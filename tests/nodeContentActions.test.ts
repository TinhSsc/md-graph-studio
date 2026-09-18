import { describe, expect, it } from 'vitest';
import { contentLimits, isNodeContentPayload } from '../src/model/contentPayloads';
import {
  appendContentBlock, appendNodeContent, createCodeBlock, createImageMarkdown, createLinkMarkdown,
  createListItemMarkdown,
  createQuoteMarkdown, deleteTask, hasTag, insertTaskAfterLastTask, materializeGhostNode, normalizeTag,
  toWorkspaceRelativePath, updateTaskText,
} from '../src/parser/NodeContentActions';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { canvasMarkdownFixture } from './fixtures/canvasMarkdownFixture';

describe('NodeContentActions payload contract', () => {
  it('accepts valid payloads of every kind', () => {
    expect(isNodeContentPayload({ kind: 'image', alt: 'Alt', src: './assets/a.png' })).toBe(true);
    expect(isNodeContentPayload({ kind: 'link', label: 'Docs', href: 'https://example.com' })).toBe(true);
    expect(isNodeContentPayload({ kind: 'list', text: 'Persistent records' })).toBe(true);
    expect(isNodeContentPayload({ kind: 'task', text: 'Do work' })).toBe(true);
    expect(isNodeContentPayload({ kind: 'code', language: 'ts', code: 'const a = 1;' })).toBe(true);
    expect(isNodeContentPayload({ kind: 'tag', name: 'research' })).toBe(true);
    expect(isNodeContentPayload({ kind: 'quote', text: 'Wise words' })).toBe(true);
  });

  it('rejects malformed payloads and oversized strings', () => {
    expect(isNodeContentPayload(null)).toBe(false);
    expect(isNodeContentPayload({ kind: 'unknown' })).toBe(false);
    expect(isNodeContentPayload({ kind: 'task', text: '' })).toBe(false);
    expect(isNodeContentPayload({ kind: 'task', text: 'a'.repeat(contentLimits.text + 1) })).toBe(false);
    expect(isNodeContentPayload({ kind: 'image', alt: 'a'.repeat(contentLimits.alt + 1), src: './a.png' })).toBe(false);
    expect(isNodeContentPayload({ kind: 'link', label: 'L', href: 'h'.repeat(contentLimits.href + 1) })).toBe(false);
    expect(isNodeContentPayload({ kind: 'tag', name: 't'.repeat(contentLimits.tag + 1) })).toBe(false);
    expect(isNodeContentPayload({ kind: 'code', language: 't'.repeat(contentLimits.language + 1), code: 'x' })).toBe(false);
    expect(isNodeContentPayload({ kind: 'code', language: 'two words', code: 'x' })).toBe(false);
    expect(isNodeContentPayload({ kind: 'code', language: 'ts', code: 'x'.repeat(contentLimits.code + 1) })).toBe(false);
  });
});

