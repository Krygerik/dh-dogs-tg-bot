import fs from 'fs';
import path from 'path';
import { ModInfo, ModCollection } from '../types';
import { STABLE_DIR, COLLECTIONS_DIR } from '../paths';

export function listStableMods(): ModInfo[] {
  if (!fs.existsSync(STABLE_DIR)) {
    return [];
  }
  const entries = fs.readdirSync(STABLE_DIR, { withFileTypes: true });
  const mods: ModInfo[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    const scriptFile = `${name}.js`;
    const descriptionFile = `${name}.txt`;
    const scriptFullPath = path.join(STABLE_DIR, name, scriptFile);
    if (!fs.existsSync(scriptFullPath)) {
      continue;
    }
    const descriptionPath = path.join(STABLE_DIR, name, descriptionFile);
    let description = '';
    if (fs.existsSync(descriptionPath)) {
      description = fs.readFileSync(descriptionPath, 'utf8').trim();
    }
    const scriptPath = path.posix.join('patches', 'stable', name, scriptFile);
    mods.push({
      id: name,
      name,
      scriptPath,
      description,
    });
  }
  mods.sort((a, b) => a.name.localeCompare(b.name));
  return mods;
}

export function listModCollections(mods: ModInfo[]): ModCollection[] {
  if (!fs.existsSync(COLLECTIONS_DIR)) {
    return [];
  }
  const modsByScriptPath = new Map(mods.map((mod) => [mod.scriptPath, mod.id]));
  const entries = fs.readdirSync(COLLECTIONS_DIR, { withFileTypes: true });
  const collections: ModCollection[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.txt')) continue;
    const collectionId = entry.name.replace(/\.txt$/i, '');
    const filePath = path.join(COLLECTIONS_DIR, entry.name);
    const raw = fs.readFileSync(filePath, 'utf8');
    const modsSet = new Set<string>();

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const normalized = trimmed.replace(/\\/g, '/');
      const modId = modsByScriptPath.get(normalized);
      if (modId) {
        modsSet.add(modId);
        continue;
      }
      const parts = normalized.split('/');
      const stableIdx = parts.indexOf('stable');
      if (stableIdx !== -1 && parts.length > stableIdx + 1) {
        modsSet.add(parts[stableIdx + 1]);
      }
    }

    collections.push({
      id: collectionId,
      name: collectionId,
      mods: [...modsSet],
    });
  }

  collections.sort((a, b) => a.name.localeCompare(b.name));
  return collections;
}

export function resolveModScripts(modIds: string[]): { scripts: string[]; unknown: string[] } {
  const catalog = listStableMods();
  const map = new Map(catalog.map((mod) => [mod.id, mod]));
  const scripts: string[] = [];
  const unknown: string[] = [];
  for (const id of modIds) {
    const mod = map.get(id);
    if (!mod) {
      unknown.push(id);
      continue;
    }
    scripts.push(mod.scriptPath);
  }
  return { scripts, unknown };
}

export function parseMods(value: unknown): { mods: string[]; error?: string } {
  if (value == null) {
    return { mods: [] };
  }
  if (!Array.isArray(value)) {
    return { mods: [], error: 'mods must be an array of strings' };
  }
  const mods: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      return { mods: [], error: 'mods must be an array of strings' };
    }
    const trimmed = item.trim();
    if (trimmed) mods.push(trimmed);
  }
  return { mods };
}
