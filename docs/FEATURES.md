# Markdown Graph Studio features

## Current features

- Opens a Markdown file as a VS Code custom graph editor or alongside its text editor.
- Treats every `##` section as a node and every wiki-link (`[[Target]]`) as an edge.
- Supports rectangle, rounded rectangle, circle, ellipse, diamond, and triangle node shapes.
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

These are proposed capabilities; they are not enabled yet.

| Capability | Markdown representation | Graph behavior |
| --- | --- | --- |
| Images | `![Alt text](./assets/diagram.png)` inside a node section | Render a safe thumbnail; click opens the VS Code file preview. Relative paths resolve against the current Markdown file. |
| Node icon | `<!-- graph-node: icon=book -->` | Render a predefined icon in the node header; avoid arbitrary HTML/SVG injection. |
| Tags | `#project #urgent` or `<!-- graph-tags: project,urgent -->` | Filter, color, and group nodes by tag. |
| Collapsible sections | Markdown heading hierarchy (`###`) | Fold body content while retaining title and links. |
| Code blocks | fenced Markdown blocks | Show a compact code preview, with a full editor in the inspector. |
| Tables and lists | normal Markdown | Render a readable compact preview; keep the source untouched. |
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
