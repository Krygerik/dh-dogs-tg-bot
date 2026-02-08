import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import http from 'http';
import { URL } from 'url';

dotenv.config();

const LOGS_DIR = path.join(process.cwd(), 'logs');
const MAX_LOG_FILES = 20;

type MapConfig = {
  name: string;
  serverValue: string;
};

type MapReference = {
  name: string;
  serverValue: string;
  defaultCollection?: string;
};

type ModInfo = {
  id: string;
  name: string;
  scriptPath: string;
  description: string;
};

type ModCollection = {
  id: string;
  name: string;
  mods: string[];
};

type ServerConfig = {
  publicIp: string;
  binaryPath: string;
  binaryDir: string;
  ports: number[];
  maxSessions: number;
  maps: MapConfig[];
  sessionParams: string;
  initSignature: string;
  initTimeoutMs: number;
  fridaPath: string;
  fridaInitSignature: string;
};

type GameSession = {
  port: number;
  pid: number;
  map: MapConfig;
  startedAt: Date;
  logPath: string;
  mods: string[];
};

type RunningSession = GameSession & {
  process: ReturnType<typeof spawn>;
};

const DEFAULT_INIT_SIGNATURE =
  'LogInit: Display: Engine is initialized. Leaving FEngineLoop::Init()';
const API_PORT = 8787;
const API_TOKEN = (process.env.API_TOKEN ?? '').trim();
const TEST_PARAMS_SOLO = 'maxplayers=1?thralls=1';
const TEST_PARAMS_DUO = 'maxplayers=2?thralls=2';
const STABLE_DIR = path.join(process.cwd(), 'patches', 'stable');
const COLLECTIONS_DIR = path.join(process.cwd(), 'patches', 'alllready_configs');
const MAPS_REF_PATH = path.join(process.cwd(), 'reference', 'maps.json');
const MAPS_RU_PATH = path.join(process.cwd(), 'reference', 'maps.ru.json');
const MAPS_COLLECTIONS_PATH = path.join(process.cwd(), 'reference', 'map-collections.json');

function listStableMods(): ModInfo[] {
  // TODO: consider caching if this becomes a hotspot.
  if (!fs.existsSync(STABLE_DIR)) {
    return [];
  }
  const entries = fs.readdirSync(STABLE_DIR, { withFileTypes: true });
  const mods: ModInfo[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const scriptFile = `${name}.js`;
    const descriptionFile = `${name}.txt`;
    const scriptFullPath = path.join(STABLE_DIR, name, scriptFile);
    if (!fs.existsSync(scriptFullPath)) {
      continue;
    }
    const descriptionPath = path.join(STABLE_DIR, name, descriptionFile);
    let description = '';
    if (fs.existsSync(descriptionPath)) {
      description = fs.readFileSync(descriptionPath, 'utf8').trim();
    }
    const scriptPath = path.posix.join('patches', 'stable', name, scriptFile);
    mods.push({
      id: name,
      name,
      scriptPath,
      description,
    });
  }
  mods.sort((a, b) => a.name.localeCompare(b.name));
  return mods;
}

function listModCollections(mods: ModInfo[]): ModCollection[] {
  if (!fs.existsSync(COLLECTIONS_DIR)) {
    return [];
  }
  const modsByScriptPath = new Map(mods.map((mod) => [mod.scriptPath, mod.id]));
  const entries = fs.readdirSync(COLLECTIONS_DIR, { withFileTypes: true });
  const collections: ModCollection[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.txt')) continue;
    const collectionId = entry.name.replace(/\.txt$/i, '');
    const filePath = path.join(COLLECTIONS_DIR, entry.name);
    const raw = fs.readFileSync(filePath, 'utf8');
    const modsSet = new Set<string>();

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const normalized = trimmed.replace(/\\/g, '/');
      const modId = modsByScriptPath.get(normalized);
      if (modId) {
        modsSet.add(modId);
        continue;
      }
      const parts = normalized.split('/');
      const stableIdx = parts.indexOf('stable');
      if (stableIdx !== -1 && parts.length > stableIdx + 1) {
        modsSet.add(parts[stableIdx + 1]);
      }
    }

    collections.push({
      id: collectionId,
      name: collectionId,
      mods: [...modsSet],
    });
  }

  collections.sort((a, b) => a.name.localeCompare(b.name));
  return collections;
}

