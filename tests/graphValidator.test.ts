import { describe, expect, it } from 'vitest';
import { collectGraphDiagnostics } from '../src/validation/GraphValidator';
import type { GraphDocument, GraphNode } from '../src/model/graphTypes';

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'Node', title: 'Node', content: '', shape: 'rounded-rectangle', color: 'gray',
    x: 0, y: 0, width: 240, height: 160, collapsed: false, locked: false, ghost: false,
    ...overrides,
  };
}

function makeDocument(overrides: Partial<GraphDocument> = {}): GraphDocument {
  return { preamble: '', nodes: [], edges: [], diagnostics: [], ...overrides };
}

const sourceText = '## Node\nbody\n';

describe('collectGraphDiagnostics', () => {
  it('returns no diagnostics for a valid document', () => {
    const graph = makeDocument({ nodes: [makeNode({ color: 'blue' })] });
    expect(collectGraphDiagnostics(graph, sourceText)).toEqual([]);
  });

  it('reports an unknown node color as MGS-E-001 at the node offset', () => {
    const graph = makeDocument({ nodes: [makeNode({ color: 'magenta', sourceRange: { start: 3, end: 10 } })] });
    const diagnostics = collectGraphDiagnostics(graph, sourceText);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'MGS-E-001', severity: 'error', offset: 3 });
    expect(diagnostics[0].message).toContain('magenta');
  });

  it('reports a blank or whitespace-only title as MGS-E-002', () => {
    const graph = makeDocument({ nodes: [makeNode({ id: 'A', title: '   ' })] });
    const diagnostics = collectGraphDiagnostics(graph, sourceText);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'MGS-E-002', severity: 'error' });
  });

  it('reports stale canvas-meta node and group keys as MGS-W-002', () => {
    const graph = makeDocument({
      nodes: [makeNode({ id: 'A' })],
      meta: {
        version: 1,
        nodes: { A: { x: 0, y: 0 }, Removed: { x: 1, y: 1 } },
        groups: { OrphanGroup: { x: 0, y: 0, width: 1, height: 1, color: 'gray', members: [] } },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });
    const diagnostics = collectGraphDiagnostics(graph, sourceText);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.every((item) => item.code === 'MGS-W-002' && item.severity === 'warning')).toBe(true);
    expect(diagnostics[0].message).toContain('"Removed"');
    expect(diagnostics[1].message).toContain('"OrphanGroup"');
  });

  it('reports stale canvas-meta edge keys and caps the listed keys at three', () => {
    const graph = makeDocument({
      nodes: [makeNode({ id: 'Node' }), makeNode({ id: 'Other' })],
      edges: [{ id: 'edge-1', source: 'Node', target: 'Other', label: '', arrow: 'forward', line: 'solid', path: 'orthogonal', sourceRange: { start: 0, end: 1 } }],
      meta: {
        version: 1,
        nodes: {},
        groups: {},
        edges: {
          'gone-1': { source: { kind: 'free', x: 0, y: 0 }, target: { kind: 'free', x: 1, y: 1 } },
          'gone-2': { source: { kind: 'free', x: 0, y: 0 }, target: { kind: 'free', x: 1, y: 1 } },
          'gone-3': { source: { kind: 'free', x: 0, y: 0 }, target: { kind: 'free', x: 1, y: 1 } },
          'gone-4': { source: { kind: 'free', x: 0, y: 0 }, target: { kind: 'free', x: 1, y: 1 } },
        },
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });
    const diagnostics = collectGraphDiagnostics(graph, sourceText);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toContain('"gone-1", "gone-2", "gone-3"');
    expect(diagnostics[0].message).toContain('(+1 more)');
  });

  it('reports ghost nodes as unresolved wiki-link info MGS-I-001', () => {
    const graph = makeDocument({ nodes: [makeNode({ id: 'Missing', ghost: true })] });
    const diagnostics = collectGraphDiagnostics(graph, sourceText);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'MGS-I-001', severity: 'info' });
    expect(diagnostics[0].message).toBe('Unresolved wiki-link target "Missing" — shown as ghost node');
  });

  it('reports self-loop edges as info MGS-I-002', () => {
    const graph = makeDocument({
      nodes: [makeNode()],
      edges: [{ id: 'loop', source: 'Node', target: 'Node', label: '', arrow: 'forward', line: 'solid', path: 'orthogonal', sourceRange: { start: 4, end: 9 } }],
    });
    const diagnostics = collectGraphDiagnostics(graph, sourceText);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'MGS-I-002', severity: 'info', offset: 4 });
  });

  it('reports an empty document with zero nodes as info MGS-I-003', () => {
    const diagnostics = collectGraphDiagnostics(makeDocument(), sourceText);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'MGS-I-003', severity: 'info' });
  });

  it('always attaches severity and code to every returned diagnostic', () => {
    const graph = makeDocument({
      nodes: [
        makeNode({ id: 'A', title: '  ', color: 'neon', ghost: true }),
        makeNode({ id: 'B', color: 'blue' }),
      ],
    });
    const diagnostics = collectGraphDiagnostics(graph, sourceText);
    expect(diagnostics.length).toBeGreaterThanOrEqual(3);
    for (const diagnostic of diagnostics) {
      expect(['error', 'warning', 'info']).toContain(diagnostic.severity);
      expect(diagnostic.code).toMatch(/^MGS-[EWI]-\d{3}$/);
    }
  });

  it('never throws on partial or null-ish input', () => {
    expect(() => collectGraphDiagnostics({} as GraphDocument, '')).not.toThrow();
    expect(() => collectGraphDiagnostics(null as unknown as GraphDocument, '')).not.toThrow();
    expect(() => collectGraphDiagnostics(makeDocument({ nodes: [null as unknown as GraphNode], meta: undefined }), sourceText)).not.toThrow();
    expect(collectGraphDiagnostics(null as unknown as GraphDocument, '')).toEqual([]);
  });

  it('clamps offsets to the source text length', () => {
    const graph = makeDocument({ nodes: [makeNode({ color: 'magenta', sourceRange: { start: 500, end: 900 } })] });
    const diagnostics = collectGraphDiagnostics(graph, sourceText);
    expect(diagnostics[0].offset).toBe(sourceText.length);
  });

  it('does not flag ghost nodes with the valid default color', () => {
    const graph = makeDocument({ nodes: [makeNode({ ghost: true, color: 'gray' })] });
    expect(collectGraphDiagnostics(graph, sourceText).every((item) => item.code !== 'MGS-E-001')).toBe(true);
  });
});

