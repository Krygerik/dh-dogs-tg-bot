import fs from "fs";
import path from "path";
import { ServerConfig } from "./types";
import { isTruthy, parsePortSpec } from "./utils/parse";
import { loadMapReferences } from "./reference/maps";

export const DEFAULT_INIT_SIGNATURE =
  "LogInit: Display: Engine is initialized. Leaving FEngineLoop::Init()";
export const API_PORT = 8787;
export const API_TOKEN = (process.env.API_TOKEN ?? "").trim();
export const TEST_PARAMS_SOLO = "maxplayers=1?thralls=1";
export const TEST_PARAMS_DUO = "maxplayers=2?thralls=2";

export function resolveBinaryPath(binaryPath: string): string {
  const normalized = binaryPath.trim();
  const exeName = "DreadHungerServer-Win64-Shipping.exe";
  const hasExe = normalized.toLowerCase().endsWith(".exe");
  const candidate = hasExe ? normalized : path.join(normalized, exeName);

  if (!fs.existsSync(candidate)) {
    throw new Error(`BINARY_PATH does not exist: ${candidate}`);
  }

  return candidate;
}

export function resolveFridaPath(fridaPath: string): string {
  const trimmed = fridaPath.trim();
  if (!trimmed) return trimmed;
  const resolved = path.isAbsolute(trimmed)
    ? trimmed
    : path.resolve(process.cwd(), trimmed);
  if (!fs.existsSync(resolved)) {
    throw new Error(`FRIDA_PATH does not exist: ${resolved}`);
  }
  return resolved;
}

export function buildConfig(): ServerConfig {
  const botToken = process.env.BOT_TOKEN;
  const publicIp = process.env.PUBLIC_IP;
  const binaryPath = process.env.BINARY_PATH;

  if (!botToken) {
    throw new Error("BOT_TOKEN is not set in .env file");
  }
  if (!publicIp) {
    throw new Error("PUBLIC_IP is not set in .env file");
  }
  if (!binaryPath) {
    throw new Error("BINARY_PATH is not set in .env file");
  }

  const ports = parsePortSpec(process.env.PORTS ?? "7777");
  const maxSessions = Number.parseInt(process.env.MAX_SESSIONS ?? "0", 10);
  if (Number.isNaN(maxSessions) || maxSessions < 0) {
    throw new Error("MAX_SESSIONS must be a non-negative integer");
  }

  const resolvedBinaryPath = resolveBinaryPath(binaryPath);
  const mapRefs = loadMapReferences().map((item) => ({
    name: item.name,
    serverValue: item.serverValue,
  }));
  if (mapRefs.length === 0) {
    throw new Error("Map references are empty. Check reference/maps.json");
  }

  const telemetryBasePortRaw = Number.parseInt(
    process.env.TELEMETRY_BASE_PORT ?? "8790",
    10,
  );
  const telemetryBasePort = Number.isNaN(telemetryBasePortRaw)
    ? 8790
    : telemetryBasePortRaw;

  return {
    publicIp,
    binaryPath: resolvedBinaryPath,
    binaryDir: path.dirname(resolvedBinaryPath),
    ports,
    maxSessions,
    maps: mapRefs,
    sessionParams: process.env.SESSION_PARAMS ?? "maxplayers=8",
    initSignature: DEFAULT_INIT_SIGNATURE,
    initTimeoutMs: 30000,
    fridaPath: process.env.FRIDA_PATH ?? "",
    fridaInitSignature: "Frida scripts have been injected.",
    telemetryEnabled: isTruthy(process.env.TELEMETRY_ENABLE),
    telemetryBasePort,
  };
}
