import fs from 'fs';
import { ROLES_REF_PATH } from '../paths';

export function loadRoleReferences(): Array<{ id: string; name: string; assetPath?: string; roleType?: number }> {
  if (!fs.existsSync(ROLES_REF_PATH)) return [];
  try {
    const raw = fs.readFileSync(ROLES_REF_PATH, 'utf8');
    const data = JSON.parse(raw) as { roles?: Array<Record<string, unknown>> };
    const items = Array.isArray(data.roles) ? data.roles : [];
    return items
      .map((item) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? ''),
        assetPath: item.assetPath ? String(item.assetPath) : '',
        roleType: Number.isFinite(Number(item.roleType)) ? Number(item.roleType) : undefined,
      }))
      .filter((item) => item.id && item.name);
  } catch {
    return [];
  }
}
