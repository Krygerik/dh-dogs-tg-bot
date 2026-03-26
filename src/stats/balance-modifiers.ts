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

function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  const k = Math.round(value / step);
  return k * step;
}

export type EloBalanceInputPlayer = {
  name: string;
  traitor: boolean;
};

/**
 * По средним Elo команд и разнице сил выставляет множители (база = default из справочника).
 * Сильнее мирные — ужесточаем среду (множители вверх по ряду).
 * Сильнее предатели — смягчаем (множители вниз).
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

  if (crew.length === 0 || thralls.length === 0 || Math.abs(diff) < 1e-6) {
    return { modifiers, avgCrew, avgThrall, diff, stepsUsed: 0 };
  }

  const magnitude = Math.min(4, Math.floor(Math.abs(diff) / 40));
  const stepsUsed = magnitude;
  const harderForCrew = diff > 0;

  for (let i = 0; i < stepsUsed; i += 1) {
    const key = BALANCE_MODIFIER_PRIORITY[i];
    const def = defByKey.get(key);
    if (!def) continue;
    const delta = harderForCrew ? def.step : -def.step;
    let next = modifiers[key] + delta;
    next = roundToStep(next, def.step);
    next = clamp(next, def.min, def.max);
    modifiers[key] = next;
  }

  return { modifiers, avgCrew, avgThrall, diff, stepsUsed };
}
