import { describe, expect, it } from 'vitest';
import { canvasHtml } from '../src/webview/canvasHtml';
import { getCanvasTemplate } from '../src/webview/canvasTemplate';
import { getCanvasUiControlsScript } from '../src/webview/canvasUiControls';
import { getCanvasInteractionsScript } from '../src/webview/canvasInteractions';
import { getCanvasIconPickerScript } from '../src/webview/canvasIconPicker';
import { getCanvasActionBarScript } from '../src/webview/canvasActionBar';
import { nodeIconIds, nodeIconSvgs } from '../src/webview/canvasIcons';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';

const CONTRACT_ICON_IDS = [
  'book', 'database', 'server', 'cloud', 'users', 'user', 'shield', 'key', 'globe',
  'mail', 'bell', 'star', 'flag', 'zap', 'settings', 'cpu', 'terminal', 'file-text',
  'folder', 'image', 'link', 'git-branch', 'bug', 'alert-triangle', 'check-circle',
  'clock', 'dollar-sign', 'layers', 'list', 'check-square', 'play', 'user-check',
  'award', 'fast-forward', 'x-circle', 'alert-octagon'
];

function extractScript(html: string): string {
  const match = /<script>([\s\S]*)<\/script>/.exec(html);
  if (!match) throw new Error('Canvas script tag not found');
  return match[1];
}

describe('canvas UI overhaul: template layout', () => {
  const template = getCanvasTemplate();

  it('keeps the redesigned toolbar with shape/icon picker and fit button', () => {
    expect(template).toContain('id="shape-picker-btn"');
    expect(template).toContain('id="icon-picker-btn"');
    expect(template).toContain('id="color-picker-btn"');
    expect(template).toContain('id="btn-fit"');
    expect(template).toContain('class="toolbar-group"');
    expect(template).toContain('id="add"');
    expect(template).toContain('id="btn-shortcuts"');
    expect(template).toContain('id="toggle-toolbar-top"');
  });

  it('removes the old toolbar search group and text selects from the template', () => {
    expect(template).not.toContain('id="node-shape"');
    expect(template).not.toContain('id="node-color"');
    expect(template).not.toContain('type="select"');
    const toolbar = template.slice(template.indexOf('id="toolbar-top"'), template.indexOf('id="expand-toolbar-top"'));
    expect(toolbar).not.toContain('search-box');
  });

  it('removes the duplicate in-canvas outline and search controls', () => {
    expect(template).not.toContain('id="sidebar-left"');
    expect(template).not.toContain('id="outline-list"');
    expect(template).not.toContain('id="search-box"');
    expect(template).not.toContain('id="expand-sidebar-left"');
  });

  it('keeps formatting as a compact floating canvas control', () => {
    expect(template).toContain('<div id="format-bar" role="toolbar" aria-label="Text formatting">');
    expect(template).toContain('data-format="bold"');
    expect(template).toContain('data-format="italic"');
    expect(template).toContain('data-format="highlight"');
  });
});

describe('canvas UI overhaul: embedded scripts', () => {
  const html = canvasHtml(parseMarkdownGraph('# Title\n'));

  it('produces a syntactically valid script with the new modules embedded', () => {
    expect(() => { new Function(extractScript(html)); }).not.toThrow();
  });

  it('injects the icon picker, node icons and contract messages end to end', () => {
    expect(html).toContain('mgsNodeIcons');
    expect(html).toContain('data-icon=');
    expect(html).toContain('openIconPicker');
    expect(html).toContain("type: 'setNodeIcon'");
    expect(html).not.toContain("type: 'autoArrange'");
    expect(html).toContain("type: 'toggleNodeLocked'");
    expect(html).toContain("type: 'duplicateNode'");
  });

  it('keeps lock and icon buttons in the action bar markup', () => {
    expect(html).toContain('data-action="list"');
    expect(html).toContain('data-action="lock"');
    expect(html).toContain('data-action="icon"');
    expect(html).toContain('aria-pressed');
  });

  it('routes the bullet-list action through the content pipeline', () => {
    const actionBar = getCanvasActionBarScript();
    expect(actionBar).toContain("dispatchContentAction('list', { kind: 'list', text: 'New item' }, nodeId)");
  });

  it('deduplicates the context menu and adds the new multi/single/ghost actions', () => {
    const interactions = getCanvasInteractionsScript();
    expect(interactions).not.toContain('ctx-img-workspace');
    expect(interactions).not.toContain('ctx-add-task');
    expect(interactions).not.toContain('ctx-img-url');
    expect(interactions).toContain('Lock all');
    expect(interactions).toContain('Duplicate node');
    expect(interactions).toContain('Create node');
    expect(interactions).toContain('Change Icon');
    expect(interactions).toContain('ctx-node-shape');
  });

  it('shows ghost nodes in the action bar instead of skipping them', () => {
    const actionBar = getCanvasActionBarScript();
    expect(actionBar).not.toContain("classList.contains('ghost')");
    expect(actionBar).toContain('Create node');
    expect(actionBar).not.toContain("nodeEl.classList.contains('ghost')");
  });

  it('enforces the lock on resize handles via styles', () => {
    expect(html).toContain('.node.locked .resizer');
  });
});

describe('canvas UI overhaul: standalone script modules', () => {
  it('compiles the icon picker script and exposes the picker API', () => {
    const script = getCanvasIconPickerScript();
    expect(() => { new Function(script); }).not.toThrow();
    expect(script).toContain('function openIconPicker');
    expect(script).toContain('function closeIconPicker');
    expect(script).toContain("typeof mgsNodeIcons === 'undefined'");
    expect(script).toContain('icon-picker-none');
  });

  it('compiles the toolbar controls script with pickers and arrange menu', () => {
    const script = getCanvasUiControlsScript();
    expect(() => { new Function(script); }).not.toThrow();
    expect(script).toContain('new-node-shape-menu');
    expect(script).toContain('new-node-icon-menu');
    expect(script).toContain('new-node-color-menu');
    expect(script).toContain("const availableShapes = ['rounded-rectangle', 'rectangle']");
    expect(script).not.toContain('arrange-menu');
    expect(script).not.toContain('toolbar-select');
    expect(script).not.toContain('searchBox.oninput');
  });
});

describe('canvas UI overhaul: node icon contract', () => {
  it('ships exactly the 36 contract icon ids with SVG bodies', () => {
    expect(nodeIconIds).toHaveLength(36);
    expect([...nodeIconIds].sort()).toEqual([...CONTRACT_ICON_IDS].sort());
    for (const id of CONTRACT_ICON_IDS) {
      expect(nodeIconSvgs[id]).toContain('<svg');
      expect(nodeIconSvgs[id]).toContain('currentColor');
    }
  });
});
