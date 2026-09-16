import {
  arrowTypes, type ArrowType, type CanvasMeta, type GraphDiagnostic, type GraphDocument,
  defaultNodeHeight, defaultNodeWidth, type GraphEdge, type GraphNode, lineStyles, nodeShapes, ports,
} from '../model/graphTypes';
import { uniqueNodeTitle } from '../model/nodeIdentity';

const nodeComment = /^<!--\s*graph-node:\s*(.*?)\s*-->\s*$/;
const edgeComment = /<!--\s*graph-edge:\s*(.*?)\s*-->/;
const wikiLink = /\[\[([^\]|#]+)(?:\|([^\]]*))?\]\]/g;
const canvasComment = /\n?<!--\s*canvas-meta\s*\n([\s\S]*?)\n?-->\s*$/;

type Attributes = Record<string, string>;

export function normalizeNodeId(title: string): string {
  return title.trim().replace(/\s+/g, ' ');
}

export function parseMarkdownGraph(text: string): GraphDocument {
  const diagnostics: GraphDiagnostic[] = [];
  const canvasMatch = canvasComment.exec(text);
  const body = canvasMatch ? text.slice(0, canvasMatch.index) : text;
  const meta = canvasMatch ? parseMeta(canvasMatch[1], diagnostics, canvasMatch.index) : undefined;
  const headings = scanHeadings(body);
  const preamble = headings.length === 0 ? body : body.slice(0, headings[0].start);
  const nodes: GraphNode[] = headings.map((heading, index) => {
    const end = headings[index + 1]?.start ?? body.length;
    const section = body.slice(heading.lineEnd, end);
    const { attributes, content } = parseNodeBody(section, heading.lineEnd, diagnostics);
    return {
      id: normalizeNodeId(heading.title), title: heading.title, content,
      shape: enumValue(attributes.shape, nodeShapes, 'rounded-rectangle', diagnostics, heading.start, 'shape'),
      color: attributes.color ?? 'gray',
      x: 0, y: 0, width: defaultNodeWidth, height: defaultNodeHeight,
      collapsed: booleanValue(attributes.collapsed, false, diagnostics, heading.start, 'collapsed'),
      locked: booleanValue(attributes.locked, false, diagnostics, heading.start, 'locked'),
      ghost: false, sourceRange: { start: heading.start, end },
    };
  });
  const titles = new Set<string>();
  for (const node of nodes) {
    if (titles.has(node.id)) {
      diagnostics.push({ message: `Duplicate node title: ${node.title}`, offset: node.sourceRange?.start });
      node.id = uniqueNodeTitle(node.id, '', titles);
      node.title = node.id;
    }
    titles.add(node.id);
  }
  const edges = nodes.flatMap((node) => parseEdges(node, body, diagnostics, meta?.edges));
  for (const edge of edges) {
    if (!titles.has(edge.target)) {
      nodes.push({ id: edge.target, title: edge.target, content: '', shape: 'rounded-rectangle', color: 'gray', x: 0, y: 0, width: defaultNodeWidth, height: defaultNodeHeight, collapsed: false, locked: false, ghost: true });
      titles.add(edge.target);
    }
  }
  hydrateMetadata(nodes, meta);
  if (meta) {
    const stableEdges = edges.filter((edge) => edge.endpoints).map((edge) => [edge.id, edge.endpoints!] as const);
    meta.edges = stableEdges.length ? Object.fromEntries(stableEdges) : undefined;
  }
  return { preamble, nodes, edges, meta, diagnostics };
}

function scanHeadings(text: string): Array<{ start: number; lineEnd: number; title: string }> {
  const found: Array<{ start: number; lineEnd: number; title: string }> = [];
  let inFence = false;
  let offset = 0;
  for (const line of text.split(/(?<=\n)/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (!inFence) {
      const match = /^##\s+(.+?)\s*\r?\n?$/.exec(line);
      if (match) found.push({ start: offset, lineEnd: offset + line.length, title: match[1] });
    }
    offset += line.length;
  }
  return found;
}

function parseNodeBody(section: string, offset: number, diagnostics: GraphDiagnostic[]): { attributes: Attributes; content: string } {
  const firstLineEnd = section.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? section : section.slice(0, firstLineEnd).replace(/\r$/, '');
  const match = nodeComment.exec(firstLine);
  const attributes = match ? parseAttributes(match[1], diagnostics, offset) : {};
  const rawBody = match ? section.slice(firstLineEnd === -1 ? section.length : firstLineEnd + 1) : section;

  let inFence = false;
  const cleanLines: string[] = [];
  for (const line of rawBody.split(/(?<=\n)/)) {
    const isFence = /^\s*(```|~~~)/.test(line);
    if (!isFence && !inFence && /^\s*-\s*\[\[.+?\]\]/.test(line)) {
      continue;
    }
    if (isFence) inFence = !inFence;
    cleanLines.push(line);
  }
  const content = cleanLines.join('').trim();
  return { attributes, content };
}

function parseEdges(node: GraphNode, text: string, diagnostics: GraphDiagnostic[], storedEdges: CanvasMeta['edges']): GraphEdge[] {
  if (!node.sourceRange) return [];
  const section = text.slice(node.sourceRange.start, node.sourceRange.end);
  const edges: GraphEdge[] = [];
  const targetOccurrences = new Map<string, number>();
  let lineOffset = node.sourceRange.start;
  let inFence = false;
  for (const line of section.split(/(?<=\n)/)) {
    const isFence = /^\s*(```|~~~)/.test(line);
    if (!isFence && !inFence) {
      const attributes = edgeComment.exec(line)?.[1];
      const attrs = attributes ? parseAttributes(attributes, diagnostics, lineOffset) : {};
      wikiLink.lastIndex = 0;
      for (let link = wikiLink.exec(line); link; link = wikiLink.exec(line)) {
        const target = normalizeNodeId(link[1]);
        if (!target) continue;
        const occurrence = targetOccurrences.get(target) ?? 0;
        targetOccurrences.set(target, occurrence + 1);
        const id = stableEdgeId(node.id, target, occurrence);
        const legacyId = `${node.id}:${lineOffset + link.index}`;
        edges.push({
          id, source: node.id, target, label: link[2]?.trim() ?? '',
          arrow: enumValue(attrs.arrow, arrowTypes, 'forward', diagnostics, lineOffset, 'arrow'),
          line: enumValue(attrs.line, lineStyles, 'solid', diagnostics, lineOffset, 'line'),
          path: 'orthogonal',
          color: attrs.color,
          fromPort: optionalEnum(attrs.from, ports, diagnostics, lineOffset, 'from'),
          toPort: optionalEnum(attrs.to, ports, diagnostics, lineOffset, 'to'),
          sourceRange: { start: lineOffset, end: lineOffset + line.length },
          endpoints: storedEdges?.[id] ?? storedEdges?.[legacyId],
        });
      }
    }
    if (isFence) inFence = !inFence;
    lineOffset += line.length;
  }
  return edges;
}

function stableEdgeId(source: string, target: string, occurrence: number): string {
  return `${encodeURIComponent(source)}>${encodeURIComponent(target)}#${occurrence}`;
}

function parseAttributes(value: string, diagnostics: GraphDiagnostic[], offset: number): Attributes {
  const result: Attributes = {};
  for (const part of value.split(';')) {
    const [key, ...rest] = part.split('=');
    if (!key?.trim() || rest.length === 0) { diagnostics.push({ message: `Invalid graph attribute: ${part.trim()}`, offset }); continue; }
    result[key.trim()] = rest.join('=').trim();
  }
  return result;
}

function enumValue<T extends readonly string[]>(value: string | undefined, allowed: T, fallback: T[number], diagnostics: GraphDiagnostic[], offset: number, name: string): T[number] {
  if (value === undefined) return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T[number];
  diagnostics.push({ message: `Invalid ${name}: ${value}`, offset });
  return fallback;
}

function optionalEnum<T extends readonly string[]>(value: string | undefined, allowed: T, diagnostics: GraphDiagnostic[], offset: number, name: string): T[number] | undefined {
  return value === undefined ? undefined : enumValue(value, allowed, allowed[0], diagnostics, offset, name);
}

function booleanValue(value: string | undefined, fallback: boolean, diagnostics: GraphDiagnostic[], offset: number, name: string): boolean {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  diagnostics.push({ message: `Invalid ${name}: ${value}`, offset });
  return fallback;
}

function parseMeta(source: string, diagnostics: GraphDiagnostic[], offset: number): CanvasMeta | undefined {
  try {
    const value = JSON.parse(source) as Partial<CanvasMeta>;
    if (value.version !== 1 || !value.nodes || !value.groups || !value.viewport) throw new Error('Missing required canvas-meta fields');
    return value as CanvasMeta;
  } catch (error) {
    diagnostics.push({ message: `Invalid canvas-meta: ${(error as Error).message}`, offset });
    return undefined;
  }
}

function hydrateMetadata(nodes: GraphNode[], meta: CanvasMeta | undefined): void {
  if (!meta) return;
  for (const node of nodes) {
    const position = meta.nodes[node.id];
    if (!position) continue;
    node.x = position.x;
    node.y = position.y;
    node.width = position.width ?? defaultNodeWidth;
    node.height = position.height ?? defaultNodeHeight;
  }
}
