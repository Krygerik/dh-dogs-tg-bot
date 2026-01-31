// ===== Dread Hunger — 2→3 booster (ARROWS ONLY, FINAL SILENT) =====

const base = Process.getModuleByName("DreadHungerServer-Win64-Shipping.exe").base;

// --- RVAs ---
const RVA_AddInventory            = 0x0DBC040; // UDH_InventoryManager::AddInventory
const RVA_UClass_GetPrivateStatic  = 0x11F02E0; // UClass::GetPrivateStaticClass
const RVA_StaticFindObject        = 0x137AAA0; // StaticFindObject

// --- Arrow Blueprints ---
const ARROW_PATHS = [
  "/Game/Blueprints/Inventory/Bow/BP_Arrows_Inventory.BP_Arrows_Inventory_C",
];

// --- Natives ---
const AddInventory = new NativeFunction(
  base.add(RVA_AddInventory), 'void',
  ['pointer','pointer','pointer','pointer','pointer','int8','pointer'], 'win64'
);
const UClass_GetPrivateStaticClass = new NativeFunction(base.add(RVA_UClass_GetPrivateStatic), 'pointer', []);
const StaticFindObject = new NativeFunction(base.add(RVA_StaticFindObject), 'pointer',
  ['pointer','pointer','pointer','int8'], 'win64'
);

// --- Helpers ---
function fstr(s){ const b = Memory.alloc((s.length+1)*2); b.writeUtf16String(s); return b; }
function tryFindClassByName(path) {
  try {
    const ucls = UClass_GetPrivateStaticClass();
    const c1 = StaticFindObject(ucls, ptr('0xFFFFFFFFFFFFFFFF'), fstr(path), 0);
    if (c1 && !c1.isNull()) return c1;
    const c2 = StaticFindObject(ucls, ptr(0), fstr(path), 0);
    if (c2 && !c2.isNull()) return c2;
  } catch(_) {}
  return ptr(0);
}
function getNumMax(arr){ try { return { num: arr.add(8).readU32(), max: arr.add(12).readU32() }; } catch(_) { return { num:-1, max:-1 }; } }
function initItemState(p){
  p.writeU32(Math.floor(Math.random()*0xFFFFFFF));
  p.add(0x4).writeU8(1);
  p.add(0x8).writeFloat(1.0);
  p.add(0xC).writeU8(0);
  p.add(0xD).writeU8(0);
  p.add(0xE).writeU8(0);
  p.add(0x10).writePointer(ptr(0));
  p.add(0x18).writePointer(ptr(0));
  p.add(0x20).writePointer(ptr(0));
  p.add(0x28).writePointer(ptr(0));
  p.add(0x30).writePointer(ptr(0));
}
function makeSingleItemArray(){
  const arr  = Memory.alloc(16 + 56);
  const data = arr.add(16);
  arr.writePointer(data);
  arr.add(8).writeU32(1);
  arr.add(12).writeU32(1);
  initItemState(data);
  return arr;
}
function makeOutPair(){ const o = Memory.alloc(8); o.writeU32(0); o.add(4).writeU32(0xFFFFFFFF); return o; }

// --- Resolve allowed Arrow classes lazily ---
const AllowedArrowClasses = [];
function tryResolveArrowClassesOnce() {
  if (AllowedArrowClasses.length) return;
  for (const p of ARROW_PATHS) {
    const cls = tryFindClassByName(p);
    if (cls && !cls.isNull()) {
      if (!AllowedArrowClasses.some(a => a.equals(cls))) AllowedArrowClasses.push(cls);
    }
  }
}

function readMaybeName(cls) {
  if (!cls || cls.isNull()) return null;
  const tryOffs = [0x18, 0x20, 0x30, 0x40, 0x10];
  for (const off of tryOffs) {
    try {
      const p = cls.add(off).readPointer();
      if (!p || p.isNull()) continue;
      const s = p.readUtf16String();
      if (s && s.length && s.length < 200) return s;
    } catch(_) {}
  }
  return null;
}

function isArrowClass(cls){
  if (!cls || cls.isNull()) return false;
  tryResolveArrowClassesOnce();
  for (const a of AllowedArrowClasses) if (cls.equals(a)) return true;
  const nm = readMaybeName(cls);
  if (!nm) return false;
  return nm.indexOf("BP_Arrows_Inventory") !== -1 ||
         nm.indexOf("Arrow") !== -1 ||
         nm.indexOf("Arrows") !== -1;
}

// --- Reusable buffers ---
const POOL_SIZE = 32;
const pool = [];
for (let i = 0; i < POOL_SIZE; i++) pool.push({ arr: makeSingleItemArray(), out: makeOutPair() });
let poolIdx = 0;
function borrowBuffers(){
  const b = pool[poolIdx];
  poolIdx = (poolIdx + 1) % POOL_SIZE;
  b.arr.add(8).writeU32(1);
  b.arr.add(12).writeU32(1);
  return b;
}

// --- Windowed detector & housekeeping ---
const windows = new Map();
const WINDOW_MS = 500;
const SWEEP_MS = 10000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of windows) if (now > v.until) windows.delete(k);
}, SWEEP_MS);

// --- Guards ---
const invGuard = new Map();
let globalReentry = false;

// --- Hook ---
Interceptor.attach(base.add(RVA_AddInventory), {
  onEnter(args){
    this.inv = args[0];
    this.cls = args[1];
    this.arr = args[2];
    this.doBoost = false;

    if (globalReentry) return;
    if (!isArrowClass(this.cls)) return;

    const { num } = getNumMax(this.arr);
    if (num === 2) { this.doBoost = true; return; }

    if (num === 1) {
      const key = this.inv.toString() + '|' + this.cls.toString();
      const now = Date.now();
      let w = windows.get(key);
      if (!w || now > w.until) w = { count: 0, until: now + WINDOW_MS, boosted: false };
      w.count += 1;
      w.until = now + WINDOW_MS;
      if (w.count === 2 && !w.boosted) {
        w.boosted = true;
        this.doBoost = true;
      }
      windows.set(key, w);
    }
  },

  onLeave(){
    if (!this.doBoost) return;
    const invKey = this.inv ? this.inv.toString() : "null";
    if (invGuard.get(invKey)) return;
    invGuard.set(invKey, true);
    try {
      globalReentry = true;
      const { arr: extraArr, out: outPair } = borrowBuffers();
      AddInventory(this.inv, this.cls, extraArr, outPair, outPair.add(4), 0, ptr(0));
    } finally {
      globalReentry = false;
      invGuard.set(invKey, false);
    }
  }
});
