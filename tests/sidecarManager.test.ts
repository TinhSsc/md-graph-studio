import { describe, expect, it } from 'vitest';
import { SidecarStorageManager } from '../src/storage/SidecarStorageManager';
import { hydrateGraphWithStorageMode } from '../src/storage/HydrationEngine';
import type { CanvasMeta, GraphDocument } from '../src/model/graphTypes';

describe('Phase 2: SidecarStorageManager Validation & Logic', () => {
  const manager = new SidecarStorageManager();

  it('determines correct sidecar URI based on naming preference', () => {
    const docUri = { fsPath: 'd:/workspace/test-doc.md', toString: () => 'd:/workspace/test-doc.md' };
    const defaultUri = manager.getSidecarUri(docUri, 'dot-md-graph-json');
    expect(defaultUri.fsPath.replace(/\\/g, '/')).toBe('d:/workspace/test-doc.md.graph.json');

    const alternativeUri = manager.getSidecarUri(docUri, 'dot-graph-json');
    expect(alternativeUri.fsPath.replace(/\\/g, '/')).toBe('d:/workspace/test-doc.graph.json');
  });

  it('validates compliant CanvasMeta structure', () => {
    const valid = {
      version: 1,
      nodes: {
        'auth-service': { x: 100, y: 200, width: 240, height: 160, collapsed: false, locked: false },
      },
      groups: {},
      edges: {
        'auth-service>db#0': {
          source: { kind: 'node', nodeId: 'auth-service', xRatio: 1, yRatio: 0.5 },
          target: { kind: 'node', nodeId: 'db', xRatio: 0, yRatio: 0.5 },
        },
      },
      viewport: { x: 10, y: 20, zoom: 1.2 },
    };

    const validated = manager.validateSidecar(valid);
    expect(validated).not.toBeNull();
    expect(validated?.version).toBe(1);
    expect(validated?.nodes['auth-service'].x).toBe(100);
    expect(validated?.viewport.zoom).toBe(1.2);
  });

  it('rejects invalid or corrupted CanvasMeta data', () => {
    expect(manager.validateSidecar(null)).toBeNull();
    expect(manager.validateSidecar({})).toBeNull();
    expect(manager.validateSidecar({ version: 2 })).toBeNull();
    expect(manager.validateSidecar({ version: 1, nodes: { a: { x: 'not-a-number', y: 0 } }, viewport: { x: 0, y: 0, zoom: 1 } })).toBeNull();
    expect(manager.validateSidecar({ version: 1, nodes: {}, viewport: { x: 0, y: 0, zoom: -1 } })).toBeNull();
    expect(manager.validateSidecar({ version: 1, revision: -1, nodes: {}, groups: {}, viewport: { x: 0, y: 0, zoom: 1 } })).toBeNull();
    expect(manager.validateSidecar({
      version: 1,
      nodes: {},
      groups: {},
      edges: { edge: { source: { kind: 'node', nodeId: 'a', xRatio: 2, yRatio: 0 }, target: { kind: 'free', x: 0, y: 0 } } },
      viewport: { x: 0, y: 0, zoom: 1 },
    })).toBeNull();
  });

  it('produces deterministic canonical JSON stringification with sorted keys', () => {
    const meta: CanvasMeta = {
      version: 1,
      nodes: {
        'z-node': { x: 1, y: 2 },
        'a-node': { x: 3, y: 4 },
      },
      groups: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const json = manager.canonicalStringify(meta);
    const parsed = JSON.parse(json);
    const keys = Object.keys(parsed.nodes);
    expect(keys).toEqual(['a-node', 'z-node']);
  });
});

describe('Phase 2: HydrationEngine Storage Mode Precedence', () => {
  function makeSampleGraph(): GraphDocument {
    return {
      preamble: '',
      nodes: [
        { id: 'node-1', title: 'Node 1', content: '', shape: 'rounded-rectangle', color: 'gray', x: 0, y: 0, width: 240, height: 160, collapsed: false, locked: false, ghost: false },
        { id: 'node-2', title: 'Node 2', content: '', shape: 'rounded-rectangle', color: 'gray', x: 0, y: 0, width: 240, height: 160, collapsed: false, locked: false, ghost: false },
      ],
      edges: [],
      meta: {
        version: 1,
        nodes: {
          'node-1': { x: 10, y: 10 },
          'node-2': { x: 20, y: 20 },
        },
        groups: {},
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      diagnostics: [],
    };
  }

  it('in sidecar mode: prefers sidecar meta over embedded meta', () => {
    const graph = makeSampleGraph();
    const sidecarMeta: CanvasMeta = {
      version: 1,
      nodes: {
        'node-1': { x: 999, y: 999, collapsed: true, locked: true },
      },
      groups: {},
      viewport: { x: 50, y: 50, zoom: 2 },
    };

    const hydrated = hydrateGraphWithStorageMode(graph, { mode: 'sidecar', sidecarMeta });
    expect(hydrated.nodes[0].x).toBe(999);
    expect(hydrated.nodes[0].collapsed).toBe(true);
    expect(hydrated.nodes[0].locked).toBe(true);
    expect(hydrated.meta?.viewport.zoom).toBe(2);
  });

  it('ignores endpoint metadata owned by a different semantic node', () => {
    const graph = makeSampleGraph();
    graph.edges = [{
      id: 'node-1>node-2#0', source: 'node-1', target: 'node-2', label: '', arrow: 'forward', line: 'solid', path: 'orthogonal',
      sourceRange: { start: 0, end: 0 },
    }];
    const sidecarMeta: CanvasMeta = {
      version: 1,
      nodes: {},
      groups: {},
      edges: {
        'node-1>node-2#0': {
          source: { kind: 'node', nodeId: 'wrong-node', xRatio: 1, yRatio: 0.5 },
          target: { kind: 'node', nodeId: 'node-2', xRatio: 0, yRatio: 0.5 },
        },
      },
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const hydrated = hydrateGraphWithStorageMode(graph, { mode: 'sidecar', sidecarMeta });
    expect(hydrated.edges[0].endpoints).toBeUndefined();
  });

  it('in sidecar mode: falls back to embedded meta when sidecar is null', () => {
    const graph = makeSampleGraph();
    const hydrated = hydrateGraphWithStorageMode(graph, { mode: 'sidecar', sidecarMeta: null });
    expect(hydrated.nodes[0].x).toBe(10);
    expect(hydrated.nodes[1].x).toBe(20);
    expect(hydrated.meta?.version).toBe(1);
  });

  it('in embedded mode: prefers embedded meta over sidecar meta', () => {
    const graph = makeSampleGraph();
    const sidecarMeta: CanvasMeta = {
      version: 1,
      nodes: {
        'node-1': { x: 888, y: 888 },
      },
      groups: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const hydrated = hydrateGraphWithStorageMode(graph, { mode: 'embedded', sidecarMeta });
    expect(hydrated.nodes[0].x).toBe(10);
  });

  it('in stateless mode: strips meta and uses autoLayout', () => {
    const graph = makeSampleGraph();
    const hydrated = hydrateGraphWithStorageMode(graph, { mode: 'stateless', sidecarMeta: null });
    expect(hydrated.meta).toBeUndefined();
    expect(hydrated.nodes[0].x).toBeDefined();
    expect(hydrated.nodes[1].x).toBeDefined();
  });
});
