# Changelog

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

