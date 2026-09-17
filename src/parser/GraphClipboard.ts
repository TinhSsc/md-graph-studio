import type { CanvasMeta, CanvasNodeMeta, GraphDocument, GraphEdge, GraphNode } from '../model/graphTypes';
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
    metaPatch[id] = {
      x: node.x + offset,
      y: node.y + offset,
      width: node.width,
      height: node.height,
      layer: node.layer,
      collapsed: node.collapsed,
      locked: node.locked,
    };
  }
  const metaAt = text.search(/\n?<!--\s*canvas-meta\s*\n/);
  const at = metaAt === -1 ? text.length : metaAt;
  const prefix = text.slice(0, at).endsWith('\n\n') ? '' : (text.slice(0, at).endsWith('\n') ? '\n' : '\n\n');
  return { text: text.slice(0, at) + prefix + sections.join('\n') + text.slice(at), nodeIds: [...idMap.values()], metaPatch };
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
