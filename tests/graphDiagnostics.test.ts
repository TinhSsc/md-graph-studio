import { describe, expect, it } from 'vitest';
import {
  clearGraphDiagnostics, mapGraphDiagnostics, publishGraphDiagnostics,
  type MappedGraphDiagnostic,
} from '../src/providers/GraphDiagnosticsPublisher';
import { getCanvasDiagnosticsScript } from '../src/webview/canvasDiagnosticsScript';
import { getCanvasDiagnosticsStyles } from '../src/webview/canvasDiagnosticsStyles';
import { getCanvasScript } from '../src/webview/canvasScript';
import type { GraphDiagnostic } from '../src/model/graphTypes';

const sampleText = 'AB\nCDEF\n';

// Mirrors vscode.TextDocument.positionAt semantics closely enough for tests.
function positionAtFactory(text: string): (offset: number) => { line: number; character: number } {
  return (offset: number) => {
    const clamped = Math.max(0, Math.min(offset, text.length));
    const lines = text.slice(0, clamped).split('\n');
    return { line: lines.length - 1, character: lines[lines.length - 1].length };
  };
}

function createFakeCollection() {
  const setCalls: Array<{ uri: unknown; diagnostics: unknown }> = [];
  const deleteCalls: Array<{ uri: unknown }> = [];
  return {
    setCalls,
    deleteCalls,
    set(uri: unknown, diagnostics: unknown) { setCalls.push({ uri, diagnostics }); },
    delete(uri: unknown) { deleteCalls.push({ uri }); },
  };
}

describe('mapGraphDiagnostics', () => {
  it('maps offsets to line/character ranges via positionAt', () => {
    const diagnostics: GraphDiagnostic[] = [{ message: 'Broken', offset: 3, severity: 'error', code: 'MGS-E-001' }];
    const mapped = mapGraphDiagnostics(diagnostics, positionAtFactory(sampleText));
    expect(mapped).toEqual([{
      rangeStart: { line: 1, character: 0 },
      rangeEnd: { line: 1, character: 1 },
      message: 'Broken',
      severity: 'error',
      code: 'MGS-E-001',
    }]);
  });

  it('defaults missing offsets to the document origin', () => {
    const mapped = mapGraphDiagnostics([{ message: 'No offset' }], positionAtFactory(sampleText));
    expect(mapped[0].rangeStart).toEqual({ line: 0, character: 0 });
    expect(mapped[0].rangeEnd).toEqual({ line: 0, character: 1 });
  });

  it('defaults a missing severity to warning and drops invalid entries', () => {
    const mapped = mapGraphDiagnostics([
      { message: 'No severity' },
      null as unknown as GraphDiagnostic,
      { message: 42 as unknown as string },
    ], positionAtFactory(sampleText));
    expect(mapped).toHaveLength(1);
    expect(mapped[0].severity).toBe('warning');
    expect(mapped[0].code).toBeUndefined();
  });

  it('clamps offsets beyond the text end instead of throwing', () => {
    const positionAt = positionAtFactory(sampleText);
    const mapped = mapGraphDiagnostics([{ message: 'Past end', offset: 9999 }], positionAt);
    expect(mapped[0].rangeStart).toEqual({ line: 2, character: 0 });
    expect(mapped[0].rangeEnd).toEqual({ line: 2, character: 0 });
  });
});