describe('NodeContentActions markdown builders', () => {
  it('creates image markdown with escaped alt brackets', () => {
    expect(createImageMarkdown('Shot [final]', './assets/a.png')).toBe('![Shot final](./assets/a.png)');
  });

  it('creates link markdown with encoded parentheses', () => {
    expect(createLinkMarkdown('Ref [1]', 'https://example.com/a_(b)')).toBe('[Ref 1](https://example.com/a_%28b%29)');
  });

  it('creates quote markdown with a prefix per line', () => {
    expect(createQuoteMarkdown('line one\nline two')).toBe('> line one\n> line two');
    expect(createQuoteMarkdown('single')).toBe('> single');
  });

  it('creates a single editable bullet item', () => {
    expect(createListItemMarkdown('Persistent records')).toBe('- Persistent records');
    expect(createListItemMarkdown('one\ntwo')).toBe('- one two');
  });

  it('creates code fences that never collide with embedded markers', () => {
    expect(createCodeBlock('ts', 'const a = 1;')).toBe('```ts\nconst a = 1;\n```');
    expect(createCodeBlock('text', 'inline ``` fence\nmore')).toBe('````text\ninline ``` fence\nmore\n````');
    expect(createCodeBlock('text', 'five ````` backticks')).toBe('``````text\nfive ````` backticks\n``````');
  });

  it('normalizes tags to lowercase hyphenated names', () => {
    expect(normalizeTag('#My Tag')).toBe('my-tag');
    expect(normalizeTag('  Already Fine  ')).toBe('already-fine');
    expect(normalizeTag('##double')).toBe('double');
    expect(normalizeTag('###')).toBe('');
  });

  it('detects tags outside code fences only', () => {
    expect(hasTag('notes #research done', 'research')).toBe(true);
    expect(hasTag('notes #research', 'search')).toBe(false);
    expect(hasTag('```\n#research\n```', 'research')).toBe(false);
    expect(hasTag('any text', '')).toBe(false);
  });

  it('builds relative markdown paths with slashes and encoding', () => {
    expect(toWorkspaceRelativePath('D:/ws/docs', 'D:/ws/docs/assets/my file.png')).toBe('./assets/my%20file.png');
    expect(toWorkspaceRelativePath('D:/ws/docs', 'D:/ws/assets/uni-đại(1).png')).toBe('../assets/uni-%C4%91%E1%BA%A1i%281%29.png');
    expect(toWorkspaceRelativePath('D:/ws/docs', 'C:/other/img.png')).toBe(null);
    expect(toWorkspaceRelativePath('/home/user/ws', '/home/user/ws/img.png')).toBe('./img.png');
  });
});

describe('insertTaskAfterLastTask', () => {
  it('appends after the last task keeping its indentation', () => {
    const content = 'Intro\n\n- [ ] first\n- [x] second\n';
    expect(insertTaskAfterLastTask(content, 'third')).toBe('Intro\n\n- [ ] first\n- [x] second\n- [ ] third\n');
  });

  it('keeps nested indentation when the last task is nested', () => {
    const content = '- [ ] outer\n  - [ ] inner';
    expect(insertTaskAfterLastTask(content, 'more')).toBe('- [ ] outer\n  - [ ] inner\n  - [ ] more\n');
  });

  it('falls back to a blank-line separated block when no task exists', () => {
    expect(insertTaskAfterLastTask('Body text', 'first')).toBe('Body text\n\n- [ ] first');
    expect(insertTaskAfterLastTask('', 'first')).toBe('- [ ] first');
  });

  it('ignores task syntax inside code fences', () => {
    const content = '```\n- [ ] fake\n```\n\n- [ ] real';
    expect(insertTaskAfterLastTask(content, 'next')).toContain('- [ ] real\n- [ ] next');
    expect(insertTaskAfterLastTask(content, 'next')).not.toContain('fake\n- [ ] next');
  });

  it('inserts before trailing content that follows the task run', () => {
    const content = '- [ ] only task\n\nTrailing paragraph';
    expect(insertTaskAfterLastTask(content, 'two')).toBe('- [ ] only task\n- [ ] two\n\nTrailing paragraph');
  });
});

describe('appendContentBlock', () => {
  it('separates new blocks from existing content with a blank line', () => {
    expect(appendContentBlock('Body', { kind: 'quote', text: 'quoted' })).toBe('Body\n\n> quoted');
    expect(appendContentBlock('Body', { kind: 'image', alt: 'A', src: './a.png' })).toBe('Body\n\n![A](./a.png)');
    expect(appendContentBlock('Body', { kind: 'link', label: 'L', href: 'https://a.dev' })).toBe('Body\n\n[L](https://a.dev)');
    expect(appendContentBlock('Body', { kind: 'list', text: 'New item' })).toBe('Body\n\n- New item');
    expect(appendContentBlock('Body', { kind: 'code', language: 'js', code: 'let b;' })).toBe('Body\n\n```js\nlet b;\n```');
    expect(appendContentBlock('', { kind: 'quote', text: 'solo' })).toBe('> solo');
  });

  it('adds tags once and reports duplicates by returning unchanged content', () => {
    expect(appendContentBlock('Notes', { kind: 'tag', name: '#Plan B' })).toBe('Notes\n\n#plan-b');
    expect(appendContentBlock('Notes #plan-b more', { kind: 'tag', name: 'Plan B' })).toBe('Notes #plan-b more');
    expect(appendContentBlock('Notes', { kind: 'tag', name: '###' })).toBe('Notes');
  });

  it('routes task payloads through the task run inserter', () => {
    expect(appendContentBlock('- [ ] one', { kind: 'task', text: 'two' })).toBe('- [ ] one\n- [ ] two\n');
  });
});

