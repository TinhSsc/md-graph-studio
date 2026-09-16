import type { CanvasEdgeEndpoints, CanvasMeta, CanvasNodeMeta, GraphNode, Viewport } from '../model/graphTypes';

export function createCanvasMeta(existing: CanvasMeta | undefined, rawNodes: unknown[], viewport?: Viewport): CanvasMeta {
  const nodes: CanvasMeta['nodes'] = { ...(existing?.nodes ?? {}) };
  for (const raw of rawNodes) {
    if (!isLayoutNode(raw)) continue;
    nodes[raw.id] = {
      ...nodes[raw.id],
      x: raw.x,
      y: raw.y,
      width: raw.width,
      height: raw.height,
      ...(typeof raw.layer === 'number' ? { layer: raw.layer } : {}),
    };
  }
  return nextRevision({
    version: 1,
    revision: existing?.revision,
    nodes,
    groups: existing?.groups ?? {},
    edges: cloneEdges(existing?.edges),
    viewport: viewport ?? existing?.viewport ?? { x: 0, y: 0, zoom: 1 },
  });
}

export function updateViewportState(existing: CanvasMeta | undefined, viewport: Viewport, fallbackNodes: unknown[] = []): CanvasMeta {
  const base = createCanvasMeta(existing, existing ? [] : fallbackNodes);
  return { ...base, viewport };
}

export function updateEdgeState(existing: CanvasMeta | undefined, edgeId: string, endpoints: CanvasEdgeEndpoints, fallbackNodes: unknown[] = []): CanvasMeta {
  const base = createCanvasMeta(existing, existing ? [] : fallbackNodes);
  return { ...base, edges: { ...(base.edges ?? {}), [edgeId]: cloneEndpoints(endpoints) } };
}

export function removeNodeState(existing: CanvasMeta, nodeId: string, remainingEdgeIds: ReadonlySet<string>): CanvasMeta {
  const nodes = { ...existing.nodes };
  delete nodes[nodeId];
  const groups = Object.fromEntries(Object.entries(existing.groups).map(([id, group]) => [
    id,
    { ...group, members: group.members.filter((member) => member !== nodeId) },
  ]));
  const edges = existing.edges
    ? Object.fromEntries(Object.entries(existing.edges).filter(([id]) => remainingEdgeIds.has(id)))
    : undefined;
  return nextRevision({ ...existing, nodes, groups, edges });
}

export function removeEdgeState(existing: CanvasMeta, edgeId: string): CanvasMeta {
  if (!existing.edges?.[edgeId]) return nextRevision(existing);
  const edges = { ...existing.edges };
  delete edges[edgeId];
  return nextRevision({ ...existing, edges });
}

export function renameNodeState(existing: CanvasMeta, currentId: string, nextId: string, edgeIds: ReadonlyMap<string, string>): CanvasMeta {
  const nodes = { ...existing.nodes };
  if (nodes[currentId]) nodes[nextId] = nodes[currentId];
  delete nodes[currentId];
  const groups = Object.fromEntries(Object.entries(existing.groups).map(([id, group]) => [
    id,
    { ...group, members: group.members.map((member) => member === currentId ? nextId : member) },
  ]));
  const edges = existing.edges ? Object.fromEntries(Object.entries(existing.edges).map(([id, endpoints]) => [
    edgeIds.get(id) ?? id,
    {
      source: renameEndpoint(endpoints.source, currentId, nextId),
      target: renameEndpoint(endpoints.target, currentId, nextId),
      ...(endpoints.guide ? { guide: { ...endpoints.guide } } : {}),
    },
  ])) : undefined;
  return nextRevision({ ...existing, nodes, groups, edges });
}

export function isViewport(value: unknown): value is Viewport {
  if (typeof value !== 'object' || value === null) return false;
  const viewport = value as Record<string, unknown>;
  return ['x', 'y', 'zoom'].every((key) => typeof viewport[key] === 'number' && Number.isFinite(viewport[key] as number))
    && (viewport.zoom as number) > 0;
}

function nextRevision(meta: CanvasMeta): CanvasMeta {
  return { ...meta, revision: (meta.revision ?? 0) + 1 };
}

function cloneEdges(edges: CanvasMeta['edges']): CanvasMeta['edges'] {
  if (!edges) return undefined;
  return Object.fromEntries(Object.entries(edges).map(([id, endpoints]) => [id, cloneEndpoints(endpoints)]));
}

function cloneEndpoints(endpoints: CanvasEdgeEndpoints): CanvasEdgeEndpoints {
  return {
    source: { ...endpoints.source },
    target: { ...endpoints.target },
    ...(endpoints.guide ? { guide: { ...endpoints.guide } } : {}),
  };
}

function renameEndpoint(endpoint: CanvasEdgeEndpoints['source'], currentId: string, nextId: string): CanvasEdgeEndpoints['source'] {
  return endpoint.kind === 'node' && endpoint.nodeId === currentId ? { ...endpoint, nodeId: nextId } : { ...endpoint };
}

type LayoutNode = Pick<GraphNode, 'id' | 'x' | 'y' | 'width' | 'height'> & Partial<Pick<CanvasNodeMeta, 'layer'>>;

function isLayoutNode(value: unknown): value is LayoutNode {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Record<string, unknown>;
  return typeof node.id === 'string'
    && ['x', 'y', 'width', 'height'].every((key) => typeof node[key] === 'number' && Number.isFinite(node[key] as number))
    && (node.layer === undefined || (typeof node.layer === 'number' && Number.isFinite(node.layer)));
}
