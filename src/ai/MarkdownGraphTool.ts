import * as path from 'node:path';
import * as vscode from 'vscode';
import { nodeColors, nodeShapes, type GraphEdge, type GraphNode } from '../model/graphTypes';
import { createNodeSection, serializeEdge } from '../parser/MarkdownGraphSerializer';
import { MarkdownGraphEditorProvider } from '../providers/MarkdownGraphEditorProvider';

const TOOL_NAME = 'markdownGraphStudio_create_markdownGraph';

interface GraphToolNode {
  id: string;
  title: string;
  content?: string;
  shape?: GraphNode['shape'];
  color?: string;
  icon?: string;
}

interface GraphToolInput {
  filePath: string;
  title?: string;
  nodes: GraphToolNode[];
  edges?: Array<{ source: string; target: string; label?: string }>;
}

export function registerMarkdownGraphTool(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.lm.registerTool(TOOL_NAME, new MarkdownGraphTool()));
}

class MarkdownGraphTool implements vscode.LanguageModelTool<GraphToolInput> {
  prepareInvocation(options: vscode.LanguageModelToolInvocationPrepareOptions<GraphToolInput>): vscode.PreparedToolInvocation {
    return {
      invocationMessage: `Creating Markdown graph in ${path.basename(options.input.filePath)}`,
      confirmationMessages: {
        title: 'Create Markdown graph',
        message: `Write ${options.input.nodes.length} node(s) to ${options.input.filePath}?`,
      },
    };
  }

  async invoke(options: vscode.LanguageModelToolInvocationOptions<GraphToolInput>): Promise<vscode.LanguageModelToolResult> {
    const input = options.input;
    const target = resolveWorkspaceTarget(input.filePath);
    validateInput(input);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(target.fsPath)));
    await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(serializeGraph(input)));
    await vscode.commands.executeCommand('vscode.openWith', target, MarkdownGraphEditorProvider.viewType);
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(
      `Created ${target.fsPath} with ${input.nodes.length} nodes and ${input.edges?.length ?? 0} edges. The graph is open in Markdown Graph Studio.`,
    )]);
  }
}

function resolveWorkspaceTarget(filePath: string): vscode.Uri {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) throw new Error('Open a workspace folder before creating a Markdown graph.');
  const absolute = path.resolve(folder.uri.fsPath, filePath);
  const relative = path.relative(folder.uri.fsPath, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('The graph file must be inside the current workspace.');
  if (path.extname(absolute).toLowerCase() !== '.md') throw new Error('The graph file path must end with .md.');
  return vscode.Uri.file(absolute);
}

function validateInput(input: GraphToolInput): void {
  if (!Array.isArray(input.nodes) || input.nodes.length === 0) throw new Error('At least one node is required.');
  const ids = new Set<string>();
  for (const node of input.nodes) {
    if (!node.id?.trim() || !node.title?.trim()) throw new Error('Every node requires a non-empty id and title.');
    if (ids.has(node.id)) throw new Error(`Duplicate node id: ${node.id}`);
    ids.add(node.id);
  }
  for (const edge of input.edges ?? []) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) throw new Error(`Edge ${edge.source} -> ${edge.target} references an unknown node.`);
  }
}

function serializeGraph(input: GraphToolInput): string {
  const edges = input.edges ?? [];
  const sections = input.nodes.map(node => {
    const outgoing = edges.filter(edge => edge.source === node.id).map(edge => serializeEdge(edge.target, {
      label: edge.label ?? '', arrow: 'forward', line: 'solid', path: 'orthogonal',
    } as GraphEdge));
    const content = [node.content?.trim() ?? '', ...outgoing].filter(Boolean).join('\n\n');
    const shape = node.shape && nodeShapes.includes(node.shape) ? node.shape : 'rounded-rectangle';
    const color = node.color && nodeColors.includes(node.color as (typeof nodeColors)[number]) ? node.color : 'blue';
    return createNodeSection({ title: node.title.trim(), explicitId: node.id.trim(), content, shape, color, icon: node.icon, collapsed: false, locked: false });
  });
  const heading = input.title?.trim() ? `# ${input.title.trim()}\n\n` : '';
  return heading + sections.join('\n');
}
