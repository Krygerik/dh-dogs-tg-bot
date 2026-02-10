'use strict';

const MODULE_NAME = 'DreadHungerServer-Win64-Shipping.exe';
const base = Module.findBaseAddress(MODULE_NAME);

if (base === null) {
  throw new Error(`Failed to find base address of ${MODULE_NAME}`);
}

const OFFSETS = {
  GWorld: 0x46ed420,
  GameModeAuthority: 0x118,
  GameStateFromGameMode: 0x280,
  PlayerArray: 0x238,
  PlayerId: 0x224,
  PlayerName: 0x300,
  PlayerPawn: 0x280,
  SpellManager: 0x488,
  SpellChargeLevel: 0x284,
  InventoryManager: 0x808,
  InventoryStored: 0x138,
  InventoryType: 0x290,
  InventoryCount: 0x8b0,
  RepMovement: 0x60,
  RepMovementLocation: 0x18,
  CharacterHealth: 0x94c,
  HumanHunger: 0x2683,
  HumanWarmth: 0x2686,
  HumanTemperature: 0x2693,
  PlayerStateIsDead: 0x570,
  PlayerStateIsThrall: 0x572,
  PlayerStateCannibalLevel: 0x588,
  PlayerStateSelectedRole: 0x590,
  RoleNameFString: 0x48,
  PlayerStateRealPawn: 0x638,
  HumanDefaultHuman: 0x9a8,
  HumanDHPlayerController: 0xa08,
  HumanLastDHPlayerState: 0xc40,
  ControllerPlayer: 0x298,
  ControllerCheatManager: 0x338,
  PlayerStateScoreboardDataAsset: 0x340,
  PlayerStateSpellManager: 0x488,
  GameTimePerHour: 0x2c0,
  BaseTemperature: 0x2d0,
  WhiteoutTemperatureModifier: 0x2d4,
  BlizzardIntensity: 0x2f4,
  CurrentTimeOfDay: 0x348,
  CurrentDate: 0x350,
  DaysUntilBlizzard: 0x484,
  MatchStartTime: 0x518,
  WinningTeam: 0x51c,
  TotemDrainCount: 0x538,
  HasCustomLobbySettings: 0x41d,
  ShipHasArrived: 0x3d0,
};

const InventoryTypeNames = {
  0: 'UNDEFINED',
  1: 'STICK',
  2: 'STONE',
  3: 'GUNPOWDER',
  4: 'LEADINGOT',
  5: 'IRONINGOT',
  6: 'WHETSTONE',
  7: 'COAL',
  8: 'WOLFPELT',
  9: 'BLUBBER',
  10: 'SINEW',
  11: 'BONE',
  12: 'TRUTHPLANT',
  13: 'HUMANBODYPART',
  14: 'ANIMALPART',
  15: 'FLINT',
  16: 'FIRE',
  17: 'CODE',
  18: 'NAILS',
  19: 'QUEST',
  20: 'RAWMEAT',
  21: 'COOKEDMEAT',
  22: 'STEW',
  23: 'TEA',
  24: 'BONEDAGGER',
  25: 'BEARTRAP',
  26: 'PISTOL',
  27: 'MUSKET',
  28: 'SWORD',
  29: 'OLDSWORD',
  30: 'CLEAVER',
  31: 'ICEAXE',
  32: 'WOODAXE',
  33: 'HARPOON',
  34: 'SHOVEL',
  35: 'FISTS',
  36: 'BOW',
  37: 'COALBARREL',
  38: 'POWDERKEG',
  39: 'NITRO',
  40: 'LAUDANUM',
  41: 'SYRINGE',
  42: 'LANTERN',
  43: 'FLINTLOCKAMMO',
  44: 'GUNPARTS',
  45: 'SKELETONKEY',
  46: 'UNIFORM',
  47: 'SPYGLASS',
  48: 'POISON',
  49: 'ANTIDOTE',
  50: 'HERBS',
  51: 'CAPTAINKEY',
  52: 'ARROWS',
  53: 'PHONOGRAPH',
};

const GameState_GetTimeOfDay = new NativeFunction(base.add(0xec1730), 'float', ['pointer'], 'win64');
const GameState_SetTimeOfDay = new NativeFunction(base.add(0xec22f0), 'void', ['pointer', 'float', 'bool'], 'win64');

const PlayerState_IsThrall = new NativeFunction(base.add(0xef2aa0), 'uint8', ['pointer'], 'win64');
const PlayerState_GetPlayerRole = new NativeFunction(base.add(0xef26b0), 'int32', ['pointer'], 'win64');
const PlayerState_OnRep_IsThrall = new NativeFunction(base.add(0xef2e10), 'void', ['pointer'], 'win64');
const PlayerState_OnRep_CannibalLevel = new NativeFunction(base.add(0xef2d50), 'void', ['pointer'], 'win64');

const ADH_PlayerState_SetPlayerRole = new NativeFunction(base.add(0xe4f390), 'void', ['pointer', 'pointer'], 'win64');
const UDH_PlayerRoleData_FindByType = new NativeFunction(
  base.add(0xe33300),
  'pointer',
  ['int8', 'pointer'],
  'win64'
);

