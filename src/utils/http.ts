import http from 'http';

export function sendJson(res: http.ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function requestLocalJson(
  port: number,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown
): Promise<{ status: number; payload: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: payload
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(payload),
            }
          : undefined,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (!data) {
            resolve({ status: res.statusCode ?? 200, payload: {} });
            return;
          }
          try {
            resolve({
              status: res.statusCode ?? 200,
              payload: JSON.parse(data),
            });
          } catch (error) {
            resolve({
              status: res.statusCode ?? 500,
              payload: { ok: false, error: 'Invalid JSON from telemetry bridge' },
            });
          }
        });
      }
    );
    req.on('error', (error) => reject(error));
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

export async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function isAuthorized(req: http.IncomingMessage, apiToken: string): boolean {
  if (!apiToken) return true;
  const token = req.headers['x-api-token'];
  return typeof token === 'string' && token === apiToken;
}
