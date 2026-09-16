import * as vscode from 'vscode';
import { autoLayout, layoutGraphDocument } from '../layout/AutoLayoutEngine';
import { nodeColors, nodeShapes, type CanvasEdgeEndpoints, type CanvasMeta, type GraphEdge, type GraphNode, type LayoutDirection, type Viewport } from '../model/graphTypes';
import { nextAvailableNodeTitle } from '../model/nodeIdentity';
import { deleteEdgeDocument, deleteNodeDocument } from '../parser/GraphDeletion';
import { parseMarkdownGraph } from '../parser/MarkdownGraphParser';
import { appendEdge, applyTextEdits, createNodeSection, deleteRange, updateCanvasMeta, updateNodeSection } from '../parser/MarkdownGraphSerializer';
import { updateNodeDocument } from '../parser/NodeDocumentUpdater';
import { canvasHtml } from '../webview/canvasHtml';

type CanvasMessage = { type: string; editId?: string; [key: string]: unknown };

export class MarkdownGraphEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'markdownGraphStudio.editor';

  public resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    const docDir = vscode.Uri.joinPath(document.uri, '..');
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        docDir,
        ...(folder ? [folder.uri] : [])
      ]
    };

    const resolveImages = (graph: ReturnType<typeof currentGraph>): Record<string, string> => {
      const resolved: Record<string, string> = {};
      const imgRegex = /!\[.*?\]\((.+?)\)/g;
      for (const node of graph.nodes) {
        let match: RegExpExecArray | null;
        while ((match = imgRegex.exec(node.content)) !== null) {
          const rawPath = match[1].trim();
          if (!/^https?:\/\//i.test(rawPath) && !/^data:/i.test(rawPath)) {
            try {
              const fileUri = vscode.Uri.joinPath(docDir, rawPath);
              resolved[rawPath] = panel.webview.asWebviewUri(fileUri).toString();
            } catch {
              // Ignore invalid local paths
            }
          }
        }
      }
      return resolved;
    };

    let ready = false;
    const currentGraph = () => layoutGraphDocument(parseMarkdownGraph(document.getText()));
    const sendGraph = () => {
      if (ready) {
        const g = currentGraph();
        g.resolvedImages = resolveImages(g);
        void panel.webview.postMessage({ type: 'graph', graph: g });
      }
    };
    const initialGraph = currentGraph();
    initialGraph.resolvedImages = resolveImages(initialGraph);
    panel.webview.html = canvasHtml(initialGraph, panel.webview.cspSource);
    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === document.uri.toString()) sendGraph();
    });
    panel.webview.onDidReceiveMessage(async (message: unknown) => {
      if (isMessage(message) && message.type === 'ready') {
        ready = true;
        sendGraph();
        return;
      }
      this.editQueue = this.editQueue.then(async () => {
        await this.handleMessage(document, message);
      }).catch((err) => {
        console.error('MarkdownGraphEditorProvider error:', err);
      });
    });
    panel.onDidDispose(() => changeListener.dispose());
  }

  private editQueue: Promise<void> = Promise.resolve();

  private async handleMessage(document: vscode.TextDocument, value: unknown): Promise<void> {
    if (!isMessage(value)) return;
    const text = document.getText();
    const graph = parseMarkdownGraph(text);
    if (value.type === 'addNode') {
      const title = nextAvailableNodeTitle(graph.nodes.map((node) => node.id));
      const shape = typeof value.shape === 'string' && nodeShapes.includes(value.shape as GraphNode['shape']) ? value.shape as GraphNode['shape'] : 'rounded-rectangle';
      const color = typeof value.color === 'string' && nodeColors.includes(value.color as (typeof nodeColors)[number]) ? value.color : 'blue';
      const at = text.search(/\n?<!--\s*canvas-meta\s*\n/);
      const prefix = at === -1 ? (text.endsWith('\n') ? '\n' : '\n\n') : '\n';
      const section = createNodeSection({ title, shape, color, collapsed: false, locked: false, content: 'Describe this node.' });
      if (typeof value.x === 'number' && typeof value.y === 'number') {
        const meta = makeMeta(graph.meta, [
          ...graph.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, width: n.width, height: n.height })),
          { id: title, x: Math.round(value.x), y: Math.round(value.y), width: 140, height: 50 }
        ]);
        const newText = text.slice(0, at === -1 ? text.length : at) + prefix + section;
        const metaEdit = updateCanvasMeta(newText, meta);
        await this.apply(document, [{ start: 0, end: text.length, text: newText.slice(0, metaEdit.start) + metaEdit.text + newText.slice(metaEdit.end) }]);
      } else {
        await this.apply(document, [{ start: at === -1 ? text.length : at, end: at === -1 ? text.length : at, text: prefix + section }]);
      }
      return;
    }
    if (value.type === 'saveLayout' && Array.isArray(value.nodes)) {
      const viewport = isViewport(value.viewport) ? value.viewport : graph.meta?.viewport;
      await this.apply(document, [updateCanvasMeta(text, makeMeta(graph.meta, value.nodes, viewport))]);
      return;
    }
    if (value.type === 'saveViewport' && isViewport(value.viewport)) {
      const meta = makeMeta(graph.meta, graph.nodes, value.viewport);
      await this.apply(document, [updateCanvasMeta(text, meta)]);
      return;
    }
    if (value.type === 'saveEdgeLayout' && typeof value.id === 'string' && isEdgeEndpoints(value.endpoints)) {
      const meta = makeMeta(graph.meta, graph.nodes);
      meta.edges = { ...(graph.meta?.edges ?? {}), [value.id]: value.endpoints };
      await this.apply(document, [updateCanvasMeta(text, meta)]);
      return;
    }
    if (value.type === 'autoArrange') {
      const direction = (value.direction === 'left-to-right' ? 'left-to-right' : 'top-to-bottom') as LayoutDirection;
      await this.apply(document, [updateCanvasMeta(text, makeMeta(graph.meta, autoLayout(graph.nodes, graph.edges, { direction })))]); 
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
        const preservedEdges = graph.meta?.edges ?? {};
        const currentText = document.getText();
        const appendedText = applyTextEdits(currentText, [appendEdge(currentText, source, value.target, 'orthogonal')]);
        const freshGraph = parseMarkdownGraph(appendedText);
        const createdEdge = [...freshGraph.edges].reverse().find((edge) => edge.source === source?.id && edge.target === value.target);
        const meta = makeMeta({ ...freshGraph.meta, edges: preservedEdges } as CanvasMeta, freshGraph.nodes);
        if (createdEdge && isEdgeEndpoints(value.endpoints)) {
          meta.edges = { ...preservedEdges, [createdEdge.id]: value.endpoints };
        }
        const finalText = applyTextEdits(appendedText, [updateCanvasMeta(appendedText, meta)]);
        await this.apply(document, [{ start: 0, end: currentText.length, text: finalText }]);
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
      await this.apply(document, [{ start: 0, end: text.length, text: nextText }]);
      return;
    }
    if (value.type === 'toggleTask' && node) {
      const taskIndex = typeof value.task === 'number' ? value.task : (typeof value.taskIndex === 'number' ? value.taskIndex : -1);
      if (taskIndex >= 0) {
        let index = -1;
        const content = node.content.replace(/([-*]\s*\[)([ xX])(\])/g, (match, prefix, state, suffix) => {
          index += 1;
          if (index === taskIndex) {
            const nextState = state.toLowerCase() === 'x' ? ' ' : 'x';
            return `${prefix}${nextState}${suffix}`;
          }
          return match;
        });
        await this.apply(document, [updateNodeSection(text, node, { ...node, content })]);
        return;
      }
    }
    if (value.type === 'openLink' && typeof value.href === 'string') {
      const href = value.href.trim();
      const docDir = vscode.Uri.joinPath(document.uri, '..');
      const targetUri = /^https?:\/\//i.test(href) ? vscode.Uri.parse(href) : vscode.Uri.joinPath(docDir, href);
      try {
        await vscode.commands.executeCommand('vscode.open', targetUri);
      } catch {
        void vscode.window.showWarningMessage(`Could not open: ${href}`);
      }
      return;
    }
    if (value.type === 'deleteNode' && node) {
      const nextText = deleteNodeDocument(text, graph, node);
      await this.apply(document, [{ start: 0, end: text.length, text: nextText }]);
      return;
    }
    const edge = typeof value.id === 'string' ? graph.edges.find((item) => item.id === value.id) : undefined;
    if (value.type === 'deleteEdge' && edge) {
      const nextText = deleteEdgeDocument(text, edge);
      await this.apply(document, [{ start: 0, end: text.length, text: nextText }]);
      return;
    }
    if (value.type === 'updateEdge' && edge && hasStrings(value, ['label', 'arrow', 'line'])) {
      const source = graph.nodes.find((item) => item.id === edge.source);
      if (!source?.sourceRange) return;
      const updated: GraphEdge = { ...edge, label: value.label, arrow: value.arrow as GraphEdge['arrow'], line: value.line as GraphEdge['line'], path: 'orthogonal' };
      const link = updated.label ? '|' + updated.label : '';
      const line = '\n- [[' + updated.target + link + ']] <!-- graph-edge: arrow=' + updated.arrow + '; line=' + updated.line + '; path=' + updated.path + ' -->\n';
      await this.apply(document, [deleteRange(edge.sourceRange), { start: source.sourceRange.end, end: source.sourceRange.end, text: line }]);
    }
  }

  private async apply(document: vscode.TextDocument, edits: Array<{ start: number; end: number; text: string }>): Promise<void> {
    if (edits.length === 0) return;
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
  }
}