function resolveModScripts(modIds: string[]): { scripts: string[]; unknown: string[] } {
  const catalog = listStableMods();
  const map = new Map(catalog.map((mod) => [mod.id, mod]));
  const scripts: string[] = [];
  const unknown: string[] = [];
  for (const id of modIds) {
    const mod = map.get(id);
    if (!mod) {
      unknown.push(id);
      continue;
    }
    scripts.push(mod.scriptPath);
  }
  return { scripts, unknown };
}

function parseMods(value: unknown): { mods: string[]; error?: string } {
  if (value == null) {
    return { mods: [] };
  }
  if (!Array.isArray(value)) {
    return { mods: [], error: 'mods must be an array of strings' };
  }
  const mods: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      return { mods: [], error: 'mods must be an array of strings' };
    }
    const trimmed = item.trim();
    if (trimmed) mods.push(trimmed);
  }
  return { mods };
}

function loadMapReferences(): MapReference[] {
  try {
    if (!fs.existsSync(MAPS_REF_PATH)) return [];
    const raw = fs.readFileSync(MAPS_REF_PATH, 'utf8');
    const data = JSON.parse(raw) as { maps?: string[] };
    const mapList = Array.isArray(data.maps) ? data.maps : [];
    if (mapList.length === 0) return [];

    let localized: Record<string, string> = {};
    if (fs.existsSync(MAPS_RU_PATH)) {
      const rawRu = fs.readFileSync(MAPS_RU_PATH, 'utf8');
      const ruData = JSON.parse(rawRu) as Record<string, string>;
      localized = ruData || {};
    }

    let collections: Record<string, string> = {};
    if (fs.existsSync(MAPS_COLLECTIONS_PATH)) {
      const rawCollections = fs.readFileSync(MAPS_COLLECTIONS_PATH, 'utf8');
      const dataCollections = JSON.parse(rawCollections) as Record<string, string>;
      collections = dataCollections || {};
    }

    return mapList.map((serverValue) => ({
      serverValue,
      name: localized[serverValue] ?? serverValue,
      defaultCollection: collections[serverValue],
    }));
  } catch {
    return [];
  }
}

function parsePortSpec(raw: string): number[] {
  const ports = new Set<number>();
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = trimmed.split('-').map((v) => v.trim());
    if (range.length === 1) {
      const value = Number(range[0]);
      if (!Number.isInteger(value) || value <= 0 || value > 65535) {
        throw new Error(`Invalid port: ${range[0]}`);
      }
      ports.add(value);
      continue;
    }
    if (range.length !== 2) {
      throw new Error(`Invalid port range: ${trimmed}`);
    }
    const start = Number(range[0]);
    const end = Number(range[1]);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start <= 0 ||
      end <= 0 ||
      start > 65535 ||
      end > 65535 ||
      start > end
    ) {
      throw new Error(`Invalid port range: ${trimmed}`);
    }
    for (let port = start; port <= end; port += 1) {
      ports.add(port);
    }
  }
  return [...ports];
}

function buildMapArg(mapValue: string, sessionParams: string, port: number): string {
  const normalized = sessionParams.replace(/^\?+/, '').trim();
  const params = [normalized, `port=${port}`].filter((value) => value.length > 0).join('?');
  return params.length > 0 ? `${mapValue}?${params}` : mapValue;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([_*`\[])/g, '\\$1');
}

function stripMarkdown(text: string): string {
  return text.replace(/[*_`]/g, '');
}

