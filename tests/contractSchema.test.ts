import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validateSemanticDocument, type SemanticGraphDocument } from '../src/model/semanticContract';
import type { CanvasMeta } from '../src/model/graphTypes';

describe('Phase 0: Data Contract & Runtime Types', () => {
  it('validates a well-formed SemanticGraphDocument', () => {
    const doc: SemanticGraphDocument = {
      schemaVersion: 1,
      documentTitle: 'System Architecture',
      nodes: [
        {
          id: 'auth-service',
          title: 'Authentication Service',
          content: 'Validates tokens',
          visualAnnotations: { shape: 'rounded-rectangle', color: 'blue' },
        },
        {
          id: 'db-service',
          title: 'Database Service',
          content: 'Stores data',
        },
      ],
      edges: [
        {
          id: 'auth-service>db-service#0',
          sourceId: 'auth-service',
          targetId: 'db-service',
          label: 'Read/write',
          type: 'depends-on',
        },
      ],
      diagnostics: [],
    };

    expect(validateSemanticDocument(doc)).toBe(true);
  });

  it('rejects SemanticGraphDocument with duplicate node IDs or invalid schemaVersion', () => {
    const duplicateDoc = {
      schemaVersion: 1,
      nodes: [
        { id: 'duplicate-id', title: 'Node 1', content: '' },
        { id: 'duplicate-id', title: 'Node 2', content: '' },
      ],
      edges: [],
      diagnostics: [],
    };
    expect(validateSemanticDocument(duplicateDoc)).toBe(false);

    const badVersionDoc = {
      schemaVersion: 2,
      nodes: [],
      edges: [],
      diagnostics: [],
    };
    expect(validateSemanticDocument(badVersionDoc)).toBe(false);
  });

  it('supports collapsed and locked fields in CanvasNodeMeta', () => {
    const meta: CanvasMeta = {
      version: 1,
      nodes: {
        'node-1': {
          x: 100,
          y: 200,
          width: 240,
          height: 160,
          collapsed: true,
          locked: false,
        },
      },
      groups: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    expect(meta.nodes['node-1'].collapsed).toBe(true);
    expect(meta.nodes['node-1'].locked).toBe(false);
  });
});

describe('Phase 0: Sidecar Fixtures Integrity', () => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'sidecar');

  it('verifies clean-canonical.md.graph.json matches CanvasMeta schema', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'clean-canonical.md.graph.json'), 'utf8');
    const json = JSON.parse(raw);
    expect(json.version).toBe(1);
    expect(json.nodes['auth-service']).toBeDefined();
    expect(json.nodes['auth-service'].collapsed).toBe(false);
    expect(json.nodes['auth-service'].locked).toBe(false);
    expect(json.edges['auth-service>database-service#0']).toBeDefined();
    expect(json.viewport.zoom).toBe(1.05);
  });

  it('verifies legacy-embedded.md fixture contains valid embedded canvas-meta', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'legacy-embedded.md'), 'utf8');
    expect(raw).toContain('<!-- canvas-meta');
    expect(raw).toContain('"Authentication Service"');
  });

  it('verifies duplicate-title-explicit-id.md fixture contains distinct anchors', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'duplicate-title-explicit-id.md'), 'utf8');
    expect(raw).toContain('## Xác thực {#auth-v1}');
    expect(raw).toContain('## Xác thực {#auth-v2}');
  });

  it('verifies corrupt-sidecar.md.graph.json is rejected by JSON.parse', () => {
    const raw = fs.readFileSync(path.join(fixturesDir, 'corrupt-sidecar.md.graph.json'), 'utf8');
    expect(() => JSON.parse(raw)).toThrow();
  });
});
