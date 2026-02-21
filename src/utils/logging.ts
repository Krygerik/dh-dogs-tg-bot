import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const LOGS_DIR = path.join(process.cwd(), 'logs');
const MAX_LOG_FILES = 20;

export function ensureLogsDir(): void {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

export function cleanupOldLogs(): void {
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

export function makeLogFileName(mapName: string, port: number): string {
  const safeName = mapName.replace(/[^\w.-]+/g, '_');
  return `session_${safeName}_${port}_${Date.now()}.log`;
}

export function attachRealtimeLogging(
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

export function readLogTail(logPath: string, maxLines: number = 40, maxChars: number = 3500): string {
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
