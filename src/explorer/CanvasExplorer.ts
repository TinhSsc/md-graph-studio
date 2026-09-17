import * as path from 'node:path';
import * as vscode from 'vscode';
import type { GraphNode } from '../model/graphTypes';
import { parseMarkdownGraph } from '../parser/MarkdownGraphParser';

const recentKey = 'markdownGraphStudio.recentCanvases';
const recentLimit = 10;

export interface CanvasExplorer {
  trackDocument(document: vscode.TextDocument): Promise<void>;
}

export function registerCanvasExplorer(
  context: vscode.ExtensionContext,
  openCanvas: (uri: vscode.Uri) => Thenable<unknown>,
): CanvasExplorer {
  const canvases = new CanvasTreeProvider(context.workspaceState);
  const outline = new OutlineTreeProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('markdownGraphStudio.canvases', canvases),
    vscode.window.registerTreeDataProvider('markdownGraphStudio.outline', outline),
    vscode.commands.registerCommand('markdownGraphStudio.pickCanvas', async () => {
      const selected = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { Markdown: ['md', 'markdown'] },
        openLabel: 'Open Canvas',
      });
      if (selected?.[0]) await openCanvas(selected[0]);
    }),
    vscode.commands.registerCommand('markdownGraphStudio.openCanvas', async (uri: vscode.Uri) => openCanvas(uri)),
    vscode.commands.registerCommand('markdownGraphStudio.refreshCanvases', () => canvases.refresh()),
    vscode.workspace.onDidChangeTextDocument((event) => outline.updateDocument(event.document)),
  );

  return {
    async trackDocument(document): Promise<void> {
      if (document.languageId !== 'markdown') return;
      await canvases.record(document.uri);
      outline.setDocument(document);
    },
  };
}

class CanvasTreeProvider implements vscode.TreeDataProvider<vscode.Uri> {
  private readonly changed = new vscode.EventEmitter<void>();
  public readonly onDidChangeTreeData = this.changed.event;

  constructor(private readonly state: vscode.Memento) {}

  public getTreeItem(uri: vscode.Uri): vscode.TreeItem {
    const item = new vscode.TreeItem(path.basename(uri.fsPath), vscode.TreeItemCollapsibleState.None);
    item.resourceUri = uri;
    item.description = vscode.workspace.asRelativePath(uri, false);
    item.tooltip = uri.fsPath;
    item.iconPath = new vscode.ThemeIcon('graph');
    item.command = { command: 'markdownGraphStudio.openCanvas', title: 'Open Canvas', arguments: [uri] };
    return item;
  }

  public async getChildren(): Promise<vscode.Uri[]> {
    const entries = this.entries();
    const existing: vscode.Uri[] = [];
    for (const value of entries) {
      const uri = vscode.Uri.parse(value);
      try {
        await vscode.workspace.fs.stat(uri);
        existing.push(uri);
      } catch {
      }
    }
    if (existing.length !== entries.length) {
      await this.state.update(recentKey, existing.map((uri) => uri.toString()));
    }
    return existing;
  }

  public async record(uri: vscode.Uri): Promise<void> {
    const value = uri.toString();
    const next = [value, ...this.entries().filter((entry) => entry !== value)].slice(0, recentLimit);
    await this.state.update(recentKey, next);
    this.refresh();
  }

  public refresh(): void {
    this.changed.fire();
  }

  private entries(): string[] {
    const stored = this.state.get<unknown>(recentKey, []);
    return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : [];
  }
}

class OutlineTreeProvider implements vscode.TreeDataProvider<GraphNode> {
  private readonly changed = new vscode.EventEmitter<void>();
  private documentUri: string | undefined;
  private nodes: GraphNode[] = [];
  public readonly onDidChangeTreeData = this.changed.event;

  public getTreeItem(node: GraphNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.title, vscode.TreeItemCollapsibleState.None);
    item.description = node.explicitId ?? node.id;
    item.tooltip = `${node.title} (${node.id})`;
    item.iconPath = new vscode.ThemeIcon(node.icon || 'symbol-field');
    return item;
  }

  public getChildren(): GraphNode[] {
    return this.nodes;
  }

  public setDocument(document: vscode.TextDocument): void {
    this.documentUri = document.uri.toString();
    this.nodes = parseMarkdownGraph(document.getText()).nodes.filter((node) => !node.ghost);
    this.changed.fire();
  }

  public updateDocument(document: vscode.TextDocument): void {
    if (document.uri.toString() === this.documentUri) this.setDocument(document);
  }
}
