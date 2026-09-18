import type { GraphNode } from '../model/graphTypes';
import type { NodeContentPayload } from '../model/contentPayloads';
import { insertTaskAfterLastTask, taskFenceMask } from '../nodes/TaskNode';
import { createDefaultTableMarkdown } from '../nodes/TableNode';
export { createTaskMarkdown, deleteTask, insertTaskAfterLastTask, toggleTask, updateTaskText } from '../nodes/TaskNode';
import { applyTextEdits, createNodeSection, updateNodeSection, type TextEdit } from './MarkdownGraphSerializer';

export function normalizeTag(name: string): string {
  return name.replace(/^#+/, '').trim().toLowerCase().replace(/\s+/g, '-');
}

export function encodeMarkdownPath(path: string): string {
  return path.split('/')
    .map((segment) => encodeURIComponent(segment)
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/'/g, '%27')
      .replace(/!/g, '%21')
      .replace(/\*/g, '%2A'))
    .join('/');
}

export function toWorkspaceRelativePath(docDir: string, targetPath: string): string | null {
  const base = docDir.replace(/\\/g, '/').replace(/\/+$/, '').split('/');
  const target = targetPath.replace(/\\/g, '/').replace(/\/+$/, '').split('/');
  let common = 0;
  while (common < base.length && common < target.length - 1 && base[common] === target[common]) common += 1;
  if (common === 0 && base[0] !== target[0]) return null;
  const relative = [...Array.from({ length: base.length - common }, () => '..'), ...target.slice(common)].join('/');
  return encodeMarkdownPath(relative.startsWith('.') ? relative : `./${relative}`);
}

export function createImageMarkdown(alt: string, src: string): string {
  return `![${alt.replace(/[[\]]/g, '')}](${src})`;
}

export function createLinkMarkdown(label: string, href: string): string {
  const encodedHref = href.replace(/[()]/g, (char) => (char === '(' ? '%28' : '%29'));
  return `[${label.replace(/[[\]]/g, '')}](${encodedHref})`;
}

export function createQuoteMarkdown(text: string): string {
  return text.split(/\r?\n/).map((line) => `> ${line}`.trimEnd()).join('\n');
}

export function createListItemMarkdown(text: string): string {
  return `- ${text.replace(/\r?\n/g, ' ').trim()}`;
}

export function createCodeBlock(language: string, code: string): string {
  const markerLength = Math.max(3, longestBacktickRun(code) + 1);
  const marker = '`'.repeat(markerLength);
  return `${marker}${language}\n${code.replace(/\s+$/, '')}\n${marker}`;
}

function longestBacktickRun(code: string): number {
  return (code.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
}

export function hasTag(content: string, tag: string): boolean {
  if (!tag) return false;
  const pattern = new RegExp(`(^|\\s)#${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
  return pattern.test(stripFencedLines(content));
}

export function appendContentBlock(content: string, payload: NodeContentPayload): string {
  if (payload.kind === 'task') return insertTaskAfterLastTask(content, payload.text.trim());
  if (payload.kind === 'tag') {
    const tag = normalizeTag(payload.name);
    if (!tag || hasTag(content, tag)) return content;
    return content ? `${content.trimEnd()}\n\n#${tag}` : `#${tag}`;
  }
  const block = renderBlock(payload);
  return content ? `${content.trimEnd()}\n\n${block}` : block;
}

function renderBlock(payload: NodeContentPayload): string {
  switch (payload.kind) {
    case 'image': return createImageMarkdown(payload.alt, payload.src);
    case 'link': return createLinkMarkdown(payload.label, payload.href);
    case 'list': return createListItemMarkdown(payload.text);
    case 'code': return createCodeBlock(payload.language, payload.code);
    case 'quote': return createQuoteMarkdown(payload.text);
    case 'table': return payload.markdown ?? createDefaultTableMarkdown(payload.cols ?? 3, payload.rows ?? 2);
    default: throw new Error(`Unsupported content kind: ${(payload as NodeContentPayload).kind}`);
  }
}

export function materializeGhostNode(text: string, node: GraphNode): string {
  const metaStart = text.search(/\n?<!--\s*canvas-meta\s*\n/);
  const position = metaStart === -1 ? text.length : metaStart;
  const section = createNodeSection({ ...node, collapsed: false, locked: false });
  return applyTextEdits(text, [{ start: position, end: position, text: `\n${section}` }]);
}

export function appendNodeContent(text: string, node: GraphNode, payload: NodeContentPayload): string | null {
  const nextContent = appendContentBlock(node.content, payload);
  if (nextContent === node.content) return null;
  if (node.ghost || !node.sourceRange) {
    return materializeGhostNode(text, { ...node, content: nextContent });
  }
  const edit = updateNodeSection(text, node, { ...node, content: nextContent });
  return applyTextEdits(text, [edit as TextEdit]);
}

function stripFencedLines(content: string): string {
  const lines = content.split(/(?<=\n)/);
  const fenced = taskFenceMask(lines);
  return lines.filter((_, index) => !fenced[index]).join('');
}