const PlayerController_SetPlayerRole = new NativeFunction(base.add(0xeeb670), 'void', ['pointer', 'pointer'], 'win64');
const PlayerController_SetPlayerRole_Simulated = new NativeFunction(
  base.add(0xeeb700),
  'void',
  ['pointer', 'pointer'],
  'win64'
);
const PlayerController_ClientSetPlayerRole = new NativeFunction(
  base.add(0xee91c0),
  'void',
  ['pointer', 'pointer'],
  'win64'
);

const ADH_Inventory_DecreaseItemStack = new NativeFunction(
  base.add(0xecc9a0),
  'void',
  ['pointer', 'int32', 'bool', 'bool'],
  'win64'
);
const ADH_Inventory_GetCurrentStackCount = new NativeFunction(
  base.add(0xeccce0),
  'int32',
  ['pointer', 'bool'],
  'win64'
);

const Character_GetCurrentHealth = new NativeFunction(base.add(0xea2db0), 'float', ['pointer'], 'win64');
const Character_GetCurrentHealthState = new NativeFunction(base.add(0xea2dd0), 'uint8', ['pointer'], 'win64');

const Human_GetCurrentHunger = new NativeFunction(base.add(0xec5ef0), 'float', ['pointer'], 'win64');
const Human_GetCurrentWarmth = new NativeFunction(base.add(0xec6000), 'float', ['pointer'], 'win64');
const Human_GetCurrentTemperature = new NativeFunction(base.add(0xec5fe0), 'float', ['pointer'], 'win64');
const Human_SetCurrentWarmth = new NativeFunction(base.add(0xec7580), 'void', ['pointer', 'float'], 'win64');
const Human_SetCurrentHunger = new NativeFunction(base.add(0xec7500), 'void', ['pointer', 'float'], 'win64');

const UClass_GetPrivateStaticClass = new NativeFunction(base.add(0x11f02e0), 'pointer', [], 'win64');
const UDH_InventoryManager_AddInventory = new NativeFunction(
  base.add(0xdbc040),
  'void',
  ['pointer', 'pointer', 'pointer', 'pointer', 'pointer', 'int8', 'pointer'],
  'win64'
);
const StaticFindObject = new NativeFunction(base.add(0x137aaa0), 'pointer', ['pointer', 'pointer', 'pointer', 'int8'], 'win64');

const config = {
  sessionPort: 0,
  sampleMs: 1000,
  includeHumanDump: true,
  dumpEveryMs: 60000,
};

const humanDumpedAt = new Map();
const humanDumpCache = new Map();
const defaultHumanDumpCache = new Map();
const controllerDumpCache = new Map();
const controllerPlayerDumpCache = new Map();
const controllerCheatDumpCache = new Map();
const spellManagerDumpCache = new Map();
const scoreboardDataDumpCache = new Map();
const playerStateDumpCache = new Map();
const lastPlayerStateDumpCache = new Map();
const HUMAN_STRUCT_SIZE = 0x12c0;
const CONTROLLER_STRUCT_SIZE = 0x570;
const PLAYER_STRUCT_SIZE = 0x48;
const CHEAT_MANAGER_STRUCT_SIZE = 0x78;
const PLAYER_STATE_STRUCT_SIZE = 0x6c8;
const SPELL_MANAGER_STRUCT_SIZE = 0x2b8;
const SCOREBOARD_DATA_STRUCT_SIZE = 0x100;

function shouldDumpHuman(playerId) {
  if (!config.includeHumanDump) return false;
  const now = Date.now();
  const last = humanDumpedAt.get(playerId) ?? 0;
  if (now - last < config.dumpEveryMs) return false;
  humanDumpedAt.set(playerId, now);
  return true;
}

