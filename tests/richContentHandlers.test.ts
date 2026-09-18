import { describe, expect, it } from 'vitest';
import { isPathWithinRoots, resolveLinkTarget, validateImageSrc, imageAltFromFileName, buildRichNodeContent } from '../src/providers/ContentActionRules';
import { handleAppendNodeContent, handleCreateRichNode, handleRequestPickImage, type HostEnv } from '../src/providers/RichContentHandlers';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { canvasMarkdownFixture } from './fixtures/canvasMarkdownFixture';

const docDir = 'D:/ws/docs';

function makeEnv(overrides: Partial<HostEnv> = {}): HostEnv & { applied: boolean; replies: unknown[] } {
  const state = { applied: false, replies: [] as unknown[] };
  const env = {
    get applied() { return state.applied; },
    replies: state.replies,
    documentText: () => canvasMarkdownFixture,
    docDirPath: () => docDir,
    workspaceRoots: () => ['D:/ws'],
    pickImageFile: async () => 'D:/ws/docs/assets/pick.png',
    graphForText: (text: string) => parseMarkdownGraph(text),
    embedMetadata: () => true,
    applyEdit: async (build: (currentText: string) => { text: string } | null) => {
      state.applied = true;
      return build(canvasMarkdownFixture);
    },
    reply: (message: unknown) => { state.replies.push(message); },
  };
  return Object.assign(env, overrides) as HostEnv & { applied: boolean; replies: unknown[] };
}

function lastReply(env: ReturnType<typeof makeEnv>): Record<string, unknown> {
  return env.replies[env.replies.length - 1] as Record<string, unknown>;
}

describe('ContentActionRules safety', () => {
  it('accepts web URLs and rejects dangerous schemes for image sources', () => {
    expect(validateImageSrc('https://example.com/a.png')).toBe('web');
    expect(validateImageSrc('http://example.com/a.png')).toBe('web');
    expect(validateImageSrc('javascript:alert(1)')).toBe(null);
    expect(validateImageSrc('data:image/png;base64,AAAA')).toBe(null);
    expect(validateImageSrc('file:///C:/x.png')).toBe(null);
    expect(validateImageSrc('./assets/local.png')).toBe('local');
    expect(validateImageSrc('   ')).toBe(null);
    expect(validateImageSrc('has space.png')).toBe(null);
  });

  it('resolves links only inside workspace roots and blocks traversal', () => {
    expect(resolveLinkTarget('https://example.com', docDir, ['D:/ws'])).toEqual({ kind: 'web', url: 'https://example.com' });
    expect(resolveLinkTarget('./notes/a.md', docDir, ['D:/ws'])?.kind).toBe('local');
    expect(resolveLinkTarget('../outside/secret.md', docDir, ['D:/ws'])?.kind).toBe('local');
    expect(resolveLinkTarget('../../outside/secret.md', docDir, ['D:/ws'])).toBe(null);
    expect(resolveLinkTarget('javascript:void(0)', docDir, ['D:/ws'])).toBe(null);
    expect(resolveLinkTarget('', docDir, ['D:/ws'])).toBe(null);
    expect(resolveLinkTarget('a%20b.md', docDir, ['D:/ws'])?.kind).toBe('local');
    expect(resolveLinkTarget('a%2.md', docDir, ['D:/ws'])).toBe(null);
  });

  it('checks path containment and derives alt text from file names', () => {
    expect(isPathWithinRoots('D:/ws/docs/a.png', ['D:/ws'])).toBe(true);
    expect(isPathWithinRoots('D:/other/a.png', ['D:/ws'])).toBe(false);
    expect(isPathWithinRoots('D:/ws-evi/a.png', ['D:/ws'])).toBe(false);
    expect(imageAltFromFileName('D:/ws/docs/my shot (1).png')).toBe('my shot (1)');
  });

  it('builds rich node content per kind and rejects image nodes without payload', () => {
    expect(buildRichNodeContent('empty', undefined)).toBe('Describe this node.');
    expect(buildRichNodeContent('checklist', undefined)).toBe('- [ ] First task');
    expect(buildRichNodeContent('code', undefined)).toContain('```text');
    expect(buildRichNodeContent('image', undefined)).toBe(null);
    expect(buildRichNodeContent('image', { kind: 'image', alt: 'A', src: 'javascript:x' })).toBe(null);
    expect(buildRichNodeContent('image', { kind: 'image', alt: 'A', src: './a.png' })).toBe('![A](./a.png)');
  });
});

