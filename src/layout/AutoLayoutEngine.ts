import type { GraphDocument, GraphEdge, GraphNode, LayoutDirection, Port } from '../model/graphTypes';

export interface LayoutOptions {
  direction: LayoutDirection;
  margin?: number;
  gap?: number;
}

export interface EdgePorts { from: Port; to: Port; }

const defaultOptions: Required<LayoutOptions> = { direction: 'top-to-bottom', margin: 80, gap: 80 };

export function autoLayout(nodes: GraphNode[], edges: GraphEdge[], options: LayoutOptions): GraphNode[] {
  const settings = { ...defaultOptions, ...options };
  const layers = buildLayers(nodes, edges);
  const positioned = new Map<string, Pick<GraphNode, 'x' | 'y'>>();
  let primaryOffset = settings.margin;
  for (const layer of layers) {
    let secondaryOffset = settings.margin;
    const primarySize = Math.max(...layer.map((node) => primaryLength(node, settings.direction)));
    for (const node of layer) {
      positioned.set(node.id, settings.direction === 'top-to-bottom'
        ? { x: secondaryOffset, y: primaryOffset }
        : { x: primaryOffset, y: secondaryOffset });
      secondaryOffset += secondaryLength(node, settings.direction) + settings.gap;
    }
    primaryOffset += primarySize + settings.gap;
  }
  return nodes.map((node) => node.locked ? { ...node } : { ...node, ...positioned.get(node.id) });
}

export function layoutGraphDocument(document: GraphDocument, options: LayoutOptions = { direction: 'top-to-bottom' }): GraphDocument {
  return document.meta ? document : { ...document, nodes: autoLayout(document.nodes, document.edges, options) };
}

export function resolveEdgePorts(source: GraphNode, target: GraphNode, direction: LayoutDirection): EdgePorts {
  if (direction === 'top-to-bottom') return source.y <= target.y ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' };
  return source.x <= target.x ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' };
}

function buildLayers(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[][] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target) || edge.source === edge.target) continue;
    outgoing.get(edge.source)?.push(edge.target);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }
  const ranks = new Map<string, number>();
  const queue = [...nodes.filter((node) => incoming.get(node.id) === 0)].sort(compareNodes);
  while (queue.length) {
    const node = queue.shift()!;
    const rank = ranks.get(node.id) ?? 0;
    for (const target of (outgoing.get(node.id) ?? []).sort()) {
      ranks.set(target, Math.max(ranks.get(target) ?? 0, rank + 1));
      incoming.set(target, (incoming.get(target) ?? 1) - 1);
      if (incoming.get(target) === 0) queue.push(byId.get(target)!);
    }
    queue.sort(compareNodes);
  }
  const maxRank = Math.max(0, ...ranks.values());
  const unresolved = nodes.filter((node) => !ranks.has(node.id) && incoming.get(node.id)! > 0).sort(compareNodes);
  for (const node of unresolved) ranks.set(node.id, maxRank + 1);
  return [...nodes].sort((left, right) => (ranks.get(left.id) ?? 0) - (ranks.get(right.id) ?? 0) || compareNodes(left, right))
    .reduce<GraphNode[][]>((layers, node) => {
      const rank = ranks.get(node.id) ?? 0;
      (layers[rank] ??= []).push(node);
      return layers;
    }, []).filter((layer): layer is GraphNode[] => layer !== undefined);
}

function compareNodes(left: GraphNode, right: GraphNode): number { return left.id.localeCompare(right.id); }
function primaryLength(node: GraphNode, direction: LayoutDirection): number { return direction === 'top-to-bottom' ? node.height : node.width; }
function secondaryLength(node: GraphNode, direction: LayoutDirection): number { return direction === 'top-to-bottom' ? node.width : node.height; }
