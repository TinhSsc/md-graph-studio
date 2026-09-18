# Changelog

## 1.1.0
- **System Clipboard Synchronization**:
  - Copying (<kbd>Ctrl+C</kbd>) or cutting (<kbd>Ctrl+X</kbd>) selected nodes now copies standard Markdown directly to the OS system clipboard for instant pasting anywhere.
  - Added status bar notification upon copying/cutting nodes.
  - Pasting (<kbd>Ctrl+V</kbd>) on the canvas parses external Markdown or plain text from the clipboard to generate new graph nodes.
- **Support Links**: Added Ko-fi support badge and links to README.

## 1.0.1
- **Quick Open Keyboard Shortcuts**: Open any Markdown graph instantly via <kbd>Ctrl+Alt+G</kbd> (<kbd>Cmd+Alt+G</kbd> on macOS) or side-by-side with <kbd>Ctrl+Alt+Shift+G</kbd>.
- **File Explorer Context Menu**: Right-click any `.md` file in the VS Code file explorer to open directly in Graph Studio or Side by Side.
- **Editor Title Bar Actions**: Quick switch between text editor and visual graph editor directly from the editor tab title bar.
- **Editor Tab Context Menu**: Right-click open Markdown tabs to reveal Graph Studio options.

## 1.0.0 - First Production Release
- **Production Readiness**: Full production-grade visual node-graph canvas editor for Markdown files in VS Code.
- **Sidecar Storage**: Store graph coordinates and viewport state in `.md.graph.json` without modifying or polluting plain Markdown text.
- **Embedded & Stateless Modes**: Support for inline frontmatter metadata or pure stateless auto-layout.
- **Rich Content & Table Nodes**: Interactive GFM tables with 4-way keyboard navigation, context menus (insert/delete rows and columns, column alignment, merge).
- **Checklists & Tasks**: Direct checkbox toggling on canvas and boundary-stepping keyboard navigation.
- **Floating Action Bar**: Quick-insert images (local & web), hyperlinks, tasks, code blocks, tags, quotes, and tables.
- **Activity Bar Integration**:
  - **Canvases Explorer**: Recent canvases with hover remove (`×`), right-click menu, and Clear All.
  - **Node Outline**: Real-time node search with Codicon mapping and auto-synchronization with active canvas.
- **Keyboard Navigation & Gestures**: Pan, zoom, marquee selection, multi-select (`Shift`), copy/paste (`Ctrl+C`/`Ctrl+V`), and comprehensive shortcut HUD (`?`).
- **Zero Lock-in**: Plain Markdown (`##` headings + `[[wikilinks]]`) remains the strict single source of truth.

## 0.2.0
- Auto Fit to View on diagram load with bounding-box centering and padding.
- Enhanced mouse controls: middle-click pan, right-click pan, right-click context menu, space + left drag hand tool.
- Cursor-centered smooth zoom (Ctrl + Mouse Wheel / pinch).
- High-performance node dragging with direct transform updates (RAF) and connected edge updates, eliminating lag.
- Interactive drag-to-connect preview line from ports.
- Comprehensive keyboard shortcuts (F, Ctrl+0, Ctrl+1, +, -, N, L, ?, Arrow keys for nudging).
- Real-time node search with focus navigation (Ctrl+F).
- Interactive keyboard shortcuts HUD modal.

## 0.1.0
- Initial Markdown Graph Studio extension.
- Semantic Markdown parser, serializer, auto-layout, graph canvas, and VS Code synchronization.

