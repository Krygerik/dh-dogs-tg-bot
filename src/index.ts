import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Scripts directory path
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

// PID and map files
const PID_FILE = path.join(SCRIPTS_DIR, 'server.pid');
const MAP_FILE = path.join(SCRIPTS_DIR, 'server.map');

// Map names
const MAP_NAMES: Record<string, string> = {
  departure: '🏔️ Вершина',
  expanse: '🌄 Просторы',
};

// Server address
const SERVER_ADDRESS = '185.17.66.195:7777';

// Read saved PID from file
function getSavedPid(): number | null {
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
      return isNaN(pid) ? null : pid;
    }
  } catch {
    return null;
  }
  return null;
}

// Read saved map name from file
function getSavedMap(): string | null {
  try {
    if (fs.existsSync(MAP_FILE)) {
      return fs.readFileSync(MAP_FILE, 'utf-8').trim();
    }
  } catch {
    return null;
  }
  return null;
}

// Clear PID files
function clearPidFiles(): void {
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
    if (fs.existsSync(MAP_FILE)) fs.unlinkSync(MAP_FILE);
  } catch {
    // ignore
  }
}

// Check if process with given PID is running
function isProcessRunning(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`tasklist /fi "PID eq ${pid}" /nh`, (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      // Check if output contains the PID (not "INFO: No tasks")
      resolve(stdout.includes(pid.toString()) && !stdout.includes('No tasks'));
    });
  });
}

// Check if server is running by PID
async function isServerRunning(): Promise<{ running: boolean; pid: number | null; map: string | null }> {
  const pid = getSavedPid();
  const map = getSavedMap();

  if (!pid) {
    return { running: false, pid: null, map: null };
  }

  const running = await isProcessRunning(pid);

  if (!running) {
    // Process not running, clear stale PID files
    clearPidFiles();
    return { running: false, pid: null, map: null };
  }

  return { running: true, pid, map };
}

// Wait for PID file to appear (with timeout)
function waitForPidFile(timeoutMs: number = 15000, intervalMs: number = 1000): Promise<number | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      const pid = getSavedPid();

      if (pid) {
        clearInterval(checkInterval);
        resolve(pid);
        return;
      }

      if (Date.now() - startTime >= timeoutMs) {
        clearInterval(checkInterval);
        resolve(null);
      }
    }, intervalMs);
  });
}

// Run bat script without blocking (detached)
function runScript(scriptPath: string): void {
  const child = spawn('cmd.exe', ['/c', scriptPath], {
    cwd: SCRIPTS_DIR,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

// Kill process by PID
function killProcess(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`taskkill /PID ${pid} /F`, (error) => {
      if (error) {
        resolve(false);
        return;
      }
      clearPidFiles();
      resolve(true);
    });
  });
}

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ Error: BOT_TOKEN is not set in .env file');
  process.exit(1);
}

// Create bot instance with polling
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🎮 Dread Hunger Server Bot is starting...');

// Command 1: /start - Welcome message
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from?.first_name || 'Игрок';

  const welcomeMessage = `
🎮 *Добро пожаловать, ${userName}!*

Это бот для управления сервером *Dread Hunger*.

🌐 Адрес сервера: \`${SERVER_ADDRESS}\`

Используй /help для списка команд
  `;

  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Command 2: /help - Show all commands
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  const helpMessage = `
📖 *Список команд DH Dogs Bot*

🎮 *Управление сервером:*
/run — Выбор и запуск игрового сервера
  • 🏔️ Вершина (Departure)
  • 🌄 Просторы (Expanse)

/stop — Принудительная остановка сервера
  Завершает текущий запущенный процесс

/status — Статус сервера
  Показывает информацию о запущенном сервере

📋 *Общие команды:*
/start — Приветственное сообщение
/help — Показать это сообщение
/dog — Случайный факт о собаках 🐕
  `;

  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Command 3: /status - Show server status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;

  const serverStatus = await isServerRunning();

  if (!serverStatus.running) {
    bot.sendMessage(
      chatId,
      `📊 *Статус сервера*\n\n` +
      `🔴 Сервер не запущен`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const mapName = serverStatus.map ? (MAP_NAMES[serverStatus.map] || serverStatus.map) : 'Неизвестная';

  bot.sendMessage(
    chatId,
    `📊 *Статус сервера*\n\n` +
    `🟢 Сервер работает\n\n` +
    `🗺️ Карта: *${mapName}*\n` +
    `🔢 PID: \`${serverStatus.pid}\`\n` +
    `🌐 Адрес: \`${SERVER_ADDRESS}\``,
    { parse_mode: 'Markdown' }
  );
});

