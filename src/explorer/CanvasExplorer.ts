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
  revealNode: (uri: vscode.Uri, nodeId: string) => Thenable<void> | void,
): CanvasExplorer {
  const canvases = new CanvasTreeProvider(context.workspaceState);
  const outline = new OutlineTreeProvider();
  const outlineView = vscode.window.createTreeView('markdownGraphStudio.outline', {
    treeDataProvider: outline,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('markdownGraphStudio.canvases', canvases),
    outlineView,
    vscode.commands.registerCommand('markdownGraphStudio.pickCanvas', async () => {
      const selected = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { Markdown: ['md', 'markdown'] },
        openLabel: 'Open Canvas',
      });
      if (selected?.[0]) await openCanvas(selected[0]);
    }),
    vscode.commands.registerCommand('markdownGraphStudio.openCanvas', async (uri: vscode.Uri) => openCanvas(uri)),
    vscode.commands.registerCommand('markdownGraphStudio.revealNode', async (uri: vscode.Uri, nodeId: string) => {
      await openCanvas(uri);
      await revealNode(uri, nodeId);
    }),
    vscode.commands.registerCommand('markdownGraphStudio.refreshCanvases', () => canvases.refresh()),
    vscode.commands.registerCommand('markdownGraphStudio.searchNodes', async () => {
      const allNodes = outline.getAllNodes();
      const docUri = outline.getDocumentUri();
      if (!allNodes.length || !docUri) {
        void vscode.window.showInformationMessage('Open a Markdown canvas first to search nodes.');
        return;
      }
      const items = allNodes.map((node) => ({
        label: node.title,
        description: node.explicitId && node.explicitId !== node.title ? `#${node.explicitId}` : undefined,
        detail: node.content ? node.content.slice(0, 100).replace(/\r?\n/g, ' ') : undefined,
        nodeId: node.id,
        iconPath: new vscode.ThemeIcon(node.icon || 'symbol-field'),
      }));
      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: 'Search node by title, ID or content...',
        matchOnDescription: true,
        matchOnDetail: true,
      });
      if (picked) {
        const uri = vscode.Uri.parse(docUri);
        await openCanvas(uri);
        await revealNode(uri, picked.nodeId);
      }
    }),
    vscode.commands.registerCommand('markdownGraphStudio.clearNodeFilter', () => {
      outline.setFilter('');
      outlineView.message = undefined;
      void vscode.commands.executeCommand('setContext', 'markdownGraphStudio.hasNodeFilter', false);
    }),
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
  private filterQuery = '';
  public readonly onDidChangeTreeData = this.changed.event;

  public getTreeItem(node: GraphNode): vscode.TreeItem {
    const item = new vscode.TreeItem(node.title, vscode.TreeItemCollapsibleState.None);
    // Only display description when explicitId is meaningful and doesn't duplicate title
    if (node.explicitId && node.explicitId !== node.title && !node.title.includes(node.explicitId)) {
      item.description = `#${node.explicitId}`;
    }
    item.tooltip = `${node.title}${node.explicitId ? ` (#${node.explicitId})` : ''}`;
    item.iconPath = new vscode.ThemeIcon(node.icon || 'symbol-field');
    if (this.documentUri) {
      item.command = {
        command: 'markdownGraphStudio.revealNode',
        title: 'Reveal Node',
        arguments: [vscode.Uri.parse(this.documentUri), node.id],
      };
    }
    return item;
  }

  public getChildren(): GraphNode[] {
    if (!this.filterQuery) return this.nodes;
    return this.nodes.filter((node) => {
      const q = this.filterQuery;
      return node.title.toLowerCase().includes(q)
        || node.id.toLowerCase().includes(q)
        || (node.explicitId && node.explicitId.toLowerCase().includes(q))
        || (node.content && node.content.toLowerCase().includes(q));
    });
  }

  public setFilter(query: string): void {
    this.filterQuery = query.trim().toLowerCase();
    this.changed.fire();
  }

  public getFilter(): string {
    return this.filterQuery;
  }

  public getAllNodes(): GraphNode[] {
    return this.nodes;
  }

  public getDocumentUri(): string | undefined {
    return this.documentUri;
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
