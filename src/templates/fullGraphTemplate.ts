import type { CanvasMeta } from '../model/graphTypes';

export const FULL_GRAPH_TEMPLATE = `## 1. Getting Started on Canvas {#getting-started}
<!-- graph-node: shape=rounded-rectangle; color=blue; collapsed=false; locked=false; icon=book -->
This template serves as an interactive walkthrough. Follow these initial steps:

1. Open any \`.md\` file in VS Code.
2. Open the Command Palette and run **Markdown Graph Studio: Open as Graph**.
3. Click **+ Node**, press **N**, or hit **Insert** to create a new node.
4. Pan the canvas using middle mouse drag or hold **Space** while left-dragging.
5. Use the mouse wheel to zoom; press **F** or **Ctrl+0** to fit the entire graph to view.

> Content, nodes, and connections are saved directly back to your Markdown file. Layout positions are stored according to your configured storage mode.

- [[edit-node|Next: Edit node content]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal; color=blue; from=right; to=left -->

## 2. Select, Move & Edit Nodes {#edit-node}
<!-- graph-node: shape=rounded-rectangle; color=purple; collapsed=false; locked=false; icon=file-text -->
1. **Select**: Click a node to select it; hold **Shift** and click to select multiple nodes, or press **Ctrl+A** to select all nodes on the canvas.
2. **Move**: Drag any selected node to move the entire selection together; left-drag on empty canvas to marquee select.
3. **Inline Edit**: Double-click any element (title, table cell, task item, code block, quote, paragraph) or select the node and press **Enter** to edit inline.
4. **Keyboard Navigation**: While editing, use the arrow keys **↑ ↓ ← →** or **Tab / Shift+Tab** to move between adjacent table cells or task items without reaching for the mouse.
5. **Save & Cancel**: Press **Enter** to save single-line edits (use **Ctrl+Enter** for multiline code blocks); press **Escape** to discard changes.
6. **Resize**: Drag the corner grip at the bottom-right of the node to adjust its width and height.

When a node is selected, a floating Action Bar appears above it with quick buttons to insert images, links, tasks, code, tags, quotes, tables, toggle lock state, change icons, or delete the node.

- [[connect-nodes|Next: Connect nodes]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal; color=purple; from=right; to=left -->

## 3. Create & Customize Connectors {#connect-nodes}
<!-- graph-node: shape=rectangle; color=green; collapsed=false; locked=false; icon=git-branch -->
1. Select a source node to reveal white connection ports around its borders.
2. Drag from any port on the source node to a target node to establish a link.
3. Click an existing edge to select it; drag the control handles to reroute its orthogonal path.
4. Right-click an edge to customize its label, arrow direction, line style, and color.
5. Press **Delete** or **Backspace** to remove the selected connection.

The corresponding connector syntax in Markdown:

\`\`\`markdown
- [[target-node-id|Connector Label]] <!-- graph-edge: arrow=forward; line=solid; from=right; to=left -->
\`\`\`

- [[markdown-structure|Explore valid Markdown structure]] <!-- graph-edge: arrow=forward; line=dashed; path=orthogonal; color=green -->

## 4. Markdown Graph Structure {#markdown-structure}
<!-- graph-node: shape=rectangle; color=yellow; collapsed=false; locked=false; icon=file-text -->
Every node is defined by a level-2 heading with a unique ID attribute. The \`graph-node\` metadata comment must immediately follow the heading:

\`\`\`markdown
## API Service {#api-service}
<!-- graph-node: shape=rounded-rectangle; color=green; collapsed=false; locked=false; icon=server -->
Core business logic and service controller.

- [[database|Read and write]] <!-- graph-edge: arrow=both; line=dashed; from=right; to=left -->
\`\`\`

Supported attributes:

| Attribute | Valid Values |
| :--- | :--- |
| \`shape\` | \`rectangle\`, \`rounded-rectangle\` |
| \`color\` | \`blue\`, \`purple\`, \`green\`, \`yellow\`, \`red\`, \`gray\` |
| \`collapsed\`, \`locked\` | \`true\`, \`false\` |
| \`arrow\` | \`forward\`, \`backward\`, \`both\`, \`none\` |
| \`line\` | \`solid\`, \`dashed\`, \`dotted\` |
| \`from\`, \`to\` | \`top\`, \`right\`, \`bottom\`, \`left\` |

Avoid modifying a node's ID if other wikilinks across the graph still reference it.

- [[rich-content|Next: Insert rich content]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal; color=yellow -->

## 5. Insert Content via Action Bar {#rich-content}
<!-- graph-node: shape=rounded-rectangle; color=blue; collapsed=false; locked=false; icon=terminal -->
Select any node and use the floating Action Bar buttons:

- **Image → From Workspace**: Choose an image within your workspace; a clean relative path is generated.
- **Image → From URL**: Enter an external image link starting with \`https://\` or \`http://\`.
- **Link**: Provide a label and URL to generate a standard Markdown hyperlink.
- **Task / Code / Tag / Quote**: Quick-insert the corresponding rich block.
- **Table**: Select row and column dimensions to insert a full GFM table.

You can also write standard Markdown directly: **bold**, *italic*, ~~strikethrough~~, \`inline code\`, [CommonMark syntax](https://commonmark.org/help/), and bare URLs such as https://code.visualstudio.com/docs.

- [[image-example|View live image example]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal; color=blue -->
- [[table-tasks|View interactive tables & tasks]] <!-- graph-edge: arrow=forward; line=dotted; path=orthogonal; color=blue -->

## 6. Live Images & Fallback Handling {#image-example}
<!-- graph-node: shape=rounded-rectangle; color=gray; collapsed=false; locked=false; icon=image -->
![Markdown Logo from Wikimedia Commons](https://upload.wikimedia.org/wikipedia/commons/4/48/Markdown-mark.svg)

The image above uses an authentic, publicly accessible URL hosted on Wikimedia Commons:

\`\`\`markdown
![Image description](https://upload.wikimedia.org/wikipedia/commons/4/48/Markdown-mark.svg)
\`\`\`

Troubleshooting image display:

1. Open the URL in an external browser to verify it is reachable.
2. Prefer direct URLs pointing to the image file rather than web page wrappers.
3. If hotlinking is blocked by the host, download the asset into your workspace and use **Image → From Workspace**.
4. Always include descriptive alt text inside \`![...]\` so readers retain context even if offline.

Source & license details: [Markdown Mark on Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Markdown-mark.svg).

## 7. Interactive Tables & Checklists {#table-tasks}
<!-- graph-node: shape=rounded-rectangle; color=green; collapsed=false; locked=false; icon=check-circle -->
Click directly into any table cell to edit. When the caret reaches cell boundaries, use **↑ ↓ ← →** to navigate across cells, or use **Tab / Shift+Tab** to step next/previous.

| Operation | How to Perform |
| :--- | :--- |
| Add / Delete Row | Right-click cell → Insert Row Above/Below or Delete Row |
| Add / Delete Column | Right-click cell → Insert Column Left/Right or Delete Column |
| Column Alignment | Right-click cell → Col Align (Left / Center / Right) |
| Merge Across Columns | Right-click cell → Span Across 2 Columns |
| Remove Entire Table | Right-click table → Delete Table |

- [x] Click checkbox directly on canvas to toggle completion
- [ ] Right-click task item to edit, mark, or delete
- [ ] Use arrow keys at text boundaries to step between checklist lines

- [[organize-find|Next: Organize & search nodes]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal; color=green -->

## 8. Organize, Lock & Search Nodes {#organize-find}
<!-- graph-node: shape=rectangle; color=red; collapsed=false; locked=false; icon=folder -->
- Use the **Auto Arrange** button on the top toolbar to organize the layout left-to-right or top-to-bottom.
- Lock nodes using the Action Bar or context menu to avoid accidental dragging.
- Collapse long nodes via right-click to conserve canvas space; expand anytime with the corner toggle.
- Press **Ctrl+F** to focus the search box in the **Node** view within the Activity Bar.
- Click any search result in the **Node** view to select and center that node on the canvas.
- Press **F** or **Ctrl+0** to fit the graph to screen; **Ctrl+1** to reset to 100% zoom.

- [[shortcuts|View complete shortcuts guide]] <!-- graph-edge: arrow=forward; line=dashed; path=orthogonal; color=red -->

## 9. Comprehensive Keyboard Shortcuts {#shortcuts}
<!-- graph-node: shape=rounded-rectangle; color=purple; collapsed=false; locked=false; icon=zap -->
| Key Shortcut | Action Description |
| :--- | :--- |
| \`N\` / \`Insert\` | Create a new node at center |
| \`Enter\` | Edit selected node inline |
| \`Ctrl+A\` | Select all nodes on canvas |
| \`Ctrl+D\` | Duplicate selected node(s) |
| \`Ctrl+C / X / V\` | Copy / cut / paste nodes |
| \`Ctrl+Z / Ctrl+Y\` | Undo / redo layout & edits |
| \`Delete / Backspace\` | Delete selected node or connector |
| \`Escape\` | Deselect all or close popovers |
| \`?\` / \`F1\` | Open Keyboard Shortcuts & Controls modal |

> Note: On macOS, use **Cmd** instead of **Ctrl** for all standard shortcut combinations.

- [[getting-started|Return to the first step]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal; color=purple -->
`;

export const FULL_GRAPH_TEMPLATE_META: CanvasMeta = {
  version: 1,
  nodes: {
    'getting-started': { x: 80, y: 80, width: 400, height: 390 },
    'edit-node': { x: 560, y: 80, width: 400, height: 430 },
    'connect-nodes': { x: 1040, y: 80, width: 400, height: 430 },
    'markdown-structure': { x: 1040, y: 620, width: 400, height: 590 },
    'rich-content': { x: 560, y: 620, width: 400, height: 450 },
    'image-example': { x: 80, y: 620, width: 400, height: 540 },
    'table-tasks': { x: 80, y: 1300, width: 400, height: 500 },
    'organize-find': { x: 560, y: 1300, width: 400, height: 390 },
    shortcuts: { x: 1040, y: 1300, width: 400, height: 510 },
  },
  groups: {},
  viewport: { x: 0, y: 0, zoom: 1 },
};
