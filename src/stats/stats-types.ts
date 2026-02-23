export type SessionEndReason = 'natural' | 'admin_stop' | 'crash' | 'unknown';

export type GameOutcome = 'humans_win' | 'cannibals_win' | 'unknown';

export interface MatchStatEntry {
  statType: number;
  value: number;
}

export interface PlayerRecord {
  name: string;
  roleName: string | null;
  traitor: boolean;
  isDead: boolean;
  // Поля из scoreboard_stats (опциональны — могут отсутствовать в старых записях)
  isDisconnected?: boolean;
  deathCount?: number;
  victimCount?: number;
  cannibalLevel?: number;
  prestige?: number;
  rank?: number;
  experience?: number;
  matchStats?: MatchStatEntry[];
}

export interface SessionRecord {
  sessionId: string;
  port: number;
  map: string;
  mapValue: string;
  mods: string[];
  customModifiers: Record<string, number>;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  players: PlayerRecord[];
  outcome: GameOutcome;
  endReason: SessionEndReason;
}

export interface StatsFile {
  version: number;
  sessions: SessionRecord[];
}

export interface StatsReport {
  totalSessions: number;
  totalPlaytimeSeconds: number;
  averageSessionSeconds: number;
  topPlayersByGames: Array<{ name: string; games: number }>;
  topPlayersByWinrate: Array<{ name: string; wins: number; games: number; winrate: number }>;
  sessionsPerDay: Array<{ date: string; count: number }>;
  recentSessions: SessionRecord[];
}