function buildHumanDump(humanPtr) {
  const dump = [];
  try {
    for (let offset = 0; offset < HUMAN_STRUCT_SIZE; offset += 4) {
      const ptr = humanPtr.add(offset);
      const u32 = ptr.readU32();
      const f32 = ptr.readFloat();
      const u8 = ptr.readU8();
      dump.push({ offset, u32, f32, u8 });
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return {
    ok: true,
    base: humanPtr.toString(),
    size: HUMAN_STRUCT_SIZE,
    items: dump,
  };
}

function buildControllerDump(controllerPtr) {
  const dump = [];
  try {
    for (let offset = 0; offset < CONTROLLER_STRUCT_SIZE; offset += 4) {
      const ptr = controllerPtr.add(offset);
      const u32 = ptr.readU32();
      const f32 = ptr.readFloat();
      const u8 = ptr.readU8();
      dump.push({ offset, u32, f32, u8 });
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return {
    ok: true,
    base: controllerPtr.toString(),
    size: CONTROLLER_STRUCT_SIZE,
    items: dump,
  };
}

function buildPlayerDump(playerPtr) {
  const dump = [];
  try {
    for (let offset = 0; offset < PLAYER_STRUCT_SIZE; offset += 4) {
      const ptr = playerPtr.add(offset);
      const u32 = ptr.readU32();
      const f32 = ptr.readFloat();
      const u8 = ptr.readU8();
      dump.push({ offset, u32, f32, u8 });
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return {
    ok: true,
    base: playerPtr.toString(),
    size: PLAYER_STRUCT_SIZE,
    items: dump,
  };
}

function buildCheatManagerDump(cheatPtr) {
  const dump = [];
  try {
    for (let offset = 0; offset < CHEAT_MANAGER_STRUCT_SIZE; offset += 4) {
      const ptr = cheatPtr.add(offset);
      const u32 = ptr.readU32();
      const f32 = ptr.readFloat();
      const u8 = ptr.readU8();
      dump.push({ offset, u32, f32, u8 });
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return {
    ok: true,
    base: cheatPtr.toString(),
    size: CHEAT_MANAGER_STRUCT_SIZE,
    items: dump,
  };
}

function buildPlayerStateDump(statePtr) {
  const dump = [];
  try {
    for (let offset = 0; offset < PLAYER_STATE_STRUCT_SIZE; offset += 4) {
      const ptr = statePtr.add(offset);
      const u32 = ptr.readU32();
      const f32 = ptr.readFloat();
      const u8 = ptr.readU8();
      dump.push({ offset, u32, f32, u8 });
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return {
    ok: true,
    base: statePtr.toString(),
    size: PLAYER_STATE_STRUCT_SIZE,
    items: dump,
  };
}

function buildSpellManagerDump(managerPtr) {
  const dump = [];
  try {
    for (let offset = 0; offset < SPELL_MANAGER_STRUCT_SIZE; offset += 4) {
      const ptr = managerPtr.add(offset);
      const u32 = ptr.readU32();
      const f32 = ptr.readFloat();
      const u8 = ptr.readU8();
      dump.push({ offset, u32, f32, u8 });
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return {
    ok: true,
    base: managerPtr.toString(),
    size: SPELL_MANAGER_STRUCT_SIZE,
    items: dump,
  };
}

function buildScoreboardDataDump(dataPtr) {
  const dump = [];
  try {
    for (let offset = 0; offset < SCOREBOARD_DATA_STRUCT_SIZE; offset += 4) {
      const ptr = dataPtr.add(offset);
      const u32 = ptr.readU32();
      const f32 = ptr.readFloat();
      const u8 = ptr.readU8();
      dump.push({ offset, u32, f32, u8 });
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return {
    ok: true,
    base: dataPtr.toString(),
    size: SCOREBOARD_DATA_STRUCT_SIZE,
    items: dump,
  };
}

function getGameState() {
  try {
    const worldPtr = base.add(OFFSETS.GWorld).readPointer();
    if (worldPtr.isNull()) return null;
    const gameModePtr = worldPtr.add(OFFSETS.GameModeAuthority).readPointer();
    if (gameModePtr.isNull()) return null;
    const gameStatePtr = gameModePtr.add(OFFSETS.GameStateFromGameMode).readPointer();
    if (gameStatePtr.isNull()) return null;
    return gameStatePtr;
  } catch (e) {
    return null;
  }
}

function readFString(addr) {
  try {
    const dataPtr = addr.readPointer();
    const length = addr.add(8).readS32();
    if (length <= 0 || length > 512 || dataPtr.isNull()) return '';
    return dataPtr.readUtf16String(length);
  } catch (e) {
    return '';
  }
}

function getArraySize(arrPtr) {
  return arrPtr.add(8).readU32();
}

function getArrayItem(arrPtr, index) {
  return arrPtr.readPointer().add(index * Process.pointerSize).readPointer();
}

function getActorLocation(actorPtr) {
  try {
    const locPtr = actorPtr.add(OFFSETS.RepMovement).add(OFFSETS.RepMovementLocation);
    return {
      x: locPtr.readFloat(),
      y: locPtr.add(4).readFloat(),
      z: locPtr.add(8).readFloat(),
    };
  } catch (e) {
    return null;
  }
}

function getInventoryItems(humanPtr) {
  const items = [];
  try {
    const invManager = humanPtr.add(OFFSETS.InventoryManager).readPointer();
    if (invManager.isNull()) return items;
    const stored = invManager.add(OFFSETS.InventoryStored);
    const count = getArraySize(stored);
    for (let i = 0; i < count; i += 1) {
      const itemPtr = getArrayItem(stored, i);
      if (itemPtr.isNull()) continue;
      const typeId = itemPtr.add(OFFSETS.InventoryType).readU8();
      let amount = 1;
      try {
        amount = ADH_Inventory_GetCurrentStackCount(itemPtr, false);
      } catch (e) {}
      items.push({
        typeId,
        type: InventoryTypeNames[typeId] || `TYPE_${typeId}`,
        count: amount,
      });
    }
  } catch (e) {
    return items;
  }
  return items;
}

function getSpellCharge(playerStatePtr) {
  try {
    const spellManager = playerStatePtr.add(OFFSETS.SpellManager).readPointer();
    if (spellManager.isNull()) return null;
    return spellManager.add(OFFSETS.SpellChargeLevel).readFloat();
  } catch (e) {
    return null;
  }
}

function getHealthStateLabel(healthState) {
  if (healthState === 1) return 'dead';
  if (healthState === 2) return 'downed';
  if (healthState === 3) return 'injured';
  if (healthState === 4) return 'healthy';
  return 'unknown';
}

function readFloatSafe(ptr, fallback) {
  try {
    const value = ptr.readFloat();
    return Number.isFinite(value) ? value : fallback;
  } catch (e) {
    return fallback;
  }
}

function isReadable(ptr, bytes = 2) {
  const range = Process.findRangeByAddress(ptr);
  if (!range) return false;
  if (!range.protection.includes('r')) return false;
  return (
    ptr.compare(range.base) >= 0 &&
    ptr.add(bytes).compare(range.base.add(range.size)) <= 0
  );
}

function readSafeFString(fstrPtr) {
  try {
    if (!isReadable(fstrPtr, 16)) return null;
    const data = fstrPtr.readPointer();
    const len = fstrPtr.add(8).readU32();
    if (len === 0) return '';
    if (len < 0 || len > 128) return null;
    const bytes = len * 2;
    if (!isReadable(data, bytes)) return null;
    return data.readUtf16String(len);
  } catch (e) {
    return null;
  }
}

function normalizeFloat(value, minAbs) {
  if (value == null || !Number.isFinite(value)) return null;
  if (minAbs != null && Math.abs(value) < minAbs) return null;
  return value;
}

function validateRange(value, min, max) {
  if (value == null || !Number.isFinite(value)) return false;
  return value >= min && value <= max;
}

function resolveHumanPtr(playerState, pawnPtr) {
  if (pawnPtr && !pawnPtr.isNull()) return pawnPtr;
  try {
    const realPawn = playerState.add(OFFSETS.PlayerStateRealPawn).readPointer();
    if (realPawn && !realPawn.isNull()) return realPawn;
  } catch (e) {}
  return pawnPtr;
}

function collectState() {
  const gameState = getGameState();
  if (!gameState) {
    return { ok: false, error: 'GameState not available' };
  }

  let timeOfDay = null;
  try {
    timeOfDay = GameState_GetTimeOfDay(gameState);
  } catch (e) {
    timeOfDay = null;
  }

  let world = { timeOfDay: normalizeFloat(timeOfDay, 0.001) };
  try {
    world = {
      timeOfDay: normalizeFloat(timeOfDay, 0.001),
      gameTimePerHour: normalizeFloat(readFloatSafe(gameState.add(OFFSETS.GameTimePerHour), null), 0.001),
      baseTemperature: normalizeFloat(readFloatSafe(gameState.add(OFFSETS.BaseTemperature), null), 0.01),
      whiteoutTemperatureModifier: normalizeFloat(
        readFloatSafe(gameState.add(OFFSETS.WhiteoutTemperatureModifier), null),
        0.01
      ),
      blizzardIntensity: normalizeFloat(
        readFloatSafe(gameState.add(OFFSETS.BlizzardIntensity), null),
        0.01
      ),
      matchStartTime: normalizeFloat(readFloatSafe(gameState.add(OFFSETS.MatchStartTime), null), 0.001),
      daysUntilBlizzard: readFloatSafe(gameState.add(OFFSETS.DaysUntilBlizzard), null),
      totemDrainCount: gameState.add(OFFSETS.TotemDrainCount).readS32(),
      winningTeam: gameState.add(OFFSETS.WinningTeam).readU8(),
      hasCustomLobbySettings: gameState.add(OFFSETS.HasCustomLobbySettings).readU8() !== 0,
      shipHasArrived: gameState.add(OFFSETS.ShipHasArrived).readU8() !== 0,
    };
  } catch (e) {
    world = { timeOfDay: normalizeFloat(timeOfDay, 0.001) };
  }

  const playerArray = gameState.add(OFFSETS.PlayerArray);
  const playerCount = getArraySize(playerArray);
  const players = [];

  for (let i = 0; i < playerCount; i += 1) {
    const playerState = getArrayItem(playerArray, i);
    if (playerState.isNull()) continue;

    const playerId = playerState.add(OFFSETS.PlayerId).readU32();
    const name = readFString(playerState.add(OFFSETS.PlayerName));
    const pawn = resolveHumanPtr(playerState, playerState.add(OFFSETS.PlayerPawn).readPointer());

    let health = null;
    let hpMeta = null;
    let healthState = null;
    let hunger = null;
    let hungerMeta = null;
    let warmth = null;
    let warmthMeta = null;
    let temperature = null;
    let temperatureMeta = null;
    let location = null;
    let inventory = [];
    let role = null;
    let roleName = null;
    let traitor = null;
    let mana = null;
    let isDead = null;

    if (pawn && !pawn.isNull()) {
      try {
        health = Character_GetCurrentHealth(pawn);
        hpMeta = { value: health, source: 'native', type: 'float' };
        healthState = Character_GetCurrentHealthState(pawn);
      } catch (e) {}
      try {
        hunger = Human_GetCurrentHunger(pawn);
        warmth = Human_GetCurrentWarmth(pawn);
        temperature = Human_GetCurrentTemperature(pawn);
        hungerMeta = { value: hunger, source: 'native', type: 'float' };
        warmthMeta = { value: warmth, source: 'native', type: 'float' };
        temperatureMeta = { value: temperature, source: 'native', type: 'float' };
      } catch (e) {}
      if (hunger == null) {
        hunger = readFloatSafe(pawn.add(OFFSETS.HumanHunger), null);
        hungerMeta = { value: hunger, source: 'offset', type: 'float' };
      }
      if (warmth == null) {
        warmth = readFloatSafe(pawn.add(OFFSETS.HumanWarmth), null);
        warmthMeta = { value: warmth, source: 'offset', type: 'float' };
      }
      if (temperature == null) {
        temperature = readFloatSafe(pawn.add(OFFSETS.HumanTemperature), null);
        temperatureMeta = { value: temperature, source: 'offset', type: 'float' };
      }
      if (health == null) {
        health = readFloatSafe(pawn.add(OFFSETS.CharacterHealth), null);
        hpMeta = { value: health, source: 'offset', type: 'float' };
      }
      location = getActorLocation(pawn);
      inventory = getInventoryItems(pawn);
    }

    let humanDump = humanDumpCache.get(playerId) ?? null;
    let defaultHumanDump = defaultHumanDumpCache.get(playerId) ?? null;
    let controllerDump = controllerDumpCache.get(playerId) ?? null;
    let controllerPlayerDump = controllerPlayerDumpCache.get(playerId) ?? null;
    let controllerCheatDump = controllerCheatDumpCache.get(playerId) ?? null;
    let spellManagerDump = spellManagerDumpCache.get(playerId) ?? null;
    let scoreboardDataDump = scoreboardDataDumpCache.get(playerId) ?? null;
    let playerStateDump = playerStateDumpCache.get(playerId) ?? null;
    let lastPlayerStateDump = lastPlayerStateDumpCache.get(playerId) ?? null;
    if (pawn && !pawn.isNull() && shouldDumpHuman(playerId)) {
      humanDump = buildHumanDump(pawn);
      humanDumpCache.set(playerId, humanDump);
      try {
        const defaultHumanPtr = pawn.add(OFFSETS.HumanDefaultHuman).readPointer();
        if (!defaultHumanPtr.isNull() && isReadable(defaultHumanPtr, 0x10)) {
          defaultHumanDump = buildHumanDump(defaultHumanPtr);
          defaultHumanDumpCache.set(playerId, defaultHumanDump);
        }
      } catch (e) {}
      try {
        const lastStatePtr = pawn.add(OFFSETS.HumanLastDHPlayerState).readPointer();
        if (!lastStatePtr.isNull() && isReadable(lastStatePtr, 0x10)) {
          lastPlayerStateDump = buildPlayerStateDump(lastStatePtr);
          lastPlayerStateDumpCache.set(playerId, lastPlayerStateDump);
        }
      } catch (e) {}
      try {
        if (playerState && !playerState.isNull() && isReadable(playerState, 0x10)) {
          playerStateDump = buildPlayerStateDump(playerState);
          playerStateDumpCache.set(playerId, playerStateDump);
          const spellPtr = playerState.add(OFFSETS.PlayerStateSpellManager).readPointer();
          if (!spellPtr.isNull() && isReadable(spellPtr, 0x10)) {
            spellManagerDump = buildSpellManagerDump(spellPtr);
            spellManagerDumpCache.set(playerId, spellManagerDump);
          }
          const scoreboardPtr = playerState
            .add(OFFSETS.PlayerStateScoreboardDataAsset)
            .readPointer();
          if (!scoreboardPtr.isNull() && isReadable(scoreboardPtr, 0x10)) {
            scoreboardDataDump = buildScoreboardDataDump(scoreboardPtr);
            scoreboardDataDumpCache.set(playerId, scoreboardDataDump);
          }
        }
      } catch (e) {}
      try {
        const controllerPtr = pawn.add(OFFSETS.HumanDHPlayerController).readPointer();
        if (!controllerPtr.isNull() && isReadable(controllerPtr, 0x10)) {
          controllerDump = buildControllerDump(controllerPtr);
          controllerDumpCache.set(playerId, controllerDump);
          try {
            const playerPtr = controllerPtr.add(OFFSETS.ControllerPlayer).readPointer();
            if (!playerPtr.isNull() && isReadable(playerPtr, 0x10)) {
              controllerPlayerDump = buildPlayerDump(playerPtr);
              controllerPlayerDumpCache.set(playerId, controllerPlayerDump);
            }
          } catch (e) {}
          try {
            const cheatPtr = controllerPtr.add(OFFSETS.ControllerCheatManager).readPointer();
            if (!cheatPtr.isNull() && isReadable(cheatPtr, 0x10)) {
              controllerCheatDump = buildCheatManagerDump(cheatPtr);
              controllerCheatDumpCache.set(playerId, controllerCheatDump);
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    const hungerValid = validateRange(hunger, 0, 500);
    const warmthValid = validateRange(warmth, 0, 500);
    const tempValid = validateRange(temperature, -200, 200);
    const hpValid = validateRange(health, 0, 2000);

    if (hungerMeta && !hungerValid) {
      hungerMeta.invalid = true;
      hunger = null;
    }
    if (warmthMeta && !warmthValid) {
      warmthMeta.invalid = true;
      warmth = null;
    }
    if (temperatureMeta && !tempValid) {
      temperatureMeta.invalid = true;
      temperature = null;
    }
    if (hpMeta && !hpValid) {
      hpMeta.invalid = true;
      health = null;
    }

    let cannibalLevel = null;
    try {
      role = PlayerState_GetPlayerRole(playerState);
    } catch (e) {}
    try {
      const roleObj = playerState.add(OFFSETS.PlayerStateSelectedRole).readPointer();
      if (!roleObj.isNull() && isReadable(roleObj, 0x60)) {
        roleName = readSafeFString(roleObj.add(OFFSETS.RoleNameFString));
      }
    } catch (e) {}
    try {
      const traitorFlag = PlayerState_IsThrall(playerState) !== 0;
      cannibalLevel = readFloatSafe(playerState.add(OFFSETS.PlayerStateCannibalLevel), null);
      traitor = traitorFlag || (cannibalLevel != null && cannibalLevel > 0.01);
    } catch (e) {}
    if (traitor == null) {
      const traitorFlag = playerState.add(OFFSETS.PlayerStateIsThrall).readU8() !== 0;
      cannibalLevel = readFloatSafe(playerState.add(OFFSETS.PlayerStateCannibalLevel), null);
      traitor = traitorFlag || (cannibalLevel != null && cannibalLevel > 0.01);
    }
    try {
      isDead = playerState.add(OFFSETS.PlayerStateIsDead).readU8() !== 0;
    } catch (e) {}
    mana = getSpellCharge(playerState);

    players.push({
      playerId,
      name,
      role,
      roleName,
      traitor,
      hp: normalizeFloat(health, 0.01),
      hpMeta,
      healthState,
      status: getHealthStateLabel(healthState),
      hunger: normalizeFloat(hunger, 0.01),
      hungerMeta,
      warmth: normalizeFloat(warmth, 0.01),
      warmthMeta,
      cold: normalizeFloat(temperature, 0.01),
      coldMeta: temperatureMeta,
      isDead,
      humanDump,
      defaultHumanDump,
      controllerDump,
      controllerPlayerDump,
      controllerCheatDump,
      spellManagerDump,
      scoreboardDataDump,
      playerStateDump,
      lastPlayerStateDump,
      mana,
      pos: location,
      inventory,
    });
  }

  return {
    ok: true,
    sessionPort: config.sessionPort,
    world,
    players,
  };
}

function sendTelemetry() {
  try {
    const payload = collectState();
    send({ type: 'telemetry', data: payload });
  } catch (e) {
    send({ type: 'telemetry', data: { ok: false, error: e.message } });
  }
}

function findPlayerById(playerId) {
  const gameState = getGameState();
  if (!gameState) return null;
  const playerArray = gameState.add(OFFSETS.PlayerArray);
  const playerCount = getArraySize(playerArray);
  for (let i = 0; i < playerCount; i += 1) {
    const playerState = getArrayItem(playerArray, i);
    if (playerState.isNull()) continue;
    const id = playerState.add(OFFSETS.PlayerId).readU32();
    if (id === playerId) {
      return playerState;
    }
  }
  return null;
}

function findPlayerByName(name) {
  const gameState = getGameState();
  if (!gameState) return null;
  const playerArray = gameState.add(OFFSETS.PlayerArray);
  const playerCount = getArraySize(playerArray);
  for (let i = 0; i < playerCount; i += 1) {
    const playerState = getArrayItem(playerArray, i);
    if (playerState.isNull()) continue;
    const playerName = readFString(playerState.add(OFFSETS.PlayerName));
    if (playerName && playerName.toLowerCase() === name.toLowerCase()) {
      return playerState;
    }
  }
  return null;
}

function findClassByName(name) {
  const buffer = Memory.alloc((name.length + 1) * 2);
  buffer.writeUtf16String(name);
  return StaticFindObject(UClass_GetPrivateStaticClass(), ptr(0xffffffffffffffff), buffer, 0);
}

function addItemToPlayer(humanPtr, itemClassPath, amount) {
  const inventoryComponent = humanPtr.add(OFFSETS.InventoryManager).readPointer();
  if (inventoryComponent.isNull()) {
    return false;
  }
  const itemClass = findClassByName(itemClassPath);
  if (itemClass.isNull()) {
    return false;
  }
  const array = Memory.alloc(16 + 56);
  array.writePointer(array.add(16));
  array.add(8).writeU32(1);
  array.add(12).writeU32(1);
  const count = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1;
  const buffer = Memory.alloc(8);
  buffer.writeU32(0);
  buffer.add(4).writeU32(0xffffffff);

  for (let i = 0; i < count; i += 1) {
    array.readPointer().writeU32(Math.floor(Math.random() * 65535));
    array.readPointer().add(4).writeU8(1);
    array.readPointer().add(8).writeFloat(1.0);
    UDH_InventoryManager_AddInventory(
      inventoryComponent,
      itemClass,
      array,
      buffer,
      buffer.add(4),
      0,
      ptr(0)
    );
  }

  return true;
}

function removeItemFromPlayer(humanPtr, itemPath, amount) {
  try {
    const invManager = humanPtr.add(OFFSETS.InventoryManager).readPointer();
    if (invManager.isNull()) return false;
    const stored = invManager.add(OFFSETS.InventoryStored);
    const count = getArraySize(stored);
    for (let i = 0; i < count; i += 1) {
      const itemPtr = getArrayItem(stored, i);
      if (itemPtr.isNull()) continue;
      const itemClass = itemPtr.add(OFFSETS.InventoryType).readPointer();
      if (itemClass.isNull()) continue;
      const itemClassPath = readFString(itemClass.add(OFFSETS.InventoryType));
      if (itemClassPath !== itemPath) continue;
      const toRemove = amount == null ? 1 : Math.max(1, Math.floor(amount));
      try {
        ADH_Inventory_DecreaseItemStack(itemPtr, toRemove, true, false);
      } catch (e) {
        return false;
      }
      return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}

function handleCommand(command) {
  if (!command || typeof command !== 'object') {
    return { ok: false, error: 'Invalid command' };
  }

  if (command.op === 'set_time_of_day') {
    const gameState = getGameState();
    if (!gameState) return { ok: false, error: 'GameState not available' };
    const timeValue = Number(command.params?.time);
    if (Number.isNaN(timeValue)) return { ok: false, error: 'Invalid time value' };
    GameState_SetTimeOfDay(gameState, timeValue, true);
    return { ok: true };
  }

  if (command.op === 'set_player_state') {
    const playerId = command.params?.playerId;
    const playerName = command.params?.playerName;
    const playerState = Number.isInteger(playerId)
      ? findPlayerById(playerId)
      : typeof playerName === 'string'
        ? findPlayerByName(playerName)
        : null;
    if (!playerState) return { ok: false, error: 'Player not found' };
    if (!isReadable(playerState, 0x700)) {
      return { ok: false, error: 'PlayerState not readable' };
    }
    const pawn = resolveHumanPtr(playerState, playerState.add(OFFSETS.PlayerPawn).readPointer());
    if (!pawn || pawn.isNull()) return { ok: false, error: 'Pawn not found' };

    if (command.params?.hp != null) {
      try {
        pawn.add(OFFSETS.CharacterHealth).writeFloat(Number(command.params.hp));
      } catch (e) {}
    }
    if (command.params?.hunger != null) {
      const raw = Number(command.params.hunger);
      const scaled = raw <= 1.5 ? raw * 100 : raw;
      try {
        Human_SetCurrentHunger(pawn, scaled);
      } catch (e) {}
      try {
        pawn.add(OFFSETS.HumanHunger).writeFloat(raw);
      } catch (e) {}
    }
    if (command.params?.warmth != null) {
      const raw = Number(command.params.warmth);
      const scaled = raw <= 1.5 ? raw * 100 : raw;
      try {
        Human_SetCurrentWarmth(pawn, scaled);
      } catch (e) {}
      try {
        pawn.add(OFFSETS.HumanWarmth).writeFloat(raw);
      } catch (e) {}
    } else if (command.params?.cold != null) {
      const raw = Number(command.params.cold);
      const scaled = raw <= 1.5 ? raw * 100 : raw;
      try {
        Human_SetCurrentWarmth(pawn, scaled);
      } catch (e) {}
      try {
        pawn.add(OFFSETS.HumanWarmth).writeFloat(raw);
      } catch (e) {}
    }
    if (command.params?.mana != null) {
      try {
        const spellManager = playerState.add(OFFSETS.SpellManager).readPointer();
        if (!spellManager.isNull() && isReadable(spellManager, 0x300)) {
          spellManager.add(OFFSETS.SpellChargeLevel).writeFloat(Number(command.params.mana));
        }
      } catch (e) {}
    }
    if (command.params?.traitor != null) {
      try {
        const isThrall = Boolean(command.params.traitor);
        playerState.add(OFFSETS.PlayerStateIsThrall).writeU8(isThrall ? 1 : 0);
        playerState.add(OFFSETS.PlayerStateCannibalLevel).writeFloat(isThrall ? 1.0 : 0.0);
      } catch (e) {}
      try {
        PlayerState_OnRep_IsThrall(playerState);
      } catch (e) {}
      try {
        PlayerState_OnRep_CannibalLevel(playerState);
      } catch (e) {}
    }
    return { ok: true };
  }

  if (command.op === 'inventory_give_item') {
    const playerId = command.params?.playerId;
    const playerName = command.params?.playerName;
    const playerState = Number.isInteger(playerId)
      ? findPlayerById(playerId)
      : typeof playerName === 'string'
        ? findPlayerByName(playerName)
        : null;
    if (!playerState) return { ok: false, error: 'Player not found' };
    const pawn = playerState.add(OFFSETS.PlayerPawn).readPointer();
    if (pawn.isNull()) return { ok: false, error: 'Pawn not found' };
    const itemPath = command.params?.itemPath;
    if (typeof itemPath !== 'string' || !itemPath) {
      return { ok: false, error: 'itemPath is required' };
    }
    const amountRaw = command.params?.amount;
    const amount = amountRaw == null ? null : Number(amountRaw);
    const ok = addItemToPlayer(pawn, itemPath, Number.isFinite(amount) ? amount : null);
    if (!ok) return { ok: false, error: 'Failed to add item' };
    return { ok: true };
  }

  if (command.op === 'inventory_remove_item') {
    const playerId = command.params?.playerId;
    const playerName = command.params?.playerName;
    const playerState = Number.isInteger(playerId)
      ? findPlayerById(playerId)
      : typeof playerName === 'string'
        ? findPlayerByName(playerName)
        : null;
    if (!playerState) return { ok: false, error: 'Player not found' };
    const pawn = resolveHumanPtr(playerState, playerState.add(OFFSETS.PlayerPawn).readPointer());
    if (!pawn || pawn.isNull()) return { ok: false, error: 'Pawn not found' };
    const itemPath = command.params?.itemPath;
    if (typeof itemPath !== 'string' || !itemPath) {
      return { ok: false, error: 'itemPath is required' };
    }
    const amountRaw = command.params?.amount;
    const amount = amountRaw == null ? null : Number(amountRaw);
    const ok = removeItemFromPlayer(pawn, itemPath, Number.isFinite(amount) ? amount : null);
    if (!ok) return { ok: false, error: 'Failed to remove item' };
    return { ok: true };
  }

  if (command.op === 'set_player_role') {
    const playerId = command.params?.playerId;
    const playerName = command.params?.playerName;
    const playerState = Number.isInteger(playerId)
      ? findPlayerById(playerId)
      : typeof playerName === 'string'
        ? findPlayerByName(playerName)
        : null;
    if (!playerState) return { ok: false, error: 'Player not found' };
    const pawn = resolveHumanPtr(playerState, playerState.add(OFFSETS.PlayerPawn).readPointer());
    if (!pawn || pawn.isNull()) return { ok: false, error: 'Pawn not found' };
    const rolePath = command.params?.rolePath;
    const roleType = Number(command.params?.roleType);
    if ((typeof rolePath !== 'string' || !rolePath) && !Number.isFinite(roleType)) {
      return { ok: false, error: 'rolePath or roleType is required' };
    }
    let roleObj = ptr(0);
    if (Number.isFinite(roleType)) {
      try {
        roleObj = UDH_PlayerRoleData_FindByType(roleType, playerState);
      } catch (e) {}
      if (!roleObj.isNull()) {
        try {
          ADH_PlayerState_SetPlayerRole(playerState, roleObj);
        } catch (e) {}
        return { ok: true };
      }
    }
    if (typeof rolePath === 'string' && rolePath) {
      const controllerPtr = pawn.add(OFFSETS.HumanDHPlayerController).readPointer();
      if (controllerPtr.isNull()) return { ok: false, error: 'Controller not found' };
      roleObj = findClassByName(rolePath);
      if (roleObj.isNull()) return { ok: false, error: 'Role asset not found' };
      try {
        PlayerController_SetPlayerRole(controllerPtr, roleObj);
      } catch (e) {}
      try {
        PlayerController_SetPlayerRole_Simulated(controllerPtr, roleObj);
      } catch (e) {}
      try {
        PlayerController_ClientSetPlayerRole(controllerPtr, roleObj);
      } catch (e) {}
      return { ok: true };
    }
    return { ok: false, error: 'Role asset not found' };
  }

  return { ok: false, error: 'Unknown op' };
}

function handleConfig(message) {
  if (!message) return;
  const payload = message.payload || message;
  if (payload.sessionPort != null) {
    config.sessionPort = Number(payload.sessionPort) || 0;
  }
  if (payload.sampleMs != null) {
    const val = Number(payload.sampleMs);
    if (!Number.isNaN(val) && val >= 250) {
      config.sampleMs = val;
    }
  }
  recv('config', handleConfig);
}

function handleCommandMessage(message) {
  const payload = message.payload || message;
  const result = handleCommand(payload);
  const commandId = payload?.commandId || null;
  send({ type: 'ack', commandId, ok: result.ok, error: result.error || null });
  recv('command', handleCommandMessage);
}

recv('config', handleConfig);
recv('command', handleCommandMessage);

send({ type: 'telemetry', data: { ok: true, status: 'telemetry_loaded' } });

setInterval(sendTelemetry, config.sampleMs);
