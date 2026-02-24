import TelegramBot from 'node-telegram-bot-api';
import { ServerConfig } from './types';
import { ServerManager } from './server-manager';
import { escapeMarkdown, sendMarkdownSafe, buildInlineKeyboard } from './utils/telegram';
import { formatDuration } from './utils/parse';
import { readLogTail } from './utils/logging';
import { listStableMods, listModCollections, resolveModScripts } from './reference/mods';
import { getStatsReport, getSessionRecord } from './stats/stats-service';
import { SessionRecord } from './stats/stats-types';

function resolveCollectionMods(collectionId: string): { scripts: string[]; ids: string[] } {
  const stableMods = listStableMods();
  const collections = listModCollections(stableMods);
  const collection = collections.find((c) => c.id === collectionId);
  if (!collection) return { scripts: [], ids: [] };
  const { scripts } = resolveModScripts(collection.mods);
  return { scripts, ids: collection.mods };
}

const dogFacts = [
  '🐕 У собак обоняние примерно в 40 раз сильнее, чем у человека!',
  '🐕 Отпечаток носа у собаки уникален, как отпечаток пальца у человека.',
  '🐕 Собаки понимают до 250 слов и жестов.',
  '🐕 Басенджи — единственная порода, которая не лает.',
  '🐕 У собак три века: верхнее, нижнее и третье (мигательная перепонка).',
  '🐕 Нормальная температура тела собаки — 38.3–39.2°C.',
  '🐕 Собаки, как и люди, видят сны.',
  '🐕 Лабрадор-ретривер более 30 лет остаётся самой популярной породой.',
  '🐕 Собаки слышат частоты до 65 000 Гц, тогда как человек — до 20 000 Гц.',
  '🐕 Грейхаунд может разгоняться до 45 миль в час (около 72 км/ч).',
  '🐕 Во сне собаки сворачиваются в клубок, чтобы защитить внутренние органы.',
  '🐕 Влажный нос помогает собаке лучше улавливать запахи.',
];

