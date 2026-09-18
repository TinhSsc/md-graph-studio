import { describe, expect, it } from 'vitest';
import { getCanvasMarkdownRendererScript } from '../src/webview/canvasMarkdownRenderer';
import { getCanvasContentStyles } from '../src/webview/canvasContentStyles';

function createRenderer() {
  const fn = new Function('esc', 'graph', `
    ${getCanvasMarkdownRendererScript()}
    return renderMarkdownToHtml;
  `);
  const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return fn(esc, { resolvedImages: {} });
}

describe('canvas rich text: inline additions', () => {
  const render = createRenderer();

  it('renders ==text== as node-mark highlight span', () => {
    const output = render('Use ==highlight== now', 'node-1');
    expect(output).toContain('<span class="node-mark">highlight</span>');
  });

  it('keeps ==sequences literal inside inline code spans', () => {
    const output = render('Check `a == b == c` here', 'node-1');
    expect(output).toContain('<code class="inline-code">a == b == c</code>');
    expect(output).not.toContain('node-mark');
  });

  it('renders ^^text^^ as literal text after transform removal', () => {
    const output = render('Say ^^Big^^ now', 'node-1');
    expect(output).toContain('Say ^^Big^^ now');
    expect(output).not.toContain('node-upper');
  });

  it('keeps lone carets literal', () => {
    const output = render('a ^ b ^ c', 'node-1');
    expect(output).toContain('a ^ b ^ c');
  });

  it('renders %%text%% as literal text after transform removal', () => {
    const output = render('Keep %%Quiet%% here', 'node-1');
    expect(output).toContain('Keep %%Quiet%% here');
    expect(output).not.toContain('node-lower');
  });

  it('keeps doubled percent signs literal', () => {
    const output = render('Discount 50%% today only', 'node-1');
    expect(output).toContain('Discount 50%% today only');
  });

  it('renders __text__ as strong', () => {
    const output = render('This is __important__ ok', 'node-1');
    expect(output).toContain('<strong>important</strong>');
  });

  it('renders _text_ as em with surrounding word boundaries', () => {
    const output = render('a _soft_ b', 'node-1');
    expect(output).toContain('<em>soft</em>');
  });

  it('never applies underscore emphasis inside words', () => {
    const output = render('snake_case and var_name stay', 'node-1');
    expect(output).toContain('snake_case');
    expect(output).toContain('var_name');
    expect(output).not.toContain('<strong>');
    expect(output).not.toContain('<em>');
  });

  it('does not close underscore emphasis against a word character', () => {
    const output = render('a _b_c_d e', 'node-1');
    expect(output).not.toContain('<em>');
  });

  it('autolinks bare http(s) urls with external anchor markup', () => {
    const output = render('Visit https://example.com today', 'node-1');
    expect(output).toContain('class="node-link external-link"');
    expect(output).toContain('data-href="https://example.com"');
    expect(output).toContain('class="external-icon"');
  });

  it('does not autolink urls already rendered by [label](url) links', () => {
    const output = render('[Docs](https://example.com/docs) page', 'node-1');
    expect((output.match(/data-href=/g) || []).length).toBe(1);
    expect(output).toContain('href="https://example.com/docs"');
  });

  it('strips trailing punctuation out of autolinked urls', () => {
    const output = render('See https://example.com.', 'node-1');
    expect(output).toContain('data-href="https://example.com"');
    expect(output).not.toContain('https://example.com."');
  });

  it('autolinks urls wrapped in parentheses without eating the closing paren', () => {
    const output = render('Refer (https://example.com/x) done', 'node-1');
    expect(output).toContain('data-href="https://example.com/x"');
    expect(output).toContain('</a>)');
  });

  it('keeps bare urls literal inside inline code spans', () => {
    const output = render('Link `https://example.com` raw', 'node-1');
    expect(output).toContain('<code class="inline-code">https://example.com</code>');
    expect(output).not.toContain('node-link');
  });

  it('autolinks multiple urls on one line', () => {
    const output = render('https://a.com and https://b.com', 'node-1');
    expect((output.match(/data-href=/g) || []).length).toBe(2);
  });
});

