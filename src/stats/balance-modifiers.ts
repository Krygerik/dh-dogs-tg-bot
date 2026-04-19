/**
 * Elo-баланс: predatordamage, predatorhealth, playermeleedamage, playerrangeddamage.
 *
 * Классический режим: 8 игроков — 6 мирных (crew) и 2 предателя (thrall).
 * Сравнение команд: средний рейтинг (avgCrew vs avgThrall).
 *
 * Суммарный вес T: по одной единице на каждые ELO_RATING_DIFF_PER_WEIGHT_UNIT пунктов
 * разницы |avgCrew − avgThrall| (floor), опционально множитель для неклассики — см. опции,
 * по умолчанию как у классического 6+2, сверху — maxTotalWeightUnits.
 *
 * Случайный сплит бюджета T между predatordamage и predatorhealth: на каждый шаг сетки 0.25
 * по любому из двух — ровно ELO_WEIGHT_PER_GRID_STEP единиц веса (по умолчанию 1).
 * Урон/HP хищников: [0.25, 3], шаг 0.25.
 *
 * playermeleedamage [0.5, 2], шаг 0.25 — масштаб «стоимости шага» тот же (1 ед. на шаг 0.25), без участия в сплите d/h;
 * формула от diff (рейтинг).
 *
 * playerrangedamage [0.25, 1], шаг 0.25 — та же стоимость шага; активация при diff < 0 и T ≥ минимума.
 */

export const ELO_CLASSIC_CREW_TEAM_SIZE = 6;
export const ELO_CLASSIC_THRALL_TEAM_SIZE = 2;
export const ELO_CLASSIC_LOBBY_SIZE =
  ELO_CLASSIC_CREW_TEAM_SIZE + ELO_CLASSIC_THRALL_TEAM_SIZE;

export const ELO_PREDATOR_MULT_MIN = 0.25;
export const ELO_PREDATOR_MULT_MAX = 3;
export const ELO_PREDATOR_MULT_STEP = 0.25;

/**
 * Единицы веса на один шаг сетки 0.25 по любому из модов (одинаково для всех четырёх).
 * Сплит T между уроном и HP хищников: d·w + h·w = T, где w = ELO_WEIGHT_PER_GRID_STEP.
 */
export const ELO_WEIGHT_PER_GRID_STEP = 1;

/** Синонимы для совместимости (равны ELO_WEIGHT_PER_GRID_STEP). */
export const ELO_WEIGHT_PER_DAMAGE_GRID_STEP = ELO_WEIGHT_PER_GRID_STEP;
export const ELO_WEIGHT_PER_HP_GRID_STEP = ELO_WEIGHT_PER_GRID_STEP;

/** Одна единица суммарного веса на каждые столько пунктов разницы средних рейтингов команд. */
export const ELO_RATING_DIFF_PER_WEIGHT_UNIT = 5;

/** Множитель веса для неклассического состава (по умолчанию 1 — как у классического 6+2). */
export const ELO_NON_CLASSIC_ROSTER_WEIGHT_MULTIPLIER = 1;

export const ELO_PLAYER_MELEE_MULT_MIN = 0.5;
export const ELO_PLAYER_MELEE_MULT_MAX = 2;
export const ELO_PLAYER_MELEE_MULT_STEP = 0.25;

export const ELO_PLAYER_RANGED_MULT_MIN = 0.25;
export const ELO_PLAYER_RANGED_MULT_MAX = 1;
export const ELO_PLAYER_RANGED_MULT_STEP = 0.25;

/** Минимальный суммарный вес T (из |avgCrew−avgThrall|), при котором включается снижение дальнобоя. */
export const ELO_MIN_WEIGHT_UNITS_FOR_PLAYER_RANGED = 1;

export const ELO_BALANCE_MODIFIER_KEYS = [
  'predatordamage',
  'predatorhealth',
  'playermeleedamage',
  'playerrangeddamage'
] as const;

export type EloBalanceModifierKey = (typeof ELO_BALANCE_MODIFIER_KEYS)[number];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Ближайшее значение сетки 0.25 в диапазоне [0.25, 3].
 */
export function quantizePredatorMultiplier(raw: number): number {
  const q = Math.round(raw / ELO_PREDATOR_MULT_STEP) * ELO_PREDATOR_MULT_STEP;
  return clamp(q, ELO_PREDATOR_MULT_MIN, ELO_PREDATOR_MULT_MAX);
}

