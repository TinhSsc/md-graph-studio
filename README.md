# Markdown Graph Studio

Visual graph editor and interactive diagram workspace for semantic Markdown notes, directly inside VS Code.

> [!WARNING]
> **Project Status: Public Beta (Work in Progress)**  
> Markdown Graph Studio is currently under active development. Core features are functional, but canvas metadata structures, features, and UI behaviors may evolve prior to stable release. Feedback and issue reports are welcome.

---

## Overview

**Markdown Graph Studio** bridges the gap between text-based knowledge bases and visual node-graph diagrams. It renders Markdown documents as interactive node-and-edge graphs while keeping standard Markdown syntax as the strict single source of truth.

- **Non-destructive**: Section titles and Markdown text remain plain Markdown. Diagram positions, node styling, and viewport coordinates are safely serialized into a trailing `<!-- canvas-meta -->` comment.
- **Embedded inside VS Code**: No browser instances, external servers, or proprietary cloud accounts required.
- **Bi-directional**: Open as a dedicated custom editor or side-by-side with your standard Markdown text editor.

---

## Markdown Syntax & Data Model

Every second-level heading (`##`) is interpreted as a graph node. Wiki-style links (`[[Target]]` or `[[Target|Label]]`) define directional connections between nodes.

```markdown
## Authentication
<!-- graph-node: shape=diamond; color=yellow -->
Validate user token and credentials.
- [[Dashboard|success]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal -->
- [[Login Error|invalid]] <!-- graph-edge: arrow=forward; line=dashed; path=orthogonal -->

## Dashboard
<!-- graph-node: shape=rounded-rectangle; color=green -->
Primary application overview.

<!-- canvas-meta: {"zoom":1,"pan":{"x":0,"y":0},"nodes":{"Authentication":{"x":120,"y":80},"Dashboard":{"x":420,"y":80}}} -->
```

### Supported Styles
- **Node Shapes**: `rectangle`, `rounded-rectangle`, `circle`, `ellipse`, `diamond`, `triangle`.
- **Node Colors**: `default`, `blue`, `green`, `yellow`, `red`, `purple`.
- **Edge Types**: `orthogonal` routing with collision avoidance, rounded corners, and customizable line patterns (`solid`, `dashed`).

---

## Key Features

- **4-Zone Studio Interface**:
  - **Left Sidebar**: Node outline, search jump, and color filters (collapsible).
  - **Top Floating Toolbar**: Quick node creation, default styling presets, and search overlay.
  - **Right Note Inspector**: In-place node title, Markdown body, shape, and color editing.
  - **Navigation Widget**: Smooth pan, zoom scale, and one-click fit-to-screen controls.
- **Smart Edge Routing**: Orthogonal edge router with collision detection, border contact snapping, and draggable routing guide segments.
- **Ghost Nodes**: Links pointing to non-existent sections appear as ghost nodes. Clicking or editing them automatically scaffolds the section in your Markdown file.
- **Multi-Selection & Canvas Gestures**: Drag marquee selection, multi-node dragging with automatic edge updates, and keyboard nudging.

---

## Canvas Controls & Shortcuts

| Action | Control / Shortcut |
| :--- | :--- |
| **Pan Canvas** | Middle Click + Drag (or Space + Left Click Drag) |
| **Zoom Canvas** | Mouse Wheel / Zoom Controls (<kbd>Ctrl+0</kbd> to Fit, <kbd>Ctrl+1</kbd> to 100%) |
| **Select Node** | Left Click |
| **Multi-Select** | <kbd>Shift</kbd> + Left Click or Marquee Drag on Canvas |
| **Add New Node** | Double Click Canvas / <kbd>N</kbd> / <kbd>Insert</kbd> |
| **Delete Element** | <kbd>Delete</kbd> / <kbd>Backspace</kbd> |
| **Nudge Selection** | Arrow keys (<kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd>) / Hold <kbd>Shift</kbd> for 50px |
| **Find Node** | <kbd>Ctrl+F</kbd> |
| **Shortcuts Cheatsheet** | <kbd>?</kbd> or <kbd>F1</kbd> |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v20 or higher recommended)
- [VS Code](https://code.visualstudio.com/) (v1.95.0 or higher)

### Setup & Development

1. Clone the repository:
   ```bash
   git clone https://github.com/TinhSsc/md-graph-studio.git
   cd md-graph-studio
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile extension:
   ```bash
   npm run build
   ```

4. Run tests and type checks:
   ```bash
   npm run verify
   ```

5. Press <kbd>F5</kbd> in VS Code to launch the Extension Development Host window for live debugging.

### Building Package

Generate an installable `.vsix` package:

```bash
npm run package
```

The resulting file is output to `dist/markdown-graph-studio.vsix`. Install it directly in VS Code via **Extensions: Install from VSIX...**

---

## Upcoming Roadmap

- [ ] Local image embedding thumbnail previews (`![alt](./path.png)`).
- [ ] Tag filtering and tag-based visual grouping (`#tag` / `<!-- graph-tags -->`).
- [ ] Group boundary containers (`<!-- graph-group -->`).
- [ ] Vector export (SVG, PNG, and PDF canvas snapshots).
