import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { hydrateGraphWithStorageMode } from '../src/storage/HydrationEngine';
import { SidecarStorageManager } from '../src/storage/SidecarStorageManager';
import type { CanvasMeta } from '../src/model/graphTypes';

const sourceRoot = join(__dirname, '..', 'src');
const fixturesDir = join(__dirname, 'fixtures', 'sidecar');

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

  it('contributes the canvas activity bar with recent canvases above outline', () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
    const container = manifest.contributes.viewsContainers.activitybar[0];
    const views = manifest.contributes.views[container.id];
    expect(container.id).toBe('markdownGraphStudio');
    expect(views.map((view: { id: string }) => view.id)).toEqual([
      'markdownGraphStudio.canvases',
      'markdownGraphStudio.outline',
    ]);
    expect(manifest.contributes.viewsWelcome[0].contents).toContain('markdownGraphStudio.pickCanvas');
  });

  describe('Phase 5 Quality Matrix Verification', () => {
    it('Legacy compatibility: parses and layouts legacy fixture with embedded metadata', () => {
      const legacyMd = readFileSync(join(fixturesDir, 'legacy-embedded.md'), 'utf8');
      const parsed = parseMarkdownGraph(legacyMd);
      expect(parsed.meta).toBeDefined();
      expect(parsed.meta?.nodes['Authentication Service']).toBeDefined();
      expect(parsed.meta?.nodes['Database Service']).toBeDefined();
      expect(parsed.nodes).toHaveLength(3);
      expect(parsed.edges).toHaveLength(2);

      const hydrated = hydrateGraphWithStorageMode(parsed, { mode: 'embedded' });
      const auth = hydrated.nodes.find((n) => n.id === 'Authentication Service')!;
      expect(auth.x).toBe(100);
      expect(auth.y).toBe(100);
    });

    it('Clean canonical: hydrates clean markdown with sidecar JSON', () => {
      const cleanMd = readFileSync(join(fixturesDir, 'clean-canonical.md'), 'utf8');
      const sidecarJson = JSON.parse(readFileSync(join(fixturesDir, 'clean-canonical.md.graph.json'), 'utf8')) as CanvasMeta;

      const parsed = parseMarkdownGraph(cleanMd);
      expect(parsed.meta).toBeUndefined();
      expect(parsed.nodes).toHaveLength(3);

      const hydrated = hydrateGraphWithStorageMode(parsed, { mode: 'sidecar', sidecarMeta: sidecarJson });
      const auth = hydrated.nodes.find((n) => n.id === 'auth-service')!;
      const db = hydrated.nodes.find((n) => n.id === 'database-service')!;
      const audit = hydrated.nodes.find((n) => n.id === 'audit-service')!;

      expect(auth.x).toBe(100);
      expect(auth.y).toBe(100);
      expect(db.x).toBe(450);
      expect(db.y).toBe(100);
      expect(audit.x).toBe(450);
      expect(audit.y).toBe(320);
      expect(hydrated.meta?.viewport.zoom).toBe(1.05);
    });

    it('Stable ID: resolves duplicate titles via explicit anchor IDs {#auth-v1} vs {#auth-v2}', () => {
      const dupMd = readFileSync(join(fixturesDir, 'duplicate-title-explicit-id.md'), 'utf8');
      const parsed = parseMarkdownGraph(dupMd);
      expect(parsed.nodes).toHaveLength(2);
      expect(parsed.nodes[0].id).toBe('auth-v1');
      expect(parsed.nodes[1].id).toBe('auth-v2');
      expect(parsed.nodes[0].title).toBe('Xác thực');
      expect(parsed.nodes[1].title).toBe('Xác thực');
      expect(parsed.edges).toHaveLength(1);
      expect(parsed.edges[0].source).toBe('auth-v1');
      expect(parsed.edges[0].target).toBe('auth-v2');
    });

    it('Corrupt sidecar fallback: safely falls back to autoLayout without crashing', async () => {
      const cleanMd = readFileSync(join(fixturesDir, 'clean-canonical.md'), 'utf8');
      const mockFs = {
        readFile: async () => readFileSync(join(fixturesDir, 'corrupt-sidecar.md.graph.json')),
        writeFile: async () => {},
        rename: async () => {},
        delete: async () => {},
      };
      const safeManager = new SidecarStorageManager(mockFs);
      const res = await safeManager.readSidecar({ fsPath: 'test.md', toString: () => 'test.md' });
      expect(res.meta).toBeNull();
      expect(res.error).toBeDefined();

      const parsed = parseMarkdownGraph(cleanMd);
      const hydrated = hydrateGraphWithStorageMode(parsed, { mode: 'sidecar', sidecarMeta: res.meta });
      expect(hydrated.nodes).toHaveLength(3);
      expect(hydrated.nodes[0].x).toBeDefined();
    });
  });
});