describe('handleAppendNodeContent', () => {
  it('appends a quote to a real node and confirms success', async () => {
    const env = makeEnv();
    await handleAppendNodeContent(env, { editId: 'r1', id: 'Research', payload: { kind: 'quote', text: 'Insight' } });
    expect(env.applied).toBe(true);
    expect(lastReply(env)).toMatchObject({ type: 'actionResult', requestId: 'r1', ok: true });
  });

  it('rejects malformed payloads without applying any edit', async () => {
    const env = makeEnv();
    await handleAppendNodeContent(env, { editId: 'r2', id: 'Research', payload: { kind: 'hacker' } });
    expect(env.applied).toBe(false);
    expect(lastReply(env)).toMatchObject({ ok: false, error: 'Invalid content request.' });
  });

  it('rejects locked nodes and missing nodes', async () => {
    const env = makeEnv();
    await handleAppendNodeContent(env, { editId: 'r3', id: 'Writing', payload: { kind: 'task', text: 'X' } });
    expect(env.applied).toBe(false);
    expect(lastReply(env)).toMatchObject({ ok: false, error: 'Node is locked.' });

    const missing = makeEnv();
    await handleAppendNodeContent(missing, { editId: 'r4', id: 'Nope', payload: { kind: 'task', text: 'X' } });
    expect(missing.applied).toBe(false);
    expect(lastReply(missing)).toMatchObject({ ok: false, error: 'Node no longer exists.' });
  });

  it('reports duplicate tags without applying an edit', async () => {
    const env = makeEnv();
    await handleAppendNodeContent(env, { editId: 'r5', id: 'Research', payload: { kind: 'tag', name: 'research' } });
    expect(env.applied).toBe(false);
    expect(lastReply(env)).toMatchObject({ ok: false, error: 'Tag already exists on this node.' });
  });

  it('materializes a ghost node through the append flow', async () => {
    const env = makeEnv();
    await handleAppendNodeContent(env, { editId: 'r6', id: 'Publishing', payload: { kind: 'task', text: 'Ship' } });
    expect(env.applied).toBe(true);
    expect(lastReply(env)).toMatchObject({ ok: true });
  });

  it('surfaces an error when the queued edit no longer applies', async () => {
    const env = makeEnv({ applyEdit: async () => null });
    await handleAppendNodeContent(env, { editId: 'r7', id: 'Research', payload: { kind: 'quote', text: 'Gone' } });
    expect(lastReply(env)).toMatchObject({ ok: false, error: 'Could not update the node.' });
  });
});

describe('handleRequestPickImage', () => {
  it('rejects local image flow when no workspace is open', async () => {
    const env = makeEnv({ workspaceRoots: () => [] });
    await handleRequestPickImage(env, { editId: 'p1', id: 'Research' });
    expect(env.applied).toBe(false);
    expect(lastReply(env)).toMatchObject({ ok: false, error: 'Open a workspace folder to insert local images.' });
  });

  it('reports cancel silently without applying an edit', async () => {
    const env = makeEnv({ pickImageFile: async () => undefined });
    await handleRequestPickImage(env, { editId: 'p2', id: 'Research' });
    expect(env.applied).toBe(false);
    expect(lastReply(env)).toMatchObject({ type: 'actionResult', requestId: 'p2', ok: false, cancelled: true });
  });

  it('rejects picks outside the workspace', async () => {
    const env = makeEnv({ pickImageFile: async () => 'C:/elsewhere/photo.png' });
    await handleRequestPickImage(env, { editId: 'p3', id: 'Research' });
    expect(env.applied).toBe(false);
    expect(lastReply(env)).toMatchObject({ ok: false, error: 'Image must be inside the current workspace.' });
  });

  it('appends image markdown with derived alt to the target node', async () => {
    const env = makeEnv({ pickImageFile: async () => 'D:/ws/docs/assets/diagram v2.png' });
    await handleRequestPickImage(env, { editId: 'p4', id: 'Research' });
    expect(env.applied).toBe(true);
    expect(env.replies[0]).toMatchObject({ type: 'imagePicked', requestId: 'p4' });
    expect(lastReply(env)).toMatchObject({ ok: true });
  });

  it('creates an image node when no target id is given', async () => {
    const env = makeEnv();
    await handleRequestPickImage(env, { editId: 'p5', x: 10, y: 20 });
    expect(env.applied).toBe(true);
    expect(lastReply(env)).toMatchObject({ ok: true });
  });
});

describe('handleCreateRichNode', () => {
  it('creates checklist and code nodes at the given position', async () => {
    const env = makeEnv();
    await handleCreateRichNode(env, { editId: 'c1', kind: 'checklist', x: 5, y: 6 });
    expect(env.applied).toBe(true);
    expect(lastReply(env)).toMatchObject({ type: 'actionResult', requestId: 'c1', ok: true });
  });

  it('rejects unknown kinds and invalid image payloads', async () => {
    const env = makeEnv();
    await handleCreateRichNode(env, { editId: 'c2', kind: 'wat' });
    expect(env.applied).toBe(false);
    expect(lastReply(env)).toMatchObject({ ok: false, error: 'Invalid node request.' });

    const image = makeEnv();
    await handleCreateRichNode(image, { editId: 'c3', kind: 'image' });
    expect(image.applied).toBe(false);
    expect(lastReply(image)).toMatchObject({ ok: false, error: 'Provide a valid image source first.' });
  });

  it('rejects malformed payload objects', async () => {
    const env = makeEnv();
    await handleCreateRichNode(env, { editId: 'c4', kind: 'image', payload: { kind: 'image', src: '' } });
    expect(env.applied).toBe(false);
    expect(lastReply(env)).toMatchObject({ ok: false, error: 'Invalid content request.' });
  });
});

describe('node lookups in handlers', () => {
  it('finds nodes through the shared parser', () => {
    const graph = parseMarkdownGraph(canvasMarkdownFixture);
    expect(graph.nodes.find((node) => node.id === 'Writing')?.locked).toBe(true);
  });
});
