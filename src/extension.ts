import * as vscode from 'vscode';
import { MarkdownGraphEditorProvider } from './providers/MarkdownGraphEditorProvider';
import { registerStorageMigrationCommands } from './commands/StorageMigrationCommands';
import { registerFileLifecycleWatcher } from './storage/FileLifecycleWatcher';
import { registerCanvasExplorer } from './explorer/CanvasExplorer';

// Kích hoạt tiện ích mở rộng Markdown Graph Studio
export function activate(context: vscode.ExtensionContext): void {
  const openCanvas = (uri: vscode.Uri): Thenable<unknown> => vscode.commands.executeCommand('vscode.openWith', uri, MarkdownGraphEditorProvider.viewType);
  let editorProvider: MarkdownGraphEditorProvider;
  const explorer = registerCanvasExplorer(context, openCanvas, (uri, nodeId) => editorProvider.revealNode(uri, nodeId));
  editorProvider = new MarkdownGraphEditorProvider({
    onDocumentOpened: (document) => explorer.trackDocument(document),
    onDocumentActive: (document) => explorer.setActiveDocument(document),
    onDocumentClosed: (uri) => explorer.clearOutline(uri),
  });
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(MarkdownGraphEditorProvider.viewType, editorProvider));
  context.subscriptions.push(vscode.commands.registerCommand('markdownGraphStudio.openAsGraph', async (targetUri?: vscode.Uri) => {
    const uri = targetUri instanceof vscode.Uri ? targetUri : vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
      vscode.window.showInformationMessage('Select or open a Markdown file before using Markdown Graph Studio.');
      return;
    }
    await openCanvas(uri);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('markdownGraphStudio.openSideBySide', async (targetUri?: vscode.Uri) => {
    const uri = targetUri instanceof vscode.Uri ? targetUri : vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
      vscode.window.showInformationMessage('Select or open a Markdown file before using Markdown Graph Studio.');
      return;
    }
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One, preserveFocus: true });
    await vscode.commands.executeCommand('vscode.openWith', uri, MarkdownGraphEditorProvider.viewType, vscode.ViewColumn.Beside);
  }));

  registerStorageMigrationCommands(context);
  registerFileLifecycleWatcher(context);
}

// Hủy kích hoạt tiện ích mở rộng
export function deactivate(): void {}
