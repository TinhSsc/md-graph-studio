import type * as vscode from 'vscode';
import { SidecarStorageManager, toFileUri, type FileSystemAdapter, type FileUriLike } from './SidecarStorageManager';

export interface FileRenameItem {
  oldUri: FileUriLike;
  newUri: FileUriLike;
}

export interface SidecarRenamePair {
  oldSidecar: FileUriLike;
  newSidecar: FileUriLike;
}

// Tính toán các cặp đường dẫn file sidecar tương ứng khi file Markdown đổi tên
export function computeRenamedSidecarPairs(oldMdUri: FileUriLike, newMdUri: FileUriLike): SidecarRenamePair[] {
  const oldPath = oldMdUri.fsPath;
  const newPath = newMdUri.fsPath;
  if (!oldPath.toLowerCase().endsWith('.md') || !newPath.toLowerCase().endsWith('.md')) {
    return [];
  }

  const oldStem = oldPath.slice(0, -3);
  const newStem = newPath.slice(0, -3);

  return [
    { oldSidecar: toFileUri(`${oldPath}.graph.json`), newSidecar: toFileUri(`${newPath}.graph.json`) },
    { oldSidecar: toFileUri(`${oldStem}.graph.json`), newSidecar: toFileUri(`${newStem}.graph.json`) },
  ];
}

// Đồng bộ việc đổi tên file sidecar khi file Markdown được đổi tên hoặc di chuyển
export async function syncSidecarRename(
  item: FileRenameItem,
  fs: FileSystemAdapter
): Promise<Array<{ oldPath: string; newPath: string }>> {
  const pairs = computeRenamedSidecarPairs(item.oldUri, item.newUri);
  const renamed: Array<{ oldPath: string; newPath: string }> = [];

  for (const pair of pairs) {
    try {
      await fs.readFile(pair.oldSidecar);
      await fs.rename(pair.oldSidecar, pair.newSidecar, { overwrite: false });
      renamed.push({ oldPath: pair.oldSidecar.fsPath, newPath: pair.newSidecar.fsPath });
    } catch {
    }
  }

  return renamed;
}

// Đăng ký lắng nghe sự kiện đổi tên file trong workspace VS Code để đồng bộ file sidecar
export function registerFileLifecycleWatcher(context: vscode.ExtensionContext, customManager?: SidecarStorageManager): void {
  const vscodeInstance: typeof vscode = require('vscode');
  const manager = customManager ?? new SidecarStorageManager();
  const disposable = vscodeInstance.workspace.onDidRenameFiles(async (event: vscode.FileRenameEvent) => {
    const fs = manager.getFs();
    for (const file of event.files) {
      try {
        await syncSidecarRename(file, fs);
      } catch (err) {
        console.error('FileLifecycleWatcher rename error:', err);
      }
    }
  });
  context.subscriptions.push(disposable);
}
