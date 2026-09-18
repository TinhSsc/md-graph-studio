import type { GraphNode } from '../model/graphTypes';
import { updateMarkdownBlock, type EditableBlockKind } from '../nodes/MarkdownNode';
import { deleteTask, toggleTask, updateTaskText } from '../nodes/TaskNode';
import {
  deleteTable,
  deleteTableColumn,
  deleteTableRow,
  insertTableColumn,
  insertTableRow,
  setTableColumnAlign,
  spanTableCells,
  updateTableCell,
  type ColumnAlignment,
} from '../nodes/TableNode';

export function updateNodeContentFromMessage(node: GraphNode | undefined, value: Record<string, unknown>): string | null | undefined {
  if (!node) return undefined;
  if (value.type === 'toggleTask') {
    const index = numberField(value.task) ?? numberField(value.taskIndex);
    return index === undefined ? null : toggleTask(node.content, index);
  }
  if (value.type === 'deleteTask') {
    const index = numberField(value.taskIndex);
    return index === undefined ? null : deleteTask(node.content, index);
  }
  if (value.type === 'updateTaskText') {
    const index = numberField(value.taskIndex);
    return index === undefined || typeof value.text !== 'string' ? null : updateTaskText(node.content, index, value.text);
  }
  if (value.type === 'updateMarkdownBlock') {
    const index = numberField(value.blockIndex);
    if (index === undefined || typeof value.text !== 'string' || !isBlockKind(value.blockKind)) return null;
    return updateMarkdownBlock(node.content, value.blockKind, index, value.text);
  }
  if (value.type === 'updateTableCell') {
    const tableIndex = numberField(value.tableIndex);
    const row = signedNumberField(value.row);
    const col = numberField(value.col);
    if (tableIndex === undefined || row === undefined || col === undefined || typeof value.text !== 'string') return null;
    return updateTableCell(node.content, tableIndex, row, col, value.text);
  }
  if (value.type === 'tableAction') {
    const tableIndex = numberField(value.tableIndex);
    if (tableIndex === undefined || typeof value.action !== 'string') return null;
    const row = signedNumberField(value.row) ?? 0;
    const col = numberField(value.col) ?? 0;
    switch (value.action) {
      case 'insertRowAbove':
        return insertTableRow(node.content, tableIndex, row, 'above');
      case 'insertRowBelow':
        return insertTableRow(node.content, tableIndex, row, 'below');
      case 'deleteRow':
        return deleteTableRow(node.content, tableIndex, row);
      case 'insertColLeft':
        return insertTableColumn(node.content, tableIndex, col, 'left');
      case 'insertColRight':
        return insertTableColumn(node.content, tableIndex, col, 'right');
      case 'deleteCol':
        return deleteTableColumn(node.content, tableIndex, col);
      case 'setColAlign': {
        const align = value.align === 'center' || value.align === 'right' ? value.align : 'left';
        return setTableColumnAlign(node.content, tableIndex, col, align as ColumnAlignment);
      }
      case 'spanCells': {
        const spanCount = numberField(value.spanCount) ?? 2;
        return spanTableCells(node.content, tableIndex, row, col, spanCount);
      }
      case 'deleteTable':
        return deleteTable(node.content, tableIndex);
      default:
        return null;
    }
  }
  return undefined;
}

function numberField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function signedNumberField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function isBlockKind(value: unknown): value is EditableBlockKind {
  return value === 'paragraph' || value === 'quote' || value === 'listItem' || value === 'code' || value === 'codeLanguage';
}
