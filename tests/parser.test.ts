import { describe, expect, it } from 'vitest';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';

describe('parseMarkdownGraph', () => {
  it('parses semantic attributes, links, metadata, and ghost nodes', () => {
    const graph = parseMarkdownGraph(`# Overview\n\n## Start\n<!-- graph-node: shape=diamond; color=yellow -->\n- [[Finish|continue]] <!-- graph-edge: arrow=both; line=dashed; path=orthogonal; from=right; to=left -->\n\n<!-- canvas-meta\n{"version":1,"nodes":{},"groups":{},"viewport":{"x":0,"y":0,"zoom":1}}\n-->\n`);
    expect(graph.preamble).toBe('# Overview\n\n');
    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0]).toMatchObject({ title: 'Start', shape: 'diamond', color: 'yellow' });
    expect(graph.nodes[0]).toMatchObject({ x: 0, y: 0, width: 240, height: 160 });
    expect(graph.nodes[1]).toMatchObject({ title: 'Finish', ghost: true });
    expect(graph.edges[0]).toMatchObject({ source: 'Start', target: 'Finish', label: 'continue', arrow: 'both', line: 'dashed', path: 'orthogonal', fromPort: 'right', toPort: 'left' });
    expect(graph.meta?.version).toBe(1);
  });

  it('does not parse headings or links inside fenced code', () => {
    const graph = parseMarkdownGraph('## Real\n```md\n## Fake\n[[Ignored]]\n```\n');
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });

  it('reports invalid semantic values without failing', () => {
    const graph = parseMarkdownGraph('## A\n<!-- graph-node: shape=octagon; collapsed=maybe -->\n');
    expect(graph.nodes[0]).toMatchObject({ shape: 'rounded-rectangle', collapsed: false });
    expect(graph.diagnostics).toHaveLength(2);
  });

  it('normalizes legacy edge path attributes to orthogonal', () => {
    const graph = parseMarkdownGraph('## A\n- [[B]] <!-- graph-edge: path=freehand -->\n');
    expect(graph.edges[0].path).toBe('orthogonal');
    expect(graph.diagnostics).toHaveLength(0);
  });

  it('hydrates optional edge endpoints from canvas metadata', () => {
    const source = '## A\n- [[B]]\n\n## B\n\n<!-- canvas-meta\n{"version":1,"nodes":{},"groups":{},"edges":{"A:7":{"source":{"kind":"free","x":10,"y":20},"target":{"kind":"node","nodeId":"B","xRatio":0,"yRatio":0.5}}},"viewport":{"x":0,"y":0,"zoom":1}}\n-->\n';
    const graph = parseMarkdownGraph(source);
    expect(graph.edges[0].endpoints).toEqual({ source: { kind: 'free', x: 10, y: 20 }, target: { kind: 'node', nodeId: 'B', xRatio: 0, yRatio: 0.5 } });
    expect(graph.meta?.edges?.[graph.edges[0].id]).toEqual(graph.edges[0].endpoints);
    expect(graph.meta?.edges?.['A:7']).toBeUndefined();
  });

  it('keeps existing edge IDs stable when earlier edges are appended', () => {
    const before = parseMarkdownGraph('## A\n\n## B\n- [[C]]\n\n## C\n');
    const after = parseMarkdownGraph('## A\n- [[C]]\n\n## B\n- [[C]]\n\n## C\n');
    expect(after.edges.find((edge) => edge.source === 'B')?.id).toBe(before.edges[0].id);
  });

  it('keeps duplicate edge IDs stable when another duplicate is appended', () => {
    const before = parseMarkdownGraph('## A\n- [[B]]\n- [[B]]\n\n## B\n');
    const after = parseMarkdownGraph('## A\n- [[B]]\n- [[B]]\n- [[B]]\n\n## B\n');
    expect(after.edges.slice(0, 2).map((edge) => edge.id)).toEqual(before.edges.map((edge) => edge.id));
  });

  it('gives existing duplicate headings distinct runtime ids', () => {
    const graph = parseMarkdownGraph('## Same\nFirst\n\n## Same\nSecond\n');
    expect(graph.nodes.map((node) => node.id)).toEqual(['Same', 'Same 2']);
    expect(graph.diagnostics[0]?.message).toBe('Duplicate node title: Same');
  });
});
