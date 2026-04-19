'use strict';

/**
 * Множитель урона ближнего боя игроков: globalThis.__DH_PLAYER_MELEE_DAMAGE_MULT (elo-balance playermeleedamage).
 * ADH_Character::AdjustDamage — только урон от игрока-человека, не хищник; исключаем очевидное огнестрельное/луковое.
 */

function installPlayerMeleeDamageHooks(base) {
  if (globalThis.__DH_PLAYER_MELEE_DMG_INSTALLED) {
    return;
  }
  globalThis.__DH_PLAYER_MELEE_DMG_INSTALLED = true;

  if (!base) {
    throw new Error('[player_melee_dmg] installPlayerMeleeDamageHooks: base is null');
  }

  function effectiveMult() {
    const v = globalThis.__DH_PLAYER_MELEE_DAMAGE_MULT;
    if (typeof v === 'number' && v > 0 && Number.isFinite(v)) return v;
    return 1;
  }

  const RVA = {
    FNAME_GET_PLAIN_NAME_STRING: 0x11604f0,
    ACONTROLLER_K2_GET_PAWN: 0x8f9570,
    ADH_CHARACTER_ADJUST_DAMAGE_IMPL: 0xd47120,
  };

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

  function isPredatorLikePawn(actor) {
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

  function isHumanPlayerPawn(actor) {
    if (!actor || actor.isNull()) return false;
    const cls = getClassName(actor);
    if (!cls) return false;
    if (cls.indexOf('WBP_') >= 0) return false;
    return cls.indexOf('HumanCharacter') >= 0 || cls.indexOf('DH_HumanCharacter') >= 0;
  }

  /** Очевидное дальнобойное оружие / снаряд — не трогаем. */
  function isRangedWeaponOrProjectile(actor) {
    if (!actor || actor.isNull()) return false;
    const c = getClassName(actor);
    if (!c) return false;
    const u = c.toLowerCase();
    if (u.indexOf('projectile') >= 0) return true;
    if (u.indexOf('gun') >= 0 && u.indexOf('flung') < 0) return true;
    if (u.indexOf('musket') >= 0 || u.indexOf('flintlock') >= 0 || u.indexOf('rifle') >= 0) return true;
    if (u.indexOf('pistol') >= 0 || u.indexOf('powder') >= 0) return true;
    if (u.indexOf('bow') >= 0 && u.indexOf('elbow') < 0) return true;
    if (u.indexOf('harpoon') >= 0 && u.indexOf('gun') >= 0) return true;
    return false;
  }

  try {
    Interceptor.attach(base.add(RVA.ADH_CHARACTER_ADJUST_DAMAGE_IMPL), {
      onEnter(args) {
        const damagePtr = args[1];
        const instigator = args[3];
        const damageCauser = args[4];
        if (!damagePtr || damagePtr.isNull() || !instigator || instigator.isNull()) {
          return;
        }
        let pawn = null;
        try {
          pawn = k2GetPawn(instigator);
        } catch (_e) {
          return;
        }
        if (!pawn || !isHumanPlayerPawn(pawn) || isPredatorLikePawn(pawn)) {
          return;
        }
        if (damageCauser && !damageCauser.isNull() && isRangedWeaponOrProjectile(damageCauser)) {
          return;
        }
        try {
          const d = damagePtr.readFloat();
          if (!(d > 0) || Number.isNaN(d)) return;
          const m = effectiveMult();
          if (Math.abs(m - 1) < 1e-6) return;
          damagePtr.writeFloat(d * m);
        } catch (_e) {}
      },
    });
  } catch (_e) {}
}
