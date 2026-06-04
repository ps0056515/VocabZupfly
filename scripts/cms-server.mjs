/**
 * Standalone CMS only (legacy). Prefer: npm run dev → http://localhost:3456/cms/
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log('CMS is built into the dev server. Starting npm run dev instead...\n');
const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  shell: true,
});
child.on('exit', function (code) {
  process.exit(code || 0);
});
