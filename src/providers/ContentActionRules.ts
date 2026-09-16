import type { NodeContentPayload } from '../model/contentPayloads';
import { createCodeBlock, createImageMarkdown, createTaskMarkdown } from '../parser/NodeContentActions';

export const richNodeKinds = ['empty', 'checklist', 'code', 'image'] as const;
export type RichNodeKind = (typeof richNodeKinds)[number];

export const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] as const;

export type ImageSrcKind = 'web' | 'local';

export function validateImageSrc(src: string): ImageSrcKind | null {
  const value = src.trim();
  if (/^https?:\/\/\S+$/i.test(value)) return 'web';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;
  if (value && !/\s/.test(value)) return 'local';
  return null;
}

export function imageAltFromFileName(filePath: string): string {
  const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
  return fileName.replace(/\.[^.]+$/, '') || 'Image';
}

export type LinkTarget =
  | { kind: 'web'; url: string }
  | { kind: 'local'; absolutePath: string }
  | null;

export function resolveLinkTarget(href: string, docDir: string, rootDirs: string[]): LinkTarget {
  const value = href.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return { kind: 'web', url: value };
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  const absolute = normalizePosixPath(`${docDir}/${decoded}`);
  if (absolute.startsWith('..') || !isPathWithinRoots(absolute, rootDirs.length ? rootDirs : [docDir])) return null;
  return { kind: 'local', absolutePath: absolute };
}

export function isPathWithinRoots(absolutePath: string, rootDirs: string[]): boolean {
  const target = normalizePosixPath(absolutePath);
  return rootDirs.some((root) => {
    const normalizedRoot = normalizePosixPath(root);
    return target === normalizedRoot || target.startsWith(`${normalizedRoot}/`);
  });
}

export function normalizePosixPath(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/');
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') resolved.pop();
      else resolved.push('..');
      continue;
    }
    resolved.push(segment);
  }
  return resolved.join('/');
}

export function buildRichNodeContent(kind: RichNodeKind, payload: NodeContentPayload | undefined): string | null {
  switch (kind) {
    case 'empty':
      return 'Describe this node.';
    case 'checklist':
      return createTaskMarkdown('First task');
    case 'code':
      return createCodeBlock('text', '// Add code here');
    case 'image':
      return payload && payload.kind === 'image' && validateImageSrc(payload.src) ? createImageMarkdown(payload.alt, payload.src) : null;
    default:
      return null;
  }
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
