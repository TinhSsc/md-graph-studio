const { execFileSync } = require('node:child_process');
const path = require('node:path');

try {
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '--pretty', 'false'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
  });
  console.log('TypeScript syntax check passed.');
} catch (error) {
  console.error('TypeScript syntax check failed.');
  process.exitCode = 1;
}
