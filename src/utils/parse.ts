export function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function parsePortSpec(raw: string): number[] {
  const ports = new Set<number>();
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const range = trimmed.split('-').map((v) => v.trim());
    if (range.length === 1) {
      const value = Number(range[0]);
      if (!Number.isInteger(value) || value <= 0 || value > 65535) {
        throw new Error(`Invalid port: ${range[0]}`);
      }
      ports.add(value);
      continue;
    }
    if (range.length !== 2) {
      throw new Error(`Invalid port range: ${trimmed}`);
    }
    const start = Number(range[0]);
    const end = Number(range[1]);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start <= 0 ||
      end <= 0 ||
      start > 65535 ||
      end > 65535 ||
      start > end
    ) {
      throw new Error(`Invalid port range: ${trimmed}`);
    }
    for (let port = start; port <= end; port += 1) {
      ports.add(port);
    }
  }
  return [...ports];
}

export function parseSessionParams(raw: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const part of raw.split('?')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const [key, value] = trimmed.split('=');
    if (!key || value == null) continue;
    params[key] = value;
  }
  return params;
}

export function buildSessionParams(
  baseParams: string,
  customModifiers: Record<string, number>
): string {
  const params = parseSessionParams(baseParams);
  for (const [key, value] of Object.entries(customModifiers)) {
    params[key] = String(value);
  }
  return Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('?');
}

export function buildMapArg(mapValue: string, sessionParams: string, port: number): string {
  const normalized = sessionParams.replace(/^\?+/, '').trim();
  const params = [normalized, `port=${port}`].filter((value) => value.length > 0).join('?');
  return params.length > 0 ? `${mapValue}?${params}` : mapValue;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
