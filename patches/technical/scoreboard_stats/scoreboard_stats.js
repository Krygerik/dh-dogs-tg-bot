'use strict';

// scoreboard_stats.js — технический мод для сбора детальной статистики финального экрана.
//
// Механизм: Interceptor.attach на ADH_GameMode::ExportMatchStats (RVA 0xEB6B30).
// Вызывается самой игрой при завершении матча — мгновенно, без polling.
//
// Собирает для каждого игрока:
//   - имя, роль, команда (thrall/explorer), isDead, deathCount
//   - killerName — имя убийцы (если есть)
//   - victimCount — сколько игроков убил этот игрок
//   - cannibalLevel — уровень каннибала (для thrall)
//   - matchStats — массив FPlayerMatchStat { statType, value }
//   - prestige, rank, experience
//
// Формат отправляемого сообщения:
//   { type: 'session_stats', data: { players: [...], winningTeam: int } }
// Использует тот же тип что и session_stats.js для совместимости с loader.py / api-server.

const MODULE_NAME = 'DreadHungerServer-Win64-Shipping.exe';
const base = Process.getModuleByName(MODULE_NAME).base;

if (base === null) {
  throw new Error(`scoreboard_stats: Failed to find base address of ${MODULE_NAME}`);
}

// ---- Offsets (из dump.h / telemetry.js) ----
const OFF = {
  // GWorld -> GameMode -> GameState
  GWorld:               0x46ed420,
  GameModeAuthority:    0x118,   // UWorld -> AuthorityGameMode
  GameStatePtrInMode:   0x280,   // ADH_GameModeBase -> GameState (GameStateFromGameMode)
  GameStateDHPtr:       0x3e8,   // ADH_GameMode -> DHGameState

  // GameState
  PlayerArray:          0x238,   // TArray<APlayerState*>
  WinningTeam:          0x51c,   // uint8

  // ADH_PlayerState (base APlayerState size = 800 = 0x320)
  // APlayerState fields:
  PlayerName:           0x300,   // FString
  PlayerId:             0x224,

  // ADH_PlayerState own fields (Offset from dump.h):
  MatchStats:           0x330,   // TArray<FPlayerMatchStat>  Size: 16
  VictimIDs:            0x348,   // TArray<FUniqueNetIdRepl>  Size: 16
  KillerID:             0x358,   // FUniqueNetIdRepl           Size: 40
  CauseOfDeath:         0x380,   // UDH_DamageType*            Size: 8
  bIsDead:              0x570,   // bool
  bIsDisconnected:      0x571,   // bool
  bIsThrall:            0x572,   // bool
  CannibalLevel:        0x588,   // float
  SelectedRole:         0x590,   // UDH_PlayerRoleData*
  PrestigeLevel:        0x598,   // int32
  Auth_Experience:      0x610,   // int32
  Auth_Rank:            0x614,   // int32
  DeathCount:           0x630,   // int32

  // UDH_PlayerRoleData
  RoleNameFString:      0x48,    // FString (role display name)

  // FPlayerMatchStat — предполагаемый макет: { int32 statType, int32 value }
  // Судя по TMap<EPlayerMatchStatType, FText> StatDescriptions — enum 4 байта
  MatchStat_Type:       0x0,     // int32 EPlayerMatchStatType
  MatchStat_Value:      0x4,     // int32
  MatchStat_Size:       0x8,     // размер одной записи FPlayerMatchStat
};

// RVA функций
const RVA = {
  // ADH_GameMode::ExportMatchStats(bool bMatchGivesExperience)
  // RVA: 0000000000EB6B30  (из dump.h)
  ExportMatchStats: 0xEB6B30,

  // ADH_PlayerState::GetPlayerRole() -> enum FEPlayerTeamRole
  // RVA: 0000000000EF26B0
  GetPlayerRole: 0xEF26B0,
};

// ---- Вспомогательные функции ----

function safeRead(fn) {
  try { return fn(); } catch (_) { return null; }
}

function safeReadPointer(addr) {
  try {
    const p = addr.readPointer();
    return (p && !p.isNull()) ? p : null;
  } catch (_) { return null; }
}

function readFString(addr) {
  try {
    const dataPtr = addr.readPointer();
    const length  = addr.add(8).readS32();
    if (length <= 0 || length > 512 || !dataPtr || dataPtr.isNull()) return '';
    return dataPtr.readUtf16String(length) || '';
  } catch (_) { return ''; }
}

// TArray layout: { Data* ptr, int32 arrayNum, int32 arrayMax }
function readTArrayPointers(baseAddr) {
  try {
    const dataPtr = safeReadPointer(baseAddr);
    if (!dataPtr) return [];
    const count = baseAddr.add(8).readS32();
    if (count <= 0 || count > 128) return [];
    const result = [];
    for (let i = 0; i < count; i++) {
      const elem = safeReadPointer(dataPtr.add(i * 8));
      if (elem) result.push(elem);
    }
    return result;
  } catch (_) { return []; }
}

