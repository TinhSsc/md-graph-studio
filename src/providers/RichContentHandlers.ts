import { contentLimits, isNodeContentPayload } from '../model/contentPayloads';
import type { CanvasMeta, GraphDocument, GraphNode } from '../model/graphTypes';
import { parseMarkdownGraph } from '../parser/MarkdownGraphParser';
import { appendNodeContent, createImageMarkdown, hasTag, normalizeTag, toWorkspaceRelativePath } from '../parser/NodeContentActions';
import { buildRichNodeContent, imageAltFromFileName, isFiniteNumber, isPathWithinRoots, richNodeKinds, type RichNodeKind } from './ContentActionRules';
import { createNodeDocument } from './NodeCreation';

export interface EditOutcome {
  text: string;
  nodeId?: string;
  meta?: CanvasMeta;
}

export interface HostEnv {
  documentText(): string;
  docDirPath(): string;
  workspaceRoots(): string[];
  pickImageFile(): Promise<string | undefined>;
  applyEdit(build: (currentText: string) => EditOutcome | null): Promise<EditOutcome | null>;
  graphForText(text: string): GraphDocument;
  embedMetadata(): boolean;
  reply(message: unknown): void;
}

export async function handleAppendNodeContent(env: HostEnv, value: Record<string, unknown>): Promise<void> {
  const requestId = requestIdOf(value);
  if (typeof value.id !== 'string' || !isNodeContentPayload(value.payload)) {
    replyError(env, requestId, 'Invalid content request.');
    return;
  }
  const payload = value.payload;
  const targetId: string = value.id;
  const node = findNode(env.documentText(), targetId);
  if (!node) {
    replyError(env, requestId, 'Node no longer exists.');
    return;
  }
  if (node.locked) {
    replyError(env, requestId, 'Node is locked.');
    return;
  }
  if (payload.kind === 'tag' && hasTag(node.content, normalizeTag(payload.name))) {
    replyError(env, requestId, 'Tag already exists on this node.');
    return;
  }

  const outcome = await env.applyEdit((current) => {
    const currentGraph = parseMarkdownGraph(current);
    const currentNode = currentGraph.nodes.find((item) => item.id === targetId);
    if (!currentNode || currentNode.locked) return null;
    const nextText = appendNodeContent(current, currentNode, payload);
    return nextText === null ? null : { text: nextText };
  });
  if (!outcome) {
    replyError(env, requestId, 'Could not update the node.');
    return;
  }
  env.reply({ type: 'actionResult', requestId, ok: true });
}

export async function handleRequestPickImage(env: HostEnv, value: Record<string, unknown>): Promise<void> {
  const requestId = requestIdOf(value);
  const targetId = typeof value.id === 'string' ? value.id : undefined;
  const alt = boundedString(value.alt, contentLimits.alt);

  if (targetId) {
    const node = findNode(env.documentText(), targetId);
    if (!node) {
      replyError(env, requestId, 'Node no longer exists.');
      return;
    }
    if (node.locked) {
      replyError(env, requestId, 'Node is locked.');
      return;
    }
  }
  const roots = env.workspaceRoots();
  if (roots.length === 0) {
    replyError(env, requestId, 'Open a workspace folder to insert local images.');
    return;
  }

  const picked = await env.pickImageFile();
  if (!picked) {
    env.reply({ type: 'actionResult', requestId, ok: false, cancelled: true });
    return;
  }
  if (!isPathWithinRoots(picked, roots)) {
    replyError(env, requestId, 'Image must be inside the current workspace.');
    return;
  }
  const relative = toWorkspaceRelativePath(env.docDirPath(), picked);
  if (!relative) {
    replyError(env, requestId, 'Could not build a relative image path.');
    return;
  }
  const markdown = createImageMarkdown(alt || imageAltFromFileName(picked), relative);
  const position = finitePoint(value.x, value.y);

  const outcome = await env.applyEdit((current) => {
    if (!targetId) {
      const created = createNodeDocument(current, env.graphForText(current), {
        shape: 'rounded-rectangle', color: 'blue', content: markdown, x: position?.x, y: position?.y,
        embedMeta: env.embedMetadata(),
        generateExplicitId: true,
      });
      return { text: created.text, nodeId: created.nodeId, meta: created.meta };
    }
    const currentNode = findNode(current, targetId);
    if (!currentNode || currentNode.locked) return null;
    const nextText = appendNodeContent(current, currentNode, { kind: 'image', alt: alt || imageAltFromFileName(picked), src: relative });
    return nextText === null ? null : { text: nextText };
  });

  if (!outcome) {
    replyError(env, requestId, 'Could not insert the image.');
    return;
  }
  env.reply({ type: 'imagePicked', requestId, markdown });
  env.reply({ type: 'actionResult', requestId, ok: true, nodeId: outcome.nodeId });
}

export async function handleCreateRichNode(env: HostEnv, value: Record<string, unknown>): Promise<void> {
  const requestId = requestIdOf(value);
  if (typeof value.kind !== 'string' || !richNodeKinds.includes(value.kind as RichNodeKind)) {
    replyError(env, requestId, 'Invalid node request.');
    return;
  }
  const kind = value.kind as RichNodeKind;
  const payload = value.payload === undefined ? undefined : value.payload;
  if (payload !== undefined && !isNodeContentPayload(payload)) {
    replyError(env, requestId, 'Invalid content request.');
    return;
  }
  const content = buildRichNodeContent(kind, payload);
  if (content === null) {
    replyError(env, requestId, 'Provide a valid image source first.');
    return;
  }
  const shape = typeof value.shape === 'string' ? value.shape : 'rounded-rectangle';
  const color = typeof value.color === 'string' ? value.color : 'blue';
  const position = finitePoint(value.x, value.y);

  const outcome = await env.applyEdit((current) => {
    const created = createNodeDocument(current, env.graphForText(current), {
      shape: shape as never, color, content, x: position?.x, y: position?.y,
      embedMeta: env.embedMetadata(),
      generateExplicitId: true,
    });
    return { text: created.text, nodeId: created.nodeId, meta: created.meta };
  });
  if (!outcome) {
    replyError(env, requestId, 'Could not create the node.');
    return;
  }
  env.reply({ type: 'actionResult', requestId, ok: true, nodeId: outcome.nodeId });
}

export function findNode(text: string, id: string): GraphNode | undefined {
  return parseMarkdownGraph(text).nodes.find((node) => node.id === id);
}

function replyError(env: HostEnv, requestId: unknown, error: string): void {
  env.reply({ type: 'actionResult', requestId: typeof requestId === 'string' ? requestId : undefined, ok: false, error });
}

function requestIdOf(value: Record<string, unknown>): string | undefined {
  return typeof value.editId === 'string' ? value.editId : undefined;
}

function boundedString(value: unknown, max: number): string | undefined {
  return typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : undefined;
}

function finitePoint(x: unknown, y: unknown): { x: number; y: number } | undefined {
  return isFiniteNumber(x) && isFiniteNumber(y) ? { x, y } : undefined;
}
