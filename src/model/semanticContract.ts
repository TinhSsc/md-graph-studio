import type { GraphDiagnostic } from './graphTypes';

export interface SemanticVisualAnnotation {
  shape?: string;
  color?: string;
  arrow?: string;
  line?: string;
  path?: string;
}

export interface SemanticNode {
  id: string;
  title: string;
  content: string;
  visualAnnotations?: SemanticVisualAnnotation;
  domainAttributes?: Record<string, unknown>;
  sourceRange?: { start: number; end: number };
}

export interface SemanticEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  type?: string;
  visualAnnotations?: SemanticVisualAnnotation;
}

export interface SemanticGraphDocument {
  schemaVersion: 1;
  documentTitle?: string;
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  diagnostics: GraphDiagnostic[];
}

/**
 * Kiểm tra tính toàn vẹn của tài liệu đồ thị ngữ nghĩa theo schema v1.
 */
export function validateSemanticDocument(doc: unknown): doc is SemanticGraphDocument {
  if (typeof doc !== 'object' || doc === null) return false;
  const candidate = doc as Partial<SemanticGraphDocument>;
  if (candidate.schemaVersion !== 1) return false;
  if (!Array.isArray(candidate.nodes) || !Array.isArray(candidate.edges) || !Array.isArray(candidate.diagnostics)) return false;
  const ids = new Set<string>();
  for (const node of candidate.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id.trim() || typeof node.title !== 'string') return false;
    if (ids.has(node.id)) return false;
    ids.add(node.id);
  }
  for (const edge of candidate.edges) {
    if (!edge || typeof edge.id !== 'string' || typeof edge.sourceId !== 'string' || typeof edge.targetId !== 'string') return false;
  }
  return true;
}
