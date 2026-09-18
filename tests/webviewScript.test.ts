import { describe, expect, it } from 'vitest';
import { canvasHtml } from '../src/webview/canvasHtml';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { canvasMarkdownFixture } from './fixtures/canvasMarkdownFixture';
import { getCanvasMarkdownRendererScript } from '../src/webview/canvasMarkdownRenderer';

function extractScript(html: string): string {
  const match = /<script>([\s\S]*)<\/script>/.exec(html);
  if (!match) throw new Error('Canvas script tag not found');
  return match[1];
}

function createRenderer() {
  const fn = new Function('esc', 'graph', `
    ${getCanvasMarkdownRendererScript()}
    return renderMarkdownToHtml;
  `);
  const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return fn(esc, { resolvedImages: {} });
}

describe('webview script integrity', () => {
  it('produces a syntactically valid script for the full canvas', () => {
    const graph = parseMarkdownGraph(canvasMarkdownFixture);
    const html = canvasHtml(graph);
    expect(() => { new Function(extractScript(html)); }).not.toThrow();
  });

  it('embeds the action bar, popover and toast markup', () => {
    const html = canvasHtml(parseMarkdownGraph('# Title\n'));
    expect(html).toContain('id="node-action-bar"');
    expect(html).toContain('data-action="image"');
    expect(html).toContain('id="action-image-menu"');
    expect(html).toContain('id="node-popover"');
    expect(html).toContain('id="toast-region"');
    expect(html).toContain('aria-live="polite"');
  });

  it('escapes node content in the embedded graph data', () => {
    const graph = parseMarkdownGraph('## Safe\n<script>alert(1)</script>\n');
    const html = canvasHtml(graph);
    expect(html).not.toContain('<script>alert(1)</script>\n');
  });

  it('embeds the quick arrange toolbar with Lucide vector icons and buttons', () => {
    const html = canvasHtml(parseMarkdownGraph('# Node A\n# Node B\n'));
    expect(html).toContain('id="arrange-quick-bar"');
    expect(html).toContain('data-type="square"');
    expect(html).toContain('data-type="vertical"');
    expect(html).toContain('data-type="horizontal"');
    expect(html).toContain('data-sort="alpha-asc"');
    expect(html).toContain('data-sort="alpha-desc"');
    expect(html).toContain('id="arrange-gap-minus"');
    expect(html).toContain('id="arrange-gap-plus"');
    expect(html).toContain('id="arrange-bar-close"');
    expect(html).toContain('function wireArrangeUi()');
    expect(html).toContain('function applyArrange(');
  });
});

describe('canvas markdown renderer', () => {
  const render = createRenderer();

  it('preserves tags inside inline code without converting to chips', () => {
    const output = render('Check `#not-a-tag` and #real-tag here', 'node-1');
    expect(output).toContain('<code class="inline-code">#not-a-tag</code>');
    expect(output).not.toContain('<span class="node-tag">#not-a-tag</span>');
    expect(output).toContain('<span class="node-tag">#real-tag</span>');
  });

  it('decorates external links with external-link class and indicator icon', () => {
    const output = render('[Website](https://example.com) and [Local](./doc.md)', 'node-1');
    expect(output).toContain('class="node-link external-link"');
    expect(output).toContain('class="external-icon"');
    expect(output).toContain('class="node-link"');
  });

  it('blocks unsafe image URI schemes and displays safe fallback', () => {
    const output = render('![Unsafe](javascript:alert(1))', 'node-1');
    expect(output).toContain('class="node-blocked-link"');
    expect(output).not.toContain('<img');
  });

  it('renders tasks with stable delete buttons and without leaking add-task row', () => {
    const output = render('- [ ] First task\n- [x] Done task\n\nParagraph text', 'node-1');
    expect(output).not.toContain('node-add-task-row');
    expect(output).not.toContain('+ Add task');
    expect(output).toContain('class="task-delete-btn"');
    expect(output).toContain('data-task-index="0"');
    expect(output).toContain('data-task-index="1"');
    expect(output).toContain('First task');
    expect(output).toContain('Done task');
  });

  it('renders code block fence with data-lang attribute', () => {
    const output = render('```typescript\nconst x = 10;\n```', 'node-1');
    expect(output).toContain('class="node-code-block"');
    expect(output).toContain('class="code-language"');
    expect(output).toContain('data-edit-kind="codeLanguage"');
    expect(output).toContain('data-edit-kind="code"');
    expect(output).toContain('const x = 10;');
  });

  it('marks paragraph and quote blocks with stable inline edit locators', () => {
    const output = render('First\n\n> Quote\n\nSecond', 'node-1');
    expect(output).toContain('data-edit-kind="paragraph" data-edit-index="0"');
    expect(output).toContain('data-edit-kind="quote" data-edit-index="0"');
    expect(output).toContain('data-edit-kind="paragraph" data-edit-index="1"');
  });
});

