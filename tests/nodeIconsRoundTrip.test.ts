import { describe, expect, it } from 'vitest';
import { nodeIconIds, nodeIconLabels } from '../src/model/nodeIcons';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { applyTextEdits, createNodeSection, serializeNodeAttributes, updateNodeSection } from '../src/parser/MarkdownGraphSerializer';

const PLAIN_COMMENT = '<!-- graph-node: shape=rectangle; color=blue; collapsed=false; locked=false -->';
const ICON_COMMENT = '<!-- graph-node: shape=rectangle; color=blue; collapsed=false; locked=false; icon=book -->';

describe('node icon catalog', () => {
  it('exposes the canonical 27 icon ids without duplicates', () => {
    expect(nodeIconIds).toHaveLength(27);
    expect(new Set(nodeIconIds).size).toBe(27);
    for (const id of ['book', 'database', 'alert-triangle', 'check-circle', 'git-branch', 'dollar-sign']) {
      expect(nodeIconIds).toContain(id);
    }
  });

  it('provides a human label for every icon id', () => {
    for (const id of nodeIconIds) {
      expect(typeof nodeIconLabels[id]).toBe('string');
      expect(nodeIconLabels[id].length).toBeGreaterThan(0);
    }
    expect(nodeIconLabels['alert-triangle']).toBe('Warning');
  });
});

describe('icon round-trip', () => {
  it('parses icon=book from the graph-node comment into node.icon', () => {
    const graph = parseMarkdownGraph(`## Start\n${ICON_COMMENT}\nBody\n`);
    expect(graph.nodes[0].icon).toBe('book');
  });

  it('serializes a node with an icon after the four base keys', () => {
    expect(serializeNodeAttributes({ shape: 'rectangle', color: 'blue', collapsed: false, locked: false, icon: 'book' })).toBe(ICON_COMMENT);
  });

  it('serializes a node without an icon byte-identical to the 4-key format', () => {
    expect(serializeNodeAttributes({ shape: 'rectangle', color: 'blue', collapsed: false, locked: false })).toBe(PLAIN_COMMENT);
    expect(serializeNodeAttributes({ shape: 'rounded-rectangle', color: 'red', collapsed: true, locked: true, icon: undefined })).toBe('<!-- graph-node: shape=rounded-rectangle; color=red; collapsed=true; locked=true -->');
    expect(serializeNodeAttributes({ shape: 'rounded-rectangle', color: 'red', collapsed: true, locked: true, icon: '  ' })).toBe('<!-- graph-node: shape=rounded-rectangle; color=red; collapsed=true; locked=true -->');
  });

  it('keeps the icon when updateNodeSection rewrites the section', () => {
    const doc = `## Start\n${ICON_COMMENT}\nOld body\n`;
    const node = parseMarkdownGraph(doc).nodes[0];
    const updated = applyTextEdits(doc, [updateNodeSection(doc, node, { ...node, content: 'New body' })]);
    expect(updated).toContain(ICON_COMMENT);
    expect(updated).toContain('New body');
  });

  it('clears the icon when the change sets it to undefined', () => {
    const doc = `## Start\n${ICON_COMMENT}\nBody\n`;
    const node = parseMarkdownGraph(doc).nodes[0];
    const updated = applyTextEdits(doc, [updateNodeSection(doc, node, { ...node, icon: undefined })]);
    expect(updated).not.toContain('icon=');
    expect(parseMarkdownGraph(updated).nodes[0].icon).toBeUndefined();
  });

  it('still ignores unknown attribute keys other than icon', () => {
    const doc = `## A\n<!-- graph-node: shape=rectangle; color=blue; collapsed=false; locked=false; foo=bar; icon=star -->\nBody\n`;
    const graph = parseMarkdownGraph(doc);
    expect(graph.nodes[0].icon).toBe('star');
    expect(graph.diagnostics).toHaveLength(0);
  });

  it('trims surrounding whitespace from the icon value', () => {
    const doc = '## A\n<!-- graph-node: shape=rectangle; color=blue; collapsed=false; locked=false; icon=  star  -->\nBody\n';
    expect(parseMarkdownGraph(doc).nodes[0].icon).toBe('star');
  });

  it('treats an empty icon value as no icon', () => {
    const doc = '## A\n<!-- graph-node: shape=rectangle; color=blue; collapsed=false; locked=false; icon= -->\nBody\n';
    const graph = parseMarkdownGraph(doc);
    expect(graph.nodes[0].icon).toBeUndefined();
    expect(graph.diagnostics).toHaveLength(0);
  });

  it('includes the icon when createNodeSection builds a new section', () => {
    const section = createNodeSection({ title: 'Clone', shape: 'rounded-rectangle', color: 'purple', collapsed: false, locked: false, icon: 'zap', content: 'Hello' });
    expect(section).toContain('<!-- graph-node: shape=rounded-rectangle; color=purple; collapsed=false; locked=false; icon=zap -->');
  });

  it('round-trips parse → serialize → parse with the icon intact', () => {
    const doc = `## Start\n${ICON_COMMENT}\nBody\n`;
    const node = parseMarkdownGraph(doc).nodes[0];
    const serialized = createNodeSection({ ...node, content: node.content, explicitId: node.explicitId });
    expect(parseMarkdownGraph(`${serialized}\n`).nodes[0].icon).toBe('book');
  });
});
