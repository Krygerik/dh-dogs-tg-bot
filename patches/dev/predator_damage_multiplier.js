'use strict';

/**
 * Dev-only: «радикальный» режим — несколько хуков урона для отладки.
 * Для AdjustDamage: активен только H01 (impl). H02 (wrap) отключён — см. комментарий у attachAdjustLike.
 *
 * Логи: send({ type: 'predator_dmg_<id>', message }) — без console.log.
 * loader.py: type.startsWith('predator_dmg') → stdout.
 *
 * Процесс: DreadHungerServer-Win64-Shipping.exe
 */

const MODULE_NAME = 'DreadHungerServer-Win64-Shipping.exe';
const MULTIPLIER = 2.0;
const LOG_FIRST_PER_HOOK = 6;

/** Уникальный префикс в type для grep: predator_dmg_H01_ … */
const HOOK = {
  ADJUST_IMPL: 'predator_dmg_H01_adjust_damage_impl',
  ADJUST_WRAP: 'predator_dmg_H02_adjust_damage_wrap',
  HUMAN_TAKE: 'predator_dmg_H03_human_character_take_damage',
  ACTOR_TAKE: 'predator_dmg_H04_actor_take_damage',
  GAMEPLAY_APPLY: 'predator_dmg_H05_ugameplay_static_apply_damage',
  MELEE_APPLY: 'predator_dmg_H06_weapon_melee_apply_damage',
  MELEE_APPLY_IMPL: 'predator_dmg_H07_weapon_melee_apply_damage_impl',
  BOOT: 'predator_dmg_boot'
};

const RVA = {
  FNAME_GET_PLAIN_NAME_STRING: 0x11604f0,
  ACONTROLLER_K2_GET_PAWN: 0x8f9570,
  ADH_CHARACTER_ADJUST_DAMAGE_IMPL: 0xd47120,
  ADH_CHARACTER_ADJUST_DAMAGE: 0xea0720,
  ADH_HUMAN_CHARACTER_TAKE_DAMAGE: 0xd73db0,
  AACTOR_TAKE_DAMAGE: 0x22ea950,
  UGAMEPLAY_APPLY_DAMAGE: 0x2558870,
  ADH_WEAPON_MELEE_APPLY_MELEE: 0xf0a730,
  ADH_WEAPON_MELEE_APPLY_MELEE_IMPL: 0xdf6710
};

const DEBUG = globalThis.__DH_PREDATOR_DMG_DEBUG === true;

