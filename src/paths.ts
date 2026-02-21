import path from 'path';

export const STABLE_DIR = path.join(process.cwd(), 'patches', 'stable');
export const COLLECTIONS_DIR = path.join(process.cwd(), 'patches', 'alllready_configs');
export const MAPS_REF_PATH = path.join(process.cwd(), 'reference', 'maps.json');
export const MAPS_RU_PATH = path.join(process.cwd(), 'reference', 'maps.ru.json');
export const MAPS_COLLECTIONS_PATH = path.join(process.cwd(), 'reference', 'map-collections.json');
export const MODIFIERS_REF_PATH = path.join(process.cwd(), 'reference', 'custom_modifiers.json');
export const MODIFIERS_RU_PATH = path.join(process.cwd(), 'reference', 'custom_modifiers.ru.json');
export const MODIFIERS_PRESETS_PATH = path.join(
  process.cwd(),
  'reference',
  'custom_modifiers.presets.json'
);
export const ROLES_REF_PATH = path.join(process.cwd(), 'reference', 'roles.json');
export const ITEMS_REF_PATH = path.join(process.cwd(), 'reference', 'items.json');