describe('canvas rich text: existing inline behavior', () => {
  const render = createRenderer();

  it('still renders asterisk bold, italic and strikethrough', () => {
    const output = render('**bold** and *em* and ~~gone~~', 'node-1');
    expect(output).toContain('<strong>bold</strong>');
    expect(output).toContain('<em>em</em>');
    expect(output).toContain('<del>gone</del>');
  });

  it('still renders triple asterisk as bold italic', () => {
    const output = render('***both***', 'node-1');
    expect(output).toContain('<strong><em>both</em></strong>');
  });

  it('still decorates markdown links with external icon', () => {
    const output = render('[Site](https://example.com)', 'node-1');
    expect(output).toContain('class="node-link external-link"');
    expect(output).toContain('class="external-icon"');
  });
});

describe('canvas rich text: tables', () => {
  const render = createRenderer();

  it('renders well-formed tables with thead, tbody and column alignment', () => {
    const output = render('| Name | Value | Note |\n|:---|---:|:---:|\n| a | 1 | x |', 'node-1');
    expect(output).toContain('<div class="node-table-wrap"><table class="node-table"><thead><tr>');
    expect(output).toContain('<th style="text-align:left">Name</th>');
    expect(output).toContain('<th style="text-align:right">Value</th>');
    expect(output).toContain('<th style="text-align:center">Note</th>');
    expect(output).toContain('<tbody><tr><td style="text-align:left">a</td>');
    expect(output).toContain('</tbody></table></div>');
  });

  it('formats table cell content through the inline pipeline', () => {
    const output = render('| **Bold** | plain |\n|---|---|', 'node-1');
    expect(output).toContain('<th style="text-align:left"><strong>Bold</strong></th>');
  });

  it('falls back to paragraphs when the delimiter row is missing', () => {
    const output = render('| just | text |\n| more text', 'node-1');
    expect(output).not.toContain('node-table');
    expect(output).toContain('node-paragraph');
    expect(output).toContain('| just | text |');
  });

  it('keeps paragraph edit indexes host-aligned across table lines', () => {
    const output = render('Before\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nAfter', 'node-1');
    expect(output).toContain('data-edit-kind="paragraph" data-edit-index="0" data-raw="Before"');
    expect(output).toContain('data-edit-index="4" data-raw="After"');
  });
});

describe('canvas rich text: horizontal rule and h1', () => {
  const render = createRenderer();

  it('renders dashes, asterisks and underscores rules as node-hr', () => {
    expect(render('---', 'node-1')).toContain('<hr class="node-hr" />');
    expect(render('***', 'node-1')).toContain('<hr class="node-hr" />');
    expect(render('___', 'node-1')).toContain('<hr class="node-hr" />');
  });

  it('does not turn list or task lines into horizontal rules', () => {
    expect(render('- item', 'node-1')).not.toContain('node-hr');
    expect(render('- [ ] task', 'node-1')).not.toContain('node-hr');
    expect(render('**bold**', 'node-1')).not.toContain('node-hr');
  });

  it('keeps paragraph edit indexes host-aligned across hr lines', () => {
    const output = render('Before\n\n---\n\nAfter', 'node-1');
    expect(output).toContain('<hr class="node-hr" />');
    expect(output).toContain('data-edit-index="2" data-raw="After"');
  });

  it('renders single-hash headings as node-h1', () => {
    const output = render('# Big Title', 'node-1');
    expect(output).toContain('<div class="node-h1">Big Title</div>');
  });

  it('still renders tag syntax instead of h1 when no space follows the hash', () => {
    const output = render('#urgent and #later', 'node-1');
    expect(output).toContain('<span class="node-tag">#urgent</span>');
    expect(output).not.toContain('node-h1');
  });

  it('excludes h1 lines from the paragraph edit index like the host does', () => {
    const output = render('Before\n\n# Big\n\nAfter', 'node-1');
    expect(output).toContain('<div class="node-h1">Big</div>');
    expect(output).toContain('data-edit-index="1" data-raw="After"');
  });
});

