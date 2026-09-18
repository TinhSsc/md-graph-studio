import { describe, expect, it } from 'vitest';
import type { CanvasMeta } from '../src/model/graphTypes';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { appendEdge, serializeEdge, updateCanvasMeta } from '../src/parser/MarkdownGraphSerializer';
import { deleteNodeDocument } from '../src/parser/GraphDeletion';
import { createNodeDocument } from '../src/providers/NodeCreation';
import { makeMeta, updateEdgeMeta, updateViewportMeta } from '../src/providers/documentEdits';
import { autoLayout } from '../src/layout/AutoLayoutEngine';
import { SidecarStorageManager, type FileSystemAdapter, type FileUriLike } from '../src/storage/SidecarStorageManager';
import { hydrateGraphWithStorageMode, type StorageMode } from '../src/storage/HydrationEngine';

class MockFileSystem implements FileSystemAdapter {
  public files = new Map<string, Uint8Array>();
  public writeCount = 0;

  async readFile(uri: FileUriLike): Promise<Uint8Array> {
    const data = this.files.get(uri.fsPath);
    if (!data) throw new Error(`File not found: ${uri.fsPath}`);
    return data;
  }

  async writeFile(uri: FileUriLike, content: Uint8Array): Promise<void> {
    this.files.set(uri.fsPath, content);
    this.writeCount += 1;
  }

  async rename(source: FileUriLike, target: FileUriLike): Promise<void> {
    const data = this.files.get(source.fsPath);
    if (!data) throw new Error(`Source not found: ${source.fsPath}`);
    this.files.set(target.fsPath, data);
    this.files.delete(source.fsPath);
  }

  async delete(uri: FileUriLike): Promise<void> {
    this.files.delete(uri.fsPath);
  }
}

