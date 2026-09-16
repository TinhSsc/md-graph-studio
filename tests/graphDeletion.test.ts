import { describe, expect, it } from 'vitest';
import { deleteEdgeDocument, deleteNodeDocument } from '../src/parser/GraphDeletion';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';

const metadata = `<!-- canvas-meta
{"version":1,"nodes":{"A":{"x":10,"y":20},"B":{"x":30,"y":40},"Deleted":{"x":50,"y":60}},"groups":{"g":{"x":0,"y":0,"width":100,"height":100,"color":"blue","members":["A","B","Deleted"]}},"edges":{"A>B#0":{"source":{"kind":"node","nodeId":"A","xRatio":1,"yRatio":0.5},"target":{"kind":"node","nodeId":"B","xRatio":0,"yRatio":0.5}},"Deleted>Gone#0":{"source":{"kind":"node","nodeId":"Deleted","xRatio":1,"yRatio":0.5},"target":{"kind":"free","x":0,"y":0}}},"viewport":{"x":0,"y":0,"zoom":1}}
-->`;

describe('graph deletion', () => {
  it('deletes a node, connected links, and orphaned metadata', () => {
    const source = `## A\n- [[B]]\n\n## B\nBody\n\n${metadata}\n`;
    const graph = parseMarkdownGraph(source);
    const node = graph.nodes.find((item) => item.id === 'B')!;
    const result = parseMarkdownGraph(deleteNodeDocument(source, graph, node));

    expect(result.nodes.map((item) => item.id)).toEqual(['A']);
    expect(result.edges).toHaveLength(0);
    expect(result.meta?.nodes).toEqual({ A: { x: 10, y: 20 } });
    expect(result.meta?.groups.g.members).toEqual(['A']);
    expect(result.meta?.edges).toBeUndefined();
  });

  it('removes deleted edge metadata while preserving remaining nodes', () => {
    const source = `## A\n- [[B]]\n\n## B\nBody\n\n${metadata}\n`;
    const graph = parseMarkdownGraph(source);
    const result = parseMarkdownGraph(deleteEdgeDocument(source, graph.edges[0]));

    expect(result.edges).toHaveLength(0);
    expect(result.meta?.nodes).toEqual({ A: { x: 10, y: 20 }, B: { x: 30, y: 40 } });
    expect(result.meta?.edges).toBeUndefined();
  });

  it('deletes a ghost node by removing links that recreate it', () => {
    const source = '## A\n- [[Missing]]\n';
    const graph = parseMarkdownGraph(source);
    const ghost = graph.nodes.find((node) => node.ghost)!;
    const result = parseMarkdownGraph(deleteNodeDocument(source, graph, ghost));

    expect(result.nodes.map((node) => node.id)).toEqual(['A']);
    expect(result.edges).toHaveLength(0);
  });
});