export function registerBotHandlers(
  bot: TelegramBot,
  config: ServerConfig,
  serverManager: ServerManager
) {
  // /start - Welcome message
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from?.first_name || 'Игрок';
    const safeUserName = escapeMarkdown(userName);

    const welcomeMessage = `
🎮 *Добро пожаловать, ${safeUserName}!*

Это бот для управления сервером *Dread Hunger*.

🌐 Публичный IP: \`${config.publicIp}\`

Используй /help для списка команд
  `;

    sendMarkdownSafe(bot, chatId, welcomeMessage);
  });

  // /help - Show all commands
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;

    const helpMessage = `
📖 *Список команд DH Dogs Bot*

🎮 *Управление сервером:*
/run — Запуск игровой сессии (выбор карты)
/stop — Остановка сессии (выбор порта)
/status — Статус сервера и активных сессий
/log — Лог выбранной сессии
/testing — Тестовый запуск (maxplayers=1?thralls=1)

📊 *Статистика:*
/stats — Статистика игровых сессий

📋 *Общие команды:*
/start — Приветственное сообщение
/help — Показать это сообщение
/dog — Случайный факт о собаках 🐕
  `;

    sendMarkdownSafe(bot, chatId, helpMessage);
  });

  // /status - Show server status
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const sessions = serverManager.listSessions();
    if (sessions.length === 0) {
      sendMarkdownSafe(
        bot,
        chatId,
        `📊 *Статус сервера*\n\n` + `🔴 Сервер не запущен`
      );
      return;
    }

    const lines = sessions
      .map((session) => {
        const uptime = formatDuration(Date.now() - session.startedAt.getTime());
        const safeMapName = escapeMarkdown(session.map.name);
        return [
          `🗺️ Карта: *${safeMapName}*`,
          `🔢 PID: \`${session.pid}\``,
          `🌐 IP: \`${config.publicIp}\``,
          `🔌 Порт: \`${session.port}\``,
          `⏱️ Аптайм: \`${uptime}\``,
        ].join('\n');
      })
      .join('\n\n');

    sendMarkdownSafe(
      bot,
      chatId,
      `📊 *Статус сервера*\n\n` +
        `🟢 Активные сессии: ${sessions.length}\n\n` +
        lines
    );
  });

  // /stop - Stop running session
  bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    const sessions = serverManager.listSessions();
    if (sessions.length === 0) {
      sendMarkdownSafe(bot, chatId, '❌ Сервер не запущен.');
      return;
    }

    const options: TelegramBot.SendMessageOptions = {
      reply_markup: {
        inline_keyboard: buildInlineKeyboard(
          sessions.map((session) => ({
            text: `${session.map.name} (${session.port})`,
            data: `stop:${session.port}`,
          }))
        ),
      },
    };

    sendMarkdownSafe(bot, chatId, '🛑 *Выберите сессию для остановки:*', options);
  });

  // /log - Show realtime log tail
  bot.onText(/\/log/, async (msg) => {
    const chatId = msg.chat.id;
    const sessions = serverManager.listSessions();
    if (sessions.length === 0) {
      sendMarkdownSafe(bot, chatId, '❌ Сервер не запущен.');
      return;
    }

    const options: TelegramBot.SendMessageOptions = {
      reply_markup: {
        inline_keyboard: buildInlineKeyboard(
          sessions.map((session) => ({
            text: `${session.map.name} (${session.port})`,
            data: `log:${session.port}`,
          }))
        ),
      },
    };

    sendMarkdownSafe(bot, chatId, '📜 *Выберите сессию для просмотра лога:*', options);
  });

  // /run - Choose and run map
  bot.onText(/\/run/, (msg) => {
    const chatId = msg.chat.id;

    const options: TelegramBot.SendMessageOptions = {
      reply_markup: {
        inline_keyboard: buildInlineKeyboard(
          config.maps.map((map) => ({
            text: map.name,
            data: `run:${map.name}`,
          }))
        ),
      },
    };

    sendMarkdownSafe(bot, chatId, '🎯 *Выберите карту для запуска:*', options);
  });

  // /testing - Choose solo/duo for test run
  bot.onText(/\/testing/, (msg) => {
    const chatId = msg.chat.id;

    const options: TelegramBot.SendMessageOptions = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🎯 Solo (1/1)', callback_data: 'testing_solo' },
            { text: '👥 Duo (2/2)', callback_data: 'testing_duo' },
          ],
        ],
      },
    };

    sendMarkdownSafe(bot, chatId, '🧪 *Выберите режим тестирования:*', options);
  });

  // Handle button callbacks
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;

    if (!chatId || !data) return;

    bot.answerCallbackQuery(callbackQuery.id);

    if (data.startsWith('run:')) {
      const mapName = data.replace('run:', '').trim();
      const safeMapName = escapeMarkdown(mapName);
      sendMarkdownSafe(bot, chatId, `⏳ Запускаю *${safeMapName}*...`);
      try {
        const mapConfig = config.maps.find(
          (m) => m.name === mapName || m.serverValue === mapName
        );
        const { scripts: modScripts, ids: modIds } = mapConfig?.defaultCollection
          ? resolveCollectionMods(mapConfig.defaultCollection)
          : { scripts: [], ids: [] };
        const session = await serverManager.startSession(mapName, undefined, undefined, modScripts, modIds);
        const safeSessionName = escapeMarkdown(session.map.name);
        sendMarkdownSafe(
          bot,
          chatId,
          `✅ *${safeSessionName}* успешно запущен!\n\n` +
            `PID: \`${session.pid}\`\n` +
            `🌐 IP: \`${config.publicIp}\`\n` +
            `🔌 Порт: \`${session.port}\``
        );
      } catch (error) {
        sendMarkdownSafe(
          bot,
          chatId,
          `❌ Не удалось запустить *${safeMapName}*.\n\n` +
            `Причина: ${escapeMarkdown((error as Error).message)}`
        );
      }
      return;
    }

    if (data.startsWith('run_test:')) {
      const parts = data.replace('run_test:', '').trim().split(':');
      const testMode = parts[0];
      const mapName = parts.slice(1).join(':').trim();
      const testModifiers: Record<string, number> =
        testMode === 'duo'
          ? { maxplayers: 2, thralls: 2 }
          : { maxplayers: 1, thralls: 1 };
      const { scripts: modScripts, ids: modIds } = resolveCollectionMods('Solo_Duo');
      const safeMapName = escapeMarkdown(mapName);
      sendMarkdownSafe(
        bot,
        chatId,
        `⏳ Тестовый запуск *${safeMapName}* (${testMode})...`
      );
      try {
        const session = await serverManager.startSession(mapName, undefined, 'test', modScripts, modIds, testModifiers);
        const safeSessionName = escapeMarkdown(session.map.name);
        sendMarkdownSafe(
          bot,
          chatId,
          `✅ *${safeSessionName}* успешно запущен (тест)!\n\n` +
            `PID: \`${session.pid}\`\n` +
            `🌐 IP: \`${config.publicIp}\`\n` +
            `🔌 Порт: \`${session.port}\``
        );
      } catch (error) {
        sendMarkdownSafe(
          bot,
          chatId,
          `❌ Не удалось запустить *${safeMapName}* (тест).\n\n` +
            `Причина: ${escapeMarkdown((error as Error).message)}`
        );
      }
      return;
    }

    if (data === 'testing_solo' || data === 'testing_duo') {
      const mode = data === 'testing_duo' ? 'duo' : 'solo';
      const options: TelegramBot.SendMessageOptions = {
        reply_markup: {
          inline_keyboard: buildInlineKeyboard(
            config.maps.map((map) => ({
              text: map.name,
              data: `run_test:${mode}:${map.name}`,
            }))
          ),
        },
      };

      sendMarkdownSafe(bot, chatId, '🧪 *Выберите карту для тестового запуска:*', options);
      return;
    }

    if (data.startsWith('stop:')) {
      const portStr = data.replace('stop:', '').trim();
      const port = Number.parseInt(portStr, 10);
      if (Number.isNaN(port)) return;

      sendMarkdownSafe(bot, chatId, `⏳ Останавливаю сессию на порту \`${port}\`...`);

      const killed = await serverManager.stopSession(port);
      if (killed) {
        sendMarkdownSafe(bot, chatId, `✅ Сессия на порту \`${port}\` остановлена.`);
      } else {
        sendMarkdownSafe(bot, chatId, `❌ Не удалось остановить сессию на порту \`${port}\`.`);
      }
    }

    if (data.startsWith('log:')) {
      const portStr = data.replace('log:', '').trim();
      const port = Number.parseInt(portStr, 10);
      if (Number.isNaN(port)) return;

      const session = serverManager.listSessions().find((item) => item.port === port);
      if (!session) {
        sendMarkdownSafe(bot, chatId, '❌ Сессия не найдена.');
        return;
      }

      const tail = readLogTail(session.logPath);
      const header = `📜 Лог сессии ${session.map.name} (${session.port})`;
      const message = `${header}\n\n${tail || 'Лог пуст'}`;
      bot.sendMessage(chatId, message);
    }

    if (data.startsWith('stats_session:')) {
      const sessionId = data.replace('stats_session:', '').trim();
      try {
        // Сначала ищем активную сессию в памяти (данных игроков ещё нет, но можно показать текущее состояние)
        const activeSession = serverManager.listSessions().find((s) => s.statsSessionId === sessionId);
        const record = await getSessionRecord(sessionId);

        if (!record && !activeSession) {
          sendMarkdownSafe(bot, chatId, '❌ Сессия не найдена.');
          return;
        }

        if (record) {
          sendMarkdownSafe(bot, chatId, formatSessionReport(record));
          return;
        }

        // Активная сессия, данных финального экрана ещё нет
        const uptime = formatDuration(Date.now() - activeSession!.startedAt.getTime());
        sendMarkdownSafe(
          bot,
          chatId,
          [
            `🟢 *Сессия в процессе*`,
            `🗺️ ${escapeMarkdown(activeSession!.map.name)}`,
            `🔌 Порт: \`${activeSession!.port}\``,
            `⏱️ Аптайм: ${escapeMarkdown(uptime)}`,
            ``,
            `_Статистика появится после завершения матча_`,
          ].join('\n')
        );
      } catch (error) {
        sendMarkdownSafe(bot, chatId, `❌ Ошибка: ${escapeMarkdown((error as Error).message)}`);
      }
    }
  });

  function outcomeLabel(outcome: string): string {
    if (outcome === 'humans_win') return 'Мирные победили';
    if (outcome === 'cannibals_win') return 'Маньяки победили';
    return 'Неизвестно';
  }

  function endReasonLabel(reason: string): string {
    if (reason === 'natural') return 'Штатное завершение';
    if (reason === 'admin_stop') return 'Остановлен администратором';
    if (reason === 'crash') return 'Аварийное завершение';
    return 'Неизвестно';
  }

  function formatTime(iso: string): string {
    // "2025-03-01T14:35:00.000Z" -> "01.03.2025 14:35"
    try {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return iso.slice(0, 16).replace('T', ' ');
    }
  }

  function formatSessionReport(s: SessionRecord): string {
    const mins = Math.round(s.durationSeconds / 60);
    const secs = s.durationSeconds % 60;
    const duration = secs > 0 ? `${mins} мин ${secs} сек` : `${mins} мин`;

    const lines: string[] = [
      `🗺️ *${escapeMarkdown(s.map)}*`,
      ``,
      `📅 Начало: ${formatTime(s.startedAt)}`,
      `🏁 Конец:  ${formatTime(s.endedAt)}`,
      `⏱️ Длительность: ${duration}`,
      ``,
      `🏆 Итог: *${outcomeLabel(s.outcome)}*`,
      `🔚 Причина: ${endReasonLabel(s.endReason)}`,
    ];

    if (s.mods.length > 0) {
      lines.push(``, `🔧 *Моды:*`);
      for (const mod of s.mods) {
        lines.push(`  • ${escapeMarkdown(mod)}`);
      }
    }

    const explorers = s.players.filter((p) => !p.traitor);
    const traitors  = s.players.filter((p) => p.traitor);

    if (s.players.length > 0) {
      lines.push(``, `👤 *Мирные (${explorers.length}):*`);
      if (explorers.length > 0) {
        for (const p of explorers) {
          const role = p.roleName ? escapeMarkdown(p.roleName) : 'неизв.';
          const dead = p.isDead ? ' — погиб' : '';
          const dmg = (p.damageToEnemy ?? 0) > 0 ? ` — ${p.damageToEnemy} урона` : '';
          lines.push(`  ${escapeMarkdown(p.name)} [${role}]${dead}${dmg}`);
        }
      } else {
        lines.push(`  (нет)`);
      }

      lines.push(``, `☠️ *Маньяки (${traitors.length}):*`);
      if (traitors.length > 0) {
        for (const p of traitors) {
          const role = p.roleName ? escapeMarkdown(p.roleName) : 'неизв.';
          const dead = p.isDead ? ' — погиб' : '';
          const dmg = (p.damageToEnemy ?? 0) > 0 ? ` — ${p.damageToEnemy} урона` : '';
          lines.push(`  ${escapeMarkdown(p.name)} [${role}]${dead}${dmg}`);
        }
      } else {
        lines.push(`  (нет)`);
      }
    } else {
      lines.push(``, `_Данные об игроках отсутствуют_`);
    }

    return lines.join('\n');
  }

  // /stats — общая статистика или статистика конкретной сессии
  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const report = await getStatsReport();
      const activeSessions = serverManager.listSessions();

      const totalHours = (report.totalPlaytimeSeconds / 3600).toFixed(1);
      const avgMins = Math.round(report.averageSessionSeconds / 60);

      const topByGames = report.topPlayersByGames.slice(0, 5)
        .map((p, i) => `  ${i + 1}. ${escapeMarkdown(p.name)} (${p.games} игр)`)
        .join('\n');

      const topByWinrate = report.topPlayersByWinrate.slice(0, 5)
        .map((p, i) => `  ${i + 1}. ${escapeMarkdown(p.name)} — ${p.winrate}% (${p.wins}/${p.games})`)
        .join('\n');

      const topByDamage = report.topPlayersByDamage.slice(0, 5)
        .map((p, i) => `  ${i + 1}. ${escapeMarkdown(p.name)} — ${p.totalDamage} урона (${p.avgDamage}/игру, ${p.games} игр)`)
        .join('\n');

      const recentLines = report.recentSessions.slice(0, 5)
        .map((s) => {
          const mins = Math.round(s.durationSeconds / 60);
          const mapName = escapeMarkdown(s.map);
          return `  ${mapName} — ${mins}мин — ${escapeMarkdown(outcomeLabel(s.outcome))}`;
        })
        .join('\n');

      const summaryText = [
        `📊 *Статистика сервера*`,
        ``,
        `Всего сессий: ${report.totalSessions}`,
        `Суммарное время: ${totalHours}ч`,
        `Средняя сессия: ${avgMins} мин`,
        ``,
        `*Топ игроков по играм:*`,
        topByGames || '  (нет данных)',
        ``,
        `*Топ игроков по винрейту* (мин. 3 игры):`,
        topByWinrate || '  (нет данных)',
        ``,
        `*Топ игроков по урону врагам* (мин. 3 игры):`,
        topByDamage || '  (нет данных)',
        ``,
        `*Последние 5 сессий:*`,
        recentLines || '  (нет данных)',
      ].join('\n');

      // Кнопки: активные сессии + последние завершённые
      const sessionButtons: Array<{ text: string; data: string }> = [];

      for (const session of activeSessions) {
        sessionButtons.push({
          text: `🟢 ${session.map.name} :${session.port}`,
          data: `stats_session:${session.statsSessionId}`,
        });
      }

      for (const s of report.recentSessions.slice(0, 5)) {
        const mins = Math.round(s.durationSeconds / 60);
        const label = `${s.map} ${mins}м ${outcomeLabel(s.outcome).split(' ')[0]}`;
        sessionButtons.push({
          text: label,
          data: `stats_session:${s.sessionId}`,
        });
      }

      const options: TelegramBot.SendMessageOptions = sessionButtons.length > 0
        ? { reply_markup: { inline_keyboard: buildInlineKeyboard(sessionButtons) } }
        : {};

      sendMarkdownSafe(bot, chatId, summaryText, options);
    } catch (error) {
      sendMarkdownSafe(bot, chatId, `❌ Не удалось загрузить статистику: ${escapeMarkdown((error as Error).message)}`);
    }
  });

  // /dog - Random dog facts
  bot.onText(/\/dog/, (msg) => {
    const chatId = msg.chat.id;
    const randomFact = dogFacts[Math.floor(Math.random() * dogFacts.length)];

    sendMarkdownSafe(bot, chatId, `*Random Dog Fact:*\n\n${randomFact}`);
  });

  // Handle errors
  bot.on('polling_error', (error) => {
    console.error('❌ Polling error:', error.message);
  });

  bot.on('error', (error) => {
    console.error('❌ Bot error:', error.message);
  });
}
