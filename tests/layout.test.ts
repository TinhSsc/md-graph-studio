import { describe, expect, it } from 'vitest';
import { autoLayout, layoutGraphDocument, resolveEdgePorts } from '../src/layout/AutoLayoutEngine';
import type { GraphDocument, GraphEdge, GraphNode } from '../src/model/graphTypes';

const node = (id: string, locked = false): GraphNode => ({ id, title: id, content: '', shape: 'rectangle', color: 'gray', x: 5, y: 5, width: 100, height: 60, collapsed: false, locked, ghost: false });
const edge = (source: string, target: string): GraphEdge => ({ id: `${source}-${target}`, source, target, label: '', arrow: 'forward', line: 'solid', path: 'orthogonal', sourceRange: { start: 0, end: 0 } });

describe('autoLayout', () => {
  it('places a directed graph in deterministic top-to-bottom layers', () => {
    const result = autoLayout([node('A'), node('B'), node('C')], [edge('A', 'B'), edge('A', 'C')], { direction: 'top-to-bottom' });
    expect(result.find((item) => item.id === 'A')?.y).toBeLessThan(result.find((item) => item.id === 'B')!.y);
    expect(result.find((item) => item.id === 'B')?.y).toBe(result.find((item) => item.id === 'C')?.y);
    expect(autoLayout([node('A'), node('B'), node('C')], [edge('A', 'B'), edge('A', 'C')], { direction: 'top-to-bottom' })).toEqual(result);
  });

  it('keeps locked nodes and supports left-to-right ports', () => {
    const [source, target] = autoLayout([node('A', true), node('B')], [edge('A', 'B')], { direction: 'left-to-right' });
    expect(source).toMatchObject({ x: 5, y: 5 });
    expect(target.x).toBeGreaterThan(source.x);
    expect(resolveEdgePorts(source, target, 'left-to-right')).toEqual({ from: 'right', to: 'left' });
  });

  it('does not hang on cycles', () => {
    const result = autoLayout([node('A'), node('B')], [edge('A', 'B'), edge('B', 'A')], { direction: 'top-to-bottom' });
    expect(result).toHaveLength(2);
  });

  it('uses auto-layout only when canvas metadata is absent', () => {
    const document: GraphDocument = { preamble: '', nodes: [node('A')], edges: [], diagnostics: [] };
    expect(layoutGraphDocument(document).nodes[0]).toMatchObject({ x: 80, y: 80 });
    const withMeta = { ...document, meta: { version: 1, nodes: {}, groups: {}, viewport: { x: 0, y: 0, zoom: 1 } } };
    expect(layoutGraphDocument(withMeta).nodes[0]).toMatchObject({ x: 5, y: 5 });
  });
});
