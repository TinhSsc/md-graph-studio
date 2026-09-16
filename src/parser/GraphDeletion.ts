import type { CanvasMeta, GraphDocument, GraphEdge, GraphNode } from '../model/graphTypes';
import { parseMarkdownGraph } from './MarkdownGraphParser';
import { applyTextEdits, deleteRange, updateCanvasMeta } from './MarkdownGraphSerializer';

export function deleteNodeDocument(text: string, graph: GraphDocument, node: GraphNode): string {
  const incomingEdges = graph.edges.filter((edge) => edge.target === node.id && edge.source !== node.id);
  const ranges = [...(node.sourceRange ? [node.sourceRange] : []), ...incomingEdges.map((edge) => edge.sourceRange)];
  const uniqueRanges = [...new Map(ranges.map((range) => [`${range.start}:${range.end}`, range])).values()];
  const edits = uniqueRanges.map(deleteRange);
  return cleanMetadata(applyTextEdits(text, edits));
}

export function deleteEdgeDocument(text: string, edge: GraphEdge): string {
  return cleanMetadata(applyTextEdits(text, [deleteRange(edge.sourceRange)]));
}

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
