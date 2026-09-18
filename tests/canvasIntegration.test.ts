import { describe, expect, it } from 'vitest';
import { canvasHtml } from '../src/webview/canvasHtml';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { collectGraphDiagnostics } from '../src/validation/GraphValidator';

const sampleMarkdown = [
  '# Integration Sample',
  '',
  '## Rich Node {#node-rich}',
  '<!-- graph-node: shape=rounded-rectangle; color=blue; collapsed=false; locked=false -->',
  'Gọi ý: ^^IN HOA^^ và ==nổi bật==.',
  '',
  '| A | B |',
  '|---|:-:|',
  '| 1 | 2 |',
  '',
  '- [[node-rich|Self loop]] <!-- graph-edge: arrow=forward; line=solid; from=right; to=left -->',
  '',
  '<!-- canvas-meta: {"version":1,"revision":1,"nodes":{},"groups":{},"viewport":{"x":0,"y":0,"zoom":1}} -->'
].join('\n');

describe('canvas html integration wiring', () => {
  const graph = parseMarkdownGraph(sampleMarkdown);
  const html = canvasHtml(graph);

  it('renders the new rich-text renderer inside the full webview script', () => {
    expect(html).toContain('function renderMarkdownToHtml');
    expect(html).toContain('node-mark');
    expect(html).not.toContain('node-upper');
    expect(html).not.toContain('node-lower');
  });

  it('includes all new style modules in the page', () => {
    expect(html).toContain('.node-mark');
    expect(html).toContain('.node.ghost');
    expect(html).toContain('.mgs-diag-chip');
    expect(html).toContain('#format-bar');
    expect(html).toContain('.node-icon');
  });

  it('wires the diagnostics and floating format controls with their call sites', () => {
    expect(html).toContain('function refreshDiagnosticsUI(graph)');
    expect(html).toContain('refreshDiagnosticsUI(graph);');
    expect(html).toContain('mgs-diag-chip');
    expect(html).toContain('toggleInlineWrap');
    expect(html).toContain("type: 'focusOutline'");
    expect(html).toContain("event.data?.type === 'revealNode'");
    expect(html).toContain('data-icon=');
    expect(html).not.toContain('autoArrange');
    expect(html).toContain('mgsNodeIcons');
    expect(html).not.toContain('mgs-legend');
  });

  it('wires the collapse toggle message end to end', () => {
    expect(html).toContain('toggleNodeCollapsed');
    expect(html).toContain('node-collapse-toggle');
  });

  it('surfaces validator diagnostics when composed like the provider does', () => {
    const enriched = collectGraphDiagnostics(graph, sampleMarkdown);
    expect(enriched.some(d => d.code === 'MGS-I-002')).toBe(true);
  });
});
