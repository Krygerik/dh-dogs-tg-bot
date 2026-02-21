import { exec, spawn } from 'child_process';
import path from 'path';
import readline from 'readline';

export function killProcessTree(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`taskkill /PID ${pid} /T /F`, (error) => {
      resolve(!error);
    });
  });
}

export function wrapCommand(commandPath: string, args: Array<string | number>) {
  const normalizedArgs = args.map((value) => `${value}`);
  if (commandPath.toLowerCase().endsWith('.bat') || commandPath.toLowerCase().endsWith('.cmd')) {
    return { command: 'cmd.exe', args: ['/c', commandPath, ...normalizedArgs] };
  }
  return { command: commandPath, args: normalizedArgs };
}

export function waitForSignature(
  streams: Array<NodeJS.ReadableStream | null | undefined>,
  signature: string,
  timeoutMs: number,
  label: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const readers: readline.Interface[] = [];
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      reject(new Error(`${label} init timeout`));
      readers.forEach((reader) => reader.close());
    }, timeoutMs);

    const onLineInternal = (line: string) => {
      if (!line) return;
      if (line.includes(signature) && !finished) {
        finished = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    streams
      .filter((stream): stream is NodeJS.ReadableStream => Boolean(stream))
      .forEach((stream) => {
        const reader = readline.createInterface({ input: stream });
        reader.on('line', onLineInternal);
        readers.push(reader);
      });

    if (readers.length === 0) {
      clearTimeout(timeout);
      reject(new Error(`${label} has no output streams`));
    }
  });
}

export function waitForSignatureWithHandlers(
  stdout: NodeJS.ReadableStream | null | undefined,
  stderr: NodeJS.ReadableStream | null | undefined,
  signature: string,
  timeoutMs: number,
  label: string,
  onStdout?: (line: string) => void,
  onStderr?: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const readers: readline.Interface[] = [];
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      reject(new Error(`${label} init timeout`));
      readers.forEach((reader) => reader.close());
    }, timeoutMs);

    const makeHandler = (callback?: (line: string) => void) => (line: string) => {
      if (!line) return;
      if (callback) callback(line);
      if (line.includes(signature) && !finished) {
        finished = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    if (stdout) {
      const reader = readline.createInterface({ input: stdout });
      reader.on('line', makeHandler(onStdout));
      readers.push(reader);
    }
    if (stderr) {
      const reader = readline.createInterface({ input: stderr });
      reader.on('line', makeHandler(onStderr));
      readers.push(reader);
    }

    if (readers.length === 0) {
      clearTimeout(timeout);
      reject(new Error(`${label} has no output streams`));
    }
  });
}
