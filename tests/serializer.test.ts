import { describe, expect, it } from 'vitest';
import { appendEdge, applyTextEdits, createNodeSection, renameWikiLinkTargets, serializeEdge, updateCanvasMeta, updateNodeSection } from '../src/parser/MarkdownGraphSerializer';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';

describe('MarkdownGraphSerializer', () => {
  it('serializes semantic node and edge syntax', () => {
    expect(createNodeSection({ title: 'Start', shape: 'circle', color: 'blue', collapsed: false, locked: false, content: 'Hello' })).toContain('<!-- graph-node: shape=circle; color=blue; collapsed=false; locked=false -->');
    expect(serializeEdge('Finish', { label: 'next', arrow: 'forward', line: 'solid', path: 'orthogonal' })).toBe('- [[Finish|next]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal -->');
  });

  it('replaces only canvas metadata', () => {
    const source = '## A\nText\n\n<!-- canvas-meta\n{"version":1,"nodes":{},"groups":{},"viewport":{"x":0,"y":0,"zoom":1}}\n-->\n';
    const result = applyTextEdits(source, [updateCanvasMeta(source, { version: 1, nodes: { A: { x: 1, y: 2 } }, groups: {}, viewport: { x: 0, y: 0, zoom: 1 } })]);
    expect(result).toContain('"A":{"x":1,"y":2}');
    expect(result).toContain('## A\nText');
  });

  it('updates a selected node and appends a connection without rewriting preamble', () => {
    const source = '# Overview\n\n## Start\nOld content\n\n## Finish\nDone\n';
    const graph = parseMarkdownGraph(source);
    const start = graph.nodes.find((node) => node.id === 'Start')!;
    const updated = applyTextEdits(source, [updateNodeSection(source, start, { ...start, title: 'Start', shape: 'circle', color: 'blue', content: 'New content' })]);
    expect(updated).toContain('<!-- graph-node: shape=circle; color=blue; collapsed=false; locked=false -->');
    expect(updated).toContain('# Overview');
    const nextStart = parseMarkdownGraph(updated).nodes.find((node) => node.id === 'Start')!;
    const connected = applyTextEdits(updated, [appendEdge(updated, nextStart, 'Finish')]);
    expect(connected).toContain('[[Finish]]');
  });

  it('renames exact wiki link targets without touching fenced examples', () => {
    const source = '[[Old|label]]\n```md\n[[Old]]\n```\n[[Old note]]\n';
    expect(renameWikiLinkTargets(source, 'Old', 'New')).toBe('[[New|label]]\n```md\n[[Old]]\n```\n[[Old note]]\n');
  });
});
