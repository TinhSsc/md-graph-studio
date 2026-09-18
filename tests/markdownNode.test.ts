import { describe, expect, it } from 'vitest';
import { updateMarkdownBlock } from '../src/nodes/MarkdownNode';

const content = [
  'First **paragraph**',
  '',
  '> Original quote',
  '',
  '- [ ] Keep task',
  '',
  '```typescript',
  'const value = 1;',
  '```',
  '',
  'Second paragraph',
].join('\n');

describe('MarkdownNode editable blocks', () => {
  it('updates one paragraph without changing task, quote, or code', () => {
    const updated = updateMarkdownBlock(content, 'paragraph', 1, 'Changed text');
    expect(updated).toContain('First **paragraph**');
    expect(updated).toContain('> Original quote');
    expect(updated).toContain('- [ ] Keep task');
    expect(updated).toContain('const value = 1;');
    expect(updated).toContain('Changed text');
  });

  it('updates quote text while preserving its marker', () => {
    expect(updateMarkdownBlock(content, 'quote', 0, 'Edited quote')).toContain('> Edited quote');
  });

  it('updates code language without changing code body', () => {
    const updated = updateMarkdownBlock(content, 'codeLanguage', 0, 'javascript');
    expect(updated).toContain('```javascript\nconst value = 1;\n```');
  });

  it('updates multiline code without changing language or surrounding content', () => {
    const updated = updateMarkdownBlock(content, 'code', 0, 'const value = 2;\nconsole.log(value);');
    expect(updated).toContain('```typescript\nconst value = 2;\nconsole.log(value);\n```');
    expect(updated).toContain('Second paragraph');
  });

  it('updates list items while preserving marker, number and indentation', () => {
    const list = '- First\n  * Nested\n1. Ordered\n- [ ] Keep task';
    expect(updateMarkdownBlock(list, 'listItem', 0, 'Changed')).toContain('- Changed');
    expect(updateMarkdownBlock(list, 'listItem', 1, 'Nested changed')).toContain('  * Nested changed');
    expect(updateMarkdownBlock(list, 'listItem', 2, 'Ordered changed')).toContain('1. Ordered changed');
    expect(updateMarkdownBlock(list, 'listItem', 2, 'Ordered changed')).toContain('- [ ] Keep task');
  });

  it('deletes a list item when its edited text is empty', () => {
    expect(updateMarkdownBlock('- Keep\n- Delete\n- Keep too', 'listItem', 1, '   ')).toBe('- Keep\n- Keep too');
  });
});
