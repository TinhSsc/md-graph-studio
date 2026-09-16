import type * as vscode from 'vscode';
import { parseMarkdownGraph } from '../parser/MarkdownGraphParser';
import { updateCanvasMeta } from '../parser/MarkdownGraphSerializer';
import { SidecarStorageManager, type FileUriLike, type SidecarNaming } from '../storage/SidecarStorageManager';

export interface StorageMigrationDeps {
  sidecarManager: SidecarStorageManager;
  confirmOverwrite?: (message: string) => Promise<boolean>;
  naming?: SidecarNaming;
}

export interface ConvertToSidecarResult {
  success: boolean;
  cleanMarkdownText?: string;
  error?: string;
  skipped?: boolean;
}

export interface EmbedMetadataResult {
  success: boolean;
  embeddedMarkdownText?: string;
  error?: string;
  skipped?: boolean;
}

// Loại bỏ khối canvas-meta khỏi văn bản Markdown
export function stripEmbeddedCanvasMeta(text: string): string {
  return text.replace(/\n?<!--\s*canvas-meta\s*\n[\s\S]*?\n?-->\s*$/, '').trimEnd() + '\n';
}

// Chuyển đổi metadata từ nhúng trong Markdown sang file sidecar tách biệt
export async function performConvertToSidecar(
  docUri: FileUriLike,
  docText: string,
  deps: StorageMigrationDeps
): Promise<ConvertToSidecarResult> {
  const naming = deps.naming ?? 'dot-md-graph-json';
  const parsed = parseMarkdownGraph(docText);
  if (!parsed.meta) {
    return { success: false, error: 'No embedded layout metadata found in this Markdown document.' };
  }

  const sidecarUri = deps.sidecarManager.getSidecarUri(docUri, naming);
  let sidecarExists = false;
  try {
    await deps.sidecarManager.getFs().readFile(sidecarUri);
    sidecarExists = true;
  } catch {
  }

  if (sidecarExists && deps.confirmOverwrite) {
    const shouldOverwrite = await deps.confirmOverwrite('Sidecar file already exists. Do you want to overwrite it?');
    if (!shouldOverwrite) {
      return { success: false, skipped: true };
    }
  }

  const writeOk = await deps.sidecarManager.writeSidecar(docUri, parsed.meta, naming);
  if (!writeOk) {
    return { success: false, error: 'Failed to write sidecar file.' };
  }

  const verified = await deps.sidecarManager.readSidecar(docUri, naming);
  if (!verified.meta || deps.sidecarManager.canonicalStringify(parsed.meta) !== deps.sidecarManager.canonicalStringify(verified.meta)) {
    return { success: false, error: 'Integrity check failed: sidecar content does not match original metadata.' };
  }

  const cleanMarkdownText = stripEmbeddedCanvasMeta(docText);
  return { success: true, cleanMarkdownText };
}

// Nhúng metadata từ file sidecar vào cuối văn bản Markdown
export async function performEmbedMetadata(
  docUri: FileUriLike,
  docText: string,
  deps: StorageMigrationDeps
): Promise<EmbedMetadataResult> {
  const naming = deps.naming ?? 'dot-md-graph-json';
  const sidecarRes = await deps.sidecarManager.readSidecar(docUri, naming);
  if (!sidecarRes.meta) {
    return { success: false, error: 'No valid sidecar metadata file found for this document.' };
  }

  const parsed = parseMarkdownGraph(docText);
  if (parsed.meta && deps.confirmOverwrite) {
    const shouldOverwrite = await deps.confirmOverwrite('Markdown document already has embedded metadata. Overwrite?');
    if (!shouldOverwrite) {
      return { success: false, skipped: true };
    }
  }

  const edit = updateCanvasMeta(docText, sidecarRes.meta);
  const embeddedMarkdownText = docText.slice(0, edit.start) + edit.text + docText.slice(edit.end);
  return { success: true, embeddedMarkdownText };
}

