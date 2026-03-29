'use strict';

/**
 * Один путь: ADH_Character::AdjustDamage (impl) — множитель globalThis.__DH_PREDATOR_DAMAGE_MULT.
 * installPredatorDamageHooks(base) один раз после проверки base.
 */

function installPredatorDamageHooks(base) {
  if (globalThis.__DH_PREDATOR_DMG_INSTALLED) {
    return;
  }
  globalThis.__DH_PREDATOR_DMG_INSTALLED = true;

  if (!base) {
    throw new Error('[predator_dmg] installPredatorDamageHooks: base is null');
  }

  function effectiveMult() {
    const v = globalThis.__DH_PREDATOR_DAMAGE_MULT;
    if (typeof v === 'number' && v > 0 && Number.isFinite(v)) return v;
    return 1;
  }

  const RVA = {
    FNAME_GET_PLAIN_NAME_STRING: 0x11604f0,
    ACONTROLLER_K2_GET_PAWN: 0x8f9570,
    ADH_CHARACTER_ADJUST_DAMAGE_IMPL: 0xd47120
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

  try {
    Interceptor.attach(base.add(RVA.ADH_CHARACTER_ADJUST_DAMAGE_IMPL), {
      onEnter(args) {
        const damagePtr = args[1];
        const instigator = args[3];
        if (!damagePtr || damagePtr.isNull() || !instigator || instigator.isNull()) return;
        let pawn = null;
        try {
          pawn = k2GetPawn(instigator);
        } catch (_e) {
          return;
        }
        if (!isPredatorLikeActor(pawn)) return;
        try {
          const d = damagePtr.readFloat();
          if (!(d > 0) || Number.isNaN(d)) return;
          const m = effectiveMult();
          damagePtr.writeFloat(d * m);
        } catch (_e) {}
      }
    });
  } catch (_e) {}
}
