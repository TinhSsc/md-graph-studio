import { describe, expect, it } from 'vitest';
import { getCanvasFormatPanelScript } from '../src/webview/canvasFormatPanel';
import { getCanvasFormatStyles } from '../src/webview/canvasFormatStyles';

type Listener = (event: unknown) => void;

interface ElementStub {
  id: string;
  dataset: Record<string, string>;
  textContent: string;
  isContentEditable: boolean;
  classes: Set<string>;
  attributes: Record<string, string>;
  listeners: Record<string, Listener[]>;
  classList: {
    toggle(name: string, force: boolean): void;
    contains(name: string): boolean;
  };
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  addEventListener(type: string, listener: Listener): void;
  dispatch(type: string, event: unknown): void;
  querySelectorAll(selector: string): ElementStub[];
  closest(selector: string): ElementStub | null;
  contains(): boolean;
}

function createElementStub(options: { id?: string; selfSelectors?: string[]; childButtons?: ElementStub[] } = {}): ElementStub {
  const classes = new Set<string>();
  const listeners: Record<string, Listener[]> = {};
  const attributes: Record<string, string> = {};
  const children = options.childButtons || [];
  const selfSelectors = options.selfSelectors || [];
  const stub: ElementStub = {
    id: options.id || '',
    dataset: {},
    textContent: '',
    isContentEditable: false,
    classes,
    attributes,
    listeners,
    classList: {
      toggle: (name, force) => {
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains: name => classes.has(name)
    },
    setAttribute: (name, value) => {
      attributes[name] = value;
    },
    getAttribute: name => (name in attributes ? attributes[name] : null),
    addEventListener: (type, listener) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(listener);
    },
    dispatch: (type, event) => {
      (listeners[type] || []).forEach(listener => listener(event));
    },
    querySelectorAll: selector => (selector === '[data-format]' ? children : []),
    closest: selector => (selfSelectors.indexOf(selector) !== -1 ? stub : null),
    contains: () => true
  };
  return stub;
}

interface WiringScope {
  posted: unknown[];
  toasts: Array<[string, string]>;
  state: { renderCount: number };
  scope: Record<string, unknown>;
}

function createScope(customs: Record<string, unknown>): WiringScope {
  const posted: unknown[] = [];
  const toasts: Array<[string, string]> = [];
  const state = { renderCount: 0 };
  const scope: Record<string, unknown> = {
    document: { querySelector: () => null, addEventListener: () => {}, activeElement: null },
    window: {},
    activeNodeEditor: null,
    selectedNodeIds: new Set<string>(),
    findNode: () => null,
    vscode: { postMessage: (message: unknown) => posted.push(message) },
    render: () => {
      state.renderCount += 1;
    },
    showToast: (level: string, message: string) => toasts.push([level, message]),
    ...customs
  };
  return { posted, toasts, state, scope };
}

function compileFragment(customs: Record<string, unknown>, returnNames: string[]): Record<string, unknown> {
  const { scope } = createScope(customs);
  const names = Object.keys(scope);
  const body = getCanvasFormatPanelScript() + '\n    return { ' + returnNames.join(', ') + ' };';
  const factory = new Function(...names.concat([body]));
  return factory(...names.map(name => scope[name])) as Record<string, unknown>;
}

interface WrapHelpers {
  toggleInlineWrap(raw: string, selection: string, prefix: string, suffix: string): string;
  toggleWholeWrap(content: string, prefix: string, suffix: string): string;
}

function extractWraps(): WrapHelpers {
  return compileFragment({}, ['toggleInlineWrap', 'toggleWholeWrap']) as unknown as WrapHelpers;
}

interface WiringHelpers {
  applyFormatClick(format: string): void;
  refreshFormatBar(): void;
}

interface WiringResult {
  helpers: WiringHelpers;
  posted: unknown[];
  toasts: Array<[string, string]>;
  state: { renderCount: number };
}

function compileWiring(customs: Record<string, unknown>): WiringResult {
  const { posted, toasts, state, scope } = createScope(customs);
  const names = Object.keys(scope);
  const body = getCanvasFormatPanelScript() + '\n    return { applyFormatClick, refreshFormatBar };';
  const factory = new Function(...names.concat([body]));
  const helpers = factory(...names.map(name => scope[name])) as unknown as WiringHelpers;
  return { helpers, posted, toasts, state };
}

function sampleNode(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'alpha', title: 'Alpha', shape: 'rectangle', color: 'blue', content: 'plain body', locked: false, ...overrides };
}