(function predatorDamageInstall() {
  if (globalThis.__DH_PREDATOR_DMG_INSTALLED) {
    try {
      send({ type: HOOK.BOOT, message: 'duplicate script load skipped' });
    } catch (_) {}
    return;
  }
  globalThis.__DH_PREDATOR_DMG_INSTALLED = true;

  const base = Process.getModuleByName(MODULE_NAME).base;
  if (!base) {
    throw new Error('[predator_dmg] Failed to find base of ' + MODULE_NAME);
  }

  const budgets = {};
  function allow(hookId, kind) {
    const key = hookId + ':' + kind;
    const n = budgets[key] || 0;
    if (n >= LOG_FIRST_PER_HOOK) return false;
    budgets[key] = n + 1;
    return true;
  }

  function slog(hookType, msg) {
    try {
      send({ type: hookType, message: String(msg) });
    } catch (_) {}
  }

  function logDbg(hookType, msg) {
    if (!DEBUG) return;
    slog(hookType, '[dbg] ' + msg);
  }

  const fnamePlain = new NativeFunction(
    base.add(RVA.FNAME_GET_PLAIN_NAME_STRING),
    'void',
    ['pointer', 'pointer'],
    'win64'
  );
  const k2GetPawn = new NativeFunction(base.add(RVA.ACONTROLLER_K2_GET_PAWN), 'pointer', ['pointer'], 'win64');

  const OFFSET_UCLASS = 0x10;

  function newFString(length) {
    const FString = Memory.alloc(16 + length * 2);
    Memory.writePointer(FString, FString.add(16));
    Memory.writeU32(FString.add(8), 0);
    Memory.writeU32(FString.add(12), length);
    return FString;
  }

  function getObjectName(uObject) {
    if (!uObject || uObject.isNull()) return '';
    try {
      const nameBuf = newFString(128);
      fnamePlain(uObject.add(0x18), nameBuf);
      const strPtr = nameBuf.readPointer();
      if (!strPtr || strPtr.isNull()) return '';
      return Memory.readUtf16String(strPtr) || '';
    } catch (_e) {
      return '';
    }
  }

  function getClassName(uObject) {
    if (!uObject || uObject.isNull()) return '';
    try {
      const uClass = uObject.add(OFFSET_UCLASS).readPointer();
      return getObjectName(uClass);
    } catch (_e) {
      return '';
    }
  }

  function isPredatorLikeActor(actor) {
    if (!actor || actor.isNull()) return false;
    const cls = getClassName(actor);
    if (!cls || cls.indexOf('BearTrap') >= 0) return false;
    return (
      cls.indexOf('Predator') >= 0 ||
      cls.indexOf('CannibalCharacter') >= 0 ||
      cls.indexOf('DH_Cannibal') >= 0 ||
      (cls.indexOf('Wolf') >= 0 &&
        cls.indexOf('Controller') < 0 &&
        cls.indexOf('WBP_') < 0 &&
        cls.indexOf('Pelt') < 0) ||
      (cls.indexOf('Bear') >= 0 && cls.indexOf('TrapView') < 0 && cls.indexOf('BearTrap') < 0)
    );
  }

  function readXmm0Float32(context) {
    try {
      const xmm = context.xmm0;
      if (!xmm) return null;
      if (typeof xmm.readFloat === 'function') return xmm.readFloat();
      const bytes = xmm.readByteArray(16);
      if (!bytes) return null;
      return new Float32Array(bytes)[0];
    } catch (_e) {
      return null;
    }
  }

  function writeXmm0Float32(context, value) {
    try {
      const xmm = context.xmm0;
      if (!xmm) return;
      if (typeof xmm.writeFloat === 'function') {
        xmm.writeFloat(value);
        return;
      }
      const tmp = Memory.alloc(16);
      Memory.writeFloat(tmp, value);
      Memory.copy(xmm, tmp, 16);
    } catch (_e) {}
  }

  function pickCauserFromArgs(args) {
    for (let i = 3; i <= 6; i++) {
      const p = args[i];
      if (isPredatorLikeActor(p)) return { ptr: p, slot: i };
    }
    return null;
  }

  function tryMulFloatPtr(ptr, hookType, tag) {
    if (!ptr || ptr.isNull()) return false;
    try {
      const d = ptr.readFloat();
      if (!(d > 0) || Number.isNaN(d)) return false;
      const next = d * MULTIPLIER;
      ptr.writeFloat(next);
      if (allow(hookType, 'mul')) {
        slog(hookType, tag + ' mul float* ' + d.toFixed(3) + ' -> ' + next.toFixed(3));
      }
      return true;
    } catch (_e) {
      return false;
    }
  }

  function tryMulXmm0(ctx, hookType, tag) {
    const d = readXmm0Float32(ctx);
    if (d === null || Number.isNaN(d) || d <= 0) {
      logDbg(hookType, tag + ' skip xmm0=' + d);
      return false;
    }
    const next = d * MULTIPLIER;
    writeXmm0Float32(ctx, next);
    if (allow(hookType, 'mul')) {
      slog(hookType, tag + ' mul xmm0 ' + d.toFixed(3) + ' -> ' + next.toFixed(3));
    }
    return true;
  }

  function attachAdjustLike(addr, hookType, tag) {
    try {
      Interceptor.attach(addr, {
        onEnter(args) {
          const damagePtr = args[1];
          const instigator = args[3];
          let victimCls = '';
          try {
            victimCls = getClassName(args[0]);
          } catch (_e) {}
          if (allow(hookType, 'trace')) {
            slog(
              hookType,
              tag + ' enter victim=' + victimCls + ' inst=' + (instigator && !instigator.isNull() ? 'ptr' : 'null')
            );
          }
          if (!damagePtr || damagePtr.isNull() || !instigator || instigator.isNull()) return;
          let pawn = null;
          try {
            pawn = k2GetPawn(instigator);
          } catch (_e) {
            return;
          }
          if (!isPredatorLikeActor(pawn)) return;
          tryMulFloatPtr(damagePtr, hookType, tag + ' predator=' + getClassName(pawn));
        }
      });
      slog(hookType, tag + ' attached @ ' + addr);
    } catch (e) {
      slog(hookType, tag + ' ATTACH FAIL: ' + e);
    }
  }

  attachAdjustLike(base.add(RVA.ADH_CHARACTER_ADJUST_DAMAGE_IMPL), HOOK.ADJUST_IMPL, 'H01');
  // H02 — ADH_Character::AdjustDamage (обёртка). Вместе с H01 даёт двойное умножение на одном событии урона; раскомментируй только если хочешь заменить H01 или тестировать wrap.
  // attachAdjustLike(base.add(RVA.ADH_CHARACTER_ADJUST_DAMAGE), HOOK.ADJUST_WRAP, 'H02');

  try {
    Interceptor.attach(base.add(RVA.ADH_HUMAN_CHARACTER_TAKE_DAMAGE), {
      onEnter(args) {
        const hit = pickCauserFromArgs(args);
        const victimCls = getClassName(args[0]);
        if (allow(HOOK.HUMAN_TAKE, 'trace')) {
          slog(HOOK.HUMAN_TAKE, 'H03 enter victim=' + victimCls + ' causerSlot=' + (hit ? hit.slot : 'none'));
        }
        if (!hit) return;
        tryMulXmm0(this.context, HOOK.HUMAN_TAKE, 'H03 causer=' + getClassName(hit.ptr));
      }
    });
    slog(HOOK.HUMAN_TAKE, 'H03 attached @ ' + base.add(RVA.ADH_HUMAN_CHARACTER_TAKE_DAMAGE));
  } catch (e) {
    slog(HOOK.HUMAN_TAKE, 'H03 ATTACH FAIL: ' + e);
  }

  try {
    Interceptor.attach(base.add(RVA.AACTOR_TAKE_DAMAGE), {
      onEnter(args) {
        const hit = pickCauserFromArgs(args);
        const victimCls = getClassName(args[0]);
        if (allow(HOOK.ACTOR_TAKE, 'trace')) {
          slog(HOOK.ACTOR_TAKE, 'H04 enter victim=' + victimCls + ' causerSlot=' + (hit ? hit.slot : 'none'));
        }
        if (!hit) return;
        tryMulXmm0(this.context, HOOK.ACTOR_TAKE, 'H04 causer=' + getClassName(hit.ptr));
      }
    });
    slog(HOOK.ACTOR_TAKE, 'H04 attached @ ' + base.add(RVA.AACTOR_TAKE_DAMAGE));
  } catch (e) {
    slog(HOOK.ACTOR_TAKE, 'H04 ATTACH FAIL: ' + e);
  }

  try {
    Interceptor.attach(base.add(RVA.UGAMEPLAY_APPLY_DAMAGE), {
      onEnter(args) {
        const causerCandidates = [args[0], args[1], args[2], args[3], args[4]];
        let predatorSlot = -1;
        let predatorName = '';
        for (let i = 0; i < causerCandidates.length; i++) {
          if (isPredatorLikeActor(causerCandidates[i])) {
            predatorSlot = i;
            predatorName = getClassName(causerCandidates[i]);
            break;
          }
        }
        if (allow(HOOK.GAMEPLAY_APPLY, 'trace')) {
          slog(
            HOOK.GAMEPLAY_APPLY,
            'H05 enter argPredSlot=' + predatorSlot + ' xmm0=' + readXmm0Float32(this.context)
          );
        }
        if (predatorSlot < 0) return;
        tryMulXmm0(this.context, HOOK.GAMEPLAY_APPLY, 'H05 predArg=' + predatorSlot + ' ' + predatorName);
      }
    });
    slog(HOOK.GAMEPLAY_APPLY, 'H05 attached @ ' + base.add(RVA.UGAMEPLAY_APPLY_DAMAGE));
  } catch (e) {
    slog(HOOK.GAMEPLAY_APPLY, 'H05 ATTACH FAIL: ' + e);
  }

  try {
    Interceptor.attach(base.add(RVA.ADH_WEAPON_MELEE_APPLY_MELEE), {
      onEnter(args) {
        const w = getClassName(args[0]);
        const d = readXmm0Float32(this.context);
        if (allow(HOOK.MELEE_APPLY, 'trace')) {
          slog(HOOK.MELEE_APPLY, 'H06 enter weapon=' + w + ' xmm0=' + d);
        }
        if (d !== null && d > 0 && !Number.isNaN(d)) {
          tryMulXmm0(this.context, HOOK.MELEE_APPLY, 'H06 melee');
        }
      }
    });
    slog(HOOK.MELEE_APPLY, 'H06 attached @ ' + base.add(RVA.ADH_WEAPON_MELEE_APPLY_MELEE));
  } catch (e) {
    slog(HOOK.MELEE_APPLY, 'H06 ATTACH FAIL: ' + e);
  }

  try {
    Interceptor.attach(base.add(RVA.ADH_WEAPON_MELEE_APPLY_MELEE_IMPL), {
      onEnter(args) {
        const w = getClassName(args[0]);
        const d = readXmm0Float32(this.context);
        if (allow(HOOK.MELEE_APPLY_IMPL, 'trace')) {
          slog(HOOK.MELEE_APPLY_IMPL, 'H07 enter weapon=' + w + ' xmm0=' + d);
        }
        if (d !== null && d > 0 && !Number.isNaN(d)) {
          tryMulXmm0(this.context, HOOK.MELEE_APPLY_IMPL, 'H07 melee_impl');
        }
      }
    });
    slog(HOOK.MELEE_APPLY_IMPL, 'H07 attached @ ' + base.add(RVA.ADH_WEAPON_MELEE_APPLY_MELEE_IMPL));
  } catch (e) {
    slog(HOOK.MELEE_APPLY_IMPL, 'H07 ATTACH FAIL: ' + e);
  }

  slog(HOOK.BOOT, 'loaded MULT=' + MULTIPLIER + ' AdjustDamage=H01 only; H03-H07 as before (H02 off)');
})();
