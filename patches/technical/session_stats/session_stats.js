'use strict';

// session_stats.js — технический мод для сбора финальной статистики матча.
// Инжектируется в каждый сеанс вместе с telemetry.js.
//
// Механизм: polling через GameState каждые 2 секунды.
// При обнаружении WinningTeam != 0 отправляет финальный снапшот один раз.
//
// TODO: при наличии RVA функции окончания матча заменить polling
//       на Interceptor.attach(base.add(RVA_EndMatch), ...) для мгновенной реакции.
// TODO: заполнить RVA_EndMatch после исследования дампа бинарника:
//       - Поиск строк "WinningTeam", "EndMatch", "GameOver" в DreadHungerServer-Win64-Shipping.exe
//       - MemoryAccessMonitor на gameStatePtr + 0x51c для поиска записывающей функции

const MODULE_NAME = 'DreadHungerServer-Win64-Shipping.exe';
const base = Process.getModuleByName(MODULE_NAME).base;

if (base === null) {
  throw new Error(`session_stats: Failed to find base address of ${MODULE_NAME}`);
}

// Офсеты (совпадают с telemetry.js)
const OFFSETS = {
  GWorld: 0x46ed420,
  GameModeAuthority: 0x118,
  GameStateFromGameMode: 0x280,
  PlayerArray: 0x238,
  PlayerId: 0x224,
  PlayerName: 0x300,
  PlayerPawn: 0x280,
  PlayerStateIsDead: 0x570,
  PlayerStateIsThrall: 0x572,
  PlayerStateSelectedRole: 0x590,
  RoleNameFString: 0x48,
  WinningTeam: 0x51c,
};

// Native functions (адреса из telemetry.js)
const PlayerState_GetPlayerRole = new NativeFunction(base.add(0xef26b0), 'int32', ['pointer'], 'win64');

function readFString(addr) {
  try {
    const dataPtr = addr.readPointer();
    const length = addr.add(8).readS32();
    if (length <= 0 || length > 512 || dataPtr.isNull()) return '';
    return dataPtr.readUtf16String(length);
  } catch (_) {
    return '';
  }
}

function safeReadPointer(addr) {
  try {
    const p = addr.readPointer();
    return p.isNull() ? null : p;
  } catch (_) {
    return null;
  }
}

function getGameStatePtr() {
  try {
    const GWorld = base.add(OFFSETS.GWorld);
    const worldPtr = safeReadPointer(GWorld);
    if (!worldPtr) return null;
    const gameModePtr = safeReadPointer(worldPtr.add(OFFSETS.GameModeAuthority));
    if (!gameModePtr) return null;
    return safeReadPointer(gameModePtr.add(OFFSETS.GameStateFromGameMode));
  } catch (_) {
    return null;
  }
}

function collectFinalSnapshot() {
  const gameStatePtr = getGameStatePtr();
  if (!gameStatePtr) return null;

  let winningTeam = 0;
  try {
    winningTeam = gameStatePtr.add(OFFSETS.WinningTeam).readU8();
  } catch (_) {
    winningTeam = 0;
  }

  const players = [];
  try {
    const playerArray = gameStatePtr.add(OFFSETS.PlayerArray);
    const arrayData = safeReadPointer(playerArray);
    const playerCount = playerArray.add(8).readU32();

    if (arrayData && playerCount > 0 && playerCount < 64) {
      for (let i = 0; i < playerCount; i++) {
        try {
          const playerStatePtr = safeReadPointer(arrayData.add(i * 8));
          if (!playerStatePtr) continue;

          const name = readFString(playerStatePtr.add(OFFSETS.PlayerName));
          if (!name) continue;

          const isDead = playerStatePtr.add(OFFSETS.PlayerStateIsDead).readU8() !== 0;
          const traitor = playerStatePtr.add(OFFSETS.PlayerStateIsThrall).readU8() !== 0;

          let roleName = null;
          try {
            const rolePtr = safeReadPointer(playerStatePtr.add(OFFSETS.PlayerStateSelectedRole));
            if (rolePtr) {
              roleName = readFString(rolePtr.add(OFFSETS.RoleNameFString)) || null;
            }
            if (!roleName) {
              const roleType = PlayerState_GetPlayerRole(playerStatePtr);
              if (roleType > 0) {
                roleName = String(roleType);
              }
            }
          } catch (_) {
            roleName = null;
          }

          players.push({ name, roleName, traitor, isDead });
        } catch (_) {
          // skip this player
        }
      }
    }
  } catch (_) {
    // players array not readable
  }

  return { players, winningTeam };
}

// --- Polling mechanism ---
let statsSent = false;
let pollIntervalMs = 2000;

function checkAndSend() {
  if (statsSent) return;

  const gameStatePtr = getGameStatePtr();
  if (!gameStatePtr) return;

  let winningTeam = 0;
  try {
    winningTeam = gameStatePtr.add(OFFSETS.WinningTeam).readU8();
  } catch (_) {
    return;
  }

  if (winningTeam === 0) return;

  statsSent = true;
  const snapshot = collectFinalSnapshot();
  if (snapshot) {
    send({ type: 'session_stats', data: snapshot });
  }
}

// Start polling
const pollHandle = setInterval(checkAndSend, pollIntervalMs);

// Stop polling when match has not ended after 3 hours (safety cleanup)
setTimeout(function() {
  if (!statsSent) {
    clearInterval(pollHandle);
  }
}, 3 * 60 * 60 * 1000);
