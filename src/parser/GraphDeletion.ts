import type { CanvasMeta, GraphDocument, GraphEdge, GraphNode } from '../model/graphTypes';
import { parseMarkdownGraph } from './MarkdownGraphParser';
import { applyTextEdits, deleteRange, updateCanvasMeta } from './MarkdownGraphSerializer';

// Xóa node và các liên kết trỏ tới node trong tài liệu markdown
export function deleteNodeDocument(text: string, graph: GraphDocument, node: GraphNode, options?: { cleanEmbeddedMeta?: boolean }): string {
  const incomingEdges = graph.edges.filter((edge) => edge.target === node.id && edge.source !== node.id);
  const ranges = [...(node.sourceRange ? [node.sourceRange] : []), ...incomingEdges.map((edge) => edge.sourceRange)];
  const uniqueRanges = [...new Map(ranges.map((range) => [`${range.start}:${range.end}`, range])).values()];
  const edits = uniqueRanges.map(deleteRange);
  const deleted = applyTextEdits(text, edits);
  return options?.cleanEmbeddedMeta === false ? deleted : cleanMetadata(deleted);
}

// Xóa liên kết cạnh trong tài liệu markdown
export function deleteEdgeDocument(text: string, edge: GraphEdge, options?: { cleanEmbeddedMeta?: boolean }): string {
  const deleted = applyTextEdits(text, [deleteRange(edge.sourceRange)]);
  return options?.cleanEmbeddedMeta === false ? deleted : cleanMetadata(deleted);
}

// Loại bỏ các node và liên kết đã xóa khỏi metadata nhúng
function cleanMetadata(text: string): string {
  const graph = parseMarkdownGraph(text);
  if (!graph.meta) return text;

  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const nodes = Object.fromEntries(Object.entries(graph.meta.nodes).filter(([id]) => nodeIds.has(id)));
  const groups = Object.fromEntries(Object.entries(graph.meta.groups).map(([id, group]) => [
    id,
    { ...group, members: group.members.filter((member) => nodeIds.has(member)) },
  ]));
  const meta: CanvasMeta = { ...graph.meta, nodes, groups, edges: graph.meta.edges };
  return applyTextEdits(text, [updateCanvasMeta(text, meta)]);
}
