import crypto from 'crypto';
import { statsStore } from './stats-store';
import {
  SessionEndReason,
  GameOutcome,
  PlayerRecord,
  SessionRecord,
  StatsReport,
} from './stats-types';
import { RunningSession } from '../types';
import { STATS_ALL_SESSIONS } from '../config';
import { computeEloLeaderboard } from './elo';

export function createStatsSessionId(): string {
  return crypto.randomUUID();
}

// Buffer for final stats that arrive before the session record is written
interface PendingFinalStats {
  players: PlayerRecord[];
  outcome: GameOutcome;
}
const pendingFinalStats = new Map<string, PendingFinalStats>();

function hasNonDefaultModifiers(customModifiers: Record<string, number>): boolean {
  return Object.keys(customModifiers).length > 0;
}

export async function recordSessionEnd(
  session: RunningSession,
  statsSessionId: string,
  endReason: SessionEndReason
): Promise<void> {
  // Сессии с нестандартными модификаторами не учитываются в статистике,
  // если не включён флаг STATS_ALL_SESSIONS (режим разработки).
  if (!STATS_ALL_SESSIONS && hasNonDefaultModifiers(session.customModifiers)) {
    pendingFinalStats.delete(statsSessionId);
    return;
  }

  const endedAt = new Date();
  const durationSeconds = Math.floor(
    (endedAt.getTime() - session.startedAt.getTime()) / 1000
  );

  // Merge any already-arrived final stats (session_stats mod can post before process exits)
  const pending = pendingFinalStats.get(statsSessionId);
  pendingFinalStats.delete(statsSessionId);

  const record: SessionRecord = {
    sessionId: statsSessionId,
    port: session.port,
    map: session.map.name,
    mapValue: session.map.serverValue,
    mods: session.mods,
    customModifiers: session.customModifiers,
    startedAt: session.startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationSeconds,
    players: pending?.players ?? [],
    outcome: pending?.outcome ?? 'unknown',
    endReason,
  };

  await statsStore.append(record);
}

export async function recordSessionFinalStats(
  sessionId: string,
  players: PlayerRecord[],
  winningTeam: number
): Promise<void> {
  const outcome: GameOutcome =
    winningTeam === 1 ? 'humans_win' :
    winningTeam === 2 ? 'cannibals_win' :
    'unknown';

  // Try to update an existing record first; if not found yet, buffer for later
  const sessions = await statsStore.readAll();
  const exists = sessions.some((s) => s.sessionId === sessionId);
  if (exists) {
    await statsStore.updateBySessionId(sessionId, { players, outcome });
  } else {
    pendingFinalStats.set(sessionId, { players, outcome });
  }
}

export async function getSessionRecord(sessionId: string): Promise<SessionRecord | null> {
  const sessions = await statsStore.readAll();
  return sessions.find((s) => s.sessionId === sessionId) ?? null;
}

export async function getStatsReport(options?: { includeElo?: boolean }): Promise<StatsReport> {
  const sessions = await statsStore.readAll();
  const includeElo = options?.includeElo === true;

  const totalSessions = sessions.length;
  const totalPlaytimeSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
  const averageSessionSeconds = totalSessions > 0
    ? Math.floor(totalPlaytimeSeconds / totalSessions)
    : 0;

  // Sessions per day (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const perDayMap = new Map<string, number>();
  for (const s of sessions) {
    const date = s.endedAt.slice(0, 10);
    if (new Date(s.endedAt) >= thirtyDaysAgo) {
      perDayMap.set(date, (perDayMap.get(date) ?? 0) + 1);
    }
  }
  const sessionsPerDay = [...perDayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }));

  // Top players by games played
  const gamesMap = new Map<string, number>();
  for (const s of sessions) {
    for (const p of s.players) {
      gamesMap.set(p.name, (gamesMap.get(p.name) ?? 0) + 1);
    }
  }
  const topPlayersByGames = [...gamesMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, games]) => ({ name, games }));

  // Top players by winrate (min 3 games in sessions with known outcome)
  const resolvedSessions = sessions.filter((s) => s.outcome !== 'unknown');
  const winsMap = new Map<string, number>();
  const resolvedGamesMap = new Map<string, number>();
  for (const s of resolvedSessions) {
    for (const p of s.players) {
      resolvedGamesMap.set(p.name, (resolvedGamesMap.get(p.name) ?? 0) + 1);
      const playerWon =
        (s.outcome === 'humans_win' && !p.traitor) ||
        (s.outcome === 'cannibals_win' && p.traitor);
      if (playerWon) {
        winsMap.set(p.name, (winsMap.get(p.name) ?? 0) + 1);
      }
    }
  }
  const topPlayersByWinrate = [...resolvedGamesMap.entries()]
    .filter(([, g]) => g >= 3)
    .map(([name, games]) => {
      const wins = winsMap.get(name) ?? 0;
      return { name, wins, games, winrate: Math.round((wins / games) * 100) };
    })
    .sort((a, b) => b.winrate - a.winrate || b.games - a.games)
    .slice(0, 10);

  const recentSessions = sessions.slice(-10).reverse();

  const report: StatsReport = {
    totalSessions,
    totalPlaytimeSeconds,
    averageSessionSeconds,
    topPlayersByGames,
    topPlayersByWinrate,
    sessionsPerDay,
    recentSessions
  };

  if (includeElo) {
    report.eloLeaderboard = computeEloLeaderboard(sessions);
  }

  return report;
}