function sendMarkdownSafe(
  bot: TelegramBot,
  chatId: number,
  text: string,
  options: TelegramBot.SendMessageOptions = {}
): void {
  bot
    .sendMessage(chatId, text, { ...options, parse_mode: 'Markdown' })
    .catch(() => {
      const { parse_mode, ...rest } = options;
      bot.sendMessage(chatId, stripMarkdown(text), rest);
    });
}

function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function isAuthorized(req: http.IncomingMessage): boolean {
  if (!API_TOKEN) return true;
  const token = req.headers['x-api-token'];
  return typeof token === 'string' && token === API_TOKEN;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function waitForSignature(
  streams: Array<NodeJS.ReadableStream | null | undefined>,
  signature: string,
  timeoutMs: number,
  label: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const readers: readline.Interface[] = [];
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      reject(new Error(`${label} init timeout`));
      readers.forEach((reader) => reader.close());
    }, timeoutMs);

    const onLineInternal = (line: string) => {
      if (!line) return;
      if (line.includes(signature) && !finished) {
        finished = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    streams
      .filter((stream): stream is NodeJS.ReadableStream => Boolean(stream))
      .forEach((stream) => {
        const reader = readline.createInterface({ input: stream });
        reader.on('line', onLineInternal);
        readers.push(reader);
      });

    if (readers.length === 0) {
      clearTimeout(timeout);
      reject(new Error(`${label} has no output streams`));
    }
  });
}

function waitForSignatureWithHandlers(
  stdout: NodeJS.ReadableStream | null | undefined,
  stderr: NodeJS.ReadableStream | null | undefined,
  signature: string,
  timeoutMs: number,
  label: string,
  onStdout?: (line: string) => void,
  onStderr?: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const readers: readline.Interface[] = [];
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      reject(new Error(`${label} init timeout`));
      readers.forEach((reader) => reader.close());
    }, timeoutMs);

    const makeHandler = (callback?: (line: string) => void) => (line: string) => {
      if (!line) return;
      if (callback) callback(line);
      if (line.includes(signature) && !finished) {
        finished = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    if (stdout) {
      const reader = readline.createInterface({ input: stdout });
      reader.on('line', makeHandler(onStdout));
      readers.push(reader);
    }
    if (stderr) {
      const reader = readline.createInterface({ input: stderr });
      reader.on('line', makeHandler(onStderr));
      readers.push(reader);
    }

    if (readers.length === 0) {
      clearTimeout(timeout);
      reject(new Error(`${label} has no output streams`));
    }
  });
}

function buildInlineKeyboard(items: Array<{ text: string; data: string }>, columns = 2) {
  const rows: TelegramBot.InlineKeyboardButton[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(
      items.slice(i, i + columns).map((item) => ({
        text: item.text,
        callback_data: item.data,
      }))
    );
  }
  return rows;
}

function killProcessTree(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`taskkill /PID ${pid} /T /F`, (error) => {
      resolve(!error);
    });
  });
}

function wrapCommand(commandPath: string, args: Array<string | number>) {
  const normalizedArgs = args.map((value) => `${value}`);
  if (commandPath.toLowerCase().endsWith('.bat') || commandPath.toLowerCase().endsWith('.cmd')) {
    return { command: 'cmd.exe', args: ['/c', commandPath, ...normalizedArgs] };
  }
  return { command: commandPath, args: normalizedArgs };
}

function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function cleanupOldLogs(): void {
  ensureLogsDir();
  const files = fs
    .readdirSync(LOGS_DIR)
    .map((name) => ({
      name,
      fullPath: path.join(LOGS_DIR, name),
      stat: fs.statSync(path.join(LOGS_DIR, name)),
    }))
    .filter((entry) => entry.stat.isFile())
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  if (files.length <= MAX_LOG_FILES) return;

  for (const entry of files.slice(MAX_LOG_FILES)) {
    try {
      fs.unlinkSync(entry.fullPath);
    } catch {
      // ignore cleanup errors
    }
  }
}
function makeLogFileName(mapName: string, port: number): string {
  const safeName = mapName.replace(/[^\w.-]+/g, '_');
  return `session_${safeName}_${port}_${Date.now()}.log`;
}

