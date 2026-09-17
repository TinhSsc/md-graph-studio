export const contentLimits = {
  alt: 200,
  label: 200,
  tag: 80,
  href: 2048,
  code: 20000,
  language: 40,
  text: 2000,
} as const;

export const nodeContentKinds = ['image', 'link', 'list', 'task', 'code', 'tag', 'quote'] as const;
export type NodeContentKind = (typeof nodeContentKinds)[number];

export type NodeContentPayload =
  | { kind: 'image'; alt: string; src: string }
  | { kind: 'link'; label: string; href: string }
  | { kind: 'list'; text: string }
  | { kind: 'task'; text: string }
  | { kind: 'code'; language: string; code: string }
  | { kind: 'tag'; name: string }
  | { kind: 'quote'; text: string };

export function isNodeContentPayload(value: unknown): value is NodeContentPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Record<string, unknown>;
  switch (payload.kind) {
    case 'image':
      return isBoundedString(payload.alt, contentLimits.alt, false)
        && isBoundedString(payload.src, contentLimits.href, true);
    case 'link':
      return isBoundedString(payload.label, contentLimits.label, false)
        && isBoundedString(payload.href, contentLimits.href, true);
    case 'list':
    case 'task':
    case 'quote':
      return isBoundedString(payload.text, contentLimits.text, true);
    case 'code':
      return isBoundedString(payload.language, contentLimits.language, false)
        && typeof payload.language === 'string' && !/\s/.test(payload.language)
        && isBoundedString(payload.code, contentLimits.code, false);
    case 'tag':
      return isBoundedString(payload.name, contentLimits.tag, true);
    default:
      return false;
  }
}

function isBoundedString(value: unknown, max: number, required: boolean): boolean {
  if (typeof value !== 'string') return false;
  if (required && value.trim().length === 0) return false;
  return value.length <= max;
}
