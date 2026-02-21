import http from 'http';
import { URL } from 'url';
import { ServerConfig } from './types';
import { ServerManager } from './server-manager';
import { API_PORT, API_TOKEN, TEST_PARAMS_SOLO, TEST_PARAMS_DUO } from './config';
import { sendJson, requestLocalJson, readJsonBody, isAuthorized } from './utils/http';
import { loadMapReferences } from './reference/maps';
import { listStableMods, listModCollections, resolveModScripts, parseMods } from './reference/mods';
import { loadCustomModifiers, parseCustomModifiers } from './reference/modifiers';
import { loadRoleReferences } from './reference/roles';
import { loadItemReferences } from './reference/items';

export function createApiServer(config: ServerConfig, serverManager: ServerManager) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Token');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (!isAuthorized(req, API_TOKEN)) {
      sendJson(res, 401, { ok: false, error: 'Unauthorized' });
      return;
    }

    if (!req.url) {
      sendJson(res, 400, { ok: false, error: 'Invalid URL' });
      return;
    }

    const url = new URL(req.url, `http://localhost:${API_PORT}`);
    try {
      if (req.method === 'GET' && url.pathname === '/status') {
        const sessions = serverManager.listSessions().map((session) => ({
          mapName: session.map.name,
          mapValue: session.map.serverValue,
          port: session.port,
          pid: session.pid,
          ip: config.publicIp,
          startedAt: session.startedAt.toISOString(),
          telemetryPort: session.telemetryPort ?? null,
          mods: session.mods ?? [],
          customModifiers: session.customModifiers ?? {}
        }));
        sendJson(res, 200, { ok: true, sessions });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/session') {
        const portStr = url.searchParams.get('port') ?? '';
        const port = Number.parseInt(portStr, 10);
        if (Number.isNaN(port)) {
          sendJson(res, 400, { ok: false, error: 'port is required' });
          return;
        }
        const session = serverManager.listSessions().find((item) => item.port === port);
        if (!session) {
          sendJson(res, 404, { ok: false, error: 'Session not found' });
          return;
        }
        sendJson(res, 200, {
          ok: true,
          session: {
            mapName: session.map.name,
            mapValue: session.map.serverValue,
            port: session.port,
            pid: session.pid,
            ip: config.publicIp,
            startedAt: session.startedAt.toISOString(),
            telemetryPort: session.telemetryPort ?? null,
          },
        });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/telemetry') {
        const portStr = url.searchParams.get('port') ?? '';
        const port = Number.parseInt(portStr, 10);
        if (Number.isNaN(port)) {
          sendJson(res, 400, { ok: false, error: 'port is required' });
          return;
        }
        const session = serverManager.listSessions().find((item) => item.port === port);
        if (!session || !session.telemetryPort) {
          sendJson(res, 404, { ok: false, error: 'Telemetry not available' });
          return;
        }
        try {
          const response = await requestLocalJson(session.telemetryPort, '/state', 'GET');
          sendJson(res, response.status, response.payload);
        } catch (error) {
          sendJson(res, 502, { ok: false, error: (error as Error).message });
        }
        return;
      }

      if (req.method === 'POST' && url.pathname === '/telemetry/command') {
        const body = await readJsonBody(req);
        const port = Number.parseInt(String(body.port ?? ''), 10);
        if (Number.isNaN(port)) {
          sendJson(res, 400, { ok: false, error: 'port is required' });
          return;
        }
        const session = serverManager.listSessions().find((item) => item.port === port);
        if (!session || !session.telemetryPort) {
          sendJson(res, 404, { ok: false, error: 'Telemetry not available' });
          return;
        }
        const command = typeof body.command === 'object' && body.command ? body.command : body;
        try {
          const response = await requestLocalJson(
            session.telemetryPort,
            '/command',
            'POST',
            command
          );
          sendJson(res, response.status, response.payload);
        } catch (error) {
          sendJson(res, 502, { ok: false, error: (error as Error).message });
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/maps') {
        const refs = loadMapReferences();
        const maps =
          refs.length > 0
            ? refs
            : config.maps.map((map) => ({
                name: map.name,
                serverValue: map.serverValue
              }));
        sendJson(res, 200, { ok: true, maps });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/modifiers') {
        const { definitions, presets } = loadCustomModifiers();
        sendJson(res, 200, { ok: true, modifiers: definitions, presets });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/reference/roles') {
        const roles = loadRoleReferences();
        sendJson(res, 200, { ok: true, roles });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/reference/items') {
        const items = loadItemReferences();
        sendJson(res, 200, { ok: true, items });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/mods') {
        const mods = listStableMods();
        const collections = listModCollections(mods);
        sendJson(res, 200, { ok: true, mods, collections });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/run') {
        const body = await readJsonBody(req);
        const mapName = body.mapName;
        const { mods, error } = parseMods(body.mods);
        const { definitions: modifierDefs } = loadCustomModifiers();
        const { modifiers, error: modifiersError } = parseCustomModifiers(
          body.customModifiers,
          modifierDefs
        );
        if (error) {
          sendJson(res, 400, { ok: false, error });
          return;
        }
        if (modifiersError) {
          sendJson(res, 400, { ok: false, error: modifiersError });
          return;
        }
        if (typeof mapName !== 'string' || mapName.length === 0) {
          sendJson(res, 400, { ok: false, error: 'mapName is required' });
          return;
        }
        const { scripts, unknown } = resolveModScripts(mods);
        if (unknown.length > 0) {
          sendJson(res, 400, { ok: false, error: `Unknown mods: ${unknown.join(', ')}` });
          return;
        }
        const session = await serverManager.startSession(
          mapName,
          undefined,
          undefined,
          scripts,
          mods,
          modifiers
        );
        sendJson(res, 200, {
          ok: true,
          session: {
            mapName: session.map.name,
            mapValue: session.map.serverValue,
            port: session.port,
            pid: session.pid,
            ip: config.publicIp,
            startedAt: session.startedAt.toISOString(),
            telemetryPort: session.telemetryPort ?? null,
            mods: session.mods ?? [],
            customModifiers: session.customModifiers ?? {}
          }
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/testing') {
        const body = await readJsonBody(req);
        const mapName = body.mapName;
        const mode = typeof body.mode === 'string' ? body.mode : 'solo';
        const { mods, error } = parseMods(body.mods);
        const { definitions: modifierDefs } = loadCustomModifiers();
        const { modifiers, error: modifiersError } = parseCustomModifiers(
          body.customModifiers,
          modifierDefs
        );
        if (error) {
          sendJson(res, 400, { ok: false, error });
          return;
        }
        if (modifiersError) {
          sendJson(res, 400, { ok: false, error: modifiersError });
          return;
        }
        if (typeof mapName !== 'string' || mapName.length === 0) {
          sendJson(res, 400, { ok: false, error: 'mapName is required' });
          return;
        }
        const params = mode === 'duo' ? TEST_PARAMS_DUO : TEST_PARAMS_SOLO;
        const { scripts, unknown } = resolveModScripts(mods);
        if (unknown.length > 0) {
          sendJson(res, 400, { ok: false, error: `Unknown mods: ${unknown.join(', ')}` });
          return;
        }
        const session = await serverManager.startSession(
          mapName,
          params,
          'test',
          scripts,
          mods,
          modifiers
        );
        sendJson(res, 200, {
          ok: true,
          session: {
            mapName: session.map.name,
            mapValue: session.map.serverValue,
            port: session.port,
            pid: session.pid,
            ip: config.publicIp,
            startedAt: session.startedAt.toISOString(),
            telemetryPort: session.telemetryPort ?? null,
            mods: session.mods ?? [],
            customModifiers: session.customModifiers ?? {}
          }
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/stop') {
        const body = await readJsonBody(req);
        const port = Number.parseInt(String(body.port ?? ''), 10);
        if (Number.isNaN(port)) {
          sendJson(res, 400, { ok: false, error: 'port is required' });
          return;
        }
        const ok = await serverManager.stopSession(port);
        sendJson(res, 200, { ok });
        return;
      }

      sendJson(res, 404, { ok: false, error: 'Not found' });
    } catch (error) {
      sendJson(res, 500, { ok: false, error: (error as Error).message });
    }
  });

  server.listen(API_PORT, () => {
    console.log(`🌐 API listening on http://0.0.0.0:${API_PORT}`);
  });
}
