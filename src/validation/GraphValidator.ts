import {
  nodeColors, type CanvasMeta, type GraphDiagnostic,
  type GraphDocument, type GraphEdge, type GraphNode,
} from '../model/graphTypes';
import { nodeIconIds } from '../model/nodeIcons';

export const DIAGNOSTIC_CODES = {
  invalidColor: 'MGS-E-001',
  blankTitle: 'MGS-E-002',
  staleMetaKeys: 'MGS-W-002',
  unknownIcon: 'MGS-W-003',
  unresolvedWikiLink: 'MGS-I-001',
  selfLoopEdge: 'MGS-I-002',
  emptyDocument: 'MGS-I-003',
} as const;

/**
 * Pure validation pass on top of parser diagnostics. Never throws; the graph
 * may be partially built by hydration, so every field is guarded.
 * Returns ADDITIONAL diagnostics only (parser findings are not repeated).
 */
export function collectGraphDiagnostics(graph: GraphDocument, sourceText: string): GraphDiagnostic[] {
  const diagnostics: GraphDiagnostic[] = [];
  if (!graph || typeof graph !== 'object') return diagnostics;
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const maxOffset = typeof sourceText === 'string' ? sourceText.length : Number.MAX_SAFE_INTEGER;
  const clamp = (offset: number | undefined): number | undefined => {
    if (typeof offset !== 'number' || !Number.isFinite(offset)) return undefined;
    return Math.max(0, Math.min(Math.floor(offset), maxOffset));
  };

  collectNodeDiagnostics(nodes, clamp, diagnostics);
  collectEdgeDiagnostics(edges, clamp, diagnostics);
  collectStaleMetaDiagnostics(graph.meta, nodeIds(nodes), edgeIds(edges), diagnostics);
  if (nodes.length === 0) {
    diagnostics.push({
      message: 'This document has no graph nodes yet. Add "## Node Title" headings with [[Wiki-Link]] edges.',
      severity: 'info',
      code: DIAGNOSTIC_CODES.emptyDocument,
    });
  }
  return diagnostics;
}

function collectNodeDiagnostics(nodes: GraphNode[], clamp: (offset: number | undefined) => number | undefined, diagnostics: GraphDiagnostic[]): void {
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    if (typeof node.title === 'string' && node.title.trim() === '') {
      diagnostics.push({
        message: `Node "${node.id ?? '?'}" has a blank title.`,
        offset: clamp(node.sourceRange?.start),
        severity: 'error',
        code: DIAGNOSTIC_CODES.blankTitle,
      });
    }
    if (typeof node.color === 'string' && !(nodeColors as readonly string[]).includes(node.color)) {
      diagnostics.push({
        message: `Unknown node color: ${node.color} (allowed: ${nodeColors.join(', ')})`,
        offset: clamp(node.sourceRange?.start),
        severity: 'error',
        code: DIAGNOSTIC_CODES.invalidColor,
      });
    }
    if (node.ghost !== true && typeof node.icon === 'string' && node.icon !== '' && !nodeIconIds.includes(node.icon)) {
      diagnostics.push({
        message: `Unknown node icon "${node.icon}"`,
        offset: clamp(node.sourceRange?.start),
        severity: 'warning',
        code: DIAGNOSTIC_CODES.unknownIcon,
      });
    }
    if (node.ghost === true && typeof node.id === 'string') {
      diagnostics.push({
        message: `Unresolved wiki-link target "${node.id}" — shown as ghost node`,
        offset: clamp(node.sourceRange?.start),
        severity: 'info',
        code: DIAGNOSTIC_CODES.unresolvedWikiLink,
      });
    }
  }
}

function collectEdgeDiagnostics(edges: GraphEdge[], clamp: (offset: number | undefined) => number | undefined, diagnostics: GraphDiagnostic[]): void {
  for (const edge of edges) {
    if (!edge || typeof edge !== 'object') continue;
    if (edge.source === edge.target && typeof edge.source === 'string') {
      diagnostics.push({
        message: `Edge "${edge.id ?? '?'}" connects node "${edge.source}" to itself.`,
        offset: clamp(edge.sourceRange?.start),
        severity: 'info',
        code: DIAGNOSTIC_CODES.selfLoopEdge,
      });
    }
  }
}

function collectStaleMetaDiagnostics(meta: CanvasMeta | undefined, knownNodes: Set<string>, knownEdges: Set<string>, diagnostics: GraphDiagnostic[]): void {
  if (!meta || typeof meta !== 'object') return;
  const staleNodes = staleKeys(meta.nodes, knownNodes);
  const staleGroups = staleKeys(meta.groups, knownNodes);
  const staleEdges = meta.edges ? staleKeys(meta.edges, knownEdges) : [];
  if (staleNodes.length > 0) {
    diagnostics.push({
      message: `Stale canvas-meta node keys: ${formatStaleKeys(staleNodes)}`,
      severity: 'warning',
      code: DIAGNOSTIC_CODES.staleMetaKeys,
    });
  }
  if (staleGroups.length > 0) {
    diagnostics.push({
      message: `Stale canvas-meta group keys: ${formatStaleKeys(staleGroups)}`,
      severity: 'warning',
      code: DIAGNOSTIC_CODES.staleMetaKeys,
    });
  }
  if (staleEdges.length > 0) {
    diagnostics.push({
      message: `Stale canvas-meta edge keys: ${formatStaleKeys(staleEdges)}`,
      severity: 'warning',
      code: DIAGNOSTIC_CODES.staleMetaKeys,
    });
  }
}

function staleKeys(record: Record<string, unknown> | undefined, known: Set<string>): string[] {
  if (!record || typeof record !== 'object') return [];
  return Object.keys(record).filter((key) => !known.has(key));
}

function formatStaleKeys(keys: string[]): string {
  const shown = keys.slice(0, 3).map((key) => `"${key}"`).join(', ');
  return keys.length > 3 ? `${shown} (+${keys.length - 3} more)` : shown;
}

function nodeIds(nodes: GraphNode[]): Set<string> {
  return new Set(nodes.filter((node) => node && typeof node.id === 'string').map((node) => node.id as string));
}

function edgeIds(edges: GraphEdge[]): Set<string> {
  return new Set(edges.filter((edge) => edge && typeof edge.id === 'string').map((edge) => edge.id as string));
}
