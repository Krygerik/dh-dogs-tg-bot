import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ServerConfig, MapConfig, GameSession, RunningSession } from './types';
import { resolveFridaPath } from './config';
import { buildSessionParams, buildMapArg } from './utils/parse';
import { killProcessTree, wrapCommand, waitForSignature, waitForSignatureWithHandlers } from './utils/process';
import { attachRealtimeLogging } from './utils/logging';
import { loadMapReferences } from './reference/maps';

export class ServerManager {
  private readonly sessions = new Map<number, RunningSession>();
  private portIdx = 0;

  constructor(private readonly config: ServerConfig) {}

  listSessions(): GameSession[] {
    return [...this.sessions.values()].map(({ process, ...session }) => session);
  }

  async startSession(
    mapName: string,
    sessionParamsOverride?: string,
    fridaMode?: string,
    modScripts?: string[],
    modIds?: string[],
    customModifiers?: Record<string, number>
  ): Promise<GameSession> {
    let map = this.config.maps.find(
      (item) => item.name === mapName || item.serverValue === mapName
    );
    if (!map) {
      const refs = loadMapReferences();
      const refMatch = refs.find(
        (item) => item.serverValue === mapName || item.name === mapName
      );
      if (refMatch) {
        map = { name: refMatch.name, serverValue: refMatch.serverValue };
      }
    }
    if (!map) {
      throw new Error(`Unknown map: ${mapName}`);
    }
    if (this.config.maxSessions > 0 && this.sessions.size >= this.config.maxSessions) {
      throw new Error('Maximum sessions limit reached');
    }

    const port = this.getNextPort();
    if (!port) {
      throw new Error('No free ports available');
    }

    const baseParams = sessionParamsOverride ?? this.config.sessionParams;
    const sessionParams = buildSessionParams(baseParams, customModifiers ?? {});
    const mapArg = buildMapArg(map.serverValue, sessionParams, port);
    const child = spawn(this.config.binaryPath, [mapArg, '-log'], {
      cwd: this.config.binaryDir,
      windowsHide: true,
    });

    if (!child.pid) {
      throw new Error('Failed to start server process');
    }

    const logPath = attachRealtimeLogging(child, map.name, port);

    let initDone = false;
    const initPromise = waitForSignature(
      [child.stdout, child.stderr],
      this.config.initSignature,
      this.config.initTimeoutMs,
      'DH server'
    ).then(() => {
      initDone = true;
    });

    const exitPromise = new Promise<void>((_, reject) => {
      child.once('exit', (code) => {
        if (initDone) return;
        reject(new Error(`DH server exited with code ${code ?? 'unknown'} before init`));
      });
    });

    await Promise.race([initPromise, exitPromise]);

    const fridaScripts = [...(modScripts ?? [])];
    let telemetryPort: number | undefined;
    if (this.config.telemetryEnabled) {
      const telemetryScript = 'patches/technical/telemetry/telemetry.js';
      if (!fridaScripts.includes(telemetryScript)) {
        fridaScripts.push(telemetryScript);
      }
      telemetryPort = this.config.telemetryBasePort + port;
    }

    if (this.config.fridaPath) {
      await this.runFrida(
        child.pid,
        map.serverValue,
        fridaMode,
        logPath,
        fridaScripts,
        telemetryPort,
        port
      );
    }

    const session: RunningSession = {
      port,
      pid: child.pid,
      map,
      startedAt: new Date(),
      logPath,
      mods: modIds ?? [],
      customModifiers: customModifiers ?? {},
      telemetryPort,
      process: child,
    };

    this.sessions.set(port, session);
    child.on('exit', () => {
      this.sessions.delete(port);
    });

    return session;
  }

  async stopSession(port: number): Promise<boolean> {
    const session = this.sessions.get(port);
    if (!session) {
      return false;
    }
    const killed = await killProcessTree(session.pid);
    if (killed) {
      this.sessions.delete(port);
    }
    return killed;
  }

  private getNextPort(): number | null {
    if (this.config.ports.length === 0) return null;
    const total = this.config.ports.length;
    for (let i = 0; i < total; i += 1) {
      const idx = (this.portIdx + i) % total;
      const port = this.config.ports[idx];
      if (!this.sessions.has(port)) {
        this.portIdx = (idx + 1) % total;
        return port;
      }
    }
    return null;
  }

  private runFrida(
    pid: number,
    mapValue: string,
    fridaMode?: string,
    logPath?: string,
    modScripts?: string[],
    telemetryPort?: number,
    sessionPort?: number
  ): Promise<void> {
    const resolvedFridaPath = resolveFridaPath(this.config.fridaPath);
    const fridaArgs = [pid, mapValue];
    if (fridaMode) fridaArgs.push(fridaMode);
    if (modScripts && modScripts.length > 0) {
      for (const script of modScripts) {
        fridaArgs.push('--mod', script);
      }
    }
    if (typeof telemetryPort === 'number') {
      fridaArgs.push('--telemetry-port', telemetryPort);
    }
    if (typeof sessionPort === 'number') {
      fridaArgs.push('--session-port', sessionPort);
    }
    const { command, args } = wrapCommand(resolvedFridaPath, fridaArgs);
    const frida = spawn(command, args, {
      windowsHide: true,
      cwd: path.dirname(resolvedFridaPath),
    });
    let exited = false;
    let initDone = false;
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const maxLines = 20;
    const fridaLogStream = logPath ? fs.createWriteStream(logPath, { flags: 'a' }) : null;

    const logFridaLine = (source: string, line: string) => {
      const entry = `[${new Date().toISOString()}] frida ${source} ${line}\n`;
      if (fridaLogStream) fridaLogStream.write(entry);
      console.log(entry.trimEnd());
    };

    const exitPromise = new Promise<void>((_, reject) => {
      frida.on('exit', (code) => {
        exited = true;
        if (fridaLogStream) fridaLogStream.end();
        if (initDone) return;
        if (code !== 0) {
          const details = [
            stdoutLines.length ? `stdout:\n${stdoutLines.join('\n')}` : null,
            stderrLines.length ? `stderr:\n${stderrLines.join('\n')}` : null,
          ]
            .filter(Boolean)
            .join('\n');
          reject(new Error(`Frida exited with code ${code}${details ? `\n${details}` : ''}`));
        } else {
          reject(new Error('Frida exited before init signature'));
        }
      });
    });

    const signaturePromise = waitForSignatureWithHandlers(
      frida.stdout,
      frida.stderr,
      this.config.fridaInitSignature,
      this.config.initTimeoutMs,
      'Frida',
      (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          logFridaLine('stdout', trimmed);
          if (stdoutLines.length < maxLines) stdoutLines.push(trimmed);
        }
      },
      (line) => {
        const trimmed = line.trim();
        if (trimmed) {
          logFridaLine('stderr', trimmed);
          if (stderrLines.length < maxLines) stderrLines.push(trimmed);
        }
      }
    ).then(() => {
      initDone = true;
    });

    return Promise.race([signaturePromise, exitPromise]).catch(async (error) => {
      if (!exited && frida.pid) {
        await killProcessTree(frida.pid);
      }
      throw error;
    });
  }
}