describe('canvas format bar: inline wrap helper', () => {
  const { toggleInlineWrap } = extractWraps();

  it('wraps the selection with the bold pair', () => {
    expect(toggleInlineWrap('hello world', 'world', '**', '**')).toBe('hello **world**');
  });

  it('unwraps when the raw source already contains the wrapped pair', () => {
    expect(toggleInlineWrap('say **hello** loud', 'hello', '**', '**')).toBe('say hello loud');
  });

  it('wraps the first occurrence when the selection appears twice', () => {
    expect(toggleInlineWrap('x and x', 'x', '**', '**')).toBe('**x** and x');
  });

  it('returns the raw source unchanged for empty or missing selections', () => {
    expect(toggleInlineWrap('hello', '', '**', '**')).toBe('hello');
    expect(toggleInlineWrap('hello', 'missing', '**', '**')).toBe('hello');
    expect(toggleInlineWrap('', 'x', '**', '**')).toBe('');
  });
});

describe('canvas format bar: whole wrap helper', () => {
  const { toggleInlineWrap, toggleWholeWrap } = extractWraps();

  it('wraps plain whole-node content once', () => {
    expect(toggleWholeWrap('plain body', '**', '**')).toBe('**plain body**');
    expect(toggleWholeWrap('plain body', '==', '==')).toBe('==plain body==');
  });

  it('unwraps already wrapped whole-node content', () => {
    expect(toggleWholeWrap('==marked==', '==', '==')).toBe('marked');
    expect(toggleWholeWrap('  **kept trailing text**  ', '**', '**')).toBe('kept trailing text');
  });

  it('inserts a format-specific placeholder into empty content', () => {
    expect(toggleWholeWrap('', '**', '**')).toBe('**bold text**');
    expect(toggleWholeWrap('', '*', '*')).toBe('*italic text*');
    expect(toggleWholeWrap('', '==', '==')).toBe('==highlighted text==');
  });

  it('documents italic single-star interaction with bold markers', () => {
    // '**x**' contains '*x*', so the unwrap branch strips the first occurrence.
    expect(toggleInlineWrap('**x**', 'x', '*', '*')).toBe('*x*');
    // Whole-content italic strips one bold marker layer, leaving '*bold*'.
    expect(toggleWholeWrap('**bold**', '*', '*')).toBe('*bold*');
  });
});

describe('canvas format bar: node mode wiring', () => {
  it('posts updateNode with the wrapped content and re-renders optimistically', () => {
    const node = sampleNode();
    const { helpers, posted, state } = compileWiring({
      selectedNodeIds: new Set(['alpha']),
      findNode: () => node
    });
    helpers.applyFormatClick('highlight');
    expect(node.content).toBe('==plain body==');
    expect(posted).toEqual([{ type: 'updateNode', id: 'alpha', title: 'Alpha', shape: 'rectangle', color: 'blue', content: '==plain body==' }]);
    expect(state.renderCount).toBe(1);
  });

  it('refuses locked nodes with a toast and keeps content untouched', () => {
    const node = sampleNode({ locked: true });
    const { helpers, posted, toasts } = compileWiring({
      selectedNodeIds: new Set(['alpha']),
      findNode: () => node
    });
    helpers.applyFormatClick('bold');
    expect(toasts).toContainEqual(['error', 'Node is locked']);
    expect(posted).toEqual([]);
    expect(node.content).toBe('plain body');
  });

  it('does nothing when multiple nodes are selected', () => {
    const node = sampleNode();
    const { helpers, posted, state } = compileWiring({
      selectedNodeIds: new Set(['a', 'b']),
      findNode: () => node
    });
    helpers.applyFormatClick('bold');
    expect(posted).toEqual([]);
    expect(state.renderCount).toBe(0);
    expect(node.content).toBe('plain body');
  });
});