function isMessage(value: unknown): value is CanvasMessage {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

function hasStrings(value: CanvasMessage, keys: string[]): value is CanvasMessage & Record<string, string> {
  return keys.every((key) => typeof value[key] === 'string');
}

function makeMeta(existing: CanvasMeta | undefined, rawNodes: unknown[], viewport?: Viewport): CanvasMeta {
  const nodes: CanvasMeta['nodes'] = { ...(existing?.nodes ?? {}) };
  for (const raw of rawNodes) if (isLayoutNode(raw)) nodes[raw.id] = { x: raw.x, y: raw.y, width: raw.width, height: raw.height };
  const edges = existing?.edges ? Object.fromEntries(Object.entries(existing.edges).map(([id, endpoints]) => [id, {
    source: endpoints.source,
    target: endpoints.target,
    ...(endpoints.guide ? { guide: endpoints.guide } : {}),
  }])) : undefined;
  return { version: 1, nodes, groups: existing?.groups ?? {}, edges, viewport: viewport ?? existing?.viewport ?? { x: 0, y: 0, zoom: 1 } };
}

function isEdgeEndpoints(value: unknown): value is CanvasEdgeEndpoints {
  if (typeof value !== 'object' || value === null) return false;
  const endpoints = value as Record<string, unknown>;
  if (!isEdgeEndpoint(endpoints.source) || !isEdgeEndpoint(endpoints.target)) return false;
  return endpoints.guide === undefined || isEdgeGuide(endpoints.guide);
}

function isEdgeGuide(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const guide = value as Record<string, unknown>;
  return (guide.axis === 'x' || guide.axis === 'y') && typeof guide.value === 'number' && Number.isFinite(guide.value);
}

function isEdgeEndpoint(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const endpoint = value as Record<string, unknown>;
  if (endpoint.kind === 'free') return typeof endpoint.x === 'number' && typeof endpoint.y === 'number';
  return endpoint.kind === 'node' && typeof endpoint.nodeId === 'string' && typeof endpoint.xRatio === 'number' && typeof endpoint.yRatio === 'number';
}

function isViewport(value: unknown): value is Viewport {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.x === 'number' && typeof v.y === 'number' && typeof v.zoom === 'number';
}

function isLayoutNode(value: unknown): value is Pick<GraphNode, 'id' | 'x' | 'y' | 'width' | 'height'> {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Record<string, unknown>;
  return typeof node.id === 'string' && ['x', 'y', 'width', 'height'].every((key) => typeof node[key] === 'number');
}
