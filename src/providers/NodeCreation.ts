import type { CanvasMeta, GraphDocument, GraphNode } from '../model/graphTypes';
import { generateNodeId, nextAvailableNodeTitle } from '../model/nodeIdentity';
import { applyTextEdits, createNodeSection, updateCanvasMeta } from '../parser/MarkdownGraphSerializer';
import { makeMeta } from './documentEdits';
import { isFiniteNumber } from './ContentActionRules';

export interface CreateNodeOptions {
  shape: GraphNode['shape'];
  color: string;
  content: string;
  x?: number;
  y?: number;
  embedMeta?: boolean;
  explicitId?: string;
  generateExplicitId?: boolean;
}

export interface CreateNodeResult {
  text: string;
  title: string;
  nodeId: string;
  meta?: CanvasMeta;
}

// Tạo section node mới trong tài liệu markdown và cập nhật metadata nếu cần
export function createNodeDocument(text: string, graph: GraphDocument, options: CreateNodeOptions): CreateNodeResult {
  const title = nextAvailableNodeTitle(graph.nodes.map((node) => node.id));
  const explicitId = options.explicitId ?? (options.generateExplicitId ? generateNodeId(graph.nodes.map((n) => n.id)) : undefined);
  const nodeId = explicitId ?? title;
  const at = text.search(/\n?<!--\s*canvas-meta\s*\n/);
  const insertAt = at === -1 ? text.length : at;
  const prefix = at === -1 ? (text.endsWith('\n') ? '\n' : '\n\n') : '\n';
  const section = createNodeSection({ title, explicitId, shape: options.shape, color: options.color, collapsed: false, locked: false, content: options.content });
  let nextText = applyTextEdits(text, [{ start: insertAt, end: insertAt, text: prefix + section }]);
  let nextMeta: CanvasMeta | undefined = undefined;

  if (isFiniteNumber(options.x) && isFiniteNumber(options.y)) {
    nextMeta = makeMeta(graph.meta, [
      ...graph.nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, width: node.width, height: node.height })),
      { id: nodeId, x: Math.round(options.x!), y: Math.round(options.y!), width: 140, height: 50 },
    ]);
    if (options.embedMeta !== false) {
      const metaEdit = updateCanvasMeta(nextText, nextMeta);
      nextText = nextText.slice(0, metaEdit.start) + metaEdit.text + nextText.slice(metaEdit.end);
    }
  }
  return { text: nextText, title, nodeId, meta: nextMeta };
}
