import { describe, expect, it } from 'vitest';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { updateNodeDocument } from '../src/parser/NodeDocumentUpdater';

describe('updateNodeDocument', () => {
  it('renames links and canvas references without moving the node or its edges', () => {
    const source = `## Start
- [[Old]]

## Old
Body
- [[Finish]]

## Finish
Done

<!-- canvas-meta
{"version":1,"nodes":{"Old":{"x":120,"y":80}},"groups":{"group":{"x":0,"y":0,"width":400,"height":300,"color":"blue","members":["Old"]}},"edges":{"Start>Old#0":{"source":{"kind":"node","nodeId":"Start","xRatio":1,"yRatio":0.5},"target":{"kind":"node","nodeId":"Old","xRatio":0,"yRatio":0.5}},"Old>Finish#0":{"source":{"kind":"node","nodeId":"Old","xRatio":1,"yRatio":0.5},"target":{"kind":"node","nodeId":"Finish","xRatio":0,"yRatio":0.5}}},"viewport":{"x":0,"y":0,"zoom":1}}
-->
`;
    const graph = parseMarkdownGraph(source);
    const node = graph.nodes.find((item) => item.id === 'Old')!;
    const updated = updateNodeDocument(source, graph, node, { ...node, title: 'Renamed', content: 'Changed' });
    const result = parseMarkdownGraph(updated);

    expect(result.nodes.some((item) => item.id === 'Old')).toBe(false);
    expect(result.nodes.find((item) => item.id === 'Renamed')).toMatchObject({ x: 120, y: 80, content: 'Changed' });
    expect(result.edges.map((edge) => [edge.source, edge.target])).toEqual([['Start', 'Renamed'], ['Renamed', 'Finish']]);
    expect(result.edges[0].endpoints?.target).toMatchObject({ kind: 'node', nodeId: 'Renamed' });
    expect(result.edges[1].endpoints?.source).toMatchObject({ kind: 'node', nodeId: 'Renamed' });
    expect(result.meta?.groups.group.members).toEqual(['Renamed']);
  });
});
