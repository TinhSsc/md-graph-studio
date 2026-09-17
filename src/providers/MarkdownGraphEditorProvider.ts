import * as vscode from 'vscode';
import { autoLayout, layoutGraphDocument } from '../layout/AutoLayoutEngine';
import { nodeColors, nodeShapes, type CanvasEdgeEndpoints, type CanvasMeta, type GraphDocument, type GraphEdge, type GraphNode, type LayoutDirection, type Port } from '../model/graphTypes';
import { nodeIconIds } from '../model/nodeIcons';
import { deleteEdgeDocument, deleteNodeDocument } from '../parser/GraphDeletion';
import { captureGraphSelection, deleteGraphSelection, pasteGraphSelection, type GraphClipboard } from '../parser/GraphClipboard';
import { parseMarkdownGraph } from '../parser/MarkdownGraphParser';
import { appendEdge, applyTextEdits, createNodeSection, serializeEdge, updateCanvasMeta, updateNodeSection } from '../parser/MarkdownGraphSerializer';
import { updateNodeDocument } from '../parser/NodeDocumentUpdater';
import { applyMetaPatch, buildDuplicateNodeEdits } from '../parser/NodeDuplication';
import { canvasHtml } from '../webview/canvasHtml';
import { imageExtensions, isFiniteNumber, isPathWithinRoots, normalizePosixPath, resolveLinkTarget } from './ContentActionRules';
import { isViewport, makeMeta, updateEdgeMeta, updateViewportMeta } from './documentEdits';
import { createNodeDocument } from './NodeCreation';
import { handleAppendNodeContent, handleCreateRichNode, handleRequestPickImage, type HostEnv } from './RichContentHandlers';
import { SidecarStorageManager } from '../storage/SidecarStorageManager';
import { hydrateGraphWithStorageMode, type StorageMode } from '../storage/HydrationEngine';
import { removeEdgeState, removeNodeState, renameNodeState, setNodeCollapsedState } from '../state/CanvasStateReducer';
import { updateNodeContentFromMessage } from './NodeContentMessages';
import { collectGraphDiagnostics } from '../validation/GraphValidator';
import { FULL_GRAPH_TEMPLATE } from '../templates/fullGraphTemplate';
import { clearGraphDiagnostics, mapGraphDiagnostics, publishGraphDiagnostics, type DiagnosticCollectionLike, type MappedGraphDiagnostic } from './GraphDiagnosticsPublisher';

type CanvasMessage = { type: string; editId?: string; [key: string]: unknown };

