import { describe, expect, it } from 'vitest';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { FULL_GRAPH_TEMPLATE, FULL_GRAPH_TEMPLATE_META } from '../src/templates/fullGraphTemplate';
import { SidecarStorageManager } from '../src/storage/SidecarStorageManager';

describe('full graph template', () => {
  it('covers supported node and content features with valid edges', () => {
    const graph = parseMarkdownGraph(FULL_GRAPH_TEMPLATE);
    expect(graph.nodes).toHaveLength(9);
    expect(graph.edges).toHaveLength(9);
    expect(new Set(graph.nodes.map(node => node.shape))).toEqual(new Set(['rounded-rectangle', 'rectangle']));
    expect(graph.nodes.every(node => Boolean(node.icon))).toBe(true);
    expect(graph.nodes.some(node => node.content.includes('- [x]'))).toBe(true);
    expect(graph.nodes.some(node => node.content.includes('```markdown'))).toBe(true);
    expect(graph.nodes.some(node => node.content.includes('!['))).toBe(true);
    expect(FULL_GRAPH_TEMPLATE).toContain('https://upload.wikimedia.org/wikipedia/commons/4/48/Markdown-mark.svg');
    expect(FULL_GRAPH_TEMPLATE).not.toContain('placehold.co');
    expect(new Set(graph.edges.map(edge => edge.line))).toEqual(new Set(['solid', 'dashed', 'dotted']));
    expect(new Set(graph.edges.map(edge => edge.arrow))).toEqual(new Set(['forward']));
    expect(graph.diagnostics).toEqual([]);
  });

  it('provides valid starter layout JSON for every template node', () => {
    const graph = parseMarkdownGraph(FULL_GRAPH_TEMPLATE);
    const manager = new SidecarStorageManager();
    expect(manager.validateSidecar(FULL_GRAPH_TEMPLATE_META)).toEqual(FULL_GRAPH_TEMPLATE_META);
    expect(Object.keys(FULL_GRAPH_TEMPLATE_META.nodes).sort()).toEqual(graph.nodes.map(node => node.id).sort());
  });
});