/** Сетка [0.5, 2], шаг 0.25 — урон ближнего боя игроков (отдельно от бюджета веса T). */
export function quantizePlayerMeleeMultiplier(raw: number): number {
  const q = Math.round(raw / ELO_PLAYER_MELEE_MULT_STEP) * ELO_PLAYER_MELEE_MULT_STEP;
  return clamp(q, ELO_PLAYER_MELEE_MULT_MIN, ELO_PLAYER_MELEE_MULT_MAX);
}

/**
 * Множитель ближнего боя: diff = avgCrew − avgThrall (по рейтингу).
 * diff > 0 → мирные сильнее → mult > 1; diff < 0 → предатели сильнее → mult < 1.
 */
export function computePlayerMeleeDamageFromRatingDiff(
  diff: number,
  initialRating: number,
  crewCount: number,
  thrallCount: number
): number {
  if (crewCount === 0 || thrallCount === 0) {
    return quantizePlayerMeleeMultiplier(1);
  }
  if (Math.abs(diff) < 1e-9) {
    return quantizePlayerMeleeMultiplier(1);
  }
  const scale = Math.max(initialRating, 1) * 3;
  const t = clamp(diff / scale, -1, 1);
  const rawLinear = 1.25 + t * 0.75;
  return quantizePlayerMeleeMultiplier(rawLinear);
}

/** Сетка [0.25, 1], шаг 0.25 — только снижение урона дальнобоя игроков (лук/пистолет/мушкет). */
export function quantizePlayerRangedMultiplier(raw: number): number {
  const q = Math.round(raw / ELO_PLAYER_RANGED_MULT_STEP) * ELO_PLAYER_RANGED_MULT_STEP;
  return clamp(q, ELO_PLAYER_RANGED_MULT_MIN, ELO_PLAYER_RANGED_MULT_MAX);
}

/**
 * Дальнобой: только mult ≤ 1. При diff = avgCrew − avgThrall < 0 (мирные слабее по рейтингу) — снижаем урон;
 * при T < минимума — без эффекта (1).
 */
export function computePlayerRangedDamageFromRatingDiff(
  diff: number,
  initialRating: number,
  crewCount: number,
  thrallCount: number,
  totalWeightUnits: number
): number {
  if (crewCount === 0 || thrallCount === 0) {
    return quantizePlayerRangedMultiplier(1);
  }
  if (diff >= -1e-9) {
    return quantizePlayerRangedMultiplier(1);
  }
  if (totalWeightUnits < ELO_MIN_WEIGHT_UNITS_FOR_PLAYER_RANGED) {
    return quantizePlayerRangedMultiplier(1);
  }
  const scale = Math.max(initialRating, 1) * 3;
  const t = clamp(diff / scale, -1, 0);
  const rawLinear = 1 + t * 0.75;
  return quantizePlayerRangedMultiplier(rawLinear);
}

export type EloBalanceInputPlayer = {
  name: string;
  traitor: boolean;
};

export type EloBalanceComputeOptions = {
  initialRating?: number;
  /** По умолчанию Math.random; для тестов можно подставить детерминированный RNG. */
  rng?: () => number;
  /** Пунктов разницы средних (|avgCrew − avgThrall|) на одну единицу веса (по умолчанию ELO_RATING_DIFF_PER_WEIGHT_UNIT). */
  ratingDiffPerWeightUnit?: number;
  /** Множитель веса для неклассического состава (по умолчанию 1, как у 6+2). */
  nonClassicRosterWeightMultiplier?: number;
  /** Верхняя граница суммарного веса (защита от постоянного упора в 3x). */
  maxTotalWeightUnits?: number;
};

/**
 * Полный классический лобби: ровно 8 игроков, 6 мирных и 2 тралла.
 */
export function isClassicEightPlayerRoster(players: EloBalanceInputPlayer[]): boolean {
  if (players.length !== ELO_CLASSIC_LOBBY_SIZE) return false;
  let crew = 0;
  let thrall = 0;
  for (const p of players) {
    if (p.traitor) thrall += 1;
    else crew += 1;
  }
  return crew === ELO_CLASSIC_CREW_TEAM_SIZE && thrall === ELO_CLASSIC_THRALL_TEAM_SIZE;
}

