import { spawn } from 'child_process';

export type MapConfig = {
  name: string;
  serverValue: string;
};

export type MapReference = {
  name: string;
  serverValue: string;
  defaultCollection?: string;
};

export type ModInfo = {
  id: string;
  name: string;
  scriptPath: string;
  description: string;
};

export type ModCollection = {
  id: string;
  name: string;
  mods: string[];
};

export type CustomModifierDefinition = {
  key: string;
  name: string;
  min: number;
  max: number;
  default: number;
  step: number;
  unit?: string;
  hint?: string;
};

export type CustomModifierPreset = {
  id: string;
  name: string;
  values: Record<string, number>;
};

export type ServerConfig = {
  publicIp: string;
  binaryPath: string;
  binaryDir: string;
  ports: number[];
  maxSessions: number;
  maps: MapConfig[];
  sessionParams: string;
  initSignature: string;
  initTimeoutMs: number;
  fridaPath: string;
  fridaInitSignature: string;
  telemetryEnabled: boolean;
  telemetryBasePort: number;
};

export type GameSession = {
  port: number;
  pid: number;
  map: MapConfig;
  startedAt: Date;
  logPath: string;
  mods: string[];
  customModifiers: Record<string, number>;
  telemetryPort?: number;
};

export type RunningSession = GameSession & {
  process: ReturnType<typeof spawn>;
};
