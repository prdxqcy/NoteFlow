import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const releaseDir = path.join(projectRoot, 'release');
const publicDownloadsDir = path.join(projectRoot, 'public', 'downloads');
const nodeBin = process.execPath;

function run(commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeBin, commandArgs, {
      cwd: projectRoot,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with exit code ${code}`));
    });
  });
}

async function findLatestPortableExe() {
  const entries = await fs.readdir(releaseDir, { withFileTypes: true });
  const exeFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'))
    .map((entry) => path.join(releaseDir, entry.name));

  if (exeFiles.length === 0) {
    throw new Error('No Windows desktop build was produced.');
  }

  const stats = await Promise.all(
    exeFiles.map(async (file) => ({
      file,
      stat: await fs.stat(file),
    }))
  );

  stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return stats[0];
}

const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8'));

await run(['node_modules/vite/bin/vite.js', 'build']);
await run(['node_modules/electron-builder/cli.js', '--win', 'portable']);

const latest = await findLatestPortableExe();
await fs.mkdir(publicDownloadsDir, { recursive: true });

const latestFilename = 'Cove-Desktop-latest.exe';
const latestTarget = path.join(publicDownloadsDir, latestFilename);
await fs.copyFile(latest.file, latestTarget);

const metadata = {
  productName: 'Cove Desktop',
  version: packageJson.version,
  file: `/downloads/${latestFilename}`,
  originalFile: path.basename(latest.file),
  sizeBytes: latest.stat.size,
  updatedAt: new Date(latest.stat.mtimeMs).toISOString(),
  platform: 'windows-x64',
};

await fs.writeFile(
  path.join(publicDownloadsDir, 'latest-desktop.json'),
  JSON.stringify(metadata, null, 2),
  'utf8'
);

console.log(`Published ${latestFilename}`);
