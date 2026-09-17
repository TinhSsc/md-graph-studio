import type { CanvasMeta, GraphEdge, GraphNode, Port } from '../model/graphTypes';

export interface TextEdit { start: number; end: number; text: string; }

export function applyTextEdits(text: string, edits: TextEdit[]): string {
  return [...edits].sort((a, b) => b.start - a.start).reduce((current, edit) => current.slice(0, edit.start) + edit.text + current.slice(edit.end), text);
}

export function serializeNodeAttributes(node: Pick<GraphNode, 'shape' | 'color' | 'collapsed' | 'locked' | 'icon'>): string {
  const icon = typeof node.icon === 'string' && node.icon.trim() !== '' ? `; icon=${node.icon.trim()}` : '';
  return `<!-- graph-node: shape=${node.shape}; color=${node.color}; collapsed=${node.collapsed}; locked=${node.locked}${icon} -->`;
}

export function serializeEdge(target: string, edge: Pick<GraphEdge, 'label' | 'arrow' | 'line' | 'path' | 'color' | 'fromPort' | 'toPort'>): string {
  const link = edge.label ? `[[${target}|${edge.label}]]` : `[[${target}]]`;
  const isDefault =
    (edge.arrow ?? 'forward') === 'forward' &&
    (edge.line ?? 'solid') === 'solid' &&
    (edge.path ?? 'orthogonal') === 'orthogonal' &&
    !edge.color &&
    !edge.fromPort &&
    !edge.toPort;

  if (isDefault) {
    return `- ${link}`;
  }

  const attributes: string[] = [];
  if (edge.arrow && edge.arrow !== 'forward') attributes.push(`arrow=${edge.arrow}`);
  if (edge.line && edge.line !== 'solid') attributes.push(`line=${edge.line}`);
  if (edge.path && edge.path !== 'orthogonal') attributes.push(`path=${edge.path}`);
  if (edge.color) attributes.push(`color=${edge.color}`);
  if (edge.fromPort) attributes.push(`from=${edge.fromPort}`);
  if (edge.toPort) attributes.push(`to=${edge.toPort}`);
  return attributes.length > 0 ? `- ${link} <!-- graph-edge: ${attributes.join('; ')} -->` : `- ${link}`;
}

export function createNodeSection(node: Pick<GraphNode, 'title' | 'shape' | 'color' | 'collapsed' | 'locked' | 'content' | 'icon'> & { explicitId?: string }): string {
  const content = node.content.trimEnd();
  const heading = node.explicitId ? `## ${node.title} {#${node.explicitId}}` : `## ${node.title}`;
  return `${heading}\n${serializeNodeAttributes(node)}\n${content}${content ? '\n\n' : '\n'}`;
}

export function updateCanvasMeta(text: string, meta: CanvasMeta): TextEdit {
  const comment = `<!-- canvas-meta\n${JSON.stringify(meta)}\n-->`;
  const existing = /\n?<!--\s*canvas-meta\s*\n[\s\S]*?\n?-->\s*$/.exec(text);
  return existing
    ? { start: existing.index, end: existing.index + existing[0].length, text: `\n${comment}\n` }
    : { start: text.length, end: text.length, text: `${text.endsWith('\n') ? '\n' : '\n\n'}${comment}\n` };
}

export function updateNodeSection(text: string, node: GraphNode, changes: Pick<GraphNode, 'title' | 'content' | 'shape' | 'color' | 'collapsed' | 'locked' | 'icon'>): TextEdit {
  if (!node.sourceRange) throw new Error('Cannot update a ghost node.');
  const sectionText = text.slice(node.sourceRange.start, node.sourceRange.end);
  let inFence = false;
  const edgeLines: string[] = [];
  for (const line of sectionText.split(/(?<=\n)/)) {
    const isFence = /^\s*(```|~~~)/.test(line);
    if (!isFence && !inFence && /^\s*-\s*\[\[.+?\]\]/.test(line)) {
      edgeLines.push(line.trimEnd());
    }
    if (isFence) inFence = !inFence;
  }
  const edgesSuffix = edgeLines.length > 0 ? `\n\n${edgeLines.join('\n')}` : '';
  const bodyContent = changes.content.trim();
  const fullContent = bodyContent ? `${bodyContent}${edgesSuffix}` : edgesSuffix.trimStart();
  return { start: node.sourceRange.start, end: node.sourceRange.end, text: createNodeSection({ ...changes, explicitId: node.explicitId, content: fullContent }) };
}

export interface AppendEdgeOptions {
  label?: string;
  arrow?: GraphEdge['arrow'];
  line?: GraphEdge['line'];
  fromPort?: Port;
  toPort?: Port;
}

export function appendEdge(
  text: string,
  source: GraphNode,
  target: string,
  path: GraphEdge['path'] = 'orthogonal',
  options?: AppendEdgeOptions
): TextEdit {
  if (!source.sourceRange) throw new Error('Cannot connect a ghost node.');
  const insertPos = source.sourceRange.end;
  const edgeText = serializeEdge(target, {
    label: options?.label ?? '',
    arrow: options?.arrow ?? 'forward',
    line: options?.line ?? 'solid',
    path,
    fromPort: options?.fromPort,
    toPort: options?.toPort,
  });
  const prefix = text.slice(0, insertPos).endsWith('\n') ? '' : '\n';
  return {
    start: insertPos,
    end: insertPos,
    text: `${prefix}${edgeText}\n`,
  };
}

export function deleteRange(range: { start: number; end: number }): TextEdit {
  return { start: range.start, end: range.end, text: '' };
}

export function renameWikiLinkTargets(text: string, currentTitle: string, nextTitle: string): string {
  let inFence = false;
  return text.split(/(?<=\n)/).map((line) => {
    const isFence = /^\s*(```|~~~)/.test(line);
    if (isFence) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    return line.replace(/\[\[([^\]|#]+)(#[^\]|]*)?(\|[^\]]*)?\]\]/g, (match, target: string, anchor = '', label = '') => {
      return target.trim().replace(/\s+/g, ' ') === currentTitle
        ? `[[${nextTitle}${anchor}${label}]]`
        : match;
    });
  }).join('');
}
