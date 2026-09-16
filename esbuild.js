const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['vscode'],
  loader: { '.html': 'text' },
  outfile: 'dist/extension.js',
  sourcemap: true,
}).catch(() => process.exit(1));
