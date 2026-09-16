import type { GraphNode } from '../model/graphTypes';
import { updateMarkdownBlock, type EditableBlockKind } from '../nodes/MarkdownNode';
import { deleteTask, toggleTask, updateTaskText } from '../nodes/TaskNode';

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
  return undefined;
}

function numberField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function isBlockKind(value: unknown): value is EditableBlockKind {
  return value === 'paragraph' || value === 'quote' || value === 'code' || value === 'codeLanguage';
}