function attachRealtimeLogging(
  child: ReturnType<typeof spawn>,
  mapName: string,
  port: number
): string {
  ensureLogsDir();
  cleanupOldLogs();
  const logPath = path.join(LOGS_DIR, makeLogFileName(mapName, port));
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  const logLine = (source: string, line: string) => {
    const entry = `[${new Date().toISOString()}] ${source} ${line}\n`;
    logStream.write(entry);
    console.log(entry.trimEnd());
  };

  const attachReader = (stream: NodeJS.ReadableStream | null | undefined, label: string) => {
    if (!stream) return;
    const reader = readline.createInterface({ input: stream });
    reader.on('line', (line) => logLine(label, line));
    child.on('exit', () => reader.close());
  };

  attachReader(child.stdout, `port:${port} stdout`);
  attachReader(child.stderr, `port:${port} stderr`);
  child.on('exit', () => logStream.end());

  return logPath;
}

function readLogTail(logPath: string, maxLines: number = 40, maxChars: number = 3500): string {
  if (!fs.existsSync(logPath)) {
    return 'Лог-файл не найден.';
  }
  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.trim().split(/\r?\n/);
  const tail = lines.slice(-maxLines).join('\n');
  if (tail.length > maxChars) {
    return tail.slice(-maxChars);
  }
  return tail;
}

function resolveBinaryPath(binaryPath: string): string {
  const normalized = binaryPath.trim();
  const exeName = 'DreadHungerServer-Win64-Shipping.exe';
  const hasExe = normalized.toLowerCase().endsWith('.exe');
  const candidate = hasExe ? normalized : path.join(normalized, exeName);

  if (!fs.existsSync(candidate)) {
    throw new Error(`BINARY_PATH does not exist: ${candidate}`);
  }

  return candidate;
}

function resolveFridaPath(fridaPath: string): string {
  const trimmed = fridaPath.trim();
  if (!trimmed) return trimmed;
  const resolved = path.isAbsolute(trimmed) ? trimmed : path.resolve(process.cwd(), trimmed);
  if (!fs.existsSync(resolved)) {
    throw new Error(`FRIDA_PATH does not exist: ${resolved}`);
  }
  return resolved;
}

class ServerManager {
  private readonly sessions = new Map<number, RunningSession>();
  private portIdx = 0;

  constructor(private readonly config: ServerConfig) {}

  listSessions(): GameSession[] {
    return [...this.sessions.values()].map(({ process, ...session }) => session);
  }