// Đăng ký các lệnh chuyển đổi định dạng lưu trữ vào VS Code
export function registerStorageMigrationCommands(context: vscode.ExtensionContext, customManager?: SidecarStorageManager): void {
  const vscodeInstance: typeof vscode = require('vscode');
  const manager = customManager ?? new SidecarStorageManager();

  const getNaming = (): SidecarNaming => {
    return vscodeInstance.workspace.getConfiguration('markdownGraphStudio').get<SidecarNaming>('sidecarNaming', 'dot-md-graph-json');
  };

  const resolveTargetDocument = async (uri?: vscode.Uri): Promise<vscode.TextDocument | null> => {
    if (uri && uri.fsPath.endsWith('.md')) {
      return vscodeInstance.workspace.openTextDocument(uri);
    }
    const active = vscodeInstance.window.activeTextEditor?.document;
    if (active && active.languageId === 'markdown') {
      return active;
    }
    return null;
  };

  context.subscriptions.push(
    vscodeInstance.commands.registerCommand('markdownGraphStudio.convertToSidecar', async (uri?: vscode.Uri) => {
      const document = await resolveTargetDocument(uri);
      if (!document) {
        void vscodeInstance.window.showWarningMessage('Please open or select a Markdown file to convert.');
        return;
      }

      const naming = getNaming();
      const result = await performConvertToSidecar(document.uri, document.getText(), {
        sidecarManager: manager,
        naming,
        confirmOverwrite: async (msg) => {
          const choice = await vscodeInstance.window.showWarningMessage(msg, { modal: true }, 'Overwrite', 'Cancel');
          return choice === 'Overwrite';
        },
      });

      if (!result.success) {
        if (!result.skipped && result.error) {
          void vscodeInstance.window.showErrorMessage(`Convert to Sidecar failed: ${result.error}`);
        }
        return;
      }

      if (result.cleanMarkdownText !== undefined) {
        const edit = new vscodeInstance.WorkspaceEdit();
        const fullRange = new vscodeInstance.Range(document.positionAt(0), document.positionAt(document.getText().length));
        edit.replace(document.uri, fullRange, result.cleanMarkdownText);
        const applied = await vscodeInstance.workspace.applyEdit(edit);
        if (applied) {
          await document.save();
          void vscodeInstance.window.showInformationMessage('Successfully converted layout metadata to sidecar storage.');
        }
      }
    })
  );

  context.subscriptions.push(
    vscodeInstance.commands.registerCommand('markdownGraphStudio.embedMetadata', async (uri?: vscode.Uri) => {
      const document = await resolveTargetDocument(uri);
      if (!document) {
        void vscodeInstance.window.showWarningMessage('Please open or select a Markdown file to convert.');
        return;
      }

      const naming = getNaming();
      const result = await performEmbedMetadata(document.uri, document.getText(), {
        sidecarManager: manager,
        naming,
        confirmOverwrite: async (msg) => {
          const choice = await vscodeInstance.window.showWarningMessage(msg, { modal: true }, 'Overwrite', 'Cancel');
          return choice === 'Overwrite';
        },
      });

      if (!result.success) {
        if (!result.skipped && result.error) {
          void vscodeInstance.window.showErrorMessage(`Embed Metadata failed: ${result.error}`);
        }
        return;
      }

      if (result.embeddedMarkdownText !== undefined) {
        const edit = new vscodeInstance.WorkspaceEdit();
        const fullRange = new vscodeInstance.Range(document.positionAt(0), document.positionAt(document.getText().length));
        edit.replace(document.uri, fullRange, result.embeddedMarkdownText);
        const applied = await vscodeInstance.workspace.applyEdit(edit);
        if (applied) {
          await document.save();
          const choice = await vscodeInstance.window.showInformationMessage(
            'Metadata embedded into Markdown. Do you want to delete the old sidecar file?',
            'Delete Sidecar',
            'Keep Both'
          );
          if (choice === 'Delete Sidecar') {
            await manager.deleteSidecar(document.uri, naming);
          }
        }
      }
    })
  );
}
