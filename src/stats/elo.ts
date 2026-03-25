import { SessionRecord } from './stats-types';

const DEFAULT_INITIAL = 1500;
const DEFAULT_K = 24;

function expectedTeamScore(teamRating: number, opponentRating: number): number {
  return 1 / (1 + Math.pow(10, (opponentRating - teamRating) / 400));
}

/**
 * Командный Elo: мирные vs маньяки, средний рейтинг команды до матча, обновление поровну внутри команды.
 * Учитываются только сессии с исходом humans_win / cannibals_win и хотя бы одним игроком в каждой команде.
 */
export function computeEloLeaderboard(
  sessions: SessionRecord[],
  options?: { initialRating?: number; k?: number }
): Array<{ name: string; rating: number; games: number }> {
  const initialRating = options?.initialRating ?? DEFAULT_INITIAL;
  const K = options?.k ?? DEFAULT_K;
  const ratings = new Map<string, number>();
  const games = new Map<string, number>();

  const getR = (name: string) => ratings.get(name) ?? initialRating;

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.endedAt).getTime() - new Date(b.endedAt).getTime()
  );

  for (const s of sorted) {
    if (s.outcome !== 'humans_win' && s.outcome !== 'cannibals_win') continue;
    const crew = s.players.filter((p) => !p.traitor);
    const thralls = s.players.filter((p) => p.traitor);
    if (crew.length === 0 || thralls.length === 0) continue;

    const rCrew = crew.reduce((sum, p) => sum + getR(p.name), 0) / crew.length;
    const rThrall = thralls.reduce((sum, p) => sum + getR(p.name), 0) / thralls.length;
    const eCrew = expectedTeamScore(rCrew, rThrall);
    const eThrall = 1 - eCrew;

    const crewWins = s.outcome === 'humans_win';
    const sCrew = crewWins ? 1 : 0;
    const sThrall = crewWins ? 0 : 1;

    for (const p of crew) {
      const oldR = getR(p.name);
      const delta = (K * (sCrew - eCrew)) / crew.length;
      ratings.set(p.name, oldR + delta);
      games.set(p.name, (games.get(p.name) ?? 0) + 1);
    }
    for (const p of thralls) {
      const oldR = getR(p.name);
      const delta = (K * (sThrall - eThrall)) / thralls.length;
      ratings.set(p.name, oldR + delta);
      games.set(p.name, (games.get(p.name) ?? 0) + 1);
    }
  }

  const rows = [...ratings.entries()].map(([name, rating]) => ({
    name,
    rating: Math.round(rating * 10) / 10,
    games: games.get(name) ?? 0
  }));
  rows.sort((a, b) => b.rating - a.rating || b.games - a.games);
  return rows;
}
