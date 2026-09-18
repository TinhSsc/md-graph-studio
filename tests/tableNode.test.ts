import { describe, expect, it } from 'vitest';
import {
  createDefaultTableMarkdown,
  deleteTable,
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
  parseMarkdownTables,
  setTableColumnAlign,
  spanTableCells,
  updateTableCell,
} from '../src/nodes/TableNode';

describe('TableNode', () => {
  const sampleMarkdown = `# Document

## Node One {#node-1}
<!-- graph-node: shape=rounded-rectangle; color=blue -->
Intro paragraph.

| Col A | Col B | Col C |
|:------|:-----:|------:|
| 1     | 2     | 3     |
| 4     | 5     | 6     |

Ending paragraph.
`;

  it('correctly parses markdown tables', () => {
    const tables = parseMarkdownTables(sampleMarkdown);
    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(['Col A', 'Col B', 'Col C']);
    expect(tables[0].alignments).toEqual(['left', 'center', 'right']);
    expect(tables[0].rows).toHaveLength(2);
    expect(tables[0].rows[0]).toEqual(['1', '2', '3']);
    expect(tables[0].rows[1]).toEqual(['4', '5', '6']);
  });

  it('creates default table markdown', () => {
    const tableMd = createDefaultTableMarkdown(3, 2);
    expect(tableMd).toContain('Header 1');
    expect(tableMd).toContain('Row 1 Col 1');
    const parsed = parseMarkdownTables(tableMd);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].headers).toHaveLength(3);
    expect(parsed[0].rows).toHaveLength(2);
  });

  it('updates table cell in header (row -1)', () => {
    const updated = updateTableCell(sampleMarkdown, 0, -1, 1, 'Updated Col B');
    const tables = parseMarkdownTables(updated);
    expect(tables[0].headers[1]).toBe('Updated Col B');
    expect(tables[0].rows[0][1]).toBe('2'); // unchanged
  });

  it('updates table cell in body row', () => {
    const updated = updateTableCell(sampleMarkdown, 0, 1, 2, '999');
    const tables = parseMarkdownTables(updated);
    expect(tables[0].rows[1][2]).toBe('999');
    expect(tables[0].rows[0][2]).toBe('3'); // unchanged
  });

  it('inserts table row below', () => {
    const updated = insertTableRow(sampleMarkdown, 0, 0, 'below');
    const tables = parseMarkdownTables(updated);
    expect(tables[0].rows).toHaveLength(3);
    expect(tables[0].rows[0]).toEqual(['1', '2', '3']);
    expect(tables[0].rows[1]).toEqual(['', '', '']);
    expect(tables[0].rows[2]).toEqual(['4', '5', '6']);
  });

  it('inserts table row above', () => {
    const updated = insertTableRow(sampleMarkdown, 0, 1, 'above');
    const tables = parseMarkdownTables(updated);
    expect(tables[0].rows).toHaveLength(3);
    expect(tables[0].rows[1]).toEqual(['', '', '']);
    expect(tables[0].rows[2]).toEqual(['4', '5', '6']);
  });

  it('deletes a table row', () => {
    const updated = deleteTableRow(sampleMarkdown, 0, 0);
    const tables = parseMarkdownTables(updated);
    expect(tables[0].rows).toHaveLength(1);
    expect(tables[0].rows[0]).toEqual(['4', '5', '6']);
  });

  it('inserts table column right', () => {
    const updated = insertTableColumn(sampleMarkdown, 0, 1, 'right');
    const tables = parseMarkdownTables(updated);
    expect(tables[0].headers).toHaveLength(4);
    expect(tables[0].rows[0]).toHaveLength(4);
    expect(tables[0].rows[1]).toHaveLength(4);
  });

  it('inserts table column left', () => {
    const updated = insertTableColumn(sampleMarkdown, 0, 0, 'left');
    const tables = parseMarkdownTables(updated);
    expect(tables[0].headers).toHaveLength(4);
    expect(tables[0].headers[1]).toBe('Col A');
  });

  it('deletes a table column', () => {
    const updated = deleteTableColumn(sampleMarkdown, 0, 1);
    const tables = parseMarkdownTables(updated);
    expect(tables[0].headers).toEqual(['Col A', 'Col C']);
    expect(tables[0].rows[0]).toEqual(['1', '3']);
    expect(tables[0].rows[1]).toEqual(['4', '6']);
  });

  it('sets table column alignment', () => {
    const updated = setTableColumnAlign(sampleMarkdown, 0, 0, 'center');
    const tables = parseMarkdownTables(updated);
    expect(tables[0].alignments[0]).toBe('center');
  });

  it('spans table cells across columns', () => {
    const updated = spanTableCells(sampleMarkdown, 0, 0, 0, 2);
    const tables = parseMarkdownTables(updated);
    expect(tables[0].rows[0][0]).toBe('1');
    expect(tables[0].rows[0][1]).toBe('>');
  });

  it('deletes entire table', () => {
    const updated = deleteTable(sampleMarkdown, 0);
    const tables = parseMarkdownTables(updated);
    expect(tables).toHaveLength(0);
    expect(updated).toContain('Intro paragraph.');
    expect(updated).toContain('Ending paragraph.');
  });
});