// Читает TArray<FPlayerMatchStat> — inline-структуры (не указатели)
function readMatchStats(arrayBaseAddr) {
  try {
    const dataPtr = safeReadPointer(arrayBaseAddr);
    if (!dataPtr) return [];
    const count = arrayBaseAddr.add(8).readS32();
    if (count <= 0 || count > 256) return [];
    const result = [];
    for (let i = 0; i < count; i++) {
      const elem = dataPtr.add(i * OFF.MatchStat_Size);
      const statType = safeRead(() => elem.add(OFF.MatchStat_Type).readS32());
      const value    = safeRead(() => elem.add(OFF.MatchStat_Value).readS32());
      if (statType !== null && value !== null) {
        result.push({ statType, value });
      }
    }
    return result;
  } catch (_) { return []; }
}

const PlayerState_GetPlayerRole = new NativeFunction(
  base.add(RVA.GetPlayerRole),
  'int32', ['pointer'], 'win64'
);

function getGameStatePtr() {
  try {
    const worldPtr = safeReadPointer(base.add(OFF.GWorld));
    if (!worldPtr) return null;
    const gameModePtr = safeReadPointer(worldPtr.add(OFF.GameModeAuthority));
    if (!gameModePtr) return null;
    return safeReadPointer(gameModePtr.add(OFF.GameStatePtrInMode));
  } catch (_) { return null; }
}

function collectSnapshot() {
  const gameStatePtr = getGameStatePtr();
  if (!gameStatePtr) return null;

  const winningTeam = safeRead(() => gameStatePtr.add(OFF.WinningTeam).readU8()) ?? 0;

  const players = [];
  const playerArray = gameStatePtr.add(OFF.PlayerArray);
  const playerStates = readTArrayPointers(playerArray);

  for (const psPtr of playerStates) {
    try {
      const name = readFString(psPtr.add(OFF.PlayerName));
      if (!name) continue;

      const isDead         = safeRead(() => psPtr.add(OFF.bIsDead).readU8()) !== 0;
      const isDisconnected = safeRead(() => psPtr.add(OFF.bIsDisconnected).readU8()) !== 0;
      const isThrall       = safeRead(() => psPtr.add(OFF.bIsThrall).readU8()) !== 0;
      const cannibalLevel  = safeRead(() => psPtr.add(OFF.CannibalLevel).readFloat()) ?? 0;
      const prestige       = safeRead(() => psPtr.add(OFF.PrestigeLevel).readS32()) ?? 0;
      const experience     = safeRead(() => psPtr.add(OFF.Auth_Experience).readS32()) ?? 0;
      const rank           = safeRead(() => psPtr.add(OFF.Auth_Rank).readS32()) ?? 0;
      const deathCount     = safeRead(() => psPtr.add(OFF.DeathCount).readS32()) ?? 0;

      // Имя роли
      let roleName = null;
      try {
        const rolePtr = safeReadPointer(psPtr.add(OFF.SelectedRole));
        if (rolePtr) {
          roleName = readFString(rolePtr.add(OFF.RoleNameFString)) || null;
        }
        if (!roleName) {
          const roleType = PlayerState_GetPlayerRole(psPtr);
          if (roleType > 0) roleName = String(roleType);
        }
      } catch (_) { roleName = null; }

      // Количество жертв (VictimIDs — TArray, считаем длину)
      const victimCount = safeRead(() => psPtr.add(OFF.VictimIDs).add(8).readS32()) ?? 0;

      // Статистика матча
      const matchStats = readMatchStats(psPtr.add(OFF.MatchStats));

      players.push({
        name,
        roleName,
        isThrall,
        isDead,
        isDisconnected,
        cannibalLevel,
        prestige,
        experience,
        rank,
        deathCount,
        victimCount: victimCount > 0 ? victimCount : 0,
        matchStats,
      });
    } catch (_) {
      // пропускаем игрока при ошибке
    }
  }

  return { players, winningTeam };
}

// ---- Перехват ExportMatchStats ----

let snapshotSent = false;

Interceptor.attach(base.add(RVA.ExportMatchStats), {
  onLeave: function(_retval) {
    if (snapshotSent) return;
    snapshotSent = true;

    try {
      const snapshot = collectSnapshot();
      if (snapshot) {
        send({ type: 'session_stats', data: snapshot });
      }
    } catch (err) {
      send({ type: 'scoreboard_stats_error', error: String(err) }); // ошибку не заглушаем
    }
  }
});

// ---- Резервный polling на случай если ExportMatchStats не сработал ----
// (например, матч завершился аномально)
let fallbackHandle = null;
let fallbackChecks = 0;
const FALLBACK_MAX_CHECKS = 3 * 60 * 30; // ~90 минут при интервале 2 с

fallbackHandle = setInterval(function() {
  if (snapshotSent) {
    clearInterval(fallbackHandle);
    return;
  }
  fallbackChecks++;
  if (fallbackChecks > FALLBACK_MAX_CHECKS) {
    clearInterval(fallbackHandle);
    return;
  }

  const gameStatePtr = getGameStatePtr();
  if (!gameStatePtr) return;
  const wt = safeRead(() => gameStatePtr.add(OFF.WinningTeam).readU8()) ?? 0;
  if (wt === 0) return;

  // Матч завершился, но ExportMatchStats не сработал
  snapshotSent = true;
  clearInterval(fallbackHandle);
  try {
    const snapshot = collectSnapshot();
    if (snapshot) {
      send({ type: 'session_stats', data: snapshot });
    }
  } catch (err) {
    send({ type: 'scoreboard_stats_error', error: String(err) }); // ошибку не заглушаем
  }
}, 2000);
