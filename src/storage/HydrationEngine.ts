import type { CanvasMeta, GraphDocument } from '../model/graphTypes';
import { autoLayout } from '../layout/AutoLayoutEngine';

export type StorageMode = 'sidecar' | 'embedded' | 'stateless';

export interface HydrateOptions {
  mode: StorageMode;
  sidecarMeta?: CanvasMeta | null;
}

// Hợp nhất metadata layout vào tài liệu đồ thị theo thứ tự ưu tiên của storage mode
export function hydrateGraphWithStorageMode(graph: GraphDocument, options: HydrateOptions): GraphDocument {
  const { mode, sidecarMeta } = options;
  const embeddedMeta = graph.meta;

  let activeMeta: CanvasMeta | undefined = undefined;

  if (mode === 'sidecar') {
    activeMeta = sidecarMeta || embeddedMeta;
  } else if (mode === 'embedded') {
    activeMeta = embeddedMeta || sidecarMeta || undefined;
  } else if (mode === 'stateless') {
    activeMeta = undefined;
  }

  if (activeMeta) {
    for (const node of graph.nodes) {
      const nodeMeta = activeMeta.nodes[node.id];
      if (nodeMeta) {
        node.x = nodeMeta.x;
        node.y = nodeMeta.y;
        if (nodeMeta.width) node.width = nodeMeta.width;
        if (nodeMeta.height) node.height = nodeMeta.height;
        if (typeof nodeMeta.layer === 'number') node.layer = nodeMeta.layer;
        if (typeof nodeMeta.collapsed === 'boolean') node.collapsed = nodeMeta.collapsed;
        if (typeof nodeMeta.locked === 'boolean') node.locked = nodeMeta.locked;
      }
    }
    if (activeMeta.edges) {
      for (const edge of graph.edges) {
        const endpoints = activeMeta.edges[edge.id];
        const sourceMatches = endpoints?.source.kind !== 'node' || endpoints.source.nodeId === edge.source;
        const targetMatches = endpoints?.target.kind !== 'node' || endpoints.target.nodeId === edge.target;
        if (endpoints && sourceMatches && targetMatches) {
          edge.endpoints = endpoints;
        }
      }
    }
    graph.meta = activeMeta;
  } else if (mode === 'stateless') {
    const arranged = autoLayout(graph.nodes, graph.edges, { direction: 'top-to-bottom' });
    graph.nodes = arranged;
    graph.meta = undefined;
  }

  return graph;
}
