export const FULL_GRAPH_TEMPLATE = `# Markdown Graph Studio Template

## Product Overview {#product-overview}
<!-- graph-node: shape=rounded-rectangle; color=blue; collapsed=false; locked=false; icon=book -->
This template demonstrates **rich Markdown**, [links](https://code.visualstudio.com), and #tags.

> Edit any node directly on the canvas.

- [[api-service|Calls API]]
- [[delivery-plan|Tracks delivery]] <!-- graph-edge: arrow=both; line=dashed; path=orthogonal; color=yellow; from=right; to=left -->

## API Service {#api-service}
<!-- graph-node: shape=rectangle; color=purple; collapsed=false; locked=false; icon=server -->
Use a square node for boundaries or controllers.

\`\`\`ts
export function status(): string {
  return 'ready';
}
\`\`\`

- [[data-store|Reads and writes]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal; color=purple -->
- [[risk-review|Reports failures]] <!-- graph-edge: arrow=forward; line=dotted; path=orthogonal; color=red -->

## Data Store {#data-store}
<!-- graph-node: shape=rounded-rectangle; color=green; collapsed=false; locked=false; icon=database -->
- Persistent records
- Cached results
- Audit history

## Delivery Plan {#delivery-plan}
<!-- graph-node: shape=rounded-rectangle; color=yellow; collapsed=false; locked=false; icon=check-circle -->
- [x] Define scope
- [ ] Implement the workflow
- [ ] Verify and release

- [[risk-review|Needs approval]] <!-- graph-edge: arrow=none; line=dashed; path=orthogonal; color=gray -->

## Risk Review {#risk-review}
<!-- graph-node: shape=rectangle; color=red; collapsed=false; locked=false; icon=alert-triangle -->
Review security, reliability, and rollback requirements.

## Reference Image {#reference-image}
<!-- graph-node: shape=rounded-rectangle; color=gray; collapsed=true; locked=false; icon=image -->
![Replace this image](https://placehold.co/480x240/png)

Collapsed nodes demonstrate hidden content. Expand this node to view the image.
`;
