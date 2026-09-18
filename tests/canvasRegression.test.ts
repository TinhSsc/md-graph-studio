import { describe, expect, it } from 'vitest';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { applyTextEdits, updateNodeSection } from '../src/parser/MarkdownGraphSerializer';
import { canvasMarkdownFixture } from './fixtures/canvasMarkdownFixture';

function updateResearchContent(text: string, content: string): string {
  const graph = parseMarkdownGraph(text);
  const node = graph.nodes.find((item) => item.id === 'Research')!;
  return applyTextEdits(text, [updateNodeSection(text, node, { ...node, content })]);
}

describe('Canvas markdown regression baseline', () => {
  it('parses fixture with real, ghost and locked nodes plus canvas-meta', () => {
    const graph = parseMarkdownGraph(canvasMarkdownFixture);
    const research = graph.nodes.find((node) => node.id === 'Research')!;
    const writing = graph.nodes.find((node) => node.id === 'Writing')!;
    const publishing = graph.nodes.find((node) => node.id === 'Publishing')!;

    expect(research.ghost).toBe(false);
    expect(writing.locked).toBe(true);
    expect(publishing.ghost).toBe(true);
    expect(graph.meta?.nodes.Research).toEqual({ x: 20, y: 40, width: 240, height: 160 });
    expect(graph.diagnostics).toEqual([]);
  });

  it('keeps edges out of the body when updating node content', () => {
    const updated = updateResearchContent(canvasMarkdownFixture, 'Fresh body text.');
    const graph = parseMarkdownGraph(updated);
    const research = graph.nodes.find((node) => node.id === 'Research')!;

    expect(research.content).toBe('Fresh body text.');
    expect(research.content).not.toContain('[[Writing]]');
    expect(updated).toContain('## Writing\n');
    const section = updated.slice(research.sourceRange!.start, research.sourceRange!.end);
    expect(section.trimEnd().endsWith('- [[Publishing]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal -->')).toBe(true);
    expect(graph.edges.filter((edge) => edge.source === 'Research')).toHaveLength(3);
  });

  it('keeps wiki-links inside code fences in the body and unmodified on append-style updates', () => {
    const graph = parseMarkdownGraph(canvasMarkdownFixture);
    const research = graph.nodes.find((node) => node.id === 'Research')!;
    const appendedContent = `${research.content}\n\n- [ ] New follow-up task`;
    const updated = updateResearchContent(canvasMarkdownFixture, appendedContent);
    const nextGraph = parseMarkdownGraph(updated);
    const nextResearch = nextGraph.nodes.find((node) => node.id === 'Research')!;

    expect(nextResearch.content).toContain('- [[Research]] inside a tilde fence');
    expect(nextResearch.content).toContain('const link = "[[Writing]] in code";');
    expect(nextResearch.content).toContain('- [ ] New follow-up task');
    expect(nextGraph.edges.filter((edge) => edge.source === 'Research' && edge.target === 'Research')).toHaveLength(0);
  });

  it('preserves canvas-meta and untouched sections on content-only edits', () => {
    const updated = updateResearchContent(canvasMarkdownFixture, 'Only body changed.');
    expect(updated).toContain('"Research":{"x":20,"y":40,"width":240,"height":160}');
    expect(updated).toContain('Draft content that must stay untouched while other nodes change.');
    expect(updated).toContain('locked=true');
    expect(updated).toContain('# Project Overview');
  });

  it('round-trips the fixture through parse and update without diagnostics', () => {
    const updated = updateResearchContent(canvasMarkdownFixture, 'Round trip body.');
    expect(parseMarkdownGraph(updated).diagnostics).toEqual([]);
  });
});
