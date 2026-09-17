# Clipboard and History Plan

## Goal

Add Copy, Cut, Paste, Undo, and Redo for one or many selected nodes through keyboard shortcuts and the canvas context menu.

## Scope

- Copy the selected nodes and connections between them.
- Cut/delete and paste a selection as one document edit.
- Offset every paste so the result is visible and does not overlap exactly.
- Route Undo/Redo through VS Code's document history.
- Keep text-input native clipboard and history behavior unchanged.

## Modules

- `GraphClipboard.ts`: pure capture, paste, and batch-delete transformations.
- `MarkdownGraphEditorProvider.ts`: owns the in-memory clipboard and routes commands.
- `canvasInteractions.ts`: keyboard and context-menu wiring.
- `canvasTemplate.ts`: shortcut help rows.

## Edge Cases

- Ignore ghost nodes and an empty selection.
- Generate unique titles on every paste.
- Preserve only edges whose source and target are both copied.
- Never intercept shortcuts while editing text.

## Verification

- Unit tests for multi-node copy/paste, internal edges, unique names, and batch delete.
- Syntax, TypeScript, existing tests, and production build pass.

## Definition of Done

All five commands work from both keyboard and context menu, including multi-selection, without breaking native text editing.