// Command 4: /stop - Stop running server
bot.onText(/\/stop/, async (msg) => {
  const chatId = msg.chat.id;

  const serverStatus = await isServerRunning();

  if (!serverStatus.running || !serverStatus.pid) {
    bot.sendMessage(chatId, '❌ Сервер не запущен.', { parse_mode: 'Markdown' });
    return;
  }

  const mapName = serverStatus.map ? (MAP_NAMES[serverStatus.map] || serverStatus.map) : 'Неизвестный';

  bot.sendMessage(chatId, `⏳ Останавливаю *${mapName}* (PID: ${serverStatus.pid})...`, {
    parse_mode: 'Markdown',
  });

  const killed = await killProcess(serverStatus.pid);

  if (killed) {
    bot.sendMessage(
      chatId,
      `✅ Сервер *${mapName}* успешно остановлен!`,
      { parse_mode: 'Markdown' }
    );
  } else {
    bot.sendMessage(
      chatId,
      `❌ Не удалось остановить сервер *${mapName}* (PID: ${serverStatus.pid}).\n\n` +
      `Попробуйте завершить процесс вручную.`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Command 5: /run - Choose and run script
bot.onText(/\/run/, (msg) => {
  const chatId = msg.chat.id;

  const options: TelegramBot.SendMessageOptions = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🏔️ Вершина', callback_data: 'run_departure' },
          { text: '🌄 Просторы', callback_data: 'run_expanse' },
        ],
      ],
    },
  };

  bot.sendMessage(chatId, '🎯 *Выберите скрипт для запуска:*', {
    parse_mode: 'Markdown',
    ...options,
  });
});

// Handle button callbacks
bot.on('callback_query', async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;

  if (!chatId) return;

  // Answer callback to remove loading state
  bot.answerCallbackQuery(callbackQuery.id);

  let scriptName = '';
  let displayName = '';

  if (data === 'run_departure') {
    scriptName = 'run-departure.bat';
    displayName = '🏔️ Вершина';
  } else if (data === 'run_expanse') {
    scriptName = 'run-expanse.bat';
    displayName = '🌄 Просторы';
  } else {
    return;
  }

  // Check if server is already running
  const serverStatus = await isServerRunning();
  if (serverStatus.running) {
    const mapName = serverStatus.map ? (MAP_NAMES[serverStatus.map] || serverStatus.map) : 'Неизвестный';
    bot.sendMessage(
      chatId,
      `⛔ *Отказано в запуске!*\n\n` +
      `Сервер уже запущен.\n` +
      `Текущая карта: *${mapName}*\n` +
      `PID: \`${serverStatus.pid}\`\n` +
      `🌐 Адрес: \`${SERVER_ADDRESS}\`\n\n` +
      `Закройте текущий сервер перед запуском нового.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const scriptPath = path.join(SCRIPTS_DIR, scriptName);

  bot.sendMessage(chatId, `⏳ Запускаю *${displayName}*...`, { parse_mode: 'Markdown' });

  // Run script without blocking
  runScript(scriptPath);

  // Wait for PID file to appear
  const pid = await waitForPidFile(15000, 1000);

  if (pid) {
    // Verify process is actually running
    const isRunning = await isProcessRunning(pid);

    if (isRunning) {
      bot.sendMessage(
        chatId,
        `✅ *${displayName}* успешно запущен!\n\n` +
        `PID: \`${pid}\`\n` +
        `🌐 Адрес: \`${SERVER_ADDRESS}\``,
        { parse_mode: 'Markdown' }
      );
    } else {
      bot.sendMessage(
        chatId,
        `⚠️ Процесс *${displayName}* (PID: ${pid}) завершился сразу после запуска.\n\n` +
        `Проверьте логи сервера.`,
        { parse_mode: 'Markdown' }
      );
    }
  } else {
    bot.sendMessage(
      chatId,
      `⚠️ Скрипт *${displayName}* выполнен, но PID не получен.\n\n` +
      `Проверьте логи сервера вручную.`,
      { parse_mode: 'Markdown' }
    );
  }
});

// Command 6: /dog - Random dog facts
const dogFacts = [
  '🐕 Dogs have a sense of smell that is 40 times better than humans!',
  '🐕 A dog\'s nose print is unique, much like a human fingerprint.',
  '🐕 Dogs can understand up to 250 words and gestures.',
  '🐕 The Basenji is the only dog breed that doesn\'t bark.',
  '🐕 Dogs have three eyelids: upper, lower, and a third lid called a nictitating membrane.',
  '🐕 A dog\'s normal body temperature is between 101-102.5°F (38.3-39.2°C).',
  '🐕 Dogs dream just like humans do!',
  '🐕 The Labrador Retriever has been the most popular dog breed for 31 consecutive years.',
  '🐕 Dogs can hear sounds at frequencies up to 65,000 Hz, while humans max out at 20,000 Hz.',
  '🐕 A Greyhound can run up to 45 miles per hour!',
  '🐕 Dogs curl up in a ball when they sleep to protect their organs.',
  '🐕 The wetness of a dog\'s nose helps them absorb scent chemicals.',
];

bot.onText(/\/dog/, (msg) => {
  const chatId = msg.chat.id;
  const randomFact = dogFacts[Math.floor(Math.random() * dogFacts.length)];

  bot.sendMessage(chatId, `*Random Dog Fact:*\n\n${randomFact}`, { parse_mode: 'Markdown' });
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('❌ Polling error:', error.message);
});

bot.on('error', (error) => {
  console.error('❌ Bot error:', error.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping bot...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping bot...');
  bot.stopPolling();
  process.exit(0);
});

console.log('✅ Dread Hunger Server Bot is running! Press Ctrl+C to stop.');

