// ===== Dread Hunger — Bow-only stamina cost reducer (silent) =====
//
// Hooks ADH_Weapon::GetDamage and, on first use of the Bow instance,
// lowers ADH_Weapon::StaminaCost (this+0x908). Never increases it.

// --- CONFIG
const NEW_BOW_STAMINA_COST = 0.1; // lower than default

// --- OFFSETS / RVAs
const OFF_WEAPON_STAMINA_COST = 0x908; // float
const OFF_WEAPON_DAMAGE_TYPE  = 0x910; // sanity check area
const OFF_UOBJECT_CLASS_PTR   = 0x10;  // UObject->Class*

const RVA_ADH_Weapon_GetDamage       = 0x0F0B430;
const RVA_UClass_GetPrivateStaticCls = 0x11F02E0; // UClass::GetPrivateStaticClass
const RVA_StaticFindObject           = 0x137AAA0; // StaticFindObject

// Bow class path (adjust if your build differs)
const BOW_CLASS_PATH = "/Game/Blueprints/Inventory/Bow/BP_Bow_Inventory.BP_Bow_Inventory_C";

// --- helpers
function isReadable(ptr, bytes=8){
  try {
    const r = Process.findRangeByAddress(ptr);
    return !!r && r.protection.indexOf('r') !== -1 &&
           ptr.compare(r.base) >= 0 &&
           ptr.add(bytes).compare(r.base.add(r.size)) <= 0;
  } catch(_) { return false; }
}
function readPtrSafe(p){
  try { if (isReadable(p, 8)) return p.readPointer(); } catch(_) {}
  return ptr(0);
}
function readFloatSafe(p){
  try { if (isReadable(p, 4)) return p.readFloat(); } catch(_) {}
  return NaN;
}
function fstr(s){ const b = Memory.alloc((s.length+1)*2); b.writeUtf16String(s); return b; }

const base = Process.getModuleByName("DreadHungerServer-Win64-Shipping.exe").base;
const Fn_GetDamage = base.add(RVA_ADH_Weapon_GetDamage);
const UClass_GetPrivateStaticClass = new NativeFunction(base.add(RVA_UClass_GetPrivateStaticCls), 'pointer', []);
const StaticFindObject = new NativeFunction(base.add(RVA_StaticFindObject), 'pointer', ['pointer','pointer','pointer','int8'], 'win64');

// resolve Bow UClass*
function findObjectByName(name, clazz){ return StaticFindObject(clazz, ptr('0xFFFFFFFFFFFFFFFF'), fstr(name), 0); }
function findClassByName(name){ return findObjectByName(name, UClass_GetPrivateStaticClass()); }
const BowClass = findClassByName(BOW_CLASS_PATH);

// track already-patched weapon instances
const patched = new Set();
function alreadyPatched(obj){ return patched.has(obj.toString()); }
function markPatched(obj){ patched.add(obj.toString()); }

// minimal sanity: looks like ADH_Weapon
function looksLikeWeapon(obj){
  if (!obj || obj.isNull()) return false;
  if (!isReadable(obj, OFF_WEAPON_DAMAGE_TYPE + 8)) return false;
  const cls = readPtrSafe(obj.add(OFF_UOBJECT_CLASS_PTR));
  if (cls.isNull()) return false;
  const cost = readFloatSafe(obj.add(OFF_WEAPON_STAMINA_COST));
  if (!Number.isFinite(cost) || cost <= 0 || cost > 1000) return false;
  return true;
}

Interceptor.attach(Fn_GetDamage, {
  onEnter(args){
    const w = args[0]; // ADH_Weapon*
    if (!w || w.isNull()) return;
    if (alreadyPatched(w)) return;
    if (!looksLikeWeapon(w)) return;

    // Bow-only: require exact class match if resolved
    if (!BowClass.isNull()) {
      const cls = readPtrSafe(w.add(OFF_UOBJECT_CLASS_PTR));
      if (!cls.equals(BowClass)) return;
    }

    // Only reduce (never raise)
    const pCost = w.add(OFF_WEAPON_STAMINA_COST);
    const old   = readFloatSafe(pCost);
    if (Number.isFinite(old) && NEW_BOW_STAMINA_COST < old) {
      pCost.writeFloat(NEW_BOW_STAMINA_COST);
    }
    // Mark either way to avoid re-checking every time
    markPatched(w);
  },
  onLeave(retval){}
});
