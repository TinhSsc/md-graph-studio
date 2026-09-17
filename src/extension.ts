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
  editorProvider = new MarkdownGraphEditorProvider((document) => explorer.trackDocument(document));
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(MarkdownGraphEditorProvider.viewType, editorProvider));
  context.subscriptions.push(vscode.commands.registerCommand('markdownGraphStudio.openAsGraph', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
      vscode.window.showInformationMessage('Open a Markdown file before using Markdown Graph Studio.');
      return;
    }
    await openCanvas(editor.document.uri);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('markdownGraphStudio.openSideBySide', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
      vscode.window.showInformationMessage('Open a Markdown file before using Markdown Graph Studio.');
      return;
    }
    await vscode.window.showTextDocument(editor.document, { viewColumn: vscode.ViewColumn.One, preserveFocus: true });
    await vscode.commands.executeCommand('vscode.openWith', editor.document.uri, MarkdownGraphEditorProvider.viewType, vscode.ViewColumn.Beside);
  }));

  registerStorageMigrationCommands(context);
  registerFileLifecycleWatcher(context);
}

// Hủy kích hoạt tiện ích mở rộng
export function deactivate(): void {}
