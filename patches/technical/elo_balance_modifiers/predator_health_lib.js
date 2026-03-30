'use strict';

/**
 * Множитель HP хищников: globalThis.__DH_PREDATOR_HP_MULT (из elo_balance, шаг 0.25).
 * Dedicated server: без Blueprint exec — один раз на актёра пишем MaximumHealth/CurrentHealth
 * (ADH_Character: 0x7e0 / 0x94c по DreadHunger_classes.h) при первом ModifyHealth/SetCurrentHealth.
 */

function installPredatorHealthHooks(base) {
  if (globalThis.__DH_PREDATOR_HP_INSTALLED) {
    return;
  }
  globalThis.__DH_PREDATOR_HP_INSTALLED = true;
  if (!base) {
    throw new Error('[predator_hp] installPredatorHealthHooks: base is null');
  }

  const RVA = {
    FNAME_GET_PLAIN_NAME_STRING: 0x11604f0,
    MODIFY_HEALTH: 0xd5dd80,
    SET_CURRENT_HEALTH: 0xd6e5c0,
  };
  const OFF = { MAX_HP: 0x7e0, CUR_HP: 0x94c };
  const OFFSET_UCLASS = 0x10;

  const fnamePlain = new NativeFunction(
    base.add(RVA.FNAME_GET_PLAIN_NAME_STRING),
    'void',
    ['pointer', 'pointer'],
    'win64'
  );

  function effectiveMult() {
    const v = globalThis.__DH_PREDATOR_HP_MULT;
    if (typeof v === 'number' && v > 0 && Number.isFinite(v)) return v;
    return 1;
  }

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
      return getObjectName(uObject.add(OFFSET_UCLASS).readPointer());
    } catch (_e) {
      return '';
    }
  }

  function isPredatorLikeActor(actor) {
    if (!actor || actor.isNull()) return false;
    const cls = getClassName(actor);
    if (!cls) return false;
    if (cls.indexOf('BearTrap') >= 0) return false;
    if (cls.indexOf('Prey') >= 0) return false;
    if (cls.indexOf('HumanCharacter') >= 0 && cls.indexOf('Cannibal') < 0) return false;
    return (
      cls.indexOf('Predator') >= 0 ||
      cls.indexOf('CannibalCharacter') >= 0 ||
      cls.indexOf('DH_Cannibal') >= 0 ||
      cls.indexOf('AnimalCharacter') >= 0 ||
      (cls.indexOf('Wolf') >= 0 &&
        cls.indexOf('Controller') < 0 &&
        cls.indexOf('WBP_') < 0 &&
        cls.indexOf('Pelt') < 0) ||
      (cls.indexOf('Bear') >= 0 && cls.indexOf('TrapView') < 0 && cls.indexOf('BearTrap') < 0)
    );
  }

  function hpSend(hookId, message) {
    try {
      send({ type: 'predator_hp_log', hook: hookId, message: String(message) });
    } catch (_e) {}
  }

  const scaledOnce = new Set();

  function scaleMemoryOnce(actor, hookName) {
    if (!actor || actor.isNull() || !isPredatorLikeActor(actor)) return;
    const m = effectiveMult();
    if (Math.abs(m - 1) < 1e-6) return;
    const key = actor.toString();
    if (scaledOnce.has(key)) return;
    try {
      const maxPtr = actor.add(OFF.MAX_HP);
      const curPtr = actor.add(OFF.CUR_HP);
      const maxH = maxPtr.readFloat();
      const curH = curPtr.readFloat();
      if (!Number.isFinite(maxH) || maxH <= 0 || maxH > 1e7) return;
      if (!Number.isFinite(curH) || curH < 0 || curH > 1e7) return;
      const max2 = maxH * m;
      const cur2 = curH * m;
      maxPtr.writeFloat(max2);
      curPtr.writeFloat(cur2);
      scaledOnce.add(key);
      hpSend(
        'memScaleOnce',
        hookName +
          ' cls=' +
          getClassName(actor) +
          ' max ' +
          maxH.toFixed(1) +
          '->' +
          max2.toFixed(1) +
          ' cur ' +
          curH.toFixed(1) +
          '->' +
          cur2.toFixed(1) +
          ' x' +
          m
      );
    } catch (_e) {}
  }

  function attach(name, rva, hookLabel) {
    try {
      Interceptor.attach(base.add(rva), {
        onEnter(args) {
          this._self = args[0];
        },
        onLeave() {
          try {
            scaleMemoryOnce(this._self, hookLabel);
          } catch (_e) {}
        },
      });
      hpSend(name, 'attached rva=0x' + rva.toString(16));
    } catch (e) {
      hpSend(name, 'attach FAILED: ' + e);
    }
  }

  attach('ModifyHealth', RVA.MODIFY_HEALTH, 'ModifyHealth');
  attach('SetCurrentHealth', RVA.SET_CURRENT_HEALTH, 'SetCurrentHealth');
}