export class MarkdownGraphEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'markdownGraphStudio.editor';
  private sidecarManager = new SidecarStorageManager();
  private documentMetaCache = new Map<string, CanvasMeta | null>();
  private documentViews = new Map<string, Set<() => void>>();
  private graphDiagnosticCollection = vscode.languages.createDiagnosticCollection('Markdown Graph Studio');
  private graphClipboard: GraphClipboard | null = null;
  private clipboardPasteCount = 0;

  constructor(private readonly onDocumentOpened?: (document: vscode.TextDocument) => Thenable<void> | void) {}

  // View cấu trúc tối thiểu của DiagnosticCollection cho publisher thuần (vscode nạp chồng set nên cần cast)
  private get diagnosticCollectionView(): DiagnosticCollectionLike<vscode.Uri, vscode.Diagnostic> {
    return this.graphDiagnosticCollection as unknown as DiagnosticCollectionLike<vscode.Uri, vscode.Diagnostic>;
  }

  // Lấy cấu hình chế độ lưu trữ từ workspace
  private getStorageMode(): StorageMode {
    return vscode.workspace.getConfiguration('markdownGraphStudio').get<StorageMode>('storageMode', 'sidecar');
  }

  // Lấy metadata lưu trong bộ nhớ đệm cho tài liệu
  public getCachedMeta(uri: vscode.Uri): CanvasMeta | null {
    return this.documentMetaCache.get(uri.toString()) ?? null;
  }

  // Cập nhật metadata trong bộ nhớ đệm cho tài liệu
  public setCachedMeta(uri: vscode.Uri, meta: CanvasMeta | null): void {
    this.documentMetaCache.set(uri.toString(), meta);
  }

  // Khởi tạo và liên kết custom editor với webview panel
  public async resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): Promise<void> {
    await this.onDocumentOpened?.(document);
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    const docDir = vscode.Uri.joinPath(document.uri, '..');
    const localRoots = [docDir.fsPath, ...(folder ? [folder.uri.fsPath] : [])];
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        docDir,
        ...(folder ? [folder.uri] : [])
      ]
    };

    const resolveImages = (graph: ReturnType<typeof currentGraph>): Record<string, string> => {
      const resolved: Record<string, string> = {};
      for (const node of graph.nodes) {
        const imgRegex = /!\[.*?\]\((.+?)\)/g;
        let match: RegExpExecArray | null;
        while ((match = imgRegex.exec(node.content)) !== null) {
          const rawPath = match[1].trim();
          if (/^https?:\/\//i.test(rawPath) || /^data:/i.test(rawPath)) continue;
          try {
            const decoded = decodeURIComponent(rawPath);
            const absolute = normalizePosixPath(vscode.Uri.joinPath(docDir, decoded).fsPath);
            if (!isPathWithinRoots(absolute, localRoots)) continue;
            resolved[rawPath] = panel.webview.asWebviewUri(vscode.Uri.file(absolute)).toString();
          } catch {
          }
        }
      }
      return resolved;
    };

    const initialSidecar = await this.sidecarManager.readSidecar(document.uri);
    if (initialSidecar.meta) this.setCachedMeta(document.uri, initialSidecar.meta);

    let ready = false;
    const currentGraph = () => {
      const parsed = parseMarkdownGraph(document.getText());
      const mode = this.getStorageMode();
      const sidecarMeta = this.getCachedMeta(document.uri);
      const hydrated = hydrateGraphWithStorageMode(parsed, { mode, sidecarMeta });
      return this.withValidatorDiagnostics(layoutGraphDocument(hydrated), document.getText());
    };
    const sendGraph = () => {
      if (ready) {
        const g = currentGraph();
        g.resolvedImages = resolveImages(g);
        void panel.webview.postMessage({ type: 'graph', graph: g });
        this.publishDocumentDiagnostics(document, g);
      }
    };
    const uriKey = document.uri.toString();
    const views = this.documentViews.get(uriKey) ?? new Set<() => void>();
    views.add(sendGraph);
    this.documentViews.set(uriKey, views);
    const initialGraph = currentGraph();
    initialGraph.resolvedImages = resolveImages(initialGraph);
    panel.webview.html = canvasHtml(initialGraph);

    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) sendGraph();
    });
    panel.webview.onDidReceiveMessage(async (message: unknown) => {
      if (!isMessage(message)) return;
      if (message.type === 'ready') {
        ready = true;
        sendGraph();
        return;
      }
      if (message.type === 'exportPng' && typeof message.dataUrl === 'string') {
        await this.savePng(document, message.dataUrl);
        return;
      }
      if (message.type === 'createTemplate') {
        await this.createTemplate(document);
        return;
      }
      if (message.type === 'undo' || message.type === 'redo') {
        this.editQueue = this.editQueue.then(async () => {
          await vscode.commands.executeCommand(message.type);
        });
        return;
      }
      const env = this.makeEnv(document, panel.webview, docDir, folder);
      if (message.type === 'appendNodeContent' || message.type === 'requestPickImage' || message.type === 'createRichNode') {
        const handled = message.type === 'appendNodeContent'
          ? handleAppendNodeContent(env, message)
          : message.type === 'requestPickImage'
            ? handleRequestPickImage(env, message)
            : handleCreateRichNode(env, message);
        await handled.catch((err) => {
          console.error('MarkdownGraphEditorProvider rich content error:', err);
        });
        return;
      }
      this.editQueue = this.editQueue.then(async () => {
        await this.handleMessage(document, message, docDir, localRoots);
      }).catch((err) => {
        console.error('MarkdownGraphEditorProvider error:', err);
      });
    });
    panel.onDidDispose(() => {
      changeListener.dispose();
      const activeViews = this.documentViews.get(uriKey);
      activeViews?.delete(sendGraph);
      if (!activeViews?.size) {
        this.documentViews.delete(uriKey);
        this.documentMetaCache.delete(uriKey);
        clearGraphDiagnostics(this.diagnosticCollectionView, document.uri);
      }
    });
  }

  private editQueue: Promise<void> = Promise.resolve();

  private async savePng(document: vscode.TextDocument, dataUrl: string): Promise<void> {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) {
      void vscode.window.showErrorMessage('Could not export PNG: invalid image data.');
      return;
    }
    const defaultName = document.uri.path.replace(/\.md$/i, '.png');
    const target = await vscode.window.showSaveDialog({
      defaultUri: document.uri.with({ path: defaultName }),
      filters: { 'PNG Image': ['png'] },
      saveLabel: 'Export PNG',
    });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, Buffer.from(match[1], 'base64'));
    void vscode.window.showInformationMessage(`Exported ${target.path.split('/').pop() ?? 'graph.png'}.`);
  }

  private async createTemplate(document: vscode.TextDocument): Promise<void> {
    const defaultPath = document.uri.path.replace(/[^/]+$/, 'graph-template.md');
    const target = await vscode.window.showSaveDialog({
      defaultUri: document.uri.with({ path: defaultPath }),
      filters: { Markdown: ['md'] },
      saveLabel: 'Create Template',
      title: 'Create Markdown Graph Template',
    });
    if (!target) return;
    await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(FULL_GRAPH_TEMPLATE));
    await vscode.commands.executeCommand('vscode.openWith', target, MarkdownGraphEditorProvider.viewType);
  }

  private async removeNodesFromSidecar(uri: vscode.Uri, nextText: string, ids: ReadonlySet<string>): Promise<void> {
    let meta = this.getCachedMeta(uri) ?? (await this.sidecarManager.readSidecar(uri)).meta;
    if (!meta) return;
    const remainingEdgeIds = new Set(parseMarkdownGraph(nextText).edges.map(edge => edge.id));
    for (const id of ids) meta = removeNodeState(meta, id, remainingEdgeIds);
    this.setCachedMeta(uri, meta);
    await this.sidecarManager.writeSidecar(uri, meta);
  }

  private broadcastGraph(uri: vscode.Uri): void {
    for (const send of this.documentViews.get(uri.toString()) ?? []) send();
  }

  // Gộp chẩn đoán từ validator (pure) vào graph, không bao giờ làm vỡ luồng render
  private withValidatorDiagnostics(graph: GraphDocument, sourceText: string): GraphDocument {
    try {
      const extra = collectGraphDiagnostics(graph, sourceText);
      if (extra.length === 0) return graph;
      return { ...graph, diagnostics: [...(graph.diagnostics ?? []), ...extra] };
    } catch (error) {
      console.error('[MarkdownGraphEditorProvider] Graph validation failed:', error);
      return graph;
    }
  }

  // Đưa chẩn đoán của tài liệu lên bảng Problems qua DiagnosticCollection
  private publishDocumentDiagnostics(document: vscode.TextDocument, graph: GraphDocument): void {
    try {
      const mapped = mapGraphDiagnostics(graph.diagnostics ?? [], (offset) => document.positionAt(offset));
      const vscodeDiagnostics = mapped.map(toVscodeDiagnostic);
      // DiagnosticCollection.set của vscode bị nạp chồng (biến thể "entries" đứng cuối),
      // nên lấy view cấu trúc tối thiểu để dùng publisher không phụ thuộc vscode.
      publishGraphDiagnostics(this.diagnosticCollectionView, document.uri, vscodeDiagnostics);
    } catch (error) {
      console.error('[MarkdownGraphEditorProvider] Diagnostics publish failed:', error);
    }
  }

  // Tạo môi trường host cho các thao tác nội dung phong phú
  private makeEnv(document: vscode.TextDocument, webview: vscode.Webview, docDir: vscode.Uri, folder: vscode.WorkspaceFolder | undefined): HostEnv {
    const mode = this.getStorageMode();
    return {
      documentText: () => document.getText(),
      docDirPath: () => docDir.fsPath,
      workspaceRoots: () => (folder ? [folder.uri.fsPath] : []),
      graphForText: (text) => {
        const parsed = parseMarkdownGraph(text);
        const hydrated = hydrateGraphWithStorageMode(parsed, { mode, sidecarMeta: this.getCachedMeta(document.uri) });
        return layoutGraphDocument(hydrated);
      },
      embedMetadata: () => mode === 'embedded',
      pickImageFile: async () => {
        const picked = await vscode.window.showOpenDialog({
          canSelectMany: false,
          openLabel: 'Insert Image',
          defaultUri: docDir,
          filters: { Images: [...imageExtensions] },
        });
        return picked?.[0]?.fsPath;
      },
      applyEdit: (build) => new Promise((resolve) => {
        this.editQueue = this.editQueue.then(async () => {
          const outcome = build(document.getText());
          if (!outcome) {
            resolve(null);
            return;
          }
          if (mode === 'sidecar' && outcome.meta) this.setCachedMeta(document.uri, outcome.meta);
          const ok = await this.apply(document, [{ start: 0, end: document.getText().length, text: outcome.text }]);
          if (ok && mode === 'sidecar' && outcome.meta) {
            await this.sidecarManager.writeSidecar(document.uri, outcome.meta);
            this.broadcastGraph(document.uri);
          }
          resolve(ok ? outcome : null);
        }).catch((err) => {
          console.error('MarkdownGraphEditorProvider applyEdit error:', err);
          resolve(null);
        });
      }),
      reply: (message) => {
        void webview.postMessage(message);
      },
    };
  }

  // Xử lý các thông điệp định tuyến lưu trữ và chỉnh sửa từ webview
  private async handleMessage(document: vscode.TextDocument, value: unknown, docDir: vscode.Uri, localRoots: string[]): Promise<void> {
    if (!isMessage(value)) return;
    const text = document.getText();
    const graph = parseMarkdownGraph(text);
    const mode = this.getStorageMode();
    const activeGraph = layoutGraphDocument(hydrateGraphWithStorageMode(graph, {
      mode,
      sidecarMeta: this.getCachedMeta(document.uri),
    }));
    const selectedIds = Array.isArray(value.ids)
      ? new Set(value.ids.filter((id): id is string => typeof id === 'string'))
      : new Set<string>();
    if (value.type === 'copyNodes') {
      const captured = captureGraphSelection(activeGraph, selectedIds);
      if (captured) {
        this.graphClipboard = captured;
        this.clipboardPasteCount = 0;
      }
      return;
    }
    if (value.type === 'cutNodes') {
      const captured = captureGraphSelection(activeGraph, selectedIds);
      if (!captured) return;
      this.graphClipboard = captured;
      this.clipboardPasteCount = 0;
      const nextText = deleteGraphSelection(text, selectedIds, mode === 'embedded');
      if (mode === 'sidecar') await this.removeNodesFromSidecar(document.uri, nextText, selectedIds);
      await this.apply(document, [{ start: 0, end: text.length, text: nextText }]);
      if (mode === 'sidecar') this.broadcastGraph(document.uri);
      return;
    }
    if (value.type === 'deleteNodes') {
      if (selectedIds.size === 0) return;
      const nextText = deleteGraphSelection(text, selectedIds, mode === 'embedded');
      if (mode === 'sidecar') await this.removeNodesFromSidecar(document.uri, nextText, selectedIds);
      await this.apply(document, [{ start: 0, end: text.length, text: nextText }]);
      if (mode === 'sidecar') this.broadcastGraph(document.uri);
      return;
    }
    if (value.type === 'pasteNodes' && this.graphClipboard) {
      this.clipboardPasteCount += 1;
      const pasted = pasteGraphSelection(text, activeGraph, this.graphClipboard, this.clipboardPasteCount);
      if (!pasted) return;
      let nextText = pasted.text;
      const currentMeta = this.getCachedMeta(document.uri) ?? graph.meta;
      if (mode !== 'stateless' && currentMeta) {
        const nextMeta = applyMetaPatch(currentMeta, pasted.metaPatch);
        this.setCachedMeta(document.uri, nextMeta);
        if (mode === 'sidecar') await this.sidecarManager.writeSidecar(document.uri, nextMeta);
        if (mode === 'embedded') nextText = applyTextEdits(nextText, [updateCanvasMeta(nextText, nextMeta)]);
      }
      await this.apply(document, [{ start: 0, end: text.length, text: nextText }]);
      if (mode === 'sidecar') this.broadcastGraph(document.uri);
      return;
    }
    if (value.type === 'addNode') {
      const shape = typeof value.shape === 'string' && nodeShapes.includes(value.shape as GraphNode['shape']) ? value.shape as GraphNode['shape'] : 'rounded-rectangle';
      const color = typeof value.color === 'string' && nodeColors.includes(value.color as (typeof nodeColors)[number]) ? value.color : 'blue';
      const icon = typeof value.icon === 'string' && nodeIconIds.includes(value.icon) ? value.icon : undefined;
      const embedMeta = mode === 'embedded';
      const created = createNodeDocument(text, activeGraph, {
        shape, color, icon, content: 'Describe this node.',
        x: isFiniteNumber(value.x) ? value.x : undefined,
        y: isFiniteNumber(value.y) ? value.y : undefined,
        embedMeta,
        generateExplicitId: true,
      });
      if (mode === 'sidecar' && created.meta) {
        this.setCachedMeta(document.uri, created.meta);
      }
      await this.apply(document, [{ start: 0, end: text.length, text: created.text }]);
      if (mode === 'sidecar' && created.meta) {
        await this.sidecarManager.writeSidecar(document.uri, created.meta);
        this.broadcastGraph(document.uri);
      }
      return;
    }
    if (value.type === 'saveLayout' && Array.isArray(value.nodes)) {
      const existingMeta = this.getCachedMeta(document.uri) ?? graph.meta;
      const viewport = isViewport(value.viewport) ? value.viewport : existingMeta?.viewport;
      const meta = makeMeta(existingMeta, value.nodes, viewport);
      this.setCachedMeta(document.uri, meta);
      if (mode === 'sidecar') {
        await this.sidecarManager.writeSidecar(document.uri, meta);
        this.broadcastGraph(document.uri);
        return;
      }
      if (mode === 'embedded') {
        await this.apply(document, [updateCanvasMeta(text, meta)]);
        return;
      }
      return;
    }
    if (value.type === 'toggleNodeCollapsed' && typeof value.id === 'string' && typeof value.collapsed === 'boolean') {
      const existingMeta = this.getCachedMeta(document.uri) ?? graph.meta;
      const fallbackNodes = existingMeta ? [] : layoutGraphDocument(graph).nodes;
      const meta = setNodeCollapsedState(existingMeta ?? makeMeta(undefined, fallbackNodes), value.id, value.collapsed);
      this.setCachedMeta(document.uri, meta);
      if (mode === 'sidecar') {
        await this.sidecarManager.writeSidecar(document.uri, meta);
        this.broadcastGraph(document.uri);
        return;
      }
      if (mode === 'embedded') {
        await this.apply(document, [updateCanvasMeta(text, meta)]);
        return;
      }
      return;
    }
    if (value.type === 'saveViewport' && isViewport(value.viewport)) {
      const existingMeta = this.getCachedMeta(document.uri) ?? graph.meta;
      const fallbackNodes = existingMeta ? [] : layoutGraphDocument(graph).nodes;
      const meta = updateViewportMeta(existingMeta, value.viewport, fallbackNodes);
      this.setCachedMeta(document.uri, meta);
      if (mode === 'sidecar') {
        await this.sidecarManager.writeSidecar(document.uri, meta);
        this.broadcastGraph(document.uri);
        return;
      }
      if (mode === 'embedded') {
        await this.apply(document, [updateCanvasMeta(text, meta)]);
        return;
      }
      return;
    }
    if (value.type === 'saveEdgeLayout' && typeof value.id === 'string' && isEdgeEndpoints(value.endpoints)) {
      const existingMeta = this.getCachedMeta(document.uri) ?? graph.meta;
      const fallbackNodes = existingMeta ? [] : layoutGraphDocument(graph).nodes;
      const meta = updateEdgeMeta(existingMeta, value.id, value.endpoints, fallbackNodes);
      this.setCachedMeta(document.uri, meta);
      if (mode === 'sidecar') {
        await this.sidecarManager.writeSidecar(document.uri, meta);
        this.broadcastGraph(document.uri);
        return;
      }
      if (mode === 'embedded') {
        await this.apply(document, [updateCanvasMeta(text, meta)]);
        return;
      }
      return;
    }
    if (value.type === 'autoArrange') {
      const direction = (value.direction === 'left-to-right' ? 'left-to-right' : 'top-to-bottom') as LayoutDirection;
      const arranged = autoLayout(graph.nodes, graph.edges, { direction });
      const existingMeta = this.getCachedMeta(document.uri) ?? graph.meta;
      const meta = makeMeta(existingMeta, arranged);
      this.setCachedMeta(document.uri, meta);
      if (mode === 'sidecar') {
        await this.sidecarManager.writeSidecar(document.uri, meta);
        this.broadcastGraph(document.uri);
        return;
      }
      if (mode === 'embedded') {
        await this.apply(document, [updateCanvasMeta(text, meta)]);
        return;
      }
      return;
    }
    if (value.type === 'applyNodeStyle' && Array.isArray(value.ids)) {
      const shape = typeof value.shape === 'string' && nodeShapes.includes(value.shape as GraphNode['shape']) ? value.shape as GraphNode['shape'] : undefined;
      const color = typeof value.color === 'string' && nodeColors.includes(value.color as (typeof nodeColors)[number]) ? value.color : undefined;
      if (!shape || !color) return;
      const ids = new Set(value.ids.filter((id): id is string => typeof id === 'string'));
      const edits = graph.nodes.filter((node) => ids.has(node.id) && node.sourceRange).map((node) => updateNodeSection(text, node, { ...node, shape, color }));
      await this.apply(document, edits);
      return;
    }
    if (value.type === 'setNodeIcon' && Array.isArray(value.ids) && (value.icon === null || typeof value.icon === 'string')) {
      const raw = typeof value.icon === 'string' ? value.icon.trim() : '';
      const icon = raw !== '' ? raw : undefined;
      const ids = new Set(value.ids.filter((id): id is string => typeof id === 'string'));
      const edits = graph.nodes.filter((node) => ids.has(node.id) && node.sourceRange).map((node) => updateNodeSection(text, node, { ...node, icon }));
      await this.apply(document, edits);
      return;
    }
    if (value.type === 'toggleNodeLocked' && typeof value.id === 'string' && typeof value.locked === 'boolean') {
      const target = graph.nodes.find((node) => node.id === value.id);
      if (!target?.sourceRange) return;
      await this.apply(document, [updateNodeSection(text, target, { ...target, locked: value.locked })]);
      return;
    }
    if (value.type === 'duplicateNode' && typeof value.id === 'string') {
      const sourceMeta = mode === 'stateless' ? null : (this.getCachedMeta(document.uri) ?? graph.meta ?? null);
      const result = buildDuplicateNodeEdits(text, graph, value.id, sourceMeta);
      if (!result) return;
      await this.apply(document, result.edits);
      if (Object.keys(result.metaPatch).length === 0) return;
      if (mode === 'sidecar') {
        const currentMeta = this.getCachedMeta(document.uri);
        if (!currentMeta) return;
        const nextMeta = applyMetaPatch(currentMeta, result.metaPatch);
        this.setCachedMeta(document.uri, nextMeta);
        await this.sidecarManager.writeSidecar(document.uri, nextMeta);
        this.broadcastGraph(document.uri);
        return;
      }
      if (mode === 'embedded') {
        const currentMeta = this.getCachedMeta(document.uri) ?? graph.meta;
        if (!currentMeta) return;
        const nextMeta = applyMetaPatch(currentMeta, result.metaPatch);
        await this.apply(document, [updateCanvasMeta(document.getText(), nextMeta)]);
      }
      return;
    }
    if (value.type === 'addEdge' && typeof value.source === 'string' && typeof value.target === 'string') {
      let source = graph.nodes.find((node) => node.id === value.source);
      if (!source || source.id === value.target) return;
      if (source.ghost) {
        const at = text.search(/\n?<!--\s*canvas-meta\s*\n/);
        const section = createNodeSection({ title: source.title, shape: 'rounded-rectangle', color: 'gray', collapsed: false, locked: false, content: '' });
        await this.apply(document, [{ start: at === -1 ? text.length : at, end: at === -1 ? text.length : at, text: '\n' + section }]);
        const fresh = parseMarkdownGraph(document.getText());
        source = fresh.nodes.find((node) => node.id === value.source);
      }
      if (source?.sourceRange) {
        const preservedEdges = (this.getCachedMeta(document.uri) ?? graph.meta)?.edges ?? {};
        const currentText = document.getText();
        const fromPort = isEdgeEndpoints(value.endpoints) ? portFromEndpoint(value.endpoints.source) : undefined;
        const toPort = isEdgeEndpoints(value.endpoints) ? portFromEndpoint(value.endpoints.target) : undefined;
        const appendedText = applyTextEdits(currentText, [appendEdge(currentText, source, value.target, 'orthogonal', { fromPort, toPort })]);
        const freshGraph = parseMarkdownGraph(appendedText);
        const createdEdge = [...freshGraph.edges].reverse().find((edge) => edge.source === source?.id && edge.target === value.target);
        const existingMeta = this.getCachedMeta(document.uri) ?? freshGraph.meta;
        const fallbackNodes = existingMeta ? [] : layoutGraphDocument(graph).nodes;
        const meta = makeMeta(existingMeta ? { ...existingMeta, edges: preservedEdges } : undefined, fallbackNodes);
        if (createdEdge && isEdgeEndpoints(value.endpoints)) {
          meta.edges = { ...preservedEdges, [createdEdge.id]: value.endpoints };
        }
        this.setCachedMeta(document.uri, meta);
        if (mode === 'sidecar') {
          if (createdEdge && isEdgeEndpoints(value.endpoints)) {
            await this.sidecarManager.writeSidecar(document.uri, meta);
          }
          await this.apply(document, [{ start: 0, end: currentText.length, text: appendedText }]);
          this.broadcastGraph(document.uri);
        } else if (mode === 'embedded') {
          const finalText = applyTextEdits(appendedText, [updateCanvasMeta(appendedText, meta)]);
          await this.apply(document, [{ start: 0, end: currentText.length, text: finalText }]);
        } else {
          await this.apply(document, [{ start: 0, end: currentText.length, text: appendedText }]);
        }
      }
      return;
    }
    const node = typeof value.id === 'string' ? graph.nodes.find((item) => item.id === value.id) : undefined;
    if (value.type === 'updateNode' && node && hasStrings(value, ['title', 'shape', 'color', 'content'])) {
      const nextText = updateNodeDocument(text, graph, node, {
        title: value.title,
        content: value.content,
        shape: value.shape as GraphNode['shape'],
        color: value.color,
      });
      if (mode === 'sidecar' && node.id === node.title && value.title.trim() !== node.title) {
        const currentMeta = this.getCachedMeta(document.uri);
        if (currentMeta) {
          const nextGraph = parseMarkdownGraph(nextText);
          const nextNode = nextGraph.nodes.find((item) => item.title === value.title.trim());
          if (nextNode) {
            const edgeIds = new Map(graph.edges.map((item, index) => [item.id, nextGraph.edges[index]?.id ?? item.id]));
            const nextMeta = renameNodeState(currentMeta, node.id, nextNode.id, edgeIds);
            this.setCachedMeta(document.uri, nextMeta);
            await this.sidecarManager.writeSidecar(document.uri, nextMeta);
          }
        }
      }
      await this.apply(document, [{ start: 0, end: text.length, text: nextText }]);
      if (mode === 'sidecar') this.broadcastGraph(document.uri);
      return;
    }
    const updatedContent = updateNodeContentFromMessage(node, value);
    if (updatedContent !== undefined) {
      if (node && updatedContent !== null && updatedContent !== node.content) {
        await this.apply(document, [updateNodeSection(text, node, { ...node, content: updatedContent })]);
      }
      return;
    }
    if (value.type === 'openLink' && typeof value.href === 'string') {
      const target = resolveLinkTarget(value.href, docDir.fsPath, localRoots);
      if (!target) {
        void vscode.window.showWarningMessage('This link was blocked for safety.');
        return;
      }
      try {
        const targetUri = target.kind === 'web' ? vscode.Uri.parse(target.url) : vscode.Uri.file(target.absolutePath);
        await vscode.commands.executeCommand('vscode.open', targetUri);
      } catch {
        void vscode.window.showWarningMessage('Could not open this link.');
      }
      return;
    }
    if (value.type === 'deleteNode' && node && value.confirmed === true) {
      const cleanEmbeddedMeta = mode === 'embedded';
      const nextText = deleteNodeDocument(text, graph, node, { cleanEmbeddedMeta });
      if (mode === 'sidecar') {
        const currentMeta = this.getCachedMeta(document.uri) ?? (await this.sidecarManager.readSidecar(document.uri)).meta;
        if (currentMeta) {
          const freshGraph = parseMarkdownGraph(nextText);
          const remainingEdgeIds = new Set(freshGraph.edges.map((item) => item.id));
          const nextMeta = removeNodeState(currentMeta, node.id, remainingEdgeIds);
          this.setCachedMeta(document.uri, nextMeta);
          await this.sidecarManager.writeSidecar(document.uri, nextMeta);
        }
      }
      await this.apply(document, [{ start: 0, end: text.length, text: nextText }]);
      if (mode === 'sidecar') this.broadcastGraph(document.uri);
      return;
    }
    const edge = typeof value.id === 'string' ? graph.edges.find((item) => item.id === value.id) : undefined;
    if (value.type === 'deleteEdge' && edge) {
      const cleanEmbeddedMeta = mode === 'embedded';
      const nextText = deleteEdgeDocument(text, edge, { cleanEmbeddedMeta });
      if (mode === 'sidecar') {
        const currentMeta = this.getCachedMeta(document.uri) ?? (await this.sidecarManager.readSidecar(document.uri)).meta;
        if (currentMeta) {
          const nextMeta = removeEdgeState(currentMeta, edge.id);
          this.setCachedMeta(document.uri, nextMeta);
          await this.sidecarManager.writeSidecar(document.uri, nextMeta);
        }
      }
      await this.apply(document, [{ start: 0, end: text.length, text: nextText }]);
      if (mode === 'sidecar') this.broadcastGraph(document.uri);
      return;
    }
    if (value.type === 'updateEdge' && edge && hasStrings(value, ['label', 'arrow', 'line'])) {
      const updated: GraphEdge = { ...edge, label: value.label, arrow: value.arrow as GraphEdge['arrow'], line: value.line as GraphEdge['line'], path: 'orthogonal' };
      const originalLine = text.slice(edge.sourceRange.start, edge.sourceRange.end);
      const newline = originalLine.endsWith('\r\n') ? '\r\n' : (originalLine.endsWith('\n') ? '\n' : '');
      const serialized = serializeEdge(updated.target, updated) + newline;
      await this.apply(document, [{ start: edge.sourceRange.start, end: edge.sourceRange.end, text: serialized }]);
      return;
    }
  }

  // Áp dụng các thay đổi văn bản vào tài liệu markdown thông qua WorkspaceEdit
  private async apply(document: vscode.TextDocument, edits: Array<{ start: number; end: number; text: string }>): Promise<boolean> {
    if (edits.length === 0) return true;
    const currentText = document.getText();
    const workspaceEdit = new vscode.WorkspaceEdit();
    for (const edit of edits) {
      const startPos = document.positionAt(Math.max(0, Math.min(currentText.length, edit.start)));
      const endPos = document.positionAt(Math.max(0, Math.min(currentText.length, edit.end)));
      workspaceEdit.replace(document.uri, new vscode.Range(startPos, endPos), edit.text);
    }
    const success = await vscode.workspace.applyEdit(workspaceEdit);
    if (!success) {
      vscode.window.showErrorMessage('Markdown Graph Studio could not apply this edit.');
    }
    return success;
  }
}

