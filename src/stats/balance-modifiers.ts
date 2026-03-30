/**
 * Elo-баланс: predatordamage, predatorhealth, craftspeed.
 *
 * Классический режим: 8 игроков — 6 мирных (crew) и 2 предателя (thrall).
 * Сравнение команд: средний рейтинг по слоту команды (avgCrew vs avgThrall).
 * Это то же самое, что (sumCrew/6) / (sumThrall/2) при полном составе 6+2.
 * При равном уровне игры у всех восьмерых одинаковый рейтинг → avgCrew = avgThrall → нейтральные множители.
 *
 * Суммарный вес случайно распределяется между модификаторами:
 * 1 ед. веса = шаг 0.25 по урону (predatordamage); 3 ед. = шаг 0.25 по HP; 2 ед. = шаг 0.25 по скорости крафта (= два шага урона по весу).
 * Урон/HP: [0.25, 3], шаг 0.25. Скорость крафта: [0.5, 2], шаг 0.25, нейтраль 1.
 */

export const ELO_CLASSIC_CREW_TEAM_SIZE = 6;
export const ELO_CLASSIC_THRALL_TEAM_SIZE = 2;
export const ELO_CLASSIC_LOBBY_SIZE =
  ELO_CLASSIC_CREW_TEAM_SIZE + ELO_CLASSIC_THRALL_TEAM_SIZE;

export const ELO_PREDATOR_MULT_MIN = 0.25;
export const ELO_PREDATOR_MULT_MAX = 3;
export const ELO_PREDATOR_MULT_STEP = 0.25;

/** Вес одного шага сетки по урону (относительно «бюджета» веса). */
export const ELO_WEIGHT_PER_DAMAGE_GRID_STEP = 1;
/** Вес одного шага сетки по HP равен трём шагам урона по весу. */
export const ELO_WEIGHT_PER_HP_GRID_STEP = 3;
/** Вес одного шага сетки по скорости крафта — два шага predatordamage (см. ELO_WEIGHT_PER_DAMAGE_GRID_STEP). */
export const ELO_WEIGHT_PER_CRAFT_GRID_STEP = 2 * ELO_WEIGHT_PER_DAMAGE_GRID_STEP;

export const ELO_CRAFT_MULT_MIN = 0.5;
export const ELO_CRAFT_MULT_MAX = 2;
export const ELO_CRAFT_MULT_STEP = 0.25;

export const ELO_BALANCE_MODIFIER_KEYS = ['predatordamage', 'predatorhealth', 'craftspeed'] as const;

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

/** Сетка [0.5, 2], шаг 0.25, нейтраль 1. */
export function quantizeCraftMultiplier(raw: number): number {
  const q = Math.round(raw / ELO_CRAFT_MULT_STEP) * ELO_CRAFT_MULT_STEP;
  return clamp(q, ELO_CRAFT_MULT_MIN, ELO_CRAFT_MULT_MAX);
}

export type EloBalanceInputPlayer = {
  name: string;
  traitor: boolean;
};

