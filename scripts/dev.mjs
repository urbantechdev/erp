import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Parse CLI flags safely so `--host 0.0.0.0` (Vite-style) is translated to `-H 0.0.0.0` (Next.js-style)
let port = process.env.DEFAULT_APP_PORT || '3000';
let host = '0.0.0.0';

const rawArgs = process.argv.slice(2);
for (let i = 0; i < rawArgs.length; i++) {
  const arg = rawArgs[i];
  if ((arg === '--port' || arg === '-p') && rawArgs[i + 1]) {
    port = rawArgs[++i];
  } else if (arg.startsWith('--port=')) {
    port = arg.split('=')[1];
  } else if ((arg === '--host' || arg === '--hostname' || arg === '-H') && rawArgs[i + 1]) {
    host = rawArgs[++i];
  } else if (arg.startsWith('--host=')) {
    host = arg.split('=')[1];
  } else if (arg.startsWith('--hostname=')) {
    host = arg.split('=')[1];
  }
}

// Ensure prebuilt ERP bundle is always fresh before starting Next.js
try {
  execFileSync(process.execPath, [path.join(__dirname, 'build-erp.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
  });
} catch (err) {
  console.error('Failed to prebuild ERP assets in dev mode:', err);
}

const nextBin = path.join(ROOT, 'node_modules', '.bin', 'next');
const child = spawn(nextBin, ['dev', '-p', String(port), '-H', String(host)], {
  cwd: ROOT,
  stdio: ['ignore', 'inherit', 'inherit'],
  env: {
    ...process.env,
    PORT: String(port),
    HOSTNAME: String(host),
  },
});

const forwardSignal = (sig) => {
  if (!child.killed) {
    child.kill(sig);
  }
};

process.on('SIGTERM', () => forwardSignal('SIGTERM'));
process.on('SIGINT', () => forwardSignal('SIGINT'));

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
