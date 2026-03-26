'use strict';

/**
 * Elo runtime balancer (stub): хук ADH_GameMode::OnPokerRoundEnded и fallback по ADH_GameState::Tick,
 * запрос множителей у API /stats/elo-balance через Frida send/recv. В память процесса и «внутриигровой
 * конфиг» ничего не пишем — только логи и доставка modifiers в мету сессии (elo_balance_meta).
 *
 * Соло-тест: globalThis.__DH_ELO_BALANCE_SOLO_TEST = true — при пустом ответе API подставляется
 * синтетический пресет (для проверки пайплайна), без применения в игре.
 * DH_ELO_BALANCE_DEBUG=1: подробные логи.
 *
 * OnPokerRoundEnded часто не вызывается (соло и т.д.) — fallback: MatchStartTime>0 на GameState.
 * Дубликат загрузки скрипта отсекается globalThis.__DH_ELO_BALANCE_INSTALLED.
 */

const MODULE_NAME = 'DreadHungerServer-Win64-Shipping.exe';
const base = Process.getModuleByName(MODULE_NAME).base;

if (base === null) {
  throw new Error(`elo_balance_modifiers: Failed to find base address of ${MODULE_NAME}`);
}

(function eloBalanceInstall() {
  if (globalThis.__DH_ELO_BALANCE_INSTALLED) {
    console.log('[elo_balance] duplicate script load skipped (singleton)');
    return;
  }
  globalThis.__DH_ELO_BALANCE_INSTALLED = true;

  const OFF = {
    GWorld: 0x46ed420,
    GameModeAuthority: 0x118,
    GameStateFromGameMode: 0x280,
    PlayerArray: 0x238,
    PlayerName: 0x300,
    PlayerStateIsThrall: 0x572,
    MatchStartTime: 0x518,
  };

  const RVA_ON_POKER_ROUND_ENDED = 0xeb7590;
  const RVA_GAME_STATE_TICK = 0xdad420;

  const STATS_SESSION_ID = globalThis.__DH_STATS_SESSION_ID || '';
  const SOLO_TEST = globalThis.__DH_ELO_BALANCE_SOLO_TEST === true;
  const DEBUG = globalThis.__DH_ELO_BALANCE_DEBUG === true;
  const DISABLE_FALLBACK = globalThis.__DH_ELO_BALANCE_DISABLE_FALLBACK === true;

  const DAYS_BEFORE_BLIZZARD_MIN = 2;
  const DAYS_BEFORE_BLIZZARD_MAX = 7;
  const DAY_MINUTES_MIN = 5;
  const DAY_MINUTES_MAX = 16;

  const SOLO_SYNTHETIC_PRESET = {
    coldintensity: 3,
    hungerrate: 3,
    dayminutes: DAY_MINUTES_MIN,
    daysbeforeblizzard: DAYS_BEFORE_BLIZZARD_MIN,
    predatordamage: 3,
    coalburnrate: 0.1,
  };

  let balanceApplied = false;
  let fallbackTickCounter = 0;

  function logInfo(msg) {
    const line = String(msg);
    console.log('[elo_balance] ' + line);
    try {
      send({ type: 'elo_balance_log', message: line });
    } catch (_) {}
  }

  function logDebug(msg) {
    if (!DEBUG && !SOLO_TEST) return;
    const line = String(msg);
    console.log('[elo_balance][dbg] ' + line);
    try {
      send({ type: 'elo_balance_log', message: '[dbg] ' + line });
    } catch (_) {}
  }

  function logPhase(phase, detail) {
    const line = '[phase:' + phase + '] ' + (detail !== undefined ? String(detail) : '');
    logInfo(line);
  }

  function safeReadPointer(addr) {
    try {
      const p = addr.readPointer();
      return p && !p.isNull() ? p : null;
    } catch (_) {
      return null;
    }
  }

  function readFString(addr) {
    try {
      const dataPtr = addr.readPointer();
      const length = addr.add(8).readS32();
      if (length <= 0 || length > 512 || !dataPtr || dataPtr.isNull()) return '';
      return dataPtr.readUtf16String(length) || '';
    } catch (_) {
      return '';
    }
  }

  function getGameModePtr() {
    try {
      const worldPtr = safeReadPointer(base.add(OFF.GWorld));
      if (!worldPtr) return null;
      return safeReadPointer(worldPtr.add(OFF.GameModeAuthority));
    } catch (_) {
      return null;
    }
  }

  function getGameStateFromGameMode(gameModePtr) {
    if (!gameModePtr) return null;
    return safeReadPointer(gameModePtr.add(OFF.GameStateFromGameMode));
  }

  function collectPlayers(gameStatePtr) {
    const players = [];
    try {
      const playerArray = gameStatePtr.add(OFF.PlayerArray);
      const arrayData = safeReadPointer(playerArray);
      const playerCount = playerArray.add(8).readU32();
      if (!arrayData || playerCount <= 0 || playerCount >= 64) return players;
      for (let i = 0; i < playerCount; i += 1) {
        const playerStatePtr = safeReadPointer(arrayData.add(i * 8));
        if (!playerStatePtr) continue;
        const name = readFString(playerStatePtr.add(OFF.PlayerName));
        if (!name) continue;
        const traitor = playerStatePtr.add(OFF.PlayerStateIsThrall).readU8() !== 0;
        players.push({ name, traitor });
      }
    } catch (_) {
      return players;
    }
    return players;
  }

  /** Заглушка: API вернул modifiers — в игру не применяем. */
  function applyModifiersStub(modifiers) {
    logPhase('apply_stub', 'no in-game writes; modifiers=' + JSON.stringify(modifiers || {}));
  }

  function mergeSoloSynthetic(modifiers) {
    const m = modifiers && typeof modifiers === 'object' ? { ...modifiers } : {};
    Object.assign(m, SOLO_SYNTHETIC_PRESET);
    logPhase('solo_merge', 'SOLO_TEST preset ' + JSON.stringify(SOLO_SYNTHETIC_PRESET));
    logInfo('SOLO_TEST: merged modifiers=' + JSON.stringify(m));
    return m;
  }

  function maybeScheduleBalanceFallback() {
    if (DISABLE_FALLBACK || balanceApplied) return;
    if (globalThis.__DH_ELO_FALLBACK_ARMED) return;
    fallbackTickCounter += 1;
    if (fallbackTickCounter % 90 !== 0) return;

    const gm = getGameModePtr();
    if (!gm) return;
    const gs = getGameStateFromGameMode(gm);
    if (!gs) return;
    let mst = 0;
    try {
      mst = gs.add(OFF.MatchStartTime).readFloat();
    } catch (_) {
      return;
    }
    if (!(mst > 0) || Number.isNaN(mst)) return;

    const players = collectPlayers(gs);
    if (players.length < 1) return;

    globalThis.__DH_ELO_FALLBACK_ARMED = true;
    logPhase(
      'fallback',
      'Tick: MatchStartTime=' +
        mst +
        ' players=' +
        players.length +
        ' (OnPokerRoundEnded did not fire - scheduling balance)',
    );
    const gmCopy = gm;
    setTimeout(() => {
      try {
        runBalanceForGameMode(gmCopy, 'fallback_MatchStartTime');
      } catch (e) {
        logInfo('fallback runBalance: ' + e);
      } finally {
        if (!balanceApplied) globalThis.__DH_ELO_FALLBACK_ARMED = false;
      }
    }, 0);
  }

  function runBalanceForGameMode(gameModePtr, trigger) {
    if (globalThis.__DH_ELO_BALANCE_DONE_GLOBAL === true) {
      logPhase('skip', 'balance already applied (global)');
      return;
    }
    const trig = trigger || 'OnPokerRoundEnded';
    if (balanceApplied) {
      logPhase('skip', 'balance already applied');
      logDebug('skip: balance already applied');
      return;
    }
    if (globalThis.__DH_ELO_BALANCE_RUNNING) {
      logPhase('skip', 'balance already running (concurrent)');
      return;
    }
    globalThis.__DH_ELO_BALANCE_RUNNING = true;
    try {
      logPhase('hook', trig + ' gm=' + gameModePtr + ' SOLO_TEST=' + SOLO_TEST);
      const gameStatePtr = getGameStateFromGameMode(gameModePtr);
      if (!gameStatePtr) {
        logPhase('abort', 'GameState is null');
        return;
      }
      logPhase('state', 'GameState=' + gameStatePtr);
      logDebug('GameState=' + gameStatePtr);

      const players = collectPlayers(gameStatePtr);
      logPhase('roster', players.length + ' player(s): ' + JSON.stringify(players));

      send({ type: 'elo_balance_request', players });
      logPhase('api', 'sent elo_balance_request, blocking recv()...');

      let api;
      try {
        api = recv();
      } catch (e) {
        logPhase('recv', 'FAILED: ' + e);
        return;
      }

      logPhase('recv', 'returned, payload=' + JSON.stringify(api));
      logDebug('API raw: ' + JSON.stringify(api));

      let modifiers = null;
      if (api && api.ok && api.modifiers && typeof api.modifiers === 'object') {
        modifiers = { ...api.modifiers };
        logPhase('api_ok', JSON.stringify(modifiers));
      } else {
        logPhase('api_err', String(JSON.stringify(api)));
        if (!SOLO_TEST) {
          logPhase('abort', 'API fail and SOLO_TEST off');
          return;
        }
        logPhase('solo', 'SOLO_TEST: use empty modifiers and synth');
        modifiers = {};
      }

      if (SOLO_TEST) {
        modifiers = mergeSoloSynthetic(modifiers);
      }

      logPhase('apply', 'keys=' + Object.keys(modifiers).join(','));
      applyModifiersStub(modifiers);
      balanceApplied = true;
      globalThis.__DH_ELO_BALANCE_DONE_GLOBAL = true;
      logPhase('apply_done', 'balanceApplied=true (stub)');

      if (STATS_SESSION_ID) {
        send({
          type: 'elo_balance_meta',
          sessionId: STATS_SESSION_ID,
          balancerAppliedModifiers: modifiers,
        });
        logPhase('meta', 'sent elo_balance_meta sessionId=' + STATS_SESSION_ID);
      } else {
        logPhase('meta', 'no STATS_SESSION_ID, skip balancer-meta');
        logDebug('no STATS_SESSION_ID, skip balancer-meta');
      }
    } finally {
      globalThis.__DH_ELO_BALANCE_RUNNING = false;
    }
  }

  Interceptor.attach(base.add(RVA_ON_POKER_ROUND_ENDED), {
    onEnter(args) {
      this._gameMode = args[0];
    },
    onLeave(_retval) {
      const gm = this._gameMode;
      setTimeout(() => {
        try {
          runBalanceForGameMode(gm, 'OnPokerRoundEnded');
        } catch (e) {
          logInfo('runBalanceForGameMode: ' + e);
        }
      }, 0);
    },
  });

  Interceptor.attach(base.add(RVA_GAME_STATE_TICK), {
    onLeave(_retval) {
      try {
        maybeScheduleBalanceFallback();
      } catch (e) {
        logInfo('GameState Tick fallback: ' + e);
      }
    },
  });

  logPhase(
    'init',
    'stub balancer OnPokerRoundEnded @ ' +
      base.add(RVA_ON_POKER_ROUND_ENDED) +
      ' + fallback Tick @ ' +
      base.add(RVA_GAME_STATE_TICK) +
      ' SOLO_TEST=' +
      SOLO_TEST +
      ' DEBUG=' +
      DEBUG +
      ' DISABLE_FALLBACK=' +
      DISABLE_FALLBACK,
  );
})();