// Chuyển chẩn đoán dạng plain object sang vscode.Diagnostic ngay trước khi set
function toVscodeDiagnostic(mapped: MappedGraphDiagnostic): vscode.Diagnostic {
  const severity = mapped.severity === 'error'
    ? vscode.DiagnosticSeverity.Error
    : mapped.severity === 'info'
      ? vscode.DiagnosticSeverity.Information
      : vscode.DiagnosticSeverity.Warning;
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(mapped.rangeStart.line, mapped.rangeStart.character, mapped.rangeEnd.line, mapped.rangeEnd.character),
    mapped.message,
    severity
  );
  diagnostic.source = 'Markdown Graph Studio';
  if (mapped.code !== undefined) diagnostic.code = mapped.code;
  return diagnostic;
}

// Kiểm tra đối tượng có phải thông điệp từ webview hợp lệ
function isMessage(value: unknown): value is CanvasMessage {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

// Kiểm tra thông điệp có chứa đầy đủ các khóa chuỗi cần thiết
function hasStrings(value: CanvasMessage, keys: string[]): value is CanvasMessage & Record<string, string> {
  return keys.every((key) => typeof value[key] === 'string');
}

// Kiểm tra cấu trúc dữ liệu đầu mút cạnh có hợp lệ
function isEdgeEndpoints(value: unknown): value is CanvasEdgeEndpoints {
  if (typeof value !== 'object' || value === null) return false;
  const endpoints = value as Record<string, unknown>;
  if (!isEdgeEndpoint(endpoints.source) || !isEdgeEndpoint(endpoints.target)) return false;
  return endpoints.guide === undefined || isEdgeGuide(endpoints.guide);
}

// Kiểm tra cấu trúc dữ liệu đường gióng phụ trợ của cạnh
function isEdgeGuide(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const guide = value as Record<string, unknown>;
  return (guide.axis === 'x' || guide.axis === 'y') && typeof guide.value === 'number' && Number.isFinite(guide.value);
}

// Kiểm tra cấu trúc dữ liệu điểm mút cạnh
function isEdgeEndpoint(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const endpoint = value as Record<string, unknown>;
  if (endpoint.kind === 'free') return typeof endpoint.x === 'number' && typeof endpoint.y === 'number';
  return endpoint.kind === 'node' && typeof endpoint.nodeId === 'string' && typeof endpoint.xRatio === 'number' && typeof endpoint.yRatio === 'number';
}

function portFromEndpoint(endpoint?: unknown): Port | undefined {
  if (!endpoint || typeof endpoint !== 'object') return undefined;
  const ep = endpoint as Record<string, unknown>;
  if (ep.kind !== 'node' || typeof ep.xRatio !== 'number' || typeof ep.yRatio !== 'number') return undefined;
  const distances = [ep.yRatio, 1 - ep.xRatio, 1 - ep.yRatio, ep.xRatio];
  const min = Math.min(...distances);
  const index = distances.indexOf(min);
  return (['top', 'right', 'bottom', 'left'] as const)[index];
}