  async startSession(
    mapName: string,
    sessionParamsOverride?: string,
    fridaMode?: string,
    modScripts?: string[],
    modIds?: string[]
  ): Promise<GameSession> {
    let map = this.config.maps.find(
      (item) => item.name === mapName || item.serverValue === mapName
    );
    if (!map) {
      const refs = loadMapReferences();
      const refMatch = refs.find(
        (item) => item.serverValue === mapName || item.name === mapName
      );
      if (refMatch) {
        map = { name: refMatch.name, serverValue: refMatch.serverValue };
      }
    }
    if (!map) {
      throw new Error(`Unknown map: ${mapName}`);
    }
    if (this.config.maxSessions > 0 && this.sessions.size >= this.config.maxSessions) {
      throw new Error('Maximum sessions limit reached');
    }

    const port = this.getNextPort();
    if (!port) {
      throw new Error('No free ports available');
    }

    const sessionParams = sessionParamsOverride ?? this.config.sessionParams;
    const mapArg = buildMapArg(map.serverValue, sessionParams, port);
    const child = spawn(this.config.binaryPath, [mapArg, '-log'], {
      cwd: this.config.binaryDir,
      windowsHide: true,
    });

    if (!child.pid) {
      throw new Error('Failed to start server process');
    }

    const logPath = attachRealtimeLogging(child, map.name, port);

    let initDone = false;
    const initPromise = waitForSignature(
      [child.stdout, child.stderr],
      this.config.initSignature,
      this.config.initTimeoutMs,
      'DH server'
    ).then(() => {
      initDone = true;
    });

    const exitPromise = new Promise<void>((_, reject) => {
      child.once('exit', (code) => {
        if (initDone) return;
        reject(new Error(`DH server exited with code ${code ?? 'unknown'} before init`));
      });
    });

    await Promise.race([initPromise, exitPromise]);

    if (this.config.fridaPath) {
      await this.runFrida(child.pid, map.serverValue, fridaMode, logPath, modScripts);
    }

    const session: RunningSession = {
      port,
      pid: child.pid,
      map,
      startedAt: new Date(),
      logPath,
      mods: modIds ?? [],
      process: child,
    };

    this.sessions.set(port, session);
    child.on('exit', () => {
      this.sessions.delete(port);
    });

    return session;
  }

  async stopSession(port: number): Promise<boolean> {
    const session = this.sessions.get(port);
    if (!session) {
      return false;
    }
    const killed = await killProcessTree(session.pid);
    if (killed) {
      this.sessions.delete(port);
    }
    return killed;
  }

  private getNextPort(): number | null {
    if (this.config.ports.length === 0) return null;
    const total = this.config.ports.length;
    for (let i = 0; i < total; i += 1) {
      const idx = (this.portIdx + i) % total;
      const port = this.config.ports[idx];
      if (!this.sessions.has(port)) {
        this.portIdx = (idx + 1) % total;
        return port;
      }
    }
    return null;
  }

  private runFrida(
    pid: number,
    mapValue: string,
    fridaMode?: string,
    logPath?: string,
    modScripts?: string[]
  ): Promise<void> {
    const resolvedFridaPath = resolveFridaPath(this.config.fridaPath);
    const fridaArgs = [pid, mapValue];
    if (fridaMode) fridaArgs.push(fridaMode);
    if (modScripts && modScripts.length > 0) {
      for (const script of modScripts) {
        fridaArgs.push('--mod', script);
      }
    }
    const { command, args } = wrapCommand(resolvedFridaPath, fridaArgs);
    const frida = spawn(command, args, {
      windowsHide: true,
      cwd: path.dirname(resolvedFridaPath),
    });
    let exited = false;
    let initDone = false;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const maxLines = 20;
    const fridaLogStream = logPath ? fs.createWriteStream(logPath, { flags: 'a' }) : null;

    const logFridaLine = (source: string, line: string) => {
      const entry = `[${new Date().toISOString()}] frida ${source} ${line}\n`;
      if (fridaLogStream) fridaLogStream.write(entry);
      console.log(entry.trimEnd());
    };

    const exitPromise = new Promise<void>((_, reject) => {
      frida.on('exit', (code) => {
        exited = true;
        if (fridaLogStream) fridaLogStream.end();
        if (initDone) return;
        if (code !== 0) {
          const details = [
            stdoutLines.length ? `stdout:\n${stdoutLines.join('\n')}` : null,
            stderrLines.length ? `stderr:\n${stderrLines.join('\n')}` : null,
          ]
            .filter(Boolean)
            .join('\n');
          reject(new Error(`Frida exited with code ${code}${details ? `\n${details}` : ''}`));
        } else {
          reject(new Error('Frida exited before init signature'));
        }
      });
    });

    const signaturePromise = waitForSignatureWithHandlers(
      frida.stdout,
      frida.stderr,
      this.config.fridaInitSignature,
      this.config.initTimeoutMs,
      'Frida',
      (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          logFridaLine('stdout', trimmed);
          if (stdoutLines.length < maxLines) stdoutLines.push(trimmed);
        }
      },
      (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          logFridaLine('stderr', trimmed);
          if (stderrLines.length < maxLines) stderrLines.push(trimmed);
        }
      }
    ).then(() => {
      initDone = true;
    });

    return Promise.race([signaturePromise, exitPromise]).catch(async (error) => {
      if (!exited && frida.pid) {
        await killProcessTree(frida.pid);
      }
      throw error;
    });
  }
}

