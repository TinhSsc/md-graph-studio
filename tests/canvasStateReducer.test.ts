import { describe, expect, it } from 'vitest';
import type { CanvasMeta } from '../src/model/graphTypes';
import { createCanvasMeta, renameNodeState, updateEdgeState } from '../src/state/CanvasStateReducer';

describe('CanvasStateReducer', () => {
  const initial: CanvasMeta = {
    version: 1,
    revision: 4,
    nodes: {
      source: { x: 10, y: 20, width: 200, height: 100, collapsed: true, locked: true, layer: 3 },
      target: { x: 400, y: 20, width: 200, height: 100, layer: 2 },
    },
    groups: { flow: { members: ['source', 'target'], x: 0, y: 0, width: 640, height: 240, color: 'gray' } },
    edges: {
      'source>target#0': {
        source: { kind: 'node', nodeId: 'source', xRatio: 1, yRatio: 0.5 },
        target: { kind: 'node', nodeId: 'target', xRatio: 0, yRatio: 0.5 },
      },
    },
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  it('updates layout without dropping node capabilities or edge state', () => {
    const updated = createCanvasMeta(initial, [
      { id: 'source', x: 70, y: 80, width: 240, height: 140, layer: 9 },
    ]);

    expect(updated.revision).toBe(5);
    expect(updated.nodes.source).toEqual({
      x: 70, y: 80, width: 240, height: 140, collapsed: true, locked: true, layer: 9,
    });
    expect(updated.nodes.target).toEqual(initial.nodes.target);
    expect(updated.edges).toEqual(initial.edges);
  });

  it('moves nodes without creating or overwriting size metadata', () => {
    const withoutSize: CanvasMeta = {
      ...initial,
      nodes: { source: { x: 10, y: 20 } },
    };
    const movedAutoSize = createCanvasMeta(withoutSize, [{ id: 'source', x: 90, y: 110 }]);
    const movedManualSize = createCanvasMeta(initial, [{ id: 'source', x: 90, y: 110 }]);

    expect(movedAutoSize.nodes.source).toEqual({ x: 90, y: 110 });
    expect(movedManualSize.nodes.source).toMatchObject({ x: 90, y: 110, width: 200, height: 100 });
  });

  it('updates either endpoint without changing node layout', () => {
    const endpoints = {
      source: { kind: 'node' as const, nodeId: 'source', xRatio: 0.5, yRatio: 1 },
      target: { kind: 'node' as const, nodeId: 'target', xRatio: 0.5, yRatio: 0 },
    };
    const updated = updateEdgeState(initial, 'source>target#0', endpoints);

    expect(updated.nodes).toEqual(initial.nodes);
    expect(updated.edges?.['source>target#0']).toEqual(endpoints);
    expect(updated.revision).toBe(5);
  });

  it('renames node ownership in node, group, and endpoint state together', () => {
    const updated = renameNodeState(initial, 'source', 'renamed', new Map([
      ['source>target#0', 'renamed>target#0'],
    ]));

    expect(updated.nodes.source).toBeUndefined();
    expect(updated.nodes.renamed).toEqual(initial.nodes.source);
    expect(updated.groups.flow.members).toEqual(['renamed', 'target']);
    expect(updated.edges?.['renamed>target#0'].source).toMatchObject({ nodeId: 'renamed' });
  });
});
