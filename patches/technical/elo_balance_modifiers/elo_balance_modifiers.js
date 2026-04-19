'use strict';

/**
 * Elo-баланс: predatordamage / predatorhealth / playermeleedamage / playerrangedamage (API /stats/elo-balance).
 * Ближний бой [0.5, 2]; дальнобой лук/пистолет/мушкет только [0.25, 1], шаг 0.25.
 * Переопределения: __DH_ELO_PLAYER_MELEE_FORCE, __DH_ELO_PLAYER_RANGED_FORCE; env — loader.py.
 * Thrall: ReceiveThrallMessage + PlayerArray, SetPlayerRole, AddStartingInventory.
 */

const MODULE_NAME = 'DreadHungerServer-Win64-Shipping.exe';
const base = Process.getModuleByName(MODULE_NAME).base;

if (base === null) {
  throw new Error(`elo_balance_modifiers: Failed to find base address of ${MODULE_NAME}`);
}

(function eloBalanceInstall() {
  if (globalThis.__DH_ELO_BALANCE_INSTALLED) {
    // console.log('[elo_balance] duplicate script load skipped (singleton)');
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
    PlayerId: 0x224,
    MatchStartTime: 0x518,
  };

  const RVA_ON_POKER_ROUND_ENDED = 0xeb7590;
  const RVA_GAME_STATE_TICK = 0xdad420;
  const RVA_PC_RECEIVE_THRALL_MESSAGE = 0xee7810;
  const RVA_UGAMEPLAYSTATICS_GET_PLAYER_CONTROLLER = 0x25630d0;
  const RVA_PLAYERSTATE_SET_PLAYER_ROLE = 0xe4f390;
  const RVA_ADD_STARTING_INVENTORY = 0xd46f10;
  const RVA_PLAYERSTATE_GET_OWNING_CONTROLLER = 0xe39820;
  const RVA_FNAME_FNAME = 0x1158f20;
  const RVA_FTEXT_FROM_NAME = 0x1096370;

  const OFF_HUMAN_CHARACTER_PLAYER_STATE = 0x240;

  const STATS_SESSION_ID = globalThis.__DH_STATS_SESSION_ID || '';
  const SOLO_TEST = globalThis.__DH_ELO_BALANCE_SOLO_TEST === true;
  // const DEBUG = globalThis.__DH_ELO_BALANCE_DEBUG === true;
  const DISABLE_FALLBACK = globalThis.__DH_ELO_BALANCE_DISABLE_FALLBACK === true;

  let balanceApplied = false;
  let fallbackTickCounter = 0;
  const balanceNoticeSentForPlayerState = new Set();

  const nativeGetPlayerController = new NativeFunction(
    base.add(RVA_UGAMEPLAYSTATICS_GET_PLAYER_CONTROLLER),
    'pointer',
    ['pointer', 'int32'],
    'win64'
  );
  const nativeReceiveThrallMessage = new NativeFunction(
    base.add(RVA_PC_RECEIVE_THRALL_MESSAGE),
    'void',
    ['pointer', 'pointer', 'pointer'],
    'win64'
  );
  const nativeGetOwningController = new NativeFunction(
    base.add(RVA_PLAYERSTATE_GET_OWNING_CONTROLLER),
    'pointer',
    ['pointer'],
    'win64'
  );

  function logLine(msg) {
    try {
      send({ type: 'elo_balance_log', message: String(msg) });
    } catch (_) {}
  }

  /*
  function logDebug(msg) {
    if (!DEBUG && !SOLO_TEST) return;
    const line = String(msg);
    console.log('[elo_balance][dbg] ' + line);
    try {
      send({ type: 'elo_balance_log', message: '[dbg] ' + line });
    } catch (_) {}
  }
  */

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

  function formatMultDisplay(m) {
    const v = Number(m);
    if (!Number.isFinite(v)) return '1';
    const r = Math.round(v * 100) / 100;
    if (Math.abs(r - Math.round(r)) < 1e-6) return String(Math.round(r));
    return r.toFixed(2).replace(/\.?0+$/, '');
  }

  /** Множитель ×1 (или не задан) — влияния на игру нет. */
  function isNeutralPredatorMult(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return true;
    return Math.abs(n - 1) < 1e-4;
  }

  function isNeutralPlayerMeleeMult(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return true;
    return Math.abs(n - 1) < 1e-4;
  }

  function isNeutralPlayerRangedMult(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return true;
    return Math.abs(n - 1) < 1e-4;
  }

  function buildFTextFromMessageLine(line) {
    const FName_FName = new NativeFunction(base.add(RVA_FNAME_FNAME), 'void', ['pointer', 'pointer', 'int8'], 'win64');
    const FText_FromName = new NativeFunction(base.add(RVA_FTEXT_FROM_NAME), 'pointer', ['pointer', 'pointer'], 'win64');
    const FName_Buffer = Memory.alloc(8);
    const Buffer = Memory.alloc((line.length + 4) * 2);
    Buffer.writeUtf16String('   ' + line);
    FName_FName(FName_Buffer, Buffer, 1);
    const FText_Buffer = Memory.alloc(24);
    FText_FromName(FText_Buffer, FName_Buffer);
    return FText_Buffer;
  }

  /** Как announcement_win64.js: PC + ReceiveThrallMessage(FText, Sound=null). */
  function sendThrallMessageToPlayerController(playerControllerPtr, fTextPtr) {
    if (!playerControllerPtr || playerControllerPtr.isNull()) return;
    try {
      nativeReceiveThrallMessage(playerControllerPtr, fTextPtr, ptr(0));
    } catch (_e) {}
  }

  /** Каждому игроку с валидным PC — по две строки (урон и здоровье), отдельные ReceiveThrallMessage. */
  function trySendPredatorNoticeToPlayerState(playerStatePtr) {
    const lines = globalThis.__DH_ELO_THRALL_NOTICE_LINES;
    if (!Array.isArray(lines) || lines.length === 0) return;
    try {
      if (!playerStatePtr || playerStatePtr.isNull()) return;
      const k = playerStatePtr.toString();
      if (balanceNoticeSentForPlayerState.has(k)) return;
      let pid = 0;
      try {
        pid = playerStatePtr.add(OFF.PlayerId).readU8();
      } catch (_e) {
        return;
      }
      const pc = nativeGetPlayerController(playerStatePtr, pid | 0);
      if (!pc || pc.isNull()) return;
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (typeof line !== 'string' || !line.length) continue;
        const ft = buildFTextFromMessageLine(line);
        sendThrallMessageToPlayerController(pc, ft);
      }
      balanceNoticeSentForPlayerState.add(k);
    } catch (_e) {}
  }

  /**
   * Этап как quest_system / get_player_coord: HumanCharacter + PlayerState@0x240 + GetOwningController → PC.
   * Дубли с trySendPredatorNoticeToPlayerState отсекаются по balanceNoticeSentForPlayerState.
   */
  function trySendPredatorNoticeFromHumanCharacter(humanCharPtr) {
    const lines = globalThis.__DH_ELO_THRALL_NOTICE_LINES;
    if (!Array.isArray(lines) || lines.length === 0) return;
    try {
      if (!humanCharPtr || humanCharPtr.isNull()) return;
      const ps = safeReadPointer(humanCharPtr.add(OFF_HUMAN_CHARACTER_PLAYER_STATE));
      if (!ps) return;
      const k = ps.toString();
      if (balanceNoticeSentForPlayerState.has(k)) return;
      const pc = nativeGetOwningController(ps);
      if (!pc || pc.isNull()) return;
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (typeof line !== 'string' || !line.length) continue;
        const ft = buildFTextFromMessageLine(line);
        sendThrallMessageToPlayerController(pc, ft);
      }
      balanceNoticeSentForPlayerState.add(k);
    } catch (_e) {}
  }

  function broadcastPredatorNoticeToAllPlayersInGameState(gameStatePtr) {
    try {
      const playerArray = gameStatePtr.add(OFF.PlayerArray);
      const arrayData = safeReadPointer(playerArray);
      const playerCount = playerArray.add(8).readU32();
      if (!arrayData || playerCount <= 0 || playerCount >= 64) return;
      for (let i = 0; i < playerCount; i += 1) {
        const ps = safeReadPointer(arrayData.add(i * 8));
        if (!ps) continue;
        trySendPredatorNoticeToPlayerState(ps);
      }
    } catch (_e) {}
  }

  /**
   * Сразу после покера на dedicated PC у части игроков ещё нет — ReceiveThrallMessage не уходит.
   * Повторяем рассылку с тем же текстом (дубликаты отсекаются по balanceNoticeSentForPlayerState).
   */
  function scheduleThrallNoticeRetries(gameModePtr) {
    const lines = globalThis.__DH_ELO_THRALL_NOTICE_LINES;
    if (!Array.isArray(lines) || lines.length === 0) return;
    const snapshot = lines.slice();
    const delaysMs = [400, 1200, 3000, 6000];
    delaysMs.forEach((ms) => {
      setTimeout(() => {
        try {
          if (!gameModePtr || gameModePtr.isNull()) return;
          const gs = getGameStateFromGameMode(gameModePtr);
          if (!gs) return;
          globalThis.__DH_ELO_THRALL_NOTICE_LINES = snapshot;
          broadcastPredatorNoticeToAllPlayersInGameState(gs);
        } catch (_e) {}
      }, ms);
    });
  }

  function setPredatorThrallNoticeAndTryDeliver(gameStatePtr, dmgMult, hpMult, meleeMult, rangedMult) {
    const lines = [];
    if (!isNeutralPredatorMult(dmgMult)) {
      lines.push(
        'В данной игре урон от хищников был изменен на ' + formatMultDisplay(dmgMult) + 'x.'
      );
    }
    if (!isNeutralPredatorMult(hpMult)) {
      lines.push('Здоровье хищников в этой игре: ' + formatMultDisplay(hpMult) + 'x.');
    }
    if (!isNeutralPlayerMeleeMult(meleeMult)) {
      lines.push(
        'Урон ближнего боя игроков в этой игре: ' + formatMultDisplay(meleeMult) + 'x.'
      );
    }
    if (!isNeutralPlayerRangedMult(rangedMult)) {
      lines.push(
        'Урон лука, пистолета и мушкета в этой игре: ' + formatMultDisplay(rangedMult) + 'x.'
      );
    }
    globalThis.__DH_ELO_THRALL_NOTICE_LINES = lines;
    broadcastPredatorNoticeToAllPlayersInGameState(gameStatePtr);
  }

  /** Сетка множителей как в API elo-balance: [0.25, 3], шаг 0.25. */
  const PRED_MULT_MIN = 0.25;
  const PRED_MULT_MAX = 3;
  const PRED_MULT_STEP = 0.25;

  function snapPredatorMult(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) {
      return 1;
    }
    const q = Math.round(n / PRED_MULT_STEP) * PRED_MULT_STEP;
    if (q < PRED_MULT_MIN) return PRED_MULT_MIN;
    if (q > PRED_MULT_MAX) return PRED_MULT_MAX;
    return q;
  }

  function applyPredatorDamageMultiplierFromModifiers(modifiers) {
    const raw = modifiers && typeof modifiers.predatordamage === 'number' ? modifiers.predatordamage : 1;
    globalThis.__DH_PREDATOR_DAMAGE_MULT = snapPredatorMult(raw);
  }

  function applyPredatorHealthMultiplierFromModifiers(modifiers) {
    const raw = modifiers && typeof modifiers.predatorhealth === 'number' ? modifiers.predatorhealth : 1;
    globalThis.__DH_PREDATOR_HP_MULT = snapPredatorMult(raw);
  }

  /** Сетка как в API: [0.5, 2], шаг 0.25 — урон ближнего боя игроков. */
  const PM_MULT_MIN = 0.5;
  const PM_MULT_MAX = 2;
  const PM_MULT_STEP = 0.25;

  function snapPlayerMeleeMult(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) {
      return 1;
    }
    const q = Math.round(n / PM_MULT_STEP) * PM_MULT_STEP;
    if (q < PM_MULT_MIN) return PM_MULT_MIN;
    if (q > PM_MULT_MAX) return PM_MULT_MAX;
    return q;
  }

  /**
   * Приоритет (каждый итог логируется отдельным source=):
   * 1) __DH_ELO_PLAYER_MELEE_FORCE — ручное переопределение в Frida;
   * 2) env из prefix (DH_ELO_PLAYER_MELEE_TEST ×2 или DH_ELO_PLAYER_MELEE_MULT);
   * 3) modifiers.playermeleedamage из API;
   * 4) ×1 по умолчанию.
   */
  function applyPlayerMeleeDamageFromModifiers(modifiers) {
    const m = modifiers && typeof modifiers === 'object' ? modifiers : {};
    let mult = 1;
    let source = 'default';

    if (
      typeof globalThis.__DH_ELO_PLAYER_MELEE_FORCE === 'number' &&
      Number.isFinite(globalThis.__DH_ELO_PLAYER_MELEE_FORCE) &&
      globalThis.__DH_ELO_PLAYER_MELEE_FORCE > 0
    ) {
      mult = snapPlayerMeleeMult(globalThis.__DH_ELO_PLAYER_MELEE_FORCE);
      source = 'global_force';
    } else if (
      typeof globalThis.__DH_ELO_PLAYER_MELEE_ENV_MULT === 'number' &&
      Number.isFinite(globalThis.__DH_ELO_PLAYER_MELEE_ENV_MULT) &&
      globalThis.__DH_ELO_PLAYER_MELEE_ENV_MULT > 0
    ) {
      mult = snapPlayerMeleeMult(globalThis.__DH_ELO_PLAYER_MELEE_ENV_MULT);
      source = String(globalThis.__DH_ELO_PLAYER_MELEE_ENV_SOURCE || 'env');
    } else if (typeof m.playermeleedamage === 'number' && Number.isFinite(m.playermeleedamage)) {
      mult = snapPlayerMeleeMult(m.playermeleedamage);
      source = 'api_elo_balance';
    }

    globalThis.__DH_PLAYER_MELEE_DAMAGE_MULT = mult;
    logLine(
      'player_melee_damage mult=' + formatMultDisplay(mult) + ' source=' + source
    );
  }

  /** Сетка [0.25, 1], шаг 0.25 — только снижение дальнобоя (лук / пистолет / мушкет). */
  const PR_MULT_MIN = 0.25;
  const PR_MULT_MAX = 1;
  const PR_MULT_STEP = 0.25;

  function snapPlayerRangedMult(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) {
      return 1;
    }
    const q = Math.round(n / PR_MULT_STEP) * PR_MULT_STEP;
    if (q < PR_MULT_MIN) return PR_MULT_MIN;
    if (q > PR_MULT_MAX) return PR_MULT_MAX;
    return q;
  }

  /**
   * Приоритет (отдельный source= в логе):
   * 1) __DH_ELO_PLAYER_RANGED_FORCE;
   * 2) env (DH_ELO_PLAYER_RANGED_TEST ×0.25 или DH_ELO_PLAYER_RANGED_MULT);
   * 3) modifiers.playerrangeddamage из API;
   * 4) ×1.
   */
  function applyPlayerRangedDamageFromModifiers(modifiers) {
    const m = modifiers && typeof modifiers === 'object' ? modifiers : {};
    let mult = 1;
    let source = 'default';

    if (
      typeof globalThis.__DH_ELO_PLAYER_RANGED_FORCE === 'number' &&
      Number.isFinite(globalThis.__DH_ELO_PLAYER_RANGED_FORCE) &&
      globalThis.__DH_ELO_PLAYER_RANGED_FORCE > 0
    ) {
      mult = snapPlayerRangedMult(globalThis.__DH_ELO_PLAYER_RANGED_FORCE);
      source = 'global_force';
    } else if (
      typeof globalThis.__DH_ELO_PLAYER_RANGED_ENV_MULT === 'number' &&
      Number.isFinite(globalThis.__DH_ELO_PLAYER_RANGED_ENV_MULT) &&
      globalThis.__DH_ELO_PLAYER_RANGED_ENV_MULT > 0
    ) {
      mult = snapPlayerRangedMult(globalThis.__DH_ELO_PLAYER_RANGED_ENV_MULT);
      source = String(globalThis.__DH_ELO_PLAYER_RANGED_ENV_SOURCE || 'env');
    } else if (typeof m.playerrangeddamage === 'number' && Number.isFinite(m.playerrangeddamage)) {
      mult = snapPlayerRangedMult(m.playerrangeddamage);
      source = 'api_elo_balance';
    }

    globalThis.__DH_PLAYER_RANGED_DAMAGE_MULT = mult;
    logLine(
      'player_ranged_damage mult=' + formatMultDisplay(mult) + ' source=' + source
    );
  }

  function applyModifiersStub(modifiers) {
    const m = modifiers || {};
    applyPredatorDamageMultiplierFromModifiers(m);
    applyPredatorHealthMultiplierFromModifiers(m);
    applyPlayerMeleeDamageFromModifiers(m);
    applyPlayerRangedDamageFromModifiers(m);
  }

  /** SOLO_TEST: без подмешивания фиксированных множителей — только ответ API. */
  function mergeSoloSynthetic(modifiers) {
    return modifiers && typeof modifiers === 'object' ? { ...modifiers } : {};
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
    const gmCopy = gm;
    setTimeout(() => {
      try {
        runBalanceForGameMode(gmCopy, 'fallback_MatchStartTime');
      } catch (e) {
        logLine('fallback runBalance: ' + e);
      } finally {
        if (!balanceApplied) globalThis.__DH_ELO_FALLBACK_ARMED = false;
      }
    }, 0);
  }

  function runBalanceForGameMode(gameModePtr, trigger) {
    if (globalThis.__DH_ELO_BALANCE_DONE_GLOBAL === true) {
      return;
    }
    if (balanceApplied) {
      return;
    }
    if (globalThis.__DH_ELO_BALANCE_RUNNING) {
      return;
    }
    globalThis.__DH_ELO_BALANCE_RUNNING = true;
    try {
      const gameStatePtr = getGameStateFromGameMode(gameModePtr);
      if (!gameStatePtr) {
        return;
      }

      const players = collectPlayers(gameStatePtr);

      send({ type: 'elo_balance_request', players });

      /** Frida 16+: нет блокирующего recv(); только recv(type, cb) + operation.wait() (см. loader.py type). */
      let api;
      try {
        const op = recv('elo_balance_reply', function (message) {
          api = message;
        });
        op.wait();
      } catch (e) {
        logLine('recv failed: ' + e);
        return;
      }

      let modifiers = null;
      if (api && api.ok && api.modifiers && typeof api.modifiers === 'object') {
        modifiers = { ...api.modifiers };
      } else {
        if (!SOLO_TEST) {
          return;
        }
        modifiers = {};
      }

      if (SOLO_TEST) {
        modifiers = mergeSoloSynthetic(modifiers);
      }

      applyModifiersStub(modifiers);
      setPredatorThrallNoticeAndTryDeliver(
        gameStatePtr,
        globalThis.__DH_PREDATOR_DAMAGE_MULT,
        globalThis.__DH_PREDATOR_HP_MULT,
        globalThis.__DH_PLAYER_MELEE_DAMAGE_MULT,
        globalThis.__DH_PLAYER_RANGED_DAMAGE_MULT
      );
      scheduleThrallNoticeRetries(gameModePtr);
      logLine(
        'predatordamage=' +
          formatMultDisplay(globalThis.__DH_PREDATOR_DAMAGE_MULT) +
          ' predatorhealth=' +
          formatMultDisplay(globalThis.__DH_PREDATOR_HP_MULT) +
          ' playermeleedamage=' +
          formatMultDisplay(globalThis.__DH_PLAYER_MELEE_DAMAGE_MULT) +
          ' playerrangeddamage=' +
          formatMultDisplay(globalThis.__DH_PLAYER_RANGED_DAMAGE_MULT) +
          ' trigger=' +
          (trigger || 'OnPokerRoundEnded')
      );

      balanceApplied = true;
      globalThis.__DH_ELO_BALANCE_DONE_GLOBAL = true;

      if (STATS_SESSION_ID) {
        const m = modifiers && typeof modifiers === 'object' ? modifiers : {};
        send({
          type: 'elo_balance_meta',
          sessionId: STATS_SESSION_ID,
          balancerAppliedModifiers: {
            predatordamage:
              typeof m.predatordamage === 'number' && Number.isFinite(m.predatordamage)
                ? m.predatordamage
                : globalThis.__DH_PREDATOR_DAMAGE_MULT,
            predatorhealth:
              typeof m.predatorhealth === 'number' && Number.isFinite(m.predatorhealth)
                ? m.predatorhealth
                : globalThis.__DH_PREDATOR_HP_MULT,
            playermeleedamage: globalThis.__DH_PLAYER_MELEE_DAMAGE_MULT,
            playerrangeddamage: globalThis.__DH_PLAYER_RANGED_DAMAGE_MULT,
          },
        });
      }
    } finally {
      globalThis.__DH_ELO_BALANCE_RUNNING = false;
    }
  }

  Interceptor.attach(base.add(RVA_PLAYERSTATE_SET_PLAYER_ROLE), {
    onEnter(args) {
      this._psRole = args[0];
    },
    onLeave(_retval) {
      try {
        trySendPredatorNoticeToPlayerState(this._psRole);
      } catch (_e) {}
    },
  });

  Interceptor.attach(base.add(RVA_ADD_STARTING_INVENTORY), {
    onEnter(args) {
      this._humanAddInv = args[0];
    },
    onLeave(_retval) {
      try {
        trySendPredatorNoticeFromHumanCharacter(this._humanAddInv);
      } catch (_e) {}
    },
  });

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
          logLine('runBalanceForGameMode: ' + e);
        }
      }, 0);
    },
  });

  Interceptor.attach(base.add(RVA_GAME_STATE_TICK), {
    onLeave(_retval) {
      try {
        maybeScheduleBalanceFallback();
      } catch (e) {
        logLine('GameState Tick fallback: ' + e);
      }
    },
  });
})();

globalThis.__DH_PREDATOR_DAMAGE_MULT = 1;
globalThis.__DH_PREDATOR_HP_MULT = 1;
globalThis.__DH_PLAYER_MELEE_DAMAGE_MULT = 1;
globalThis.__DH_PLAYER_RANGED_DAMAGE_MULT = 1;
if (typeof installPredatorDamageHooks === 'function') {
  installPredatorDamageHooks(base);
}
if (typeof installPredatorHealthHooks === 'function') {
  installPredatorHealthHooks(base);
}
if (typeof installPlayerMeleeDamageHooks === 'function') {
  installPlayerMeleeDamageHooks(base);
}
if (typeof installPlayerRangedDamageHooks === 'function') {
  installPlayerRangedDamageHooks(base);
}
