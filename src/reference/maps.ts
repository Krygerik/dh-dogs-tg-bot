import fs from "fs";
import { MapReference } from "../types";
import { MAPS_REF_PATH, MAPS_RU_PATH, MAPS_COLLECTIONS_PATH } from "../paths";

export function loadMapReferences(): MapReference[] {
  try {
    if (!fs.existsSync(MAPS_REF_PATH)) return [];
    const raw = fs.readFileSync(MAPS_REF_PATH, "utf8");
    const data = JSON.parse(raw) as { maps?: string[] };
    const mapList = Array.isArray(data.maps) ? data.maps : [];
    if (mapList.length === 0) return [];

    let localized: Record<string, string> = {};
    if (fs.existsSync(MAPS_RU_PATH)) {
      const rawRu = fs.readFileSync(MAPS_RU_PATH, "utf8");
      const ruData = JSON.parse(rawRu) as Record<string, string>;
      localized = ruData || {};
    }

    let collections: Record<string, string> = {};
    if (fs.existsSync(MAPS_COLLECTIONS_PATH)) {
      const rawCollections = fs.readFileSync(MAPS_COLLECTIONS_PATH, "utf8");
      const dataCollections = JSON.parse(rawCollections) as Record<
        string,
        string
      >;
      collections = dataCollections || {};
    }

    return mapList.map((serverValue) => ({
      serverValue,
      name: localized[serverValue] ?? serverValue,
      defaultCollection: collections[serverValue],
    }));
  } catch {
    return [];
  }
}
