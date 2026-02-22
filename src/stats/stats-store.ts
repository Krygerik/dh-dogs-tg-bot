import fs from 'fs';
import path from 'path';
import { SessionRecord, StatsFile } from './stats-types';

const DEFAULT_STATS_PATH = path.join(process.cwd(), 'data', 'stats.json');

class StatsStore {
  private readonly filePath: string;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async readAll(): Promise<SessionRecord[]> {
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as StatsFile;
      return data.sessions ?? [];
    } catch {
      return [];
    }
  }

  async append(record: SessionRecord): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this._mutate((sessions) => {
      sessions.push(record);
    }));
    return this.writeQueue;
  }

  async updateBySessionId(sessionId: string, patch: Partial<SessionRecord>): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this._mutate((sessions) => {
      const idx = sessions.findIndex((s) => s.sessionId === sessionId);
      if (idx !== -1) {
        sessions[idx] = { ...sessions[idx], ...patch };
      }
    }));
    return this.writeQueue;
  }

  private async _mutate(fn: (sessions: SessionRecord[]) => void): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.filePath), { recursive: true });

    let data: StatsFile = { version: 1, sessions: [] };
    try {
      const raw = await fs.promises.readFile(this.filePath, 'utf-8');
      data = JSON.parse(raw) as StatsFile;
    } catch {
      // file does not exist yet — use default
    }

    fn(data.sessions);

    const tmpPath = `${this.filePath}.tmp`;
    await fs.promises.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    await fs.promises.rename(tmpPath, this.filePath);
  }
}

export const statsStore = new StatsStore(
  process.env.STATS_FILE_PATH ?? DEFAULT_STATS_PATH
);
