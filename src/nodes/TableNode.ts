export type ColumnAlignment = 'left' | 'center' | 'right';

export interface MarkdownTableInfo {
  index: number;
  startLine: number;
  endLine: number; // exclusive
  headers: string[];
  alignments: ColumnAlignment[];
  rows: string[][];
}

export function splitTableRow(row: string): string[] {
  const trimmed = row.trim();
  const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return withoutEdges.split('|').map((cell) => cell.trim());
}

export function isTableDelimiterRow(row: string): boolean {
  if (!/^\s*\|/.test(row)) return false;
  const cells = row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  return cells.length > 0 && cells.every((cell) => /^[\t ]*:?-+:?[\t ]*$/.test(cell));
}

export function parseTableAlignments(row: string): ColumnAlignment[] {
  return splitTableRow(row).map((cell) => {
    const trimmed = cell.trim();
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
    if (trimmed.endsWith(':')) return 'right';
    return 'left';
  });
}

export function parseMarkdownTables(content: string): MarkdownTableInfo[] {
  const lines = content.split('\n');
  const tables: MarkdownTableInfo[] = [];
  let inFencedBlock = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFencedBlock = !inFencedBlock;
      continue;
    }
    if (inFencedBlock) continue;

    if (/^\s*\|/.test(line) && i + 1 < lines.length && isTableDelimiterRow(lines[i + 1])) {
      const headers = splitTableRow(line);
      const alignments = parseTableAlignments(lines[i + 1]);
      // Normalize alignment array length to match header column count
      while (alignments.length < headers.length) alignments.push('left');

      const rows: string[][] = [];
      let cursor = i + 2;
      while (cursor < lines.length && /^\s*\|/.test(lines[cursor])) {
        const rowCells = splitTableRow(lines[cursor]);
        while (rowCells.length < headers.length) rowCells.push('');
        rows.push(rowCells);
        cursor += 1;
      }

      tables.push({
        index: tables.length,
        startLine: i,
        endLine: cursor,
        headers,
        alignments,
        rows,
      });

      i = cursor - 1;
    }
  }

  return tables;
}

export function formatTableMarkdown(headers: string[], alignments: ColumnAlignment[], rows: string[][]): string {
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length), alignments.length, 1);
  const normalizedHeaders = [...headers];
  while (normalizedHeaders.length < colCount) normalizedHeaders.push(`Col ${normalizedHeaders.length + 1}`);

  const normalizedAlignments = [...alignments];
  while (normalizedAlignments.length < colCount) normalizedAlignments.push('left');

  const normalizedRows = rows.map((row) => {
    const cells = [...row];
    while (cells.length < colCount) cells.push('');
    return cells;
  });

  // Calculate maximum column widths for alignment formatting
  const colWidths: number[] = Array.from({ length: colCount }, (_, colIdx) => {
    let width = Math.max(3, normalizedHeaders[colIdx]?.length ?? 3);
    for (const r of normalizedRows) {
      width = Math.max(width, (r[colIdx] ?? '').length);
    }
    return width;
  });

  const pad = (str: string, width: number, align: ColumnAlignment): string => {
    const space = Math.max(0, width - str.length);
    if (align === 'right') return ' '.repeat(space) + str;
    if (align === 'center') {
      const left = Math.floor(space / 2);
      const right = space - left;
      return ' '.repeat(left) + str + ' '.repeat(right);
    }
    return str + ' '.repeat(space);
  };

  const delimiterCell = (width: number, align: ColumnAlignment): string => {
    if (align === 'center') return `:${'-'.repeat(Math.max(1, width - 2))}:`;
    if (align === 'right') return `${'-'.repeat(Math.max(2, width - 1))}:`;
    return `:${'-'.repeat(Math.max(2, width - 1))}`;
  };

  const headerLine = '| ' + normalizedHeaders.map((h, i) => pad(h, colWidths[i], normalizedAlignments[i])).join(' | ') + ' |';
  const delimiterLine = '| ' + normalizedAlignments.map((a, i) => delimiterCell(colWidths[i], a)).join(' | ') + ' |';
  const dataLines = normalizedRows.map(
    (row) => '| ' + row.map((cell, i) => pad(cell, colWidths[i], normalizedAlignments[i])).join(' | ') + ' |',
  );

  return [headerLine, delimiterLine, ...dataLines].join('\n');
}

export function createDefaultTableMarkdown(cols = 3, rows = 2): string {
  const safeCols = Math.max(1, Math.min(10, cols));
  const safeRows = Math.max(1, Math.min(20, rows));
  const headers = Array.from({ length: safeCols }, (_, i) => `Header ${i + 1}`);
  const alignments: ColumnAlignment[] = Array.from({ length: safeCols }, () => 'left');
  const dataRows: string[][] = Array.from({ length: safeRows }, (_, r) =>
    Array.from({ length: safeCols }, (_, c) => `Row ${r + 1} Col ${c + 1}`),
  );
  return formatTableMarkdown(headers, alignments, dataRows);
}

function replaceTableInContent(content: string, table: MarkdownTableInfo, replacement: string): string {
  const lines = content.split('\n');
  const replacementLines = replacement ? replacement.split('\n') : [];
  lines.splice(table.startLine, table.endLine - table.startLine, ...replacementLines);
  return lines.join('\n');
}

