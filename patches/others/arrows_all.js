// ===== Dread Hunger — generic 2→3 booster for small stacks (SILENT) =====

const base = Process.getModuleByName("DreadHungerServer-Win64-Shipping.exe").base;
const RVA_AddInventory = 0x0DBC040; // UDH_InventoryManager::AddInventory

const AddInventory = new NativeFunction(base.add(RVA_AddInventory), 'void',
  ['pointer','pointer','pointer','pointer','pointer','int8','pointer'], 'win64');

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

const windows = new Map(); // key = inv|cls -> {count, until, boosted}
const WINDOW_MS = 500;
let reentry = false;

Interceptor.attach(base.add(RVA_AddInventory), {
  onEnter(args){
    this.inv = args[0];
    this.cls = args[1];
    this.arr = args[2];
    this.doBoost = false;

    if (reentry) return;

    const { num } = getNumMax(this.arr);

    // Case A: both items come in one call
    if (num === 2) {
      this.doBoost = true;
      return;
    }

    // Case B: two single adds within a short window
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
    try {
      reentry = true;
      const extraArr = makeSingleItemArray();
      const outPair  = makeOutPair();
      AddInventory(this.inv, this.cls, extraArr, outPair, outPair.add(4), 0, ptr(0));
    } finally {
      reentry = false;
    }
  }
});