describe('diagnostics collection adapter', () => {
  it('publishes converted diagnostics through collection.set', () => {
    const collection = createFakeCollection();
    const items: MappedGraphDiagnostic[] = [{
      rangeStart: { line: 0, character: 0 },
      rangeEnd: { line: 0, character: 1 },
      message: 'Broken',
      severity: 'error',
      code: 'MGS-E-001',
    }];
    publishGraphDiagnostics(collection, 'file:///doc.md', items);
    expect(collection.setCalls).toHaveLength(1);
    expect(collection.setCalls[0].uri).toBe('file:///doc.md');
    expect(collection.setCalls[0].diagnostics).toBe(items);
    expect(collection.deleteCalls).toHaveLength(0);
  });

  it('clears diagnostics through collection.delete', () => {
    const collection = createFakeCollection();
    clearGraphDiagnostics(collection, 'file:///doc.md');
    expect(collection.deleteCalls).toEqual([{ uri: 'file:///doc.md' }]);
    expect(collection.setCalls).toHaveLength(0);
  });

  it('never throws on a malformed collection', () => {
    expect(() => publishGraphDiagnostics(null as never, 'uri', [])).not.toThrow();
    expect(() => clearGraphDiagnostics(undefined as never, 'uri')).not.toThrow();
  });
});