describe('appendNodeContent', () => {
  it('updates a real node body while preserving the edge suffix and canvas-meta', () => {
    const graph = parseMarkdownGraph(canvasMarkdownFixture);
    const research = graph.nodes.find((node) => node.id === 'Research')!;
    const updated = appendNodeContent(canvasMarkdownFixture, research, { kind: 'quote', text: 'New insight' })!;

    expect(updated).toContain('> New insight');
    expect(updated).toContain('"Research":{"x":20,"y":40,"width":240,"height":160}');
    expect(parseMarkdownGraph(updated).edges.filter((edge) => edge.source === 'Research')).toHaveLength(3);
  });

  it('returns null when a tag already exists so no edit is applied', () => {
    const graph = parseMarkdownGraph(canvasMarkdownFixture);
    const research = graph.nodes.find((node) => node.id === 'Research')!;
    expect(appendNodeContent(canvasMarkdownFixture, research, { kind: 'tag', name: 'research' })).toBe(null);
  });

  it('materializes a ghost node with the new content inline', () => {
    const graph = parseMarkdownGraph(canvasMarkdownFixture);
    const publishing = graph.nodes.find((node) => node.id === 'Publishing')!;
    const updated = appendNodeContent(canvasMarkdownFixture, publishing, { kind: 'task', text: 'Ship it' })!;

    const nextGraph = parseMarkdownGraph(updated);
    const section = nextGraph.nodes.find((node) => node.id === 'Publishing')!;
    expect(section.ghost).toBe(false);
    expect(section.content).toBe('- [ ] Ship it');
    expect(updated.indexOf('## Publishing')).toBeGreaterThan(updated.indexOf('## Review'));
    expect(updated).toContain('"Research":{"x":20,"y":40,"width":240,"height":160}');
  });

  it('materializeGhostNode keeps node attributes but resets transient flags', () => {
    const graph = parseMarkdownGraph(canvasMarkdownFixture);
    const publishing = graph.nodes.find((node) => node.id === 'Publishing')!;
    const updated = materializeGhostNode(canvasMarkdownFixture, { ...publishing, shape: 'rectangle', color: 'red' });
    const section = updated.slice(updated.indexOf('## Publishing'));
    expect(section).toContain('<!-- graph-node: shape=rectangle; color=red; collapsed=false; locked=false -->');
  });

  it('deletes a task at specified index without altering other content', () => {
    const initial = 'Intro paragraph\n\n- [ ] Task 1\n- [x] Task 2\n- [ ] Task 3\n\nOutro text';
    const deletedMiddle = deleteTask(initial, 1);
    expect(deletedMiddle).toBe('Intro paragraph\n\n- [ ] Task 1\n- [ ] Task 3\n\nOutro text');

    const deletedFirst = deleteTask(initial, 0);
    expect(deletedFirst).toBe('Intro paragraph\n\n- [x] Task 2\n- [ ] Task 3\n\nOutro text');
  });

  it('updates task text at specified index without touching checklist state or other lines', () => {
    const initial = 'Intro\n- [ ] Task 1\n- [x] Task 2\n- [ ] Task 3';
    const updated = updateTaskText(initial, 1, 'Updated Task 2 Text');
    expect(updated).toBe('Intro\n- [ ] Task 1\n- [x] Updated Task 2 Text\n- [ ] Task 3');
  });
});