describe('canvas rich text: nested lists', () => {
  const render = createRenderer();

  it('nests unordered list items one level deep', () => {
    const output = render('- a\n  - b', 'node-1');
    expect(output).toContain('<ul class="node-list"><li><span class="node-list-text"');
    expect(output).toContain('class="list-delete-btn"');
    expect(output).toContain('data-edit-kind="listItem" data-edit-index="1"');
  });

  it('clamps nesting at three levels', () => {
    const output = render('- a\n  - b\n    - c\n      - d', 'node-1');
    expect((output.match(/<ul class="node-list">/g) || []).length).toBe(3);
    expect(output).toContain('data-edit-index="2"');
    expect(output).toContain('data-edit-index="3"');
  });

  it('nests ordered lists inside unordered ones', () => {
    const output = render('* root\n  1. child', 'node-1');
    expect(output).toContain('<ol class="node-list"><li><span class="node-list-text"');
    expect(output).toContain('data-edit-index="1"');
  });

  it('keeps flat unordered and ordered list output identical to before', () => {
    expect(render('- a\n- b', 'node-1')).toContain('data-edit-kind="listItem" data-edit-index="1"');
    expect(render('1. one\n2. two', 'node-1')).toContain('data-edit-kind="listItem" data-edit-index="1"');
  });

  it('closes open lists before a task line and keeps task indexes stable', () => {
    const output = render('- a\n- [ ] todo', 'node-1');
    expect(output.indexOf('</ul>')).toBeLessThan(output.indexOf('node-task-item'));
    expect(output).toContain('data-task-index="0"');
  });

  it('closes every nesting level before a task line', () => {
    const output = render('- a\n  - b\n- [ ] todo', 'node-1');
    expect(output).toContain('</ul></li></ul><div class="node-task-item"');
    expect(output).toContain('data-task-index="0"');
  });
});

describe('canvas rich text: regression spot checks', () => {
  const render = createRenderer();

  it('still renders task runs with checkboxes, completion state and delete buttons', () => {
    const output = render('- [ ] First\n- [x] Done', 'node-1');
    expect(output).toContain('data-task-index="0"');
    expect(output).toContain('data-task-index="1"');
    expect(output).toContain('node-task-item completed');
    expect(output).toContain('task-delete-btn');
  });

  it('still renders headings and quotes with edit locators', () => {
    const output = render('### Head\n\n> Quote', 'node-1');
    expect(output).toContain('<div class="node-h3">Head</div>');
    expect(output).toContain('data-edit-kind="quote" data-edit-index="0"');
  });

  it('still renders code fences with language label and edit locators', () => {
    const output = render('```typescript\nconst x = 10;\n```', 'node-1');
    expect(output).toContain('class="node-code-block"');
    expect(output).toContain('class="code-language"');
    expect(output).toContain('data-edit-kind="codeLanguage"');
    expect(output).toContain('data-edit-kind="code"');
    expect(output).toContain('const x = 10;');
  });
});

describe('canvas content styles', () => {
  const styles = getCanvasContentStyles();

  it('defines every class emitted by the renderer additions', () => {
    expect(styles).toContain('.node-mark');
    expect(styles).toContain('.node-h1');
    expect(styles).toContain('.node-hr');
    expect(styles).toContain('.node-table-wrap');
    expect(styles).toContain('.node-table');
  });

  it('no longer ships visual case transform styles', () => {
    expect(styles).not.toContain('node-upper');
    expect(styles).not.toContain('node-lower');
    expect(styles).not.toContain('text-transform');
  });

  it('keeps the compact table typography', () => {
    expect(styles).toContain('border-collapse: collapse');
    expect(styles).toContain('font-size: 10px');
  });
});
