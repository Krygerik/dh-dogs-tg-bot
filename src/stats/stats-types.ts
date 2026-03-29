export type SessionEndReason = 'natural' | 'admin_stop' | 'crash' | 'unknown';

export type GameOutcome = 'humans_win' | 'cannibals_win' | 'unknown';

export interface PlayerRecord {
  name: string;
  roleName: string | null;
  /** true = Маньяк (Thrall/Cannibal), false = Мирный (Explorer) */
  traitor: boolean;
  isDead: boolean;
  /** Суммарный урон по команде противника. 0 если данных нет. */
  damageToEnemy: number;
}

export interface SessionRecord {
  sessionId: string;
  port: number;
  map: string;
  mapValue: string;
  mods: string[];
  customModifiers: Record<string, number>;
  /** Модификаторы, фактически применённые рантайм-балансировщиком (Frida). */
  balancerAppliedModifiers?: Record<string, number>;
  /** Сессия учитывает автобаланс по Elo (модификаторы не скрывают матч из статистики). */
  modifiersFromBalancer?: boolean;
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
  topPlayersByDamage: Array<{ name: string; totalDamage: number; games: number; avgDamage: number }>;
  sessionsPerDay: Array<{ date: string; count: number }>;
  recentSessions: SessionRecord[];
  /** Только для админ-клиента (заголовок X-App-Build: admin). Не показывать игрокам. */
  eloLeaderboard?: Array<{ name: string; rating: number; games: number }>;
}