/**
 * Синтетическое классическое лобби 6+2 для APP_ENV=dev и соло-тестов:
 * с сервера/Frida приходит неполный состав, поэтому расчёт elo-balance на API
 * подставляет фиксированный набор слотов (имена только для карты рейтингов).
 */
export const ELO_DEV_SOLO_SYNTHETIC_CLASSIC_LOBBY: readonly EloBalanceInputPlayer[] = [
  { name: '__elo_dev_crew_1', traitor: false },
  { name: '__elo_dev_crew_2', traitor: false },
  { name: '__elo_dev_crew_3', traitor: false },
  { name: '__elo_dev_crew_4', traitor: false },
  { name: '__elo_dev_crew_5', traitor: false },
  { name: '__elo_dev_crew_6', traitor: false },
  { name: '__elo_dev_thrall_1', traitor: true },
  { name: '__elo_dev_thrall_2', traitor: true }
];

/**
 * Dev-мок для классического 6+2: каждому мирному 2×initial, каждому траллу 1×initial
 * → средний мирный в 2 раза выше среднего тралла (как «команда мирных в 2 раза сильнее» по рейтингу на игрока).
 *
 * Пример при initial=1500: шесть мирных по 3000, два тралла по 1500
 * → sumCrew=18000, sumThrall=3000, avgCrew=3000, avgThrall=1500, strengthRatio=2.
 */
export function buildClassicDevMockRatingByName(
  players: EloBalanceInputPlayer[],
  initialRating: number
): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of players) {
    m.set(p.name, p.traitor ? initialRating : 2 * initialRating);
  }
  return m;
}

/**
 * Случайное разбиение бюджета T между шагами predatordamage и predatorhealth:
 * d·w + h·w = T, w = ELO_WEIGHT_PER_GRID_STEP (по умолчанию d + h = T).
 */
export function splitTotalWeightBetweenDamageAndHp(
  totalWeightUnits: number,
  rng: () => number
): { damageGridSteps: number; hpGridSteps: number } {
  const T = Math.max(0, Math.floor(totalWeightUnits));
  const w = ELO_WEIGHT_PER_GRID_STEP;
  if (T === 0 || w <= 0) {
    return { damageGridSteps: 0, hpGridSteps: 0 };
  }
  if (w === 1) {
    const h = Math.floor(rng() * (T + 1));
    return { damageGridSteps: T - h, hpGridSteps: h };
  }
  const units = T / w;
  if (!Number.isInteger(units)) {
    return { damageGridSteps: 0, hpGridSteps: 0 };
  }
  const h = Math.floor(rng() * (units + 1));
  return { damageGridSteps: units - h, hpGridSteps: h };
}

const DEFAULT_MAX_TOTAL_WEIGHT = 48;

/**
 * T из разницы средних рейтингов команд и множителя классического состава;
 * дальше случайный сплит урона/HP.
 */
