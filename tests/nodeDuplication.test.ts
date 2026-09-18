import { describe, expect, it } from 'vitest';
import { applyMetaPatch, buildDuplicateNodeEdits } from '../src/parser/NodeDuplication';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { applyTextEdits } from '../src/parser/MarkdownGraphSerializer';
import type { CanvasMeta } from '../src/model/graphTypes';

const SOURCE_COMMENT = '<!-- graph-node: shape=rectangle; color=blue; collapsed=false; locked=false; icon=star -->';
const DOC = `# Doc\n\n## Start\n${SOURCE_COMMENT}\nHello\n\n## Next\nWorld\n`;

const META: CanvasMeta = {
  version: 1,
  nodes: { Start: { x: 100, y: 80, width: 240, height: 120 } },
  groups: {},
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe('buildDuplicateNodeEdits', () => {
  it('builds a single insert edit at the end of the source section', () => {
    const graph = parseMarkdownGraph(DOC);
    const start = graph.nodes.find((node) => node.id === 'Start')!;
    const result = buildDuplicateNodeEdits(DOC, graph, 'Start', null);
    expect(result).not.toBeNull();
    expect(result!.edits).toHaveLength(1);
    expect(result!.edits[0].start).toBe(start.sourceRange!.end);
    expect(result!.edits[0].end).toBe(start.sourceRange!.end);
    expect(result!.edits[0].text.startsWith('## Start 2\n')).toBe(true);
  });

  it('dedupes the new title against all current node ids', () => {
    const graph = parseMarkdownGraph(DOC);
    const result = buildDuplicateNodeEdits(DOC, graph, 'Start', null)!;
    expect(result.newTitle).toBe('Start 2');
    expect(result.newId).toBe('Start 2');
    const nextText = applyTextEdits(DOC, result.edits);
    const again = buildDuplicateNodeEdits(nextText, parseMarkdownGraph(nextText), 'Start', null)!;
    expect(again.newTitle).toBe('Start 3');
  });

  it('inserts the clone between the source section and the following heading', () => {
    const result = buildDuplicateNodeEdits(DOC, parseMarkdownGraph(DOC), 'Start', null)!;
    const next = applyTextEdits(DOC, result.edits);
    expect(next).toContain('Hello\n\n## Start 2');
    expect(next.indexOf('## Start 2')).toBeLessThan(next.indexOf('## Next'));
    expect(next).toContain('## Next');
  });

  it('copies shape, color and icon into the cloned section', () => {
    const result = buildDuplicateNodeEdits(DOC, parseMarkdownGraph(DOC), 'Start', null)!;
    expect(result.edits[0].text).toContain('shape=rectangle; color=blue; collapsed=false; locked=false; icon=star');
  });

  it('copies collapsed and locked state into the clone', () => {
    const doc = '## Locked\n<!-- graph-node: shape=rectangle; color=red; collapsed=true; locked=true -->\nBody\n';
    const result = buildDuplicateNodeEdits(doc, parseMarkdownGraph(doc), 'Locked', null)!;
    expect(result.edits[0].text).toContain('collapsed=true; locked=true');
  });

  it('strips edge lines from the duplicated content but keeps fenced ones', () => {
    const graph = parseMarkdownGraph(DOC);
    graph.nodes[0].content = 'Keep me\n- [[Next]]\n```\n- [[Fenced]]\n```\nEnd';
    const result = buildDuplicateNodeEdits(DOC, graph, 'Start', null)!;
    const section = result.edits[0].text;
    expect(section).toContain('Keep me');
    expect(section).toContain('End');
    expect(section).toContain('- [[Fenced]]');
    expect(section).not.toContain('- [[Next]]');
  });

  it('offsets the cloned meta entry by +32 on both axes', () => {
    const result = buildDuplicateNodeEdits(DOC, parseMarkdownGraph(DOC), 'Start', META)!;
    expect(result.metaPatch).toEqual({ 'Start 2': { x: 132, y: 112, width: 240, height: 120 } });
  });

  it('returns an empty metaPatch when meta is null or has no entry', () => {
    const graph = parseMarkdownGraph(DOC);
    expect(buildDuplicateNodeEdits(DOC, graph, 'Start', null)!.metaPatch).toEqual({});
    expect(buildDuplicateNodeEdits(DOC, graph, 'Next', META)!.metaPatch).toEqual({});
  });

  it('returns null for ghost, missing or non-string node ids', () => {
    const doc = `${DOC}- [[Missing]]\n`;
    const graph = parseMarkdownGraph(doc);
    expect(graph.nodes.find((node) => node.id === 'Missing')?.ghost).toBe(true);
    expect(buildDuplicateNodeEdits(doc, graph, 'Missing', META)).toBeNull();
    expect(buildDuplicateNodeEdits(doc, graph, 'Does Not Exist', META)).toBeNull();
  });

  it('produces a document where the clone parses back with the same style', () => {
    const result = buildDuplicateNodeEdits(DOC, parseMarkdownGraph(DOC), 'Start', null)!;
    const clone = parseMarkdownGraph(applyTextEdits(DOC, result.edits)).nodes.find((node) => node.id === 'Start 2');
    expect(clone).toBeDefined();
    expect(clone!.shape).toBe('rectangle');
    expect(clone!.color).toBe('blue');
    expect(clone!.icon).toBe('star');
    expect(clone!.content).toBe('Hello');
    expect(clone!.ghost).toBe(false);
  });
});

describe('applyMetaPatch', () => {
  it('merges the patch without mutating the source meta', () => {
    const next = applyMetaPatch(META, { 'Start 2': { x: 1, y: 2 } });
    expect(next.nodes['Start 2']).toEqual({ x: 1, y: 2 });
    expect(next.nodes.Start).toEqual({ x: 100, y: 80, width: 240, height: 120 });
    expect(META.nodes['Start 2']).toBeUndefined();
  });
});
