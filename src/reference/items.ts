import fs from 'fs';
import { ITEMS_REF_PATH } from '../paths';

export function loadItemReferences(): Array<{ typeId: number; name: string; itemPath?: string }> {
  if (!fs.existsSync(ITEMS_REF_PATH)) return [];
  try {
    const raw = fs.readFileSync(ITEMS_REF_PATH, 'utf8');
    const data = JSON.parse(raw) as { items?: Array<Record<string, unknown>> };
    const items = Array.isArray(data.items) ? data.items : [];
    return items
      .map((item) => ({
        typeId: Number(item.typeId ?? -1),
        name: String(item.name ?? ''),
        itemPath: item.itemPath ? String(item.itemPath) : '',
      }))
      .filter((item) => Number.isFinite(item.typeId) && item.typeId >= 0 && item.name);
  } catch {
    return [];
  }
}
