import { CustomModifierDefinition } from '../types';

/** От менее значимого к более значимому (v1: без dayminutes / daysbeforeblizzard). */
export const BALANCE_MODIFIER_PRIORITY = [
  'predatordamage',
  'coalburnrate',
  'coldintensity',
  'hungerrate'
] as const;

export type BalanceModifierKey = (typeof BALANCE_MODIFIER_PRIORITY)[number];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type EloBalanceInputPlayer = {
  name: string;
  traitor: boolean;
};

/**
 * Единственный применимый в игре рантайн-множитель — predatordamage (Frida).
 * Формула: strengthRatio = avgCrewElo / avgThrallElo, predatordamage = strengthRatio² (кламп по справочнику).
 * Сильнее мирные → больше урон хищников; сильнее предатели → меньше.
 */
export function computeEloBalanceModifiers(
  players: EloBalanceInputPlayer[],
  ratingByName: Map<string, number>,
  definitions: CustomModifierDefinition[],
  options?: { initialRating?: number }
): {
  modifiers: Record<string, number>;
  avgCrew: number;
  avgThrall: number;
  diff: number;
  stepsUsed: number;
  strengthRatio: number;
} {
  const initial = options?.initialRating ?? 1500;
  const defByKey = new Map(definitions.map((d) => [d.key, d]));

  const crew = players.filter((p) => !p.traitor);
  const thralls = players.filter((p) => p.traitor);

  const avg = (list: EloBalanceInputPlayer[]) =>
    list.length === 0
      ? initial
      : list.reduce((s, p) => s + (ratingByName.get(p.name) ?? initial), 0) / list.length;

  const avgCrew = avg(crew);
  const avgThrall = avg(thralls);
  const diff = avgCrew - avgThrall;

  const modifiers: Record<string, number> = {};
  for (const key of BALANCE_MODIFIER_PRIORITY) {
    const def = defByKey.get(key);
    if (def) modifiers[key] = def.default;
  }

  let strengthRatio = 1;

  if (crew.length === 0 || thralls.length === 0) {
    return { modifiers, avgCrew, avgThrall, diff, stepsUsed: 0, strengthRatio };
  }

  strengthRatio = avgThrall > 0 ? avgCrew / avgThrall : 1;
  const rawPred = strengthRatio * strengthRatio;
  const defP = defByKey.get('predatordamage');
  if (defP) {
    modifiers.predatordamage = clamp(rawPred, defP.min, defP.max);
  }

  return { modifiers, avgCrew, avgThrall, diff, stepsUsed: 0, strengthRatio };
}