describe('canvas format bar: inline mode wiring', () => {
  function createInlineBlock(kind: string): ElementStub {
    const block = createElementStub({ id: 'node-alpha', selfSelectors: ['.node-content', '[data-edit-kind]', '.node'] });
    block.isContentEditable = true;
    block.dataset.editKind = kind;
    block.dataset.editIndex = '0';
    block.dataset.raw = encodeURIComponent('hello world');
    return block;
  }

  function inlineCustoms(block: ElementStub, selection: { rangeCount: number; isCollapsed: boolean; text: string }): Record<string, unknown> {
    return {
      document: { querySelector: () => null, addEventListener: () => {}, activeElement: block },
      window: {
        getSelection: () => ({ rangeCount: selection.rangeCount, isCollapsed: selection.isCollapsed, anchorNode: {}, toString: () => selection.text })
      }
    };
  }

  it('posts updateMarkdownBlock for the selected text inside a paragraph block', () => {
    const block = createInlineBlock('paragraph');
    const { helpers, posted } = compileWiring(inlineCustoms(block, { rangeCount: 1, isCollapsed: false, text: 'world' }));
    helpers.applyFormatClick('bold');
    expect(posted).toEqual([{ type: 'updateMarkdownBlock', id: 'alpha', blockKind: 'paragraph', blockIndex: 0, text: 'hello **world**' }]);
    expect(block.textContent).toBe('hello **world**');
    expect(block.dataset.raw).toBe(encodeURIComponent('hello **world**'));
  });

  it('supports quote blocks and unwrapping through the same path', () => {
    const block = createInlineBlock('quote');
    block.dataset.raw = encodeURIComponent('say **hello** loud');
    const { helpers, posted } = compileWiring(inlineCustoms(block, { rangeCount: 1, isCollapsed: false, text: 'hello' }));
    helpers.applyFormatClick('bold');
    expect(posted).toEqual([{ type: 'updateMarkdownBlock', id: 'alpha', blockKind: 'quote', blockIndex: 0, text: 'say hello loud' }]);
  });

  it('refuses code blocks without falling back to node mode', () => {
    const codeBlock = createInlineBlock('code');
    const node = sampleNode();
    const { helpers, posted, state } = compileWiring({
      ...inlineCustoms(codeBlock, { rangeCount: 1, isCollapsed: false, text: 'world' }),
      selectedNodeIds: new Set(['alpha']),
      findNode: () => node
    });
    helpers.applyFormatClick('bold');
    expect(posted).toEqual([]);
    expect(state.renderCount).toBe(0);
    expect(node.content).toBe('plain body');
  });

  it('keeps the whole node untouched when an editor is open without a selection', () => {
    const block = createInlineBlock('paragraph');
    const node = sampleNode();
    const { helpers, posted } = compileWiring({
      ...inlineCustoms(block, { rangeCount: 1, isCollapsed: true, text: '' }),
      selectedNodeIds: new Set(['alpha']),
      findNode: () => node
    });
    helpers.applyFormatClick('bold');
    expect(posted).toEqual([]);
    expect(node.content).toBe('plain body');
  });
});

describe('canvas format bar: disabled state and button flow', () => {
  function createBar(): { bar: ElementStub; buttons: ElementStub[] } {
    const buttons = ['bold', 'italic', 'highlight'].map(format => {
      const button = createElementStub();
      button.setAttribute('data-format', format);
      return button;
    });
    return { bar: createElementStub({ childButtons: buttons }), buttons };
  }

  function barCustoms(bar: ElementStub): Record<string, unknown> {
    return {
      document: { querySelector: (selector: string) => (selector === '#format-bar' ? bar : null), addEventListener: () => {}, activeElement: null }
    };
  }

  it('toggles the disabled class and aria state on the three buttons', () => {
    const { bar, buttons } = createBar();
    const selectedNodeIds = new Set<string>();
    const { helpers } = compileWiring({ ...barCustoms(bar), selectedNodeIds });
    helpers.refreshFormatBar();
    expect(buttons.every(button => button.classes.has('disabled'))).toBe(true);
    expect(buttons[0].attributes['aria-disabled']).toBe('true');
    selectedNodeIds.add('alpha');
    helpers.refreshFormatBar();
    expect(buttons.every(button => !button.classes.has('disabled'))).toBe(true);
    expect(buttons[0].attributes['aria-disabled']).toBe('false');
  });

  it('binds handlers once, ignores disabled clicks and posts on enabled buttons', () => {
    const node = sampleNode();
    const { bar, buttons } = createBar();
    const selectedNodeIds = new Set<string>();
    const { helpers, posted } = compileWiring({ ...barCustoms(bar), selectedNodeIds, findNode: () => node });
    expect(buttons[0].listeners.mousedown.length).toBe(1);
    expect(buttons[0].listeners.click.length).toBe(1);
    buttons[0].dispatch('click', { currentTarget: buttons[0] });
    expect(posted).toEqual([]);
    selectedNodeIds.add('alpha');
    helpers.refreshFormatBar();
    buttons[0].dispatch('click', { currentTarget: buttons[0] });
    expect(posted).toEqual([{ type: 'updateNode', id: 'alpha', title: 'Alpha', shape: 'rectangle', color: 'blue', content: '**plain body**' }]);
  });
});

describe('canvas format bar: containment and compilation', () => {
  it('contains the host message contract and format bar selector', () => {
    const script = getCanvasFormatPanelScript();
    expect(script).toContain('updateMarkdownBlock');
    expect(script).toContain('updateNode');
    expect(script).toContain('#format-bar');
    expect(script).not.toMatch(/[`$]/);
  });

  it('compiles as a standalone script fragment', () => {
    expect(() => {
      new Function(getCanvasFormatPanelScript());
    }).not.toThrow();
  });

  it('ships the format bar styles with disabled and per-format rules', () => {
    const styles = getCanvasFormatStyles();
    expect(styles).toContain('#format-bar');
    expect(styles).toContain('[data-format="bold"]');
    expect(styles).toContain('[data-format="italic"]');
    expect(styles).toContain('[data-format="highlight"]');
    expect(styles).toContain('.disabled');
    expect(styles).toContain('font-weight: 700');
    expect(styles).toContain('font-style: italic');
    expect(styles).toContain('position: fixed');
    expect(styles).toContain('bottom: 12px');
  });
});
