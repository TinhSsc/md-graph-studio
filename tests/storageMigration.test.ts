import { describe, expect, it } from 'vitest';
import type { CanvasMeta } from '../src/model/graphTypes';
import { parseMarkdownGraph } from '../src/parser/MarkdownGraphParser';
import { SidecarStorageManager, type FileSystemAdapter, type FileUriLike } from '../src/storage/SidecarStorageManager';
import {
  performConvertToSidecar,
  performEmbedMetadata,
  stripEmbeddedCanvasMeta,
} from '../src/commands/StorageMigrationCommands';
import {
  computeRenamedSidecarPairs,
  syncSidecarRename,
} from '../src/storage/FileLifecycleWatcher';

class MemoryFs implements FileSystemAdapter {
  public files = new Map<string, Uint8Array>();
  public shouldFailWrite = false;

  async readFile(uri: FileUriLike): Promise<Uint8Array> {
    const data = this.files.get(uri.fsPath);
    if (!data) throw new Error(`File not found: ${uri.fsPath}`);
    return data;
  }

  async writeFile(uri: FileUriLike, content: Uint8Array): Promise<void> {
    if (this.shouldFailWrite) throw new Error('Simulated disk failure');
    this.files.set(uri.fsPath, content);
  }

  async rename(source: FileUriLike, target: FileUriLike): Promise<void> {
    const data = this.files.get(source.fsPath);
    if (!data) throw new Error(`Source not found: ${source.fsPath}`);
    this.files.set(target.fsPath, data);
    this.files.delete(source.fsPath);
  }

  async delete(uri: FileUriLike): Promise<void> {
    this.files.delete(uri.fsPath);
  }
}

