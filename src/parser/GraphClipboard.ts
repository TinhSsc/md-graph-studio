import type { CanvasNodeMeta, GraphDocument, GraphEdge, GraphNode } from '../model/graphTypes';
import { createNodeSection, serializeEdge } from './MarkdownGraphSerializer';
import { deleteNodeDocument } from './GraphDeletion';
import { parseMarkdownGraph } from './MarkdownGraphParser';

export interface GraphClipboard {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PasteGraphResult {
  text: string;
  nodeIds: string[];
  metaPatch: Record<string, CanvasNodeMeta>;
}

export function captureGraphSelection(graph: GraphDocument, ids: ReadonlySet<string>): GraphClipboard | null {
  const nodes = graph.nodes.filter(node => ids.has(node.id) && !node.ghost && node.sourceRange);
  if (nodes.length === 0) return null;
  const capturedIds = new Set(nodes.map(node => node.id));
  const edges = graph.edges.filter(edge => capturedIds.has(edge.source) && capturedIds.has(edge.target));
  return { nodes: nodes.map(node => ({ ...node })), edges: edges.map(edge => ({ ...edge })) };
}

export function pasteGraphSelection(
  text: string,
  graph: GraphDocument,
  clipboard: GraphClipboard,
  pasteCount: number,
): PasteGraphResult | null {
  if (clipboard.nodes.length === 0) return null;
  const taken = new Set(graph.nodes.map(node => node.id));
  const idMap = new Map<string, string>();
  for (const node of clipboard.nodes) {
    const id = nextPasteId(node.id, taken);
    taken.add(id);
    idMap.set(node.id, id);
  }

  const sections = clipboard.nodes.map(node => {
    const outgoing = clipboard.edges
      .filter(edge => edge.source === node.id && idMap.has(edge.target))
      .map(edge => serializeEdge(idMap.get(edge.target)!, edge));
    const content = [node.content.trim(), ...outgoing].filter(Boolean).join('\n\n');
    return createNodeSection({ ...node, title: node.title, explicitId: idMap.get(node.id)!, content });
  });
  const metaPatch: Record<string, CanvasNodeMeta> = {};
  const offset = 32 * Math.max(1, pasteCount);
  for (const node of clipboard.nodes) {
    const id = idMap.get(node.id)!;
    const nx = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 100;
    const ny = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 100;
    metaPatch[id] = {
      x: nx + offset,
      y: ny + offset,
      width: node.width || 260,
      height: node.height || 140,
      layer: node.layer ?? 0,
      collapsed: Boolean(node.collapsed),
      locked: Boolean(node.locked),
    };
  }
  const metaAt = text.search(/\n?<!--\s*canvas-meta\s*\n/);
  const at = metaAt === -1 ? text.length : metaAt;
  const prefix = text.slice(0, at).endsWith('\n\n') ? '' : (text.slice(0, at).endsWith('\n') ? '\n' : '\n\n');
  return { text: text.slice(0, at) + prefix + sections.join('\n') + text.slice(at), nodeIds: [...idMap.values()], metaPatch };
}

// Chuyển đổi các node và cạnh trong clipboard thành văn bản Markdown để sao chép vào bộ nhớ tạm hệ thống.
export function serializeClipboardToMarkdown(clipboard: GraphClipboard, originalText?: string): string {
  if (clipboard.nodes.length === 0) return '';
  const chunks = clipboard.nodes.map(node => {
    if (originalText && node.sourceRange && node.sourceRange.end > node.sourceRange.start) {
      const sliced = originalText.slice(node.sourceRange.start, node.sourceRange.end).trimEnd();
      if (sliced) return sliced;
    }
    const outgoing = clipboard.edges
      .filter(edge => edge.source === node.id)
      .map(edge => serializeEdge(edge.target, edge));
    const content = [node.content.trim(), ...outgoing].filter(Boolean).join('\n\n');
    return createNodeSection({ ...node, title: node.title, explicitId: node.explicitId || node.id, content }).trimEnd();
  });
  return chunks.filter(Boolean).join('\n\n');
}

// Phân tích cú pháp văn bản Markdown hoặc văn bản thuần từ bộ nhớ tạm để tạo dữ liệu node và cạnh dán vào đồ thị.
export function createClipboardFromMarkdown(text: string): GraphClipboard | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parsed = parseMarkdownGraph(trimmed);
  if (parsed.nodes.length > 0) {
    const nodeIds = new Set(parsed.nodes.map(node => node.id));
    const edges = parsed.edges.filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    return {
      nodes: parsed.nodes.map(node => ({ ...node })),
      edges: edges.map(edge => ({ ...edge })),
    };
  }
  const lines = trimmed.split('\n');
  const rawTitle = lines[0].replace(/^[#\s\-*]+/, '').trim();
  const title = rawTitle.slice(0, 50) || 'Pasted Note';
  const content = lines.length > 1 ? lines.slice(1).join('\n').trim() : trimmed;
  return {
    nodes: [{
      id: 'pasted-note',
      title,
      content: content || title,
      shape: 'rounded-rectangle',
      color: 'blue',
      x: 100,
      y: 100,
      width: 260,
      height: 140,
      layer: 0,
      collapsed: false,
      locked: false,
      ghost: false,
    }],
    edges: [],
  };
}

function nextPasteId(sourceId: string, taken: ReadonlySet<string>): string {
  const base = sourceId.replace(/-paste-\d+$/i, '') || 'node';
  let suffix = 1;
  while (taken.has(`${base}-paste-${suffix}`)) suffix += 1;
  return `${base}-paste-${suffix}`;
}

export function deleteGraphSelection(text: string, ids: ReadonlySet<string>, cleanEmbeddedMeta: boolean): string {
  let current = text;
  for (const id of ids) {
    const graph = parseMarkdownGraph(current);
    const node = graph.nodes.find(item => item.id === id);
    if (node) current = deleteNodeDocument(current, graph, node, { cleanEmbeddedMeta });
  }
  return current;
}