export function updateTableCell(
  content: string,
  tableIndex: number,
  row: number,
  col: number,
  text: string,
): string {
  const tables = parseMarkdownTables(content);
  const table = tables[tableIndex];
  if (!table) return content;

  const cleanText = text.replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|').trim();

  if (row === -1) {
    if (col >= 0 && col < table.headers.length) {
      table.headers[col] = cleanText;
    }
  } else if (row >= 0 && row < table.rows.length) {
    if (col >= 0 && col < table.headers.length) {
      table.rows[row][col] = cleanText;
    }
  } else {
    return content;
  }

  const nextTableStr = formatTableMarkdown(table.headers, table.alignments, table.rows);
  return replaceTableInContent(content, table, nextTableStr);
}

export function insertTableRow(
  content: string,
  tableIndex: number,
  targetRow: number,
  position: 'above' | 'below',
): string {
  const tables = parseMarkdownTables(content);
  const table = tables[tableIndex];
  if (!table) return content;

  const newRow: string[] = Array.from({ length: table.headers.length }, () => '');
  let insertIndex = targetRow;

  if (targetRow < 0) {
    // If targetRow is -1 (header row)
    insertIndex = 0;
  } else {
    insertIndex = position === 'above' ? targetRow : targetRow + 1;
    insertIndex = Math.max(0, Math.min(table.rows.length, insertIndex));
  }

  table.rows.splice(insertIndex, 0, newRow);
  const nextTableStr = formatTableMarkdown(table.headers, table.alignments, table.rows);
  return replaceTableInContent(content, table, nextTableStr);
}

export function deleteTableRow(content: string, tableIndex: number, targetRow: number): string {
  const tables = parseMarkdownTables(content);
  const table = tables[tableIndex];
  if (!table) return content;

  if (targetRow >= 0 && targetRow < table.rows.length) {
    table.rows.splice(targetRow, 1);
  } else if (targetRow === -1 && table.rows.length > 0) {
    // If deleting header, promote first row to header
    table.headers = table.rows.shift()!;
  } else {
    return content;
  }

  const nextTableStr = formatTableMarkdown(table.headers, table.alignments, table.rows);
  return replaceTableInContent(content, table, nextTableStr);
}

export function insertTableColumn(
  content: string,
  tableIndex: number,
  targetCol: number,
  position: 'left' | 'right',
): string {
  const tables = parseMarkdownTables(content);
  const table = tables[tableIndex];
  if (!table) return content;

  const insertIndex = position === 'left' ? Math.max(0, targetCol) : Math.min(table.headers.length, targetCol + 1);

  table.headers.splice(insertIndex, 0, `Col ${insertIndex + 1}`);
  table.alignments.splice(insertIndex, 0, 'left');
  for (const row of table.rows) {
    row.splice(insertIndex, 0, '');
  }

  const nextTableStr = formatTableMarkdown(table.headers, table.alignments, table.rows);
  return replaceTableInContent(content, table, nextTableStr);
}

export function deleteTableColumn(content: string, tableIndex: number, targetCol: number): string {
  const tables = parseMarkdownTables(content);
  const table = tables[tableIndex];
  if (!table || targetCol < 0 || targetCol >= table.headers.length) return content;

  if (table.headers.length <= 1) {
    // If only 1 column, deleting it removes the entire table
    return deleteTable(content, tableIndex);
  }

  table.headers.splice(targetCol, 1);
  table.alignments.splice(targetCol, 1);
  for (const row of table.rows) {
    row.splice(targetCol, 1);
  }

  const nextTableStr = formatTableMarkdown(table.headers, table.alignments, table.rows);
  return replaceTableInContent(content, table, nextTableStr);
}

export function setTableColumnAlign(
  content: string,
  tableIndex: number,
  targetCol: number,
  align: ColumnAlignment,
): string {
  const tables = parseMarkdownTables(content);
  const table = tables[tableIndex];
  if (!table || targetCol < 0 || targetCol >= table.headers.length) return content;

  table.alignments[targetCol] = align;
  const nextTableStr = formatTableMarkdown(table.headers, table.alignments, table.rows);
  return replaceTableInContent(content, table, nextTableStr);
}

/**
 * Span (merge) cells across columns in markdown:
 * In markdown tables, spanning a cell across `spanCount` columns is achieved
 * by setting subsequent spanned cells to `>` (or empty) indicating continuation.
 */
export function spanTableCells(
  content: string,
  tableIndex: number,
  row: number,
  col: number,
  spanCount = 2,
): string {
  const tables = parseMarkdownTables(content);
  const table = tables[tableIndex];
  if (!table) return content;

  const targetCells = row === -1 ? table.headers : table.rows[row];
  if (!targetCells || col < 0 || col >= targetCells.length) return content;

  const maxSpan = Math.min(spanCount, targetCells.length - col);
  for (let i = 1; i < maxSpan; i += 1) {
    targetCells[col + i] = '>';
  }

  const nextTableStr = formatTableMarkdown(table.headers, table.alignments, table.rows);
  return replaceTableInContent(content, table, nextTableStr);
}

export function deleteTable(content: string, tableIndex: number): string {
  const tables = parseMarkdownTables(content);
  const table = tables[tableIndex];
  if (!table) return content;
  return replaceTableInContent(content, table, '');
}
