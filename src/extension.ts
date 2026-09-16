import * as vscode from 'vscode';
import { MarkdownGraphEditorProvider } from './providers/MarkdownGraphEditorProvider';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.window.registerCustomEditorProvider(MarkdownGraphEditorProvider.viewType, new MarkdownGraphEditorProvider()));
  context.subscriptions.push(vscode.commands.registerCommand('markdownGraphStudio.openAsGraph', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'markdown') {
      vscode.window.showInformationMessage('Open a Markdown file before using Markdown Graph Studio.');
      return;
    }
    await vscode.commands.executeCommand('vscode.openWith', editor.document.uri, MarkdownGraphEditorProvider.viewType);
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
}

export function deactivate(): void {}