describe('collectGraphDiagnostics node icons', () => {
  it('warns MGS-W-003 for an icon outside the catalog', () => {
    const graph = makeDocument({ nodes: [makeNode({ icon: 'rocket', sourceRange: { start: 3, end: 10 } })] });
    const diagnostics = collectGraphDiagnostics(graph, sourceText);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'MGS-W-003', severity: 'warning', offset: 3 });
    expect(diagnostics[0].message).toContain('rocket');
  });

  it('stays silent for known, empty or missing icons', () => {
    expect(collectGraphDiagnostics(makeDocument({ nodes: [makeNode({ icon: 'book' })] }), sourceText)).toEqual([]);
    expect(collectGraphDiagnostics(makeDocument({ nodes: [makeNode({ icon: 'dollar-sign' })] }), sourceText)).toEqual([]);
    expect(collectGraphDiagnostics(makeDocument({ nodes: [makeNode({ icon: 'layers' })] }), sourceText)).toEqual([]);
    expect(collectGraphDiagnostics(makeDocument({ nodes: [makeNode({ icon: 'alert-octagon' })] }), sourceText)).toEqual([]);
    expect(collectGraphDiagnostics(makeDocument({ nodes: [makeNode({ icon: '' })] }), sourceText)).toEqual([]);
    expect(collectGraphDiagnostics(makeDocument({ nodes: [makeNode()] }), sourceText)).toEqual([]);
  });

  it('ignores ghost nodes carrying an unknown icon', () => {
    const graph = makeDocument({ nodes: [makeNode({ id: 'Missing', ghost: true, icon: 'rocket' })] });
    const diagnostics = collectGraphDiagnostics(graph, sourceText);
    expect(diagnostics.every((item) => item.code !== 'MGS-W-003')).toBe(true);
  });
});
