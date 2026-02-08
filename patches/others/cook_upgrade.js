// ===== Dread Hunger: Cook-only Safe Health Setter (silent) =====
// Hooks APawn::SetPlayerState → role == "Cook" (safe FString read)
// Validates ADH_Character layout → (optional) raises MaxHealth → sets CurrentHealth
// No logging, no send() — fully silent

// ---- CONFIG ----
const TARGET_HEALTH      = 110.0;  // desired health for Cook
const RAISE_MAX_HEALTH   = true;   // raise max before setting current?
const DESIRED_MAX_HEALTH = 110.0;  // target MaxHealth when raising

// ---- RVAs (this build) ----
const RVA_APawn_SetPlayerState = 0x2752480; // APawn::SetPlayerState(APlayerState*)

// ---- ADH_Character offsets ----
const OFF_MAX_HEALTH = 0x7E0; // float MaximumHealth
const OFF_CUR_HEALTH = 0x94C; // float CurrentHealth

// ---- PlayerState → Role (your path) ----
// ps + 0x590 -> pointer (SelectedRole?); then +0x48 -> FString (TCHAR*)
const OFF_PS_SELECTED_ROLE_PTR = 0x590;
const OFF_ROLE_FSTRING         = 0x48;
const ROLE_NAME                = "Cook";

// ---- Utils ----
function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }
function finiteInRange(f, lo, hi){ return Number.isFinite(f) && f >= lo && f <= hi; }
function isReadable(ptr, bytes=2){
  const r = Process.findRangeByAddress(ptr);
  return !!r && r.protection.includes('r') &&
         ptr.compare(r.base) >= 0 && ptr.add(bytes).compare(r.base.add(r.size)) <= 0;
}
function readSafeFString(fstrPtr){
  try {
    if (!isReadable(fstrPtr, 16)) return null;
    const data = fstrPtr.readPointer();
    const len  = fstrPtr.add(8).readU32(); // Num
    if (len === 0) return "";
    if (len < 0 || len > 128) return null;
    const bytes = len * 2;
    if (!isReadable(data, bytes)) return null;
    return data.readUtf16String(len);
  } catch { return null; }
}

// ---- Find module & hook ----
const mod = Process.enumerateModules().find(m => /DreadHungerServer.*Shipping\.exe$/i.test(m.name)) || Process.enumerateModules()[0];
const Fn_SetPlayerState = mod.base.add(RVA_APawn_SetPlayerState);

Interceptor.attach(Fn_SetPlayerState, {
  onEnter(args) {
    const self = args[0]; // expected ADH_HumanCharacter* (inherits ADH_Character)
    const ps   = args[1]; // APlayerState*
    if (self.isNull() || ps.isNull()) return;

    // Role check: Cook only
    try {
      const roleObj = ps.add(OFF_PS_SELECTED_ROLE_PTR).readPointer();
      if (roleObj.isNull() || !isReadable(roleObj, 0x60)) return;
      const roleStr = readSafeFString(roleObj.add(OFF_ROLE_FSTRING));
      if (roleStr !== ROLE_NAME) return;
    } catch { return; }

    // Validate ADH_Character layout before touching memory
    try {
      const r = Process.findRangeByAddress(self);
      if (!r || !r.protection.includes('r')) return;

      let maxH, curH;
      try { maxH = self.add(OFF_MAX_HEALTH).readFloat(); } catch {}
      try { curH = self.add(OFF_CUR_HEALTH).readFloat(); } catch {}

      if (!finiteInRange(maxH, 20, 1000)) return;
      if (!finiteInRange(curH, 0, maxH * 1.1)) return;

      // Optionally raise MaxHealth first
      if (RAISE_MAX_HEALTH) {
        const newMax = Math.max(DESIRED_MAX_HEALTH, TARGET_HEALTH, maxH);
        try { self.add(OFF_MAX_HEALTH).writeFloat(newMax); } catch {}
        try { maxH = self.add(OFF_MAX_HEALTH).readFloat(); } catch {}
      }

      // Set CurrentHealth (direct write; GC-safe)
      const target = clamp(TARGET_HEALTH, 0, maxH);
      try { self.add(OFF_CUR_HEALTH).writeFloat(target); } catch {}
    } catch { /* swallow */ }
  }
});
