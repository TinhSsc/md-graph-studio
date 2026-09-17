import type { CanvasMeta, CanvasNodeMeta, GraphDocument, GraphNode } from '../model/graphTypes';
import { uniqueNodeTitle } from '../model/nodeIdentity';
import { createNodeSection, type TextEdit } from './MarkdownGraphSerializer';

export interface DuplicateNodeEdits {
  edits: TextEdit[];
  newId: string;
  newTitle: string;
  metaPatch: Record<string, CanvasNodeMeta>;
}

export function buildDuplicateNodeEdits(
  text: string,
  graph: GraphDocument,
  sourceNodeId: string,
  meta: CanvasMeta | null
): DuplicateNodeEdits | null {
  const source = graph.nodes.find((node) => node.id === sourceNodeId);
  if (!source || !source.sourceRange) return null;
  const newTitle = uniqueNodeTitle(source.title, '', graph.nodes.map((node) => node.id));
  const section = createNodeSection({
    title: newTitle,
    shape: source.shape,
    color: source.color,
    icon: source.icon,
    collapsed: source.collapsed,
    locked: source.locked,
    content: stripEdgeLines(source.content),
  });
  const at = source.sourceRange.end;
  const before = text.slice(0, at);
  const prefix = before.endsWith('\n\n') ? '' : (before.endsWith('\n') ? '\n' : '\n\n');
  return {
    edits: [{ start: at, end: at, text: `${prefix}${section}` }],
    newId: newTitle,
    newTitle,
    metaPatch: buildMetaPatch(source, newTitle, meta),
  };
}

export function applyMetaPatch(meta: CanvasMeta, patch: Record<string, CanvasNodeMeta>): CanvasMeta {
  return { ...meta, nodes: { ...meta.nodes, ...patch } };
}

function buildMetaPatch(source: GraphNode, newId: string, meta: CanvasMeta | null): Record<string, CanvasNodeMeta> {
  if (!meta || typeof meta !== 'object') return {};
  const entry = meta.nodes?.[source.id];
  if (!entry || !Number.isFinite(entry.x) || !Number.isFinite(entry.y)) return {};
  return { [newId]: { ...entry, x: entry.x + 32, y: entry.y + 32 } };
}

// The parser already strips edge lines from node.content; this pass keeps the
// duplicate clean even when fed a hand-built graph whose content still has them.
function stripEdgeLines(content: string): string {
  let inFence = false;
  const kept: string[] = [];
  for (const line of content.split(/(?<=\n)/)) {
    const isFence = /^\s*(```|~~~)/.test(line);
    if (!isFence && !inFence && /^\s*-\s*\[\[.+?\]\]/.test(line)) continue;
    if (isFence) inFence = !inFence;
    kept.push(line);
  }
  return kept.join('').trim();
}
