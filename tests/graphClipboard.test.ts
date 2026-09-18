import { describe, expect, it } from 'vitest';
import {
  captureGraphSelection,
  createClipboardFromMarkdown,
  deleteGraphSelection,
  pasteGraphSelection,
  serializeClipboardToMarkdown,
} from '../src/parser/GraphClipboard';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';

const source = `## Alpha
<!-- graph-node: shape=rounded-rectangle; color=blue; collapsed=false; locked=false -->
First node.

- [[Beta|uses]]

## Beta
<!-- graph-node: shape=rectangle; color=green; collapsed=false; locked=false -->
Second node.
`;

describe('graph clipboard', () => {
  it('copies multiple nodes and preserves internal edges', () => {
    const graph = parseMarkdownGraph(source);
    graph.nodes[0].x = 10;
    graph.nodes[0].y = 20;
    graph.nodes[1].x = 300;
    graph.nodes[1].y = 20;
    const clipboard = captureGraphSelection(graph, new Set(['Alpha', 'Beta']));
    expect(clipboard?.nodes).toHaveLength(2);
    expect(clipboard?.edges).toHaveLength(1);

    const pasted = pasteGraphSelection(source, graph, clipboard!, 1)!;
    const result = parseMarkdownGraph(pasted.text);
    expect(result.nodes.map(node => node.title)).toEqual(['Alpha', 'Beta', 'Alpha', 'Beta']);
    expect(result.nodes.slice(2).map(node => node.id)).toEqual(['Alpha-paste-1', 'Beta-paste-1']);
    expect(result.edges.some(edge => edge.source === 'Alpha-paste-1' && edge.target === 'Beta-paste-1' && edge.label === 'uses')).toBe(true);
    expect(pasted.metaPatch['Alpha-paste-1']).toMatchObject({ x: 42, y: 52 });
  });

  it('removes a selection and incoming edges in one transformation', () => {
    const deleted = deleteGraphSelection(source, new Set(['Beta']), false);
    const result = parseMarkdownGraph(deleted);
    expect(result.nodes.map(node => node.id)).toEqual(['Alpha']);
    expect(result.edges).toHaveLength(0);
  });

  it('serializes clipboard nodes to markdown text for system clipboard copy', () => {
    const graph = parseMarkdownGraph(source);
    const clipboard = captureGraphSelection(graph, new Set(['Alpha']));
    expect(clipboard).not.toBeNull();

    const mdWithSource = serializeClipboardToMarkdown(clipboard!, source);
    expect(mdWithSource).toContain('## Alpha');
    expect(mdWithSource).toContain('First node.');
    expect(mdWithSource).toContain('[[Beta|uses]]');

    const mdSynthetic = serializeClipboardToMarkdown(clipboard!);
    expect(mdSynthetic).toContain('## Alpha');
    expect(mdSynthetic).toContain('First node.');
  });

  it('creates graph clipboard from external markdown text or plain text', () => {
    const extMd = `## External One\nNote 1 content\n\n## External Two\nNote 2 content\n- [[External One]]`;
    const parsedMd = createClipboardFromMarkdown(extMd);
    expect(parsedMd?.nodes).toHaveLength(2);
    expect(parsedMd?.nodes.map(n => n.title)).toEqual(['External One', 'External Two']);
    expect(parsedMd?.edges).toHaveLength(1);

    const plain = `Quick reminder note\nCheck the server logs before deploy`;
    const parsedPlain = createClipboardFromMarkdown(plain);
    expect(parsedPlain?.nodes).toHaveLength(1);
    expect(parsedPlain?.nodes[0].title).toBe('Quick reminder note');
    expect(parsedPlain?.nodes[0].content).toBe('Check the server logs before deploy');

    expect(createClipboardFromMarkdown('   ')).toBeNull();
  });
});