describe('canvas performance & anti-crash stability', () => {
  it('does not allocate giant 50000px SVG textures that cause GPU OOM crashes', () => {
    const html = canvasHtml(parseMarkdownGraph('# Test\n'));
    expect(html).not.toContain('50000px');
    expect(html).toContain('overflow: visible');
  });

  it('avoids DOM cloning probe in floating panel to prevent thrashing and loops', () => {
    const html = canvasHtml(parseMarkdownGraph('# Test\n'));
    expect(html).not.toContain('cloneNode(true)');
  });

  it('does not dirty document or save viewport on initial canvas open', () => {
    const html = canvasHtml(parseMarkdownGraph('# Test\n'));
    expect(html).toContain('fitToView(70, false)');
  });

  it('caps unresized node height to prevent massive 4000px reflow blowout', () => {
    const html = canvasHtml(parseMarkdownGraph('# Test\n'));
    expect(html).toContain('Math.min(380, Math.max(');
  });

  it('keeps persisted manual width and height independent during resize', () => {
    const html = canvasHtml(parseMarkdownGraph('## Resizable\nBody\n'));
    expect(html).toContain("manuallySized ? ' user-sized' : ''");
    expect(html).toContain('.node.user-sized {');
    expect(html).toContain('max-width: none;');
    expect(html).toContain('getNodeMinimumHeight(resizing.el)');
    expect(html).toContain("content.style.height = '0px';");
    expect(html).toContain('const contentHeight = content.scrollHeight;');
    expect(html).toContain("savedNodeMeta?.width !== undefined || savedNodeMeta?.height !== undefined");
  });

  it('preserves task checkbox dimensions and prevents text column squishing', () => {
    const html = canvasHtml(parseMarkdownGraph('# Test\n'));
    expect(html).toContain('input:not([type="checkbox"])');
    expect(html).toContain('.task-checkbox {');
    expect(html).toContain('min-width: 14px;');
    expect(html).toContain('word-break: break-word;');
  });

  it('does not route Backspace from contenteditable fields to node deletion', () => {
    const html = canvasHtml(parseMarkdownGraph('## Editable\nBody\n'));
    expect(html).toContain('eventTarget.isContentEditable');
    expect(html).toContain("eventTarget.closest('[contenteditable=\"true\"]')");
    expect(html).toContain('event.stopPropagation();');
  });

  it('separates node dragging candidate, interaction controls, and text editing via interaction config', () => {
    const html = canvasHtml(parseMarkdownGraph('## Editable\nBody\n'));
    expect(html).toContain('const INTERACTION_CONFIG');
    expect(html).toContain('resolvePointerIntent(e, spaceDown)');
    expect(html).toContain('nodeDragCandidate = {');
    expect(html).toContain('INTERACTION_CONFIG.thresholds.dragDistance');
  });

  it('starts structured inline block editing on double click', () => {
    const html = canvasHtml(parseMarkdownGraph('## Editable\nText\n\n```ts\nconst x = 1;\n```\n'));
    expect(html).toContain("clickedTarget.closest('[data-edit-kind]')");
    expect(html).toContain("type: 'updateMarkdownBlock'");
    expect(html).toContain("const multiline = blockKind === 'code'");
    expect(html).toContain("e.target.closest('.list-delete-btn')");
  });

  it('uses the topmost DOM node for edge connection hit testing', () => {
    const html = canvasHtml(parseMarkdownGraph('## A\n\n## B\n'));
    expect(html).toContain('function endpointFromClientPoint(clientX, clientY, excludedNodeId)');
    expect(html).toContain("const topNodeElement = topElement?.closest('.node')");
    expect(html).toContain("if (nodeId === excludedNodeId) return { kind: 'free'");
  });

  it('keeps edge segment drag handles invisible until interaction', () => {
    const html = canvasHtml(parseMarkdownGraph('## A\n\n## B\n'));
    expect(html).toMatch(/\.edge-segment-handle \{\s*stroke: transparent;/);
    expect(html).toContain('body.adjusting-edge .edge-segment-handle { stroke: var(--focus);');
  });

  it('rejects stale revisions and defers concurrent graph updates until interaction ends', () => {
    const html = canvasHtml(parseMarkdownGraph('## A\n\n## B\n'));
    expect(html).toContain('if (incomingRevision < appliedRevision) return;');
    expect(html).toContain('pendingGraph = event.data.graph;');
    expect(html).toContain('schedulePendingGraph();');
    expect(html).toContain('if (isNodeDragging || resizing || connecting || draggingEdgeEndpoint || draggingEdgeSegment || activeNodeEditor)');
  });

  it('constrains each dragged endpoint to its semantic source or target node', () => {
    const html = canvasHtml(parseMarkdownGraph('## A {#a}\n\n- [[#b]]\n\n## B {#b}\n'));
    expect(html).toContain('function endpointForEdgeHandle(edge, key, clientX, clientY)');
    expect(html).toContain("const ownerId = key === 'source' ? edge.source : edge.target;");
  });

  it('renders edge label with pill background and enables inline editing and segment knobs', () => {
    const html = canvasHtml(parseMarkdownGraph('## A {#a}\n\n- [[#b|Test Label]]\n\n## B {#b}\n'));
    expect(html).toContain("rect.setAttribute('class', 'edge-label-bg');");
    expect(html).toContain("t.setAttribute('class', 'label edge-label-text');");
    expect(html).toContain('function startInlineEdgeLabelEdit(edge, geom)');
    expect(html).toContain('edge-segment-knob');
    expect(html).toContain('function calculateRouteMidpoint(route)');
  });

  it('persists viewport pan across webview reloads using vscode state and beforeunload flush', () => {
    const html = canvasHtml(parseMarkdownGraph('## A {#a}\n'));
    expect(html).toContain('const savedState =');
    expect(html).toContain('vscode.getState()');
    expect(html).toContain('vscode.setState(');
    expect(html).toContain("window.addEventListener('beforeunload'");
    expect(html).toContain('flushSaveViewport()');
    expect(html).toContain('hasPersistedState');
  });
});