export function computeEloBalanceModifiers(
  players: EloBalanceInputPlayer[],
  ratingByName: Map<string, number>,
  options?: EloBalanceComputeOptions
): {
  modifiers: Record<EloBalanceModifierKey, number>;
  avgCrew: number;
  avgThrall: number;
  sumCrewRatings: number;
  sumThrallRatings: number;
  crewCount: number;
  thrallCount: number;
  isClassicRoster: boolean;
  diff: number;
  stepsUsed: number;
  strengthRatio: number;
  totalWeightUnits: number;
  damageGridSteps: number;
  hpGridSteps: number;
  direction: 1 | -1 | 0;
} {
  const initial = options?.initialRating ?? 1500;
  const rng = options?.rng ?? Math.random;
  const maxTotalWeightUnits = options?.maxTotalWeightUnits ?? DEFAULT_MAX_TOTAL_WEIGHT;
  const ratingDiffPerUnit =
    options?.ratingDiffPerWeightUnit ?? ELO_RATING_DIFF_PER_WEIGHT_UNIT;
  const nonClassicMult =
    options?.nonClassicRosterWeightMultiplier ?? ELO_NON_CLASSIC_ROSTER_WEIGHT_MULTIPLIER;

  const crew = players.filter((p) => !p.traitor);
  const thralls = players.filter((p) => p.traitor);

  const sumCrewRatings = crew.reduce((s, p) => s + (ratingByName.get(p.name) ?? initial), 0);
  const sumThrallRatings = thralls.reduce((s, p) => s + (ratingByName.get(p.name) ?? initial), 0);

  const crewCount = crew.length;
  const thrallCount = thralls.length;

  const avgCrew = crewCount === 0 ? initial : sumCrewRatings / crewCount;
  const avgThrall = thrallCount === 0 ? initial : sumThrallRatings / thrallCount;
  const diff = avgCrew - avgThrall;
  const isClassicRoster = isClassicEightPlayerRoster(players);

  const baseUnitsEarly =
    crewCount === 0 || thrallCount === 0 ? 0 : Math.floor(Math.abs(diff) / ratingDiffPerUnit);
  const rosterFactorEarly = isClassicRoster ? 1 : nonClassicMult;
  const preTotalWeightUnits = Math.min(
    maxTotalWeightUnits,
    Math.max(0, Math.floor(baseUnitsEarly * rosterFactorEarly))
  );

  const neutral = quantizePredatorMultiplier(1);
  const modifiers: Record<EloBalanceModifierKey, number> = {
    predatordamage: neutral,
    predatorhealth: neutral,
    playermeleedamage: computePlayerMeleeDamageFromRatingDiff(
      diff,
      initial,
      crewCount,
      thrallCount
    ),
    playerrangeddamage: computePlayerRangedDamageFromRatingDiff(
      diff,
      initial,
      crewCount,
      thrallCount,
      preTotalWeightUnits
    ),
  };

  let strengthRatio = 1;
  let totalWeightUnits = 0;
  let damageGridSteps = 0;
  let hpGridSteps = 0;
  let direction: 1 | -1 | 0 = 0;

  if (crewCount === 0 || thrallCount === 0) {
    return {
      modifiers,
      avgCrew,
      avgThrall,
      sumCrewRatings,
      sumThrallRatings,
      crewCount,
      thrallCount,
      isClassicRoster,
      diff,
      stepsUsed: 0,
      strengthRatio,
      totalWeightUnits,
      damageGridSteps,
      hpGridSteps,
      direction,
    };
  }

  strengthRatio = avgThrall > 0 ? avgCrew / avgThrall : 1;
  if (Math.abs(diff) < 1e-9) {
    return {
      modifiers,
      avgCrew,
      avgThrall,
      sumCrewRatings,
      sumThrallRatings,
      crewCount,
      thrallCount,
      isClassicRoster,
      diff,
      stepsUsed: 0,
      strengthRatio,
      totalWeightUnits: 0,
      damageGridSteps: 0,
      hpGridSteps: 0,
      direction: 0,
    };
  }

  const baseUnits = Math.floor(Math.abs(diff) / ratingDiffPerUnit);
  const rosterFactor = isClassicRoster ? 1 : nonClassicMult;
  totalWeightUnits = Math.min(
    maxTotalWeightUnits,
    Math.max(0, Math.floor(baseUnits * rosterFactor))
  );

  if (totalWeightUnits === 0) {
    return {
      modifiers,
      avgCrew,
      avgThrall,
      sumCrewRatings,
      sumThrallRatings,
      crewCount,
      thrallCount,
      isClassicRoster,
      diff,
      stepsUsed: 0,
      strengthRatio,
      totalWeightUnits: 0,
      damageGridSteps: 0,
      hpGridSteps: 0,
      direction: 0,
    };
  }

  direction = diff > 0 ? 1 : -1;
  const split = splitTotalWeightBetweenDamageAndHp(totalWeightUnits, rng);
  damageGridSteps = split.damageGridSteps;
  hpGridSteps = split.hpGridSteps;

  const step = ELO_PREDATOR_MULT_STEP;
  modifiers.predatordamage = quantizePredatorMultiplier(1 + direction * damageGridSteps * step);
  modifiers.predatorhealth = quantizePredatorMultiplier(1 + direction * hpGridSteps * step);
  modifiers.playermeleedamage = computePlayerMeleeDamageFromRatingDiff(
    diff,
    initial,
    crewCount,
    thrallCount
  );
  modifiers.playerrangeddamage = computePlayerRangedDamageFromRatingDiff(
    diff,
    initial,
    crewCount,
    thrallCount,
    totalWeightUnits
  );

  return {
    modifiers,
    avgCrew,
    avgThrall,
    sumCrewRatings,
    sumThrallRatings,
    crewCount,
    thrallCount,
    isClassicRoster,
    diff,
    stepsUsed: damageGridSteps + hpGridSteps,
    strengthRatio,
    totalWeightUnits,
    damageGridSteps,
    hpGridSteps,
    direction,
  };
}
