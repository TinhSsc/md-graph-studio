import type { CanvasEdgeEndpoint, CanvasMeta, GraphDocument, GraphNode } from '../model/graphTypes';
import { uniqueNodeTitle } from '../model/nodeIdentity';
import { parseMarkdownGraph } from './MarkdownGraphParser';
import { materializeGhostNode } from './NodeContentActions';
import { applyTextEdits, renameWikiLinkTargets, updateCanvasMeta, updateNodeSection } from './MarkdownGraphSerializer';

type NodeChanges = Pick<GraphNode, 'title' | 'content' | 'shape' | 'color'>;

export function updateNodeDocument(text: string, graph: GraphDocument, node: GraphNode, changes: NodeChanges): string {
  const hasExplicitId = node.id !== node.title;
  const title = hasExplicitId
    ? changes.title.trim()
    : uniqueNodeTitle(changes.title, node.id, graph.nodes.map((item) => item.id));
  const updatedNode = { ...node, ...changes, title };
  let updatedText = node.ghost
    ? materializeGhostNode(text, updatedNode)
    : applyTextEdits(text, [updateNodeSection(text, node, updatedNode)]);

  if (hasExplicitId || title === node.id) return updatedText;
  updatedText = renameWikiLinkTargets(updatedText, node.id, title);
  if (!graph.meta) return updatedText;

  const nextGraph = parseMarkdownGraph(updatedText);
  const meta = remapMetadata(graph, nextGraph, node.id, title);
  return applyTextEdits(updatedText, [updateCanvasMeta(updatedText, meta)]);
}

function remapMetadata(graph: GraphDocument, nextGraph: GraphDocument, currentId: string, nextId: string): CanvasMeta {
  const source = graph.meta!;
  const nodes = { ...source.nodes };
  if (nodes[currentId]) nodes[nextId] = nodes[currentId];
  delete nodes[currentId];

  const edgeIds = new Map(graph.edges.map((edge, index) => [edge.id, nextGraph.edges[index]?.id ?? edge.id]));
  const edges = source.edges ? Object.fromEntries(Object.entries(source.edges).map(([id, endpoints]) => [
    edgeIds.get(id) ?? id,
    {
      source: remapEndpoint(endpoints.source, currentId, nextId),
      target: remapEndpoint(endpoints.target, currentId, nextId),
      ...(endpoints.guide ? { guide: endpoints.guide } : {}),
    },
  ])) : undefined;
  const groups = Object.fromEntries(Object.entries(source.groups).map(([id, group]) => [
    id,
    { ...group, members: group.members.map((member) => member === currentId ? nextId : member) },
  ]));
  return { ...source, nodes, groups, edges };
}

function remapEndpoint(endpoint: CanvasEdgeEndpoint, currentId: string, nextId: string): CanvasEdgeEndpoint {
  return endpoint.kind === 'node' && endpoint.nodeId === currentId
    ? { ...endpoint, nodeId: nextId }
    : endpoint;
}
