import fs from 'fs';
import { CustomModifierDefinition, CustomModifierPreset } from '../types';
import { MODIFIERS_REF_PATH, MODIFIERS_RU_PATH, MODIFIERS_PRESETS_PATH } from '../paths';

export function loadCustomModifiers(): { definitions: CustomModifierDefinition[]; presets: CustomModifierPreset[] } {
  try {
    if (!fs.existsSync(MODIFIERS_REF_PATH)) return { definitions: [], presets: [] };
    const raw = fs.readFileSync(MODIFIERS_REF_PATH, 'utf8');
    const data = JSON.parse(raw) as { modifiers?: Array<Record<string, unknown>> };
    const items = Array.isArray(data.modifiers) ? data.modifiers : [];
    if (items.length === 0) return { definitions: [], presets: [] };

    let localized: Record<string, string> = {};
    if (fs.existsSync(MODIFIERS_RU_PATH)) {
      const rawRu = fs.readFileSync(MODIFIERS_RU_PATH, 'utf8');
      localized = JSON.parse(rawRu) as Record<string, string>;
    }

    const definitions = items
      .map((item) => {
        const key = String(item.key ?? '').trim();
        const min = Number(item.min);
        const max = Number(item.max);
        const def = Number(item.default);
        const step = Number(item.step ?? 1);
        const unit = typeof item.unit === 'string' ? item.unit : undefined;
        const hint = typeof item.hint === 'string' ? item.hint : undefined;
        if (!key || Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(def)) {
          return null;
        }
        return {
          key,
          name: localized[key] ?? key,
          min,
          max,
          default: def,
          step: Number.isNaN(step) ? 1 : step,
          unit,
          hint,
        } as CustomModifierDefinition;
      })
      .filter((item): item is CustomModifierDefinition => Boolean(item));

    let presets: CustomModifierPreset[] = [];
    if (fs.existsSync(MODIFIERS_PRESETS_PATH)) {
      const rawPresets = fs.readFileSync(MODIFIERS_PRESETS_PATH, 'utf8');
      const dataPresets = JSON.parse(rawPresets) as { presets?: Array<Record<string, unknown>> };
      const rawItems = Array.isArray(dataPresets.presets) ? dataPresets.presets : [];
      presets = rawItems
        .map((item) => {
          const id = String(item.id ?? '').trim();
          const name = String(item.name ?? '').trim();
          const values = item.values && typeof item.values === 'object' ? item.values : null;
          if (!id || !name || !values) return null;
          const numericValues: Record<string, number> = {};
          for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
            const num = Number(value);
            if (!Number.isNaN(num)) numericValues[key] = num;
          }
          return { id, name, values: numericValues } as CustomModifierPreset;
        })
        .filter((item): item is CustomModifierPreset => Boolean(item));
    }

    return { definitions, presets };
  } catch {
    return { definitions: [], presets: [] };
  }
}

export function parseCustomModifiers(
  value: unknown,
  definitions: CustomModifierDefinition[]
): { modifiers: Record<string, number>; error?: string } {
  if (value == null) return { modifiers: {} };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { modifiers: {}, error: 'customModifiers must be an object' };
  }
  const mods: Record<string, number> = {};
  const defMap = new Map(definitions.map((def) => [def.key, def]));
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const def = defMap.get(key);
    if (!def) continue;
    const num = Number(raw);
    if (Number.isNaN(num)) {
      return { modifiers: {}, error: `customModifiers.${key} must be a number` };
    }
    if (num < def.min || num > def.max) {
      return { modifiers: {}, error: `customModifiers.${key} out of range` };
    }
    if (num !== def.default) {
      mods[key] = num;
    }
  }
  return { modifiers: mods };
}