describe('canvas diagnostics webview script', () => {
  const script = getCanvasDiagnosticsScript();

  it('compiles as a standalone function body', () => {
    expect(() => { new Function(script); }).not.toThrow();
  });

  it('contains the required integration anchors', () => {
    expect(script).toContain('refreshDiagnosticsUI');
    expect(script).toContain('mgs-diag-chip');
    expect(script).toContain('mgs-diag-panel');
    expect(script).toContain('node-diag-badge');
  });

  it('stays free of backticks and template interpolation', () => {
    expect(script).not.toContain('`');
    expect(script).not.toContain('${');
  });

  it('compiles as part of the full canvas IIFE once wired by canvasScript', () => {
    const wired = getCanvasScript('{"diagnostics":[]}');
    expect(wired).toContain('function refreshDiagnosticsUI(graph)');
    expect(() => { new Function(wired); }).not.toThrow();
  });

  it('refreshes chip, panel and node badges without throwing', () => {
    const stub = createDomStub();
    const esc = (value: string) => String(value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const api = new Function('esc', 'document', script + '\nreturn { refreshDiagnosticsUI: refreshDiagnosticsUI };')(esc, stub.document) as {
      refreshDiagnosticsUI: (graph: unknown) => void;
    };

    api.refreshDiagnosticsUI({ diagnostics: [] });
    const chip = stub.byId.get('mgs-diag-chip')!;
    expect(chip).toBeTruthy();
    expect(chip.style.display).toBe('none');

    const header = stub.registerNodeElement('node-A');
    api.refreshDiagnosticsUI({
      nodes: [{ id: 'A', ghost: false, sourceRange: { start: 0, end: 10 } }],
      diagnostics: [
        { message: 'Bad <color>', offset: 2, severity: 'error', code: 'MGS-E-001' },
        { message: 'Info only', offset: 2, severity: 'info' },
      ],
    });
    expect(chip.textContent).toBe('⚠ 1 issue(s)');
    expect(chip.style.display).toBe('');
    expect(header.insertedHtml).toContain('node-diag-badge-error');
    expect(header.insertedHtml).toContain('Bad &lt;color&gt;');
  });

  it('skips badges for ghost nodes and nodes without a covering range', () => {
    const stub = createDomStub();
    const esc = (value: string) => value;
    const api = new Function('esc', 'document', script + '\nreturn { refreshDiagnosticsUI: refreshDiagnosticsUI };')(esc, stub.document) as {
      refreshDiagnosticsUI: (graph: unknown) => void;
    };
    const ghostHeader = stub.registerNodeElement('node-Ghost');
    stub.byId.get('node-Ghost')!.ghost = true;
    api.refreshDiagnosticsUI({
      nodes: [{ id: 'Ghost', ghost: true, sourceRange: { start: 0, end: 10 } }],
      diagnostics: [{ message: 'Boom', offset: 0, severity: 'error', code: 'MGS-E-001' }],
    });
    expect(ghostHeader.insertedHtml).toBeUndefined();
  });

  it('toggles the issues panel from the chip and closes it via the close button', () => {
    const stub = createDomStub();
    const esc = (value: string) => value;
    const api = new Function('esc', 'document', script + '\nreturn { refreshDiagnosticsUI: refreshDiagnosticsUI };')(esc, stub.document) as {
      refreshDiagnosticsUI: (graph: unknown) => void;
    };
    api.refreshDiagnosticsUI({ diagnostics: [{ message: 'Broken', offset: 0, severity: 'error', code: 'MGS-E-001' }] });
    const chip = stub.byId.get('mgs-diag-chip')!;
    chip.listeners.click();
    const panel = stub.byId.get('mgs-diag-panel')!;
    expect(panel.style.display).toBe('block');
    expect(panel.innerHTML).toContain('Broken');
    expect(panel.innerHTML).toContain('MGS-E-001');
    chip.listeners.click();
    expect(panel.style.display).toBe('none');
    chip.listeners.click();
    expect(panel.style.display).toBe('block');
    // The close button lives inside the rendered innerHTML; the panel closes via click delegation.
    const closeEvent = { target: { classList: { contains: (cls: string) => cls === 'mgs-diag-close' } } };
    (panel.listeners.click as (event: unknown) => void)(closeEvent);
    expect(panel.style.display).toBe('none');
  });
});

describe('canvas diagnostics styles', () => {
  it('styles the chip, panel and node badges', () => {
    const styles = getCanvasDiagnosticsStyles();
    expect(styles).toContain('.mgs-diag-chip');
    expect(styles).toContain('.mgs-diag-panel');
    expect(styles).toContain('.node-diag-badge');
    expect(styles).not.toContain('`');
    expect(styles).not.toContain('${');
  });
});

/* Minimal DOM stub so the webview script can run inside Node without jsdom. */
interface StubElement {
  tag: string;
  id: string;
  className: string;
  textContent: string;
  title: string;
  innerHTML: string;
  insertedHtml?: string;
  ghost?: boolean;
  style: Record<string, string>;
  listeners: Record<string, (event?: unknown) => void>;
  appendedChildren: StubElement[];
  querySelectorResults: Record<string, StubElement>;
  setAttribute(key: string, value: string): void;
  addEventListener(type: string, handler: (event?: unknown) => void): void;
  appendChild(child: StubElement): StubElement;
  querySelector(selector: string): StubElement | null;
  insertAdjacentHTML(position: string, html: string): void;
  remove(): void;
}

function createDomStub() {
  const byId = new Map<string, StubElement>();
  const makeElement = (tag: string): StubElement => {
    const el = {
      tag,
      id: '',
      className: '',
      textContent: '',
      title: '',
      innerHTML: '',
      style: {},
      listeners: {},
      appendedChildren: [],
      querySelectorResults: {},
    } as unknown as StubElement & Record<string, unknown>;
    el.setAttribute = (key: string, value: string) => { el[key] = value; };
    el.addEventListener = (type: string, handler: (event?: unknown) => void) => { el.listeners[type] = handler; };
    el.appendChild = (child: StubElement) => {
      el.appendedChildren.push(child);
      if (child.id) byId.set(child.id, child);
      return child;
    };
    el.querySelector = (selector: string) => el.querySelectorResults[selector] ?? null;
    el.insertAdjacentHTML = (_position: string, html: string) => {
      el.insertedHtml = (el.insertedHtml ?? '') + html;
    };
    el.remove = () => { /* badges are tracked through the querySelectorAll stub */ };
    return el;
  };
  const toolbar = makeElement('div');
  toolbar.id = 'toolbar-top';
  byId.set('toolbar-top', toolbar);
  const document = {
    getElementById: (id: string) => byId.get(id) ?? null,
    createElement: (tag: string) => makeElement(tag),
    querySelectorAll: () => [] as StubElement[],
    body: makeElement('body'),
  };
  return {
    byId,
    document,
    registerNodeElement(nodeId: string) {
      const nodeEl = makeElement('article');
      nodeEl.id = nodeId;
      byId.set(nodeId, nodeEl);
      const header = makeElement('div');
      nodeEl.querySelectorResults['.node-header'] = header;
      return header;
    },
  };
}
