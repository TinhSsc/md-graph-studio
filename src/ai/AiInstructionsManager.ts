import type * as vscode from 'vscode';
import { AI_GRAPH_INSTRUCTIONS_TEMPLATE } from './aiInstructionsTemplate';

export { AI_GRAPH_INSTRUCTIONS_TEMPLATE };

export const AI_INSTRUCTIONS_FILENAME = 'MD_GRAPH_AI_INSTRUCTIONS.md';

export interface UriLike {
  fsPath: string;
  toString(): string;
}

export interface FsAdapterLike {
  readFile(uri: UriLike): Promise<Uint8Array>;
  writeFile(uri: UriLike, content: Uint8Array): Promise<void>;
  joinPath?(base: UriLike, ...pathSegments: string[]): UriLike;
}

export function resolveTargetUri(folderUri: UriLike, fsAdapter?: FsAdapterLike): UriLike {
  if (fsAdapter?.joinPath) {
    return fsAdapter.joinPath(folderUri, AI_INSTRUCTIONS_FILENAME);
  }
  try {
    const vscode = require('vscode');
    return vscode.Uri.joinPath(folderUri as vscode.Uri, AI_INSTRUCTIONS_FILENAME);
  } catch {
    const sep = folderUri.fsPath.includes('\\') ? '\\' : '/';
    const joined = folderUri.fsPath.endsWith(sep)
      ? `${folderUri.fsPath}${AI_INSTRUCTIONS_FILENAME}`
      : `${folderUri.fsPath}${sep}${AI_INSTRUCTIONS_FILENAME}`;
    return {
      fsPath: joined,
      toString: () => joined
    };
  }
}

/**
 * Checks and synchronizes the AI guidance document in a workspace folder.
 * Returns true if a write operation occurred, false if content already matches.
 */
export async function syncAiInstructionsForFolder(
  folderUri: UriLike,
  fsAdapter?: FsAdapterLike
): Promise<boolean> {
  let fs = fsAdapter;
  if (!fs) {
    try {
      const vscode = require('vscode');
      fs = vscode.workspace.fs;
    } catch {
      throw new Error('FsAdapter is required when running outside of VS Code runtime');
    }
  }

  const targetUri = resolveTargetUri(folderUri, fsAdapter);
  const normalizedTemplate = AI_GRAPH_INSTRUCTIONS_TEMPLATE.trim().replace(/\r\n/g, '\n');

  try {
    const existingBytes = await fs!.readFile(targetUri);
    const existingContent = new TextDecoder('utf-8').decode(existingBytes).trim().replace(/\r\n/g, '\n');
    if (existingContent === normalizedTemplate) {
      return false;
    }
  } catch {
    // File missing or unreadable, proceed to create
  }

  const encodedBytes = new TextEncoder().encode(normalizedTemplate + '\n');
  await fs!.writeFile(targetUri, encodedBytes);
  return true;
}

/**
 * Registers automatic synchronization for AI graph instructions across workspaces.
 */
export function registerAiInstructionsManager(context: vscode.ExtensionContext): void {
  const vscode = require('vscode');
  const syncAll = async () => {
    const config = vscode.workspace.getConfiguration('markdownGraphStudio');
    const enabled = config.get('autoGenerateAiInstructions', true);
    if (!enabled) return;

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return;

    for (const folder of folders) {
      try {
        await syncAiInstructionsForFolder(folder.uri);
      } catch (err) {
        console.error('[WARN AiInstructionsManager] Failed to sync AI instructions', {
          path: folder.uri.fsPath,
          error: err
        });
      }
    }
  };

  void syncAll();

  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void syncAll();
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e: any) => {
      if (e.affectsConfiguration('markdownGraphStudio.autoGenerateAiInstructions')) {
        void syncAll();
      }
    })
  );
}