function buildConfig(): ServerConfig {
  const botToken = process.env.BOT_TOKEN;
  const publicIp = process.env.PUBLIC_IP;
  const binaryPath = process.env.BINARY_PATH;

  if (!botToken) {
    throw new Error('BOT_TOKEN is not set in .env file');
  }
  if (!publicIp) {
    throw new Error('PUBLIC_IP is not set in .env file');
  }
  if (!binaryPath) {
    throw new Error('BINARY_PATH is not set in .env file');
  }

  const ports = parsePortSpec(process.env.PORTS ?? '7777');
  const maxSessions = Number.parseInt(process.env.MAX_SESSIONS ?? '0', 10);
  if (Number.isNaN(maxSessions) || maxSessions < 0) {
    throw new Error('MAX_SESSIONS must be a non-negative integer');
  }

  const resolvedBinaryPath = resolveBinaryPath(binaryPath);
  const mapRefs = loadMapReferences().map((item) => ({
    name: item.name,
    serverValue: item.serverValue,
  }));
  if (mapRefs.length === 0) {
    throw new Error('Map references are empty. Check reference/maps.json');
  }

  return {
    publicIp,
    binaryPath: resolvedBinaryPath,
    binaryDir: path.dirname(resolvedBinaryPath),
    ports,
    maxSessions,
    maps: mapRefs,
    sessionParams: process.env.SESSION_PARAMS ?? 'maxplayers=8',
    initSignature: DEFAULT_INIT_SIGNATURE,
    initTimeoutMs: 30000,
    fridaPath: process.env.FRIDA_PATH ?? '',
    fridaInitSignature: 'Frida scripts have been injected.',
  };
}

let config: ServerConfig;
try {
  config = buildConfig();
} catch (error) {
  console.error(`❌ Error: ${(error as Error).message}`);
  process.exit(1);
}

const bot = new TelegramBot(process.env.BOT_TOKEN as string, { polling: true });
const serverManager = new ServerManager(config);

console.log('🎮 Dread Hunger Server Bot is starting...');

function createApiServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (!isAuthorized(req)) {
      sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      return;
    }

    if (!req.url) {
      sendJson(res, 400, { ok: false, error: 'Invalid URL' });
      return;
    }

    const url = new URL(req.url, `http://localhost:${API_PORT}`);
    try {
      if (req.method === 'GET' && url.pathname === '/status') {
        const sessions = serverManager.listSessions().map((session) => ({
          mapName: session.map.name,
          mapValue: session.map.serverValue,
          port: session.port,
          pid: session.pid,
          ip: config.publicIp,
          startedAt: session.startedAt.toISOString(),
          mods: session.mods ?? []
        }));
        sendJson(res, 200, { ok: true, sessions });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/maps') {
        const refs = loadMapReferences();
        const maps =
          refs.length > 0
            ? refs
            : config.maps.map((map) => ({
                name: map.name,
                serverValue: map.serverValue
              }));
        sendJson(res, 200, { ok: true, maps });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/mods') {
        const mods = listStableMods();
        const collections = listModCollections(mods);
        sendJson(res, 200, { ok: true, mods, collections });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/run') {
        const body = await readJsonBody(req);
        const mapName = body.mapName;
        const { mods, error } = parseMods(body.mods);
        if (error) {
          sendJson(res, 400, { ok: false, error });
          return;
        }
        if (typeof mapName !== 'string' || mapName.length === 0) {
          sendJson(res, 400, { ok: false, error: 'mapName is required' });
          return;
        }
        const { scripts, unknown } = resolveModScripts(mods);
        if (unknown.length > 0) {
          sendJson(res, 400, { ok: false, error: `Unknown mods: ${unknown.join(', ')}` });
          return;
        }
        const session = await serverManager.startSession(mapName, undefined, undefined, scripts, mods);
        sendJson(res, 200, {
          ok: true,
          session: {
            mapName: session.map.name,
            mapValue: session.map.serverValue,
            port: session.port,
            pid: session.pid,
            ip: config.publicIp,
            startedAt: session.startedAt.toISOString(),
            mods: session.mods ?? []
          }
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/testing') {
        const body = await readJsonBody(req);
        const mapName = body.mapName;
        const mode = typeof body.mode === 'string' ? body.mode : 'solo';
        const { mods, error } = parseMods(body.mods);
        if (error) {
          sendJson(res, 400, { ok: false, error });
          return;
        }
        if (typeof mapName !== 'string' || mapName.length === 0) {
          sendJson(res, 400, { ok: false, error: 'mapName is required' });
          return;
        }
        const params = mode === 'duo' ? TEST_PARAMS_DUO : TEST_PARAMS_SOLO;
        const { scripts, unknown } = resolveModScripts(mods);
        if (unknown.length > 0) {
          sendJson(res, 400, { ok: false, error: `Unknown mods: ${unknown.join(', ')}` });
          return;
        }
        const session = await serverManager.startSession(mapName, params, 'test', scripts, mods);
        sendJson(res, 200, {
          ok: true,
          session: {
            mapName: session.map.name,
            mapValue: session.map.serverValue,
            port: session.port,
            pid: session.pid,
            ip: config.publicIp,
            startedAt: session.startedAt.toISOString(),
            mods: session.mods ?? []
          }
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/stop') {
        const body = await readJsonBody(req);
        const port = Number.parseInt(String(body.port ?? ''), 10);
        if (Number.isNaN(port)) {
          sendJson(res, 400, { ok: false, error: 'port is required' });
          return;
        }
        const ok = await serverManager.stopSession(port);
        sendJson(res, 200, { ok });
        return;
      }

      sendJson(res, 404, { ok: false, error: 'Not found' });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: (error as Error).message });
    }
  });

  server.listen(API_PORT, () => {
    console.log(`🌐 API listening on http://0.0.0.0:${API_PORT}`);
  });
}

createApiServer();

// Command 1: /start - Welcome message
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

// Command 2: /help - Show all commands
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

📋 *Общие команды:*
/start — Приветственное сообщение
/help — Показать это сообщение
/dog — Случайный факт о собаках 🐕
  `;

  sendMarkdownSafe(bot, chatId, helpMessage);
});

// Command 3: /status - Show server status
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

// Command 4: /stop - Stop running session
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

// Command 5: /log - Show realtime log tail
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

// Command 6: /run - Choose and run map
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

// Command 7: /testing - Choose solo/duo for test run
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

  // Answer callback to remove loading state
  bot.answerCallbackQuery(callbackQuery.id);

  if (data.startsWith('run:')) {
    const mapName = data.replace('run:', '').trim();
    const safeMapName = escapeMarkdown(mapName);
    sendMarkdownSafe(bot, chatId, `⏳ Запускаю *${safeMapName}*...`);
    try {
      const session = await serverManager.startSession(mapName);
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
    const testParams =
      testMode === 'duo'
        ? 'maxplayers=2?thralls=2'
        : 'maxplayers=1?thralls=1';
    const safeMapName = escapeMarkdown(mapName);
    sendMarkdownSafe(
      bot,
      chatId,
      `⏳ Тестовый запуск *${safeMapName}* (${testMode})...`
    );
    try {
      const session = await serverManager.startSession(mapName, testParams, 'test');
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
});

// Command 8: /dog - Random dog facts
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