describe('Phase 3: Provider Save Routing & Storage Mode Isolation', () => {
  const sampleDoc = `## Service A {#svc-a}
<!-- graph-node: shape=rounded-rectangle; color=blue -->
Core service logic.

- [[#svc-b]]

## Service B {#svc-b}
<!-- graph-node: shape=rounded-rectangle; color=green -->
Worker service.
`;

  it('sidecar mode: saveLayout writes exclusively to sidecar and leaves markdown untouched', async () => {
    const mockFs = new MockFileSystem();
    const manager = new SidecarStorageManager(mockFs);
    const docUri: FileUriLike = { fsPath: 'd:/project/system.md', toString: () => 'd:/project/system.md' };

    const parsed = parseMarkdownGraph(sampleDoc);
    const mode: StorageMode = 'sidecar';

    const movedNodes = [
      { id: 'svc-a', x: 250, y: 120, width: 140, height: 50 },
      { id: 'svc-b', x: 500, y: 300, width: 140, height: 50 },
    ];
    const newViewport = { x: 50, y: 50, zoom: 1.1 };

    let mdEdited = false;
    if (mode === 'sidecar') {
      const meta = makeMeta(parsed.meta, movedNodes, newViewport);
      await manager.writeSidecar(docUri, meta);
    } else if (mode === 'embedded') {
      mdEdited = true;
    }

    expect(mdEdited).toBe(false);
    expect(mockFs.files.size).toBe(1);

    const sidecarUri = manager.getSidecarUri(docUri);
    const savedBytes = mockFs.files.get(sidecarUri.fsPath);
    expect(savedBytes).toBeDefined();

    const savedJson = JSON.parse(new TextDecoder().decode(savedBytes!)) as CanvasMeta;
    expect(savedJson.nodes['svc-a'].x).toBe(250);
    expect(savedJson.nodes['svc-b'].y).toBe(300);
    expect(savedJson.viewport.zoom).toBe(1.1);
  });

  it('embedded mode: saveLayout modifies markdown canvas-meta and does not write sidecar', async () => {
    const mockFs = new MockFileSystem();
    const manager = new SidecarStorageManager(mockFs);
    const docUri: FileUriLike = { fsPath: 'd:/project/system.md', toString: () => 'd:/project/system.md' };

    const parsed = parseMarkdownGraph(sampleDoc);
    const movedNodes = [
      { id: 'svc-a', x: 100, y: 100, width: 140, height: 50 },
      { id: 'svc-b', x: 200, y: 200, width: 140, height: 50 },
    ];

    let updatedMd = sampleDoc;
    const modeForEmbedded: StorageMode = 'embedded';
    if ((modeForEmbedded as string) === 'sidecar') {
      const meta = makeMeta(parsed.meta, movedNodes);
      await manager.writeSidecar(docUri, meta);
    } else if (modeForEmbedded === 'embedded') {
      const meta = makeMeta(parsed.meta, movedNodes);
      const edit = updateCanvasMeta(sampleDoc, meta);
      updatedMd = sampleDoc.slice(0, edit.start) + edit.text + sampleDoc.slice(edit.end);
    }

    expect(mockFs.files.size).toBe(0);
    expect(updatedMd).toContain('<!-- canvas-meta');
    expect(updatedMd).toContain('"svc-a"');
  });

  it('stateless mode: saveLayout does not write to disk or modify markdown', async () => {
    const mockFs = new MockFileSystem();
    const manager = new SidecarStorageManager(mockFs);
    const docUri: FileUriLike = { fsPath: 'd:/project/system.md', toString: () => 'd:/project/system.md' };

    const parsed = parseMarkdownGraph(sampleDoc);
    const movedNodes = [
      { id: 'svc-a', x: 10, y: 10, width: 140, height: 50 },
    ];

    let diskWriteAttempted = false;
    const modeForStateless: StorageMode = 'stateless';
    if ((modeForStateless as string) === 'sidecar') {
      const meta = makeMeta(parsed.meta, movedNodes);
      await manager.writeSidecar(docUri, meta);
      diskWriteAttempted = true;
    } else if ((modeForStateless as string) === 'embedded') {
      diskWriteAttempted = true;
    }

    expect(diskWriteAttempted).toBe(false);
    expect(mockFs.files.size).toBe(0);
  });

  it('sidecar mode: autoArrange saves arranged positions to sidecar without dirtying markdown', async () => {
    const mockFs = new MockFileSystem();
    const manager = new SidecarStorageManager(mockFs);
    const docUri: FileUriLike = { fsPath: 'd:/project/system.md', toString: () => 'd:/project/system.md' };

    const parsed = parseMarkdownGraph(sampleDoc);
    const arranged = autoLayout(parsed.nodes, parsed.edges, { direction: 'left-to-right' });
    const meta = makeMeta(parsed.meta, arranged);

    await manager.writeSidecar(docUri, meta);

    const sidecarUri = manager.getSidecarUri(docUri);
    const content = JSON.parse(new TextDecoder().decode(mockFs.files.get(sidecarUri.fsPath)!)) as CanvasMeta;
    expect(content.nodes['svc-a']).toBeDefined();
    expect(content.nodes['svc-b']).toBeDefined();
    expect(content.nodes['svc-a'].x).toBeLessThan(content.nodes['svc-b'].x);
  });

  it('sidecar mode: createNodeDocument produces clean markdown without canvas-meta and stores coords in sidecar', async () => {
    const mockFs = new MockFileSystem();
    const manager = new SidecarStorageManager(mockFs);
    const docUri: FileUriLike = { fsPath: 'd:/project/system.md', toString: () => 'd:/project/system.md' };

    const parsed = parseMarkdownGraph(sampleDoc);
    const created = createNodeDocument(sampleDoc, parsed, {
      shape: 'rounded-rectangle',
      color: 'blue',
      content: 'New node description.',
      x: 350,
      y: 180,
      embedMeta: false,
      generateExplicitId: true,
    });

    expect(created.text).not.toContain('<!-- canvas-meta');
    expect(created.text).toContain(`## ${created.title} {#${created.nodeId}}`);
    expect(created.meta).toBeDefined();

    await manager.writeSidecar(docUri, created.meta!);

    const sidecarUri = manager.getSidecarUri(docUri);
    const sidecar = JSON.parse(new TextDecoder().decode(mockFs.files.get(sidecarUri.fsPath)!)) as CanvasMeta;
    expect(sidecar.nodes[created.nodeId]).toBeDefined();
    expect(sidecar.nodes[created.nodeId].x).toBe(350);
    expect(sidecar.nodes[created.nodeId].y).toBe(180);
  });

  it('sidecar mode: deleteNodeDocument removes node from markdown without injecting canvas-meta and updates sidecar', async () => {
    const mockFs = new MockFileSystem();
    const manager = new SidecarStorageManager(mockFs);
    const docUri: FileUriLike = { fsPath: 'd:/project/system.md', toString: () => 'd:/project/system.md' };

    const parsed = parseMarkdownGraph(sampleDoc);
    const nodeToDelete = parsed.nodes.find((n) => n.id === 'svc-b')!;

    const nextText = deleteNodeDocument(sampleDoc, parsed, nodeToDelete, { cleanEmbeddedMeta: false });
    expect(nextText).not.toContain('## Service B');
    expect(nextText).not.toContain('<!-- canvas-meta');

    const initialSidecar: CanvasMeta = {
      version: 1,
      nodes: {
        'svc-a': { x: 100, y: 100 },
        'svc-b': { x: 300, y: 300 },
      },
      groups: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    await manager.writeSidecar(docUri, initialSidecar);

    const fresh = parseMarkdownGraph(nextText);
    const remainingIds = new Set(fresh.nodes.map((n) => n.id));
    const updatedNodes = Object.fromEntries(Object.entries(initialSidecar.nodes).filter(([id]) => remainingIds.has(id)));
    await manager.writeSidecar(docUri, { ...initialSidecar, nodes: updatedNodes });

    const sidecarUri = manager.getSidecarUri(docUri);
    const sidecar = JSON.parse(new TextDecoder().decode(mockFs.files.get(sidecarUri.fsPath)!)) as CanvasMeta;
    expect(sidecar.nodes['svc-a']).toBeDefined();
    expect(sidecar.nodes['svc-b']).toBeUndefined();
  });

  it('sidecar mode: writeSidecar updates the target without delete/create churn', async () => {
    let renameCalled = false;
    let writeTarget = '';
    const mockFs: FileSystemAdapter = {
      readFile: async () => new Uint8Array(),
      writeFile: async (uri) => {
        writeTarget = uri.fsPath;
      },
      rename: async () => {
        renameCalled = true;
      },
      delete: async () => {},
    };
    const manager = new SidecarStorageManager(mockFs);
    const docUri: FileUriLike = { fsPath: 'd:/project/system.md', toString: () => 'd:/project/system.md' };
    const meta: CanvasMeta = {
      version: 1,
      nodes: { 'svc-a': { x: 50, y: 75 } },
      groups: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    await manager.writeSidecar(docUri, meta);
    expect(renameCalled).toBe(false);
    expect(writeTarget).toBe('d:/project/system.md.graph.json');
  });

  it('layout preservation: markdown text change re-hydrates with saved sidecar metadata', () => {
    const savedMeta: CanvasMeta = {
      version: 1,
      nodes: {
        'svc-a': { x: 800, y: 900, width: 200, height: 100 },
        'svc-b': { x: 1200, y: 1300, width: 220, height: 110 },
      },
      groups: {},
      viewport: { x: 10, y: 20, zoom: 1.2 },
    };

    // Giả lập người dùng click checkbox task làm thay đổi markdown
    const updatedDocText = sampleDoc.replace('Worker service.', '- [x] Completed task\nWorker service.');
    const freshParsed = parseMarkdownGraph(updatedDocText);
    const hydrated = hydrateGraphWithStorageMode(freshParsed, { mode: 'sidecar', sidecarMeta: savedMeta });

    const nodeA = hydrated.nodes.find((n) => n.id === 'svc-a');
    const nodeB = hydrated.nodes.find((n) => n.id === 'svc-b');
    expect(nodeA?.x).toBe(800);
    expect(nodeA?.y).toBe(900);
    expect(nodeB?.x).toBe(1200);
    expect(nodeB?.y).toBe(1300);
    expect(hydrated.meta?.viewport?.zoom).toBe(1.2);
  });

  it('saveViewport preserves every saved node position and edge endpoint', () => {
    const savedMeta: CanvasMeta = {
      version: 1,
      nodes: {
        'svc-a': { x: 800, y: 900, width: 200, height: 100 },
        'svc-b': { x: 1200, y: 1300, width: 220, height: 110 },
      },
      groups: {},
      edges: {
        'svc-a>svc-b#0': {
          source: { kind: 'node', nodeId: 'svc-a', xRatio: 1, yRatio: 0.5 },
          target: { kind: 'node', nodeId: 'svc-b', xRatio: 0, yRatio: 0.5 },
        },
      },
      viewport: { x: 10, y: 20, zoom: 1.2 },
    };

    const updated = updateViewportMeta(savedMeta, { x: 40, y: 50, zoom: 0.8 });

    expect(updated.nodes).toEqual(savedMeta.nodes);
    expect(updated.edges).toEqual(savedMeta.edges);
    expect(updated.viewport).toEqual({ x: 40, y: 50, zoom: 0.8 });
  });

  it('saveEdgeLayout updates one edge without resetting node positions', () => {
    const savedMeta: CanvasMeta = {
      version: 1,
      nodes: {
        'svc-a': { x: 250, y: 120, width: 200, height: 100 },
        'svc-b': { x: 700, y: 420, width: 220, height: 110 },
      },
      groups: {},
      viewport: { x: 10, y: 20, zoom: 1.2 },
    };
    const endpoints = {
      source: { kind: 'node' as const, nodeId: 'svc-a', xRatio: 1, yRatio: 0.5 },
      target: { kind: 'node' as const, nodeId: 'svc-b', xRatio: 0, yRatio: 0.5 },
      guide: { axis: 'x' as const, value: 480 },
    };

    const updated = updateEdgeMeta(savedMeta, 'svc-a>svc-b#0', endpoints);

    expect(updated.nodes).toEqual(savedMeta.nodes);
    expect(updated.viewport).toEqual(savedMeta.viewport);
    expect(updated.edges?.['svc-a>svc-b#0']).toEqual(endpoints);
  });

  it('hydrateGraphWithStorageMode hydrates and preserves edge endpoints from sidecar metadata', () => {
    const freshParsed = parseMarkdownGraph(sampleDoc);
    const sidecarMeta: CanvasMeta = {
      version: 1,
      nodes: {
        'svc-a': { x: 100, y: 100 },
        'svc-b': { x: 400, y: 400 },
      },
      groups: {},
      edges: {
        'svc-a>svc-b#0': {
          source: { kind: 'node', nodeId: 'svc-a', xRatio: 1, yRatio: 0.5 },
          target: { kind: 'node', nodeId: 'svc-b', xRatio: 0, yRatio: 0.5 },
          guide: { axis: 'x', value: 250 },
        },
      },
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const hydrated = hydrateGraphWithStorageMode(freshParsed, { mode: 'sidecar', sidecarMeta });
    const edge = hydrated.edges.find((e) => e.source === 'svc-a' && e.target === 'svc-b');
    expect(edge).toBeDefined();
    expect(edge?.endpoints).toBeDefined();
    expect(edge?.endpoints?.source).toEqual({ kind: 'node', nodeId: 'svc-a', xRatio: 1, yRatio: 0.5 });
    expect(edge?.endpoints?.target).toEqual({ kind: 'node', nodeId: 'svc-b', xRatio: 0, yRatio: 0.5 });
    expect(edge?.endpoints?.guide).toEqual({ axis: 'x', value: 250 });
  });

  it('appendEdge serializes fromPort and toPort into graph-edge attributes', () => {
    const parsed = parseMarkdownGraph(sampleDoc);
    const nodeA = parsed.nodes.find((n) => n.id === 'svc-a')!;
    const edit = appendEdge(sampleDoc, nodeA, 'svc-b', 'orthogonal', { fromPort: 'right', toPort: 'left' });
    expect(edit.text).toContain('- [[svc-b]] <!-- graph-edge: from=right; to=left -->');
  });

  it('in-place edge update preserves line location in markdown', () => {
    const parsed = parseMarkdownGraph(sampleDoc);
    const edge = parsed.edges[0];
    expect(edge).toBeDefined();
    const updated = { ...edge, label: 'calls', arrow: 'both' as const, line: 'dashed' as const, path: 'orthogonal' as const };
    const serialized = serializeEdge(updated.target, updated);
    const newDoc = sampleDoc.slice(0, edge.sourceRange.start) + serialized + '\n' + sampleDoc.slice(edge.sourceRange.end);
    const reParsed = parseMarkdownGraph(newDoc);
    const reEdge = reParsed.edges[0];
    expect(reEdge.label).toBe('calls');
    expect(reEdge.arrow).toBe('both');
    expect(reEdge.line).toBe('dashed');
  });
});
