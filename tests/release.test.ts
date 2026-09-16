import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = join(__dirname, '..', 'src');

describe('release safety contract', () => {
  it('does not launch external applications or browsers', () => {
    const files = [
      join(sourceRoot, 'extension.ts'),
      join(sourceRoot, 'providers', 'MarkdownGraphEditorProvider.ts'),
      join(sourceRoot, 'webview', 'canvasHtml.ts'),
      join(sourceRoot, 'webview', 'canvasIcons.ts'),
      join(sourceRoot, 'webview', 'canvasStyles.ts'),
      join(sourceRoot, 'webview', 'canvasTemplate.ts'),
      join(sourceRoot, 'webview', 'canvasScript.ts'),
    ];
    const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toContain('openExternal');
    expect(source).not.toContain('child_process');
    expect(source).not.toContain('window.open');
  });

  it('ships the required extension documentation', () => {
    for (const file of ['README.md', 'CHANGELOG.md', 'LICENSE', '.vscodeignore']) {
      expect(readFileSync(join(__dirname, '..', file), 'utf8').length).toBeGreaterThan(0);
    }
  });
});