export type EloBalanceComputeOptions = {
  initialRating?: number;
  /** По умолчанию Math.random; для тестов можно подставить детерминированный RNG. */
  rng?: () => number;
  /**
   * Масштаб перевода |strengthRatio² − 1| в целые единицы суммарного веса.
   * Чем больше — тем сильнее отклонение множителей при том же дисбалансе команд.
   */
  weightScale?: number;
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
 * Случайное разбиение целого бюджета T: d + 3h = T, d,h ≥ 0.
 * d — число шагов сетки по урону, h — по HP.
 */
export function splitTotalWeightBetweenDamageAndHp(
  totalWeightUnits: number,
  rng: () => number
): { damageGridSteps: number; hpGridSteps: number } {
  const T = Math.max(0, Math.floor(totalWeightUnits));
  if (T === 0) {
    return { damageGridSteps: 0, hpGridSteps: 0 };
  }
  const maxH = Math.floor(T / ELO_WEIGHT_PER_HP_GRID_STEP);
  const h = Math.floor(rng() * (maxH + 1));
  const d = T - ELO_WEIGHT_PER_HP_GRID_STEP * h;
  return { damageGridSteps: d, hpGridSteps: h };
}

/**
 * Случайное разбиение T: d + 3h + 2c = T (c — шаги craftspeed, 2 ед. веса на шаг = два шага урона).
 */
export function splitTotalWeightBetweenDamageHpAndCraft(
  totalWeightUnits: number,
  rng: () => number
): { damageGridSteps: number; hpGridSteps: number; craftGridSteps: number } {
  const T = Math.max(0, Math.floor(totalWeightUnits));
  if (T === 0) {
    return { damageGridSteps: 0, hpGridSteps: 0, craftGridSteps: 0 };
  }
  const wCraft = ELO_WEIGHT_PER_CRAFT_GRID_STEP;
  const maxCraft = Math.floor(T / wCraft);
  const craftGridSteps = Math.floor(rng() * (maxCraft + 1));
  const rem = T - wCraft * craftGridSteps;
  const split = splitTotalWeightBetweenDamageAndHp(rem, rng);
  return {
    damageGridSteps: split.damageGridSteps,
    hpGridSteps: split.hpGridSteps,
    craftGridSteps,
  };
}

const DEFAULT_WEIGHT_SCALE = 4;
const DEFAULT_MAX_TOTAL_WEIGHT = 48;

/**
 * strengthRatio = avgCrew / avgThrall (средний рейтинг на слот команды).
 * Дальше: T ≈ scale · |strengthRatio² − 1|, случайный сплит урона/HP/крафта.
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
  craftGridSteps: number;
  direction: 1 | -1 | 0;
} {
  const initial = options?.initialRating ?? 1500;
  const rng = options?.rng ?? Math.random;
  const weightScale = options?.weightScale ?? DEFAULT_WEIGHT_SCALE;
  const maxTotalWeightUnits = options?.maxTotalWeightUnits ?? DEFAULT_MAX_TOTAL_WEIGHT;

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

  const neutral = quantizePredatorMultiplier(1);
  const neutralCraft = quantizeCraftMultiplier(1);
  const modifiers: Record<EloBalanceModifierKey, number> = {
    predatordamage: neutral,
    predatorhealth: neutral,
    craftspeed: neutralCraft,
  };

  let strengthRatio = 1;
  let totalWeightUnits = 0;
  let damageGridSteps = 0;
  let hpGridSteps = 0;
  let craftGridSteps = 0;
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
      craftGridSteps,
      direction,
    };
  }

  strengthRatio = avgThrall > 0 ? avgCrew / avgThrall : 1;
  const raw = strengthRatio * strengthRatio;
  const deviation = raw - 1;
  if (Math.abs(deviation) < 1e-9) {
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
      craftGridSteps: 0,
      direction: 0,
    };
  }

  direction = deviation > 0 ? 1 : -1;
  totalWeightUnits = Math.min(
    maxTotalWeightUnits,
    Math.round(Math.abs(deviation) * weightScale)
  );

  const split = splitTotalWeightBetweenDamageHpAndCraft(totalWeightUnits, rng);
  damageGridSteps = split.damageGridSteps;
  hpGridSteps = split.hpGridSteps;
  craftGridSteps = split.craftGridSteps;

  const step = ELO_PREDATOR_MULT_STEP;
  modifiers.predatordamage = quantizePredatorMultiplier(1 + direction * damageGridSteps * step);
  modifiers.predatorhealth = quantizePredatorMultiplier(1 + direction * hpGridSteps * step);
  modifiers.craftspeed = quantizeCraftMultiplier(
    1 + direction * craftGridSteps * ELO_CRAFT_MULT_STEP
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
    stepsUsed: damageGridSteps + hpGridSteps + craftGridSteps,
    strengthRatio,
    totalWeightUnits,
    damageGridSteps,
    hpGridSteps,
    craftGridSteps,
    direction,
  };
}