describe('Phase 4: Storage Migration Commands & File Lifecycle', () => {
  const sampleEmbeddedMd = `## Service Alpha {#alpha}
<!-- graph-node: shape=rounded-rectangle; color=blue -->
Alpha service details.

- [[#beta]]

## Service Beta {#beta}
<!-- graph-node: shape=rounded-rectangle; color=green -->
Beta worker.

<!-- canvas-meta
{"version":1,"nodes":{"alpha":{"x":120,"y":80,"width":160,"height":60},"beta":{"x":340,"y":200,"width":160,"height":60}},"groups":{},"viewport":{"x":10,"y":20,"zoom":1.25}}
-->
`;

  it('convertToSidecar: converts embedded metadata to sidecar file and strips canvas-meta cleanly', async () => {
    const fs = new MemoryFs();
    const manager = new SidecarStorageManager(fs);
    const docUri: FileUriLike = { fsPath: 'd:/workspace/app.md', toString: () => 'd:/workspace/app.md' };

    const result = await performConvertToSidecar(docUri, sampleEmbeddedMd, {
      sidecarManager: manager,
      naming: 'dot-md-graph-json',
    });

    expect(result.success).toBe(true);
    expect(result.cleanMarkdownText).toBeDefined();
    expect(result.cleanMarkdownText).not.toContain('<!-- canvas-meta');
    expect(result.cleanMarkdownText).toContain('## Service Alpha {#alpha}');

    const sidecarUri = manager.getSidecarUri(docUri, 'dot-md-graph-json');
    const sidecarBytes = fs.files.get(sidecarUri.fsPath);
    expect(sidecarBytes).toBeDefined();

    const sidecarJson = JSON.parse(new TextDecoder().decode(sidecarBytes!)) as CanvasMeta;
    expect(sidecarJson.nodes['alpha'].x).toBe(120);
    expect(sidecarJson.nodes['beta'].y).toBe(200);
    expect(sidecarJson.viewport.zoom).toBe(1.25);
  });

  it('convertToSidecar: fails safely when document has no embedded metadata', async () => {
    const fs = new MemoryFs();
    const manager = new SidecarStorageManager(fs);
    const docUri: FileUriLike = { fsPath: 'd:/workspace/clean.md', toString: () => 'd:/workspace/clean.md' };
    const cleanDoc = '## Simple Node\nContent without meta.\n';

    const result = await performConvertToSidecar(docUri, cleanDoc, {
      sidecarManager: manager,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No embedded layout metadata found');
    expect(fs.files.size).toBe(0);
  });

  it('convertToSidecar: prompts for overwrite and cancels if user rejects', async () => {
    const fs = new MemoryFs();
    const manager = new SidecarStorageManager(fs);
    const docUri: FileUriLike = { fsPath: 'd:/workspace/app.md', toString: () => 'd:/workspace/app.md' };

    const sidecarUri = manager.getSidecarUri(docUri);
    fs.files.set(sidecarUri.fsPath, new TextEncoder().encode('{"version":1,"nodes":{}}'));

    let askedPrompt = '';
    const result = await performConvertToSidecar(docUri, sampleEmbeddedMd, {
      sidecarManager: manager,
      confirmOverwrite: async (msg) => {
        askedPrompt = msg;
        return false;
      },
    });

    expect(askedPrompt).toContain('already exists');
    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
  });

  it('convertToSidecar: Zero Data Loss - aborts and preserves original markdown if sidecar write fails', async () => {
    const fs = new MemoryFs();
    fs.shouldFailWrite = true;
    const manager = new SidecarStorageManager(fs);
    const docUri: FileUriLike = { fsPath: 'd:/workspace/app.md', toString: () => 'd:/workspace/app.md' };

    const result = await performConvertToSidecar(docUri, sampleEmbeddedMd, {
      sidecarManager: manager,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to write sidecar file');
    expect(result.cleanMarkdownText).toBeUndefined();
  });

  it('embedMetadata: embeds sidecar metadata into Markdown and roundtrip preserves data completely', async () => {
    const fs = new MemoryFs();
    const manager = new SidecarStorageManager(fs);
    const docUri: FileUriLike = { fsPath: 'd:/workspace/app.md', toString: () => 'd:/workspace/app.md' };

    const originalMeta = parseMarkdownGraph(sampleEmbeddedMd).meta!;

    // 1. Convert to sidecar
    const toSidecarResult = await performConvertToSidecar(docUri, sampleEmbeddedMd, {
      sidecarManager: manager,
    });
    expect(toSidecarResult.success).toBe(true);
    const cleanMd = toSidecarResult.cleanMarkdownText!;

    // 2. Embed metadata back into clean Markdown
    const embedResult = await performEmbedMetadata(docUri, cleanMd, {
      sidecarManager: manager,
    });
    expect(embedResult.success).toBe(true);
    expect(embedResult.embeddedMarkdownText).toContain('<!-- canvas-meta');

    // 3. Verify parsed meta from roundtrip
    const roundtripParsed = parseMarkdownGraph(embedResult.embeddedMarkdownText!);
    expect(roundtripParsed.meta).toEqual(originalMeta);
  });

  it('stripEmbeddedCanvasMeta: strips trailing canvas-meta block accurately', () => {
    const stripped = stripEmbeddedCanvasMeta(sampleEmbeddedMd);
    expect(stripped).not.toContain('canvas-meta');
    expect(stripped).toContain('## Service Beta {#beta}');
    expect(stripped.endsWith('\n')).toBe(true);
  });

  it('computeRenamedSidecarPairs: calculates correct rename paths for both naming styles', () => {
    const oldMd: FileUriLike = { fsPath: 'd:/notes/arch.md', toString: () => 'd:/notes/arch.md' };
    const newMd: FileUriLike = { fsPath: 'd:/notes/architecture.md', toString: () => 'd:/notes/architecture.md' };

    const pairs = computeRenamedSidecarPairs(oldMd, newMd);
    expect(pairs).toHaveLength(2);

    expect(pairs[0].oldSidecar.fsPath).toBe('d:/notes/arch.md.graph.json');
    expect(pairs[0].newSidecar.fsPath).toBe('d:/notes/architecture.md.graph.json');

    expect(pairs[1].oldSidecar.fsPath).toBe('d:/notes/arch.graph.json');
    expect(pairs[1].newSidecar.fsPath).toBe('d:/notes/architecture.graph.json');
  });

  it('syncSidecarRename: renames existing sidecar file on disk when Markdown is renamed', async () => {
    const fs = new MemoryFs();
    const oldMd: FileUriLike = { fsPath: 'd:/notes/system.md', toString: () => 'd:/notes/system.md' };
    const newMd: FileUriLike = { fsPath: 'd:/notes/overview.md', toString: () => 'd:/notes/overview.md' };

    fs.files.set('d:/notes/system.md.graph.json', new TextEncoder().encode('{"version":1}'));

    const renamed = await syncSidecarRename({ oldUri: oldMd, newUri: newMd }, fs);
    expect(renamed).toHaveLength(1);
    expect(renamed[0].oldPath).toBe('d:/notes/system.md.graph.json');
    expect(renamed[0].newPath).toBe('d:/notes/overview.md.graph.json');

    expect(fs.files.has('d:/notes/system.md.graph.json')).toBe(false);
    expect(fs.files.has('d:/notes/overview.md.graph.json')).toBe(true);
  });
});
