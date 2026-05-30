import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const nodeBin = process.execPath;
const require = createRequire(import.meta.url);
const electronBin = require('electron');
const vitePort = process.env.ELECTRON_VITE_PORT || '5173';
const rendererUrl = `http://127.0.0.1:${vitePort}`;
const electronEnv = { ...process.env };

delete electronEnv.ELECTRON_RUN_AS_NODE;

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    function poll() {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });

      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(poll, 500);
      });
    }

    poll();
  });
}

const vite = spawn(
  nodeBin,
  ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', vitePort],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env },
  }
);

let electron = null;

function stopChildren(exitCode = 0) {
  if (electron && !electron.killed) electron.kill();
  if (!vite.killed) vite.kill();
  process.exit(exitCode);
}

process.on('SIGINT', () => stopChildren(0));
process.on('SIGTERM', () => stopChildren(0));

vite.on('exit', (code) => {
  if (code && code !== 0) stopChildren(code);
});

await waitForServer(rendererUrl);

electron = spawn(
  electronBin,
  ['.'],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...electronEnv,
      ELECTRON_RENDERER_URL: rendererUrl,
    },
  }
);

electron.on('exit', (code) => {
  stopChildren(code ?? 0);
});
