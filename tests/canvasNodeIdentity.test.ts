import { describe, expect, it } from 'vitest';
import type { CanvasMeta } from '../src/model/graphTypes';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { setNodeCollapsedState } from '../src/state/CanvasStateReducer';
import { canvasHtml } from '../src/webview/canvasHtml';
import { getCanvasNodeIdentityStyles } from '../src/webview/canvasNodeIdentityStyles';

function extractScript(html: string): string {
  const match = /<script>([\s\S]*)<\/script>/.exec(html);
  if (!match) throw new Error('Canvas script tag not found');
  return match[1];
}

const baseMeta: CanvasMeta = {
  version: 1,
  revision: 7,
  nodes: { alpha: { x: 10, y: 20, width: 220, height: 120, collapsed: false, locked: false } },
  groups: {},
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe('setNodeCollapsedState', () => {
  it('sets collapsed on an existing node meta entry and keeps layout fields', () => {
    const updated = setNodeCollapsedState(baseMeta, 'alpha', true);
    expect(updated.nodes.alpha).toEqual({ x: 10, y: 20, width: 220, height: 120, collapsed: true, locked: false });
  });

  it('creates a missing node meta entry with layout defaults', () => {
    const updated = setNodeCollapsedState(baseMeta, 'ghost-node', true);
    expect(updated.nodes['ghost-node']).toEqual({ x: 0, y: 0, width: 240, height: 160, collapsed: true });
    expect(updated.nodes.alpha).toEqual(baseMeta.nodes.alpha);
  });

  it('expands a collapsed node back by setting collapsed to false', () => {
    const collapsed = setNodeCollapsedState(baseMeta, 'alpha', true);
    const expanded = setNodeCollapsedState(collapsed, 'alpha', false);
    expect(expanded.nodes.alpha?.collapsed).toBe(false);
  });

  it('bumps the revision and preserves the rest of the meta', () => {
    const updated = setNodeCollapsedState(baseMeta, 'alpha', true);
    expect(updated.revision).toBe(8);
    expect(updated.version).toBe(1);
    expect(updated.viewport).toEqual(baseMeta.viewport);
    expect(updated.groups).toEqual(baseMeta.groups);
  });

  it('does not mutate the input meta', () => {
    const snapshot = JSON.stringify(baseMeta);
    setNodeCollapsedState(baseMeta, 'alpha', true);
    expect(JSON.stringify(baseMeta)).toBe(snapshot);
  });
});

describe('canvas node identity webview integration', () => {
  const html = canvasHtml(parseMarkdownGraph('# Legend\n## A {#a}\nBody\n'));

  it('renders the node icon, collapse toggle and message wiring in the canvas script', () => {
    expect(html).toContain('node-icon');
    expect(html).toContain('node-collapse-toggle');
    expect(html).toContain('data-collapse-toggle=');
    expect(html).toContain("type: 'toggleNodeCollapsed'");
    expect(html).toContain('node-collapsed-hint');
    expect(html).toContain("n.locked ? ' locked' : ''");
    expect(html).toContain("n.collapsed ? ' collapsed' : ''");
  });

  it('keeps collapsed node heights compact without breaking manual resize cap', () => {
    expect(html).toContain('n.collapsed ? minimumHeight :');
    expect(html).toContain('Math.min(380, Math.max(');
  });


  it('compiles the full webview script and no longer ships the legend', () => {
    expect(() => { new Function(extractScript(html)); }).not.toThrow();
    expect(html).not.toContain('mgs-legend-toggle');
    expect(html).not.toContain('mgs-legend-panel');
  });

  it('identity styles cover the visible states without legend CSS', () => {
    const styles = getCanvasNodeIdentityStyles();
    expect(styles).toContain('.node.ghost');
    expect(styles).toContain('.node.locked');
    expect(styles).toContain('.node.collapsed');
    expect(styles).toContain('.node-icon');
    expect(styles).toContain('.node-collapse-toggle');
    expect(styles).toContain('.node-collapsed-hint');
    expect(styles).not.toContain('.mgs-legend');
  });
});
