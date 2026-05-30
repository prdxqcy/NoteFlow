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
const electronEnv = { ...process.env };

delete electronEnv.ELECTRON_RUN_AS_NODE;

function run(commandArgs, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeBin, commandArgs, {
      cwd: projectRoot,
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
  });
}

await run(['node_modules/vite/bin/vite.js', 'build']);

await new Promise((resolve, reject) => {
  const child = spawn(electronBin, ['.'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: electronEnv,
  });

  child.on('exit', (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Electron exited with code ${code}`));
  });
});
