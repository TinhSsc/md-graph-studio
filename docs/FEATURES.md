# Markdown Graph Studio features

## Current features

- Opens a Markdown file as a VS Code custom graph editor or alongside its text editor.
- Treats every `##` section as a node and every wiki-link (`[[Target]]`) as an edge.
- Supports rectangle and rounded rectangle node shapes.
- Supports six node colors, editable titles and Markdown body content.
- Uses compact toolbar defaults for new-node shape and color; the Note Editor can explicitly apply the current toolbar style to an existing node.
- Creates, edits, and removes nodes and edges without replacing unrelated Markdown.
- Supports edge labels, forward/backward/both arrows, and solid/dashed line styles.
- Treats each edge as an editable entity with two draggable endpoints. Endpoints can snap anywhere along a node border or remain free on the canvas; the four node ports are quick-create controls only.
- Snaps a dragged connector as soon as it touches or approaches a node border, preserving the exact contact position instead of centering it.
- Uses one smooth `orthogonal` edge router that recomputes when nodes move, avoids nearby node bounds, prioritizes the source-port axis, rounds corners, and supports draggable segment guides.
- Shows missing linked sections as ghost nodes; editing or linking them creates a real Markdown section.
- Stores positions, sizes, groups, and viewport only in a final `canvas-meta` comment.
- Provides automatic layout, canvas pan/zoom/fit, search, outline, multi-select, marquee selection, move, resize, keyboard nudging, keyboard shortcuts, and context menu actions.
- Keeps the Markdown document as the source of truth and works entirely inside VS Code.

## Webview structure

- `canvasHtml.ts`: assembles the full VS Code webview document.
- `canvasTemplate.html`: static webview markup.
- `canvasTemplate.ts`: icon placeholder injection for the static markup.
- `canvasStyles.ts`: visual rules for the webview, deliberately isolated from behavior so styling can change without touching graph logic.
- `canvasScript.ts`: bootstrap, state, and event coordination.
- `canvasRendering.ts`: node and edge rendering only.
- `canvasGeometry.ts`: edge geometry and viewport calculations.
- `canvasInteractions.ts`: menu, shortcuts, selection, and editing actions.
- `canvasInspector.ts`: right-side node and edge inspector.

This split deliberately keeps the webview script in a single generated scope. Its modules return script fragments that share the same canvas state, preventing behavior changes caused by moving state across browser modules.

## Recommended Markdown extensions

Rows marked **Enabled** ship in the current renderer; the rest are proposed for future work.

| Capability | Markdown representation | Graph behavior |
| --- | --- | --- |
| Images | `![Alt text](./assets/diagram.png)` inside a node section | **Enabled** — safe thumbnail; click opens the VS Code file preview. Relative paths resolve against the current Markdown file. |
| Node icon | `<!-- graph-node: icon=database -->` | **Enabled** — quick icon assignment from a built-in icon grid; unknown or missing ids use the neutral file icon. |
| Tags | `#project #urgent` or `<!-- graph-tags: project,urgent -->` | Tags render as badges; filtering, coloring, and grouping are future work. |
| Collapsible sections | `<!-- graph-node: collapsed=true -->` | **Enabled** — fold the node body on canvas; toggle from the node header chevron; persisted in canvas metadata. |
| Code blocks | fenced Markdown blocks | **Enabled** — compact code preview with language label, editable in place. |
| Tables and lists | normal Markdown | **Enabled** — tables render with column alignment; lists nest up to depth 3; the source stays untouched. |
| Inline rich text | `**bold**`, `_italic_`, `==mark==`, format-bar buttons | **Enabled** — format bar (sidebar) toggles bold/italic/highlight on the text selection or whole node; the Markdown source stays readable. |
| Document validation | none (parser + validator) | **Enabled** — diagnostics in the VS Code Problems panel plus an issues chip and node badges on canvas. |
| Attachments | normal relative Markdown links | Show file type and open through VS Code. |
| Groups | `<!-- graph-group: name=... -->` plus canvas metadata | Visually surround related nodes without altering node content. |
| Edge routing | `path=orthogonal` plus canvas guide metadata | Add routing quality controls and multi-guide editing. |
| Export | no Markdown syntax change | Export SVG/PNG/PDF from the graph view without changing the document. |

## Image integration rules

1. Use only normal Markdown image syntax so files remain portable and readable outside this extension.
2. Accept local relative paths first; do not fetch remote images by default.
3. Resolve the path in the extension host, validate that it is within the workspace, then convert it with `webview.asWebviewUri` before rendering.
4. Set a restrictive Content Security Policy and allow images only from the webview source and VS Code's generated resource URI.
5. Render a thumbnail with an alt-text fallback; a missing image must not prevent the graph from loading.

## Suggested implementation order

1. Add image parsing and safe webview URI resolution, with parser and provider tests.
2. Add image preview rendering in a dedicated `canvasNodeContent` module and CSS component file.
3. Add tags and filtering, then groups and export.
