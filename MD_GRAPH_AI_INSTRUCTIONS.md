# AI Guidelines for Generating Markdown Graphs (Markdown Graph Studio)

This document specifies the mandatory syntax and best practices for AI agents and LLMs when creating, updating, or expanding Architecture Diagrams, Flowcharts, System Topologies, and Concept Mindmaps compatible with **Markdown Graph Studio** in VS Code.

---

## 1. Overall Markdown Graph Structure

A valid markdown graph file contains:
1. **Document Title (`# Document Title`)** and optional introductory preamble.
2. **Nodes (Graph Vertices)**: Each node is represented as an H2 heading with an explicit anchor ID (`## Node Title {#unique-node-id}`) followed immediately by a metadata comment.
3. **Edges (Connections / Arrows)**: Defined as bullet list items containing wiki-links (`- [[target-node-id|Optional Label]]`) with an edge metadata comment.

---

## 2. Node Declaration Standards

### Standard Syntax:
```markdown
## Node Title {#unique-node-id}
<!-- graph-node: shape=rounded-rectangle; color=blue; collapsed=false; locked=false -->
Detailed content of the node goes here...
```

### Mandatory Rules:
1. **Unique Node ID**: Always specify an explicit ID in the heading using `{#unique-node-id}`. Use lowercase letters, digits, and hyphens (e.g., `{#node-auth}`, `{#api-gateway}`, `{#db-primary}`).
2. **Node Shape (`shape` attribute)**:
   - `rounded-rectangle`: Soft rounded rectangle (default; best for services, generic components, application modules).
   - `rectangle`: Sharp rectangle (suitable for Gateways, Controllers, System Boundaries).
   - `diamond`: Decision diamond (ideal for conditional branching, logic checks, authorization gates).
   - `circle`: Circular node (ideal for Databases, Storage, In-memory caches, Start/End states).
   - `ellipse`: Oval / Ellipse (ideal for External services, Third-party APIs, Notification providers).
   - `triangle`: Triangle (ideal for Warning indicators, Risk checkpoints, Message queues, Dead-letter queues).
3. **Node Color Palette (`color` attribute)**:
   - `blue`: Primary client-facing apps, Web UI, Mobile clients, Frontend layer.
   - `purple`: Routers, Reverse proxies, API Gateways, Middleware orchestrators.
   - `green`: Core business microservices, Business logic handlers, Successful terminal states.
   - `yellow`: Authentication, Authorization, Security vaults, Inspection checkpoints.
   - `red`: Payment gateways, Sensitive operations, Danger zones, Error handlers.
   - `gray`: Utility workers, Background daemons, Logging, Telemetry collectors.
4. **State Flags**:
   - `locked=true`: Locks the position of fixed infrastructure nodes (e.g., database clusters).
   - `collapsed=true`: Collapses the node card body when containing lengthy documentation.

---

## 3. Edge / Connection Standards

### Standard Syntax:
```markdown
- [[target-node-id|Connection Label]] <!-- graph-edge: arrow=forward; line=solid; from=right; to=left -->
```

### Edge Attributes:
1. **Arrow Direction (`arrow` attribute)**:
   - `forward`: Unidirectional arrow pointing from source to destination (default: `Source ----> Target`).
   - `both`: Bidirectional arrows (synchronous duplex communication, sync protocols: `A <----> B`).
   - `backward`: Reverse arrow from target back to source (`A <---- B`).
   - `none`: Simple line with no arrowheads (`A ------ B`).
2. **Line Stroke Style (`line` attribute)**:
   - `solid`: Continuous line (synchronous HTTP/gRPC requests, direct DB queries).
   - `dashed`: Dashed line (token verification, auxiliary fallback, soft dependency).
   - `dotted`: Dotted line (asynchronous messaging, Event-driven webhooks, Pub/Sub, Kafka/RabbitMQ).
3. **Connection Ports (`from` and `to` attributes)**:
   - Allowed values: `top`, `right`, `bottom`, `left`.
   - Prevents overlapping lines and provides clean orthogonal routing.
   - Example (Left-to-Right flow): `from=right; to=left`.
   - Example (Top-to-Bottom flow): `from=bottom; to=top`.

---

## 4. Rich Content within Node Bodies

AI models can include markdown elements inside each node body:
- **Task Lists**:
  ```markdown
  - [x] Step 1 completed
  - [ ] Step 2 in progress
  ```
- **Code Blocks**:
  ```markdown
  ```typescript
  const session = await authProvider.verify(token);
  ```
  ```
- **Blockquotes / Alerts**:
  ```markdown
  > Important: Strict TLS v1.3 encryption required between internal microservices.
  ```
- **Tags**:
  ```markdown
  Tags: #security #auth #production #tier1
  ```
- **Markdown Links**:
  ```markdown
  [API Reference Documentation](https://api.example.com/docs)
  ```

---

## 5. Complete Reference Architecture Template

```markdown
# Production Cloud Architecture

## Web Client {#node-client}
<!-- graph-node: shape=rounded-rectangle; color=blue; collapsed=false; locked=false -->
React Single Page Application served via CDN.

- [x] OAuth 2.0 PKCE authentication flow
- [ ] Offline local caching layer

- [[node-gateway|HTTPS API Requests]] <!-- graph-edge: arrow=forward; line=solid; from=right; to=left -->

## API Gateway {#node-gateway}
<!-- graph-node: shape=rectangle; color=purple; collapsed=false; locked=false -->
Reverse proxy, rate limiting, and SSL termination.

- [[node-auth|Validate JWT Token]] <!-- graph-edge: arrow=both; line=dashed; from=bottom; to=top -->
- [[node-service|Forward Request]] <!-- graph-edge: arrow=forward; line=solid; from=right; to=left -->

## Auth Service {#node-auth}
<!-- graph-node: shape=diamond; color=yellow; collapsed=false; locked=false -->
User identity provider and permission evaluator.

> Zero-trust architecture: Enforces mTLS across all private network routes.

- [[node-db|Query Credentials]] <!-- graph-edge: arrow=forward; line=solid; from=right; to=left -->

## Core Service {#node-service}
<!-- graph-node: shape=rounded-rectangle; color=green; collapsed=false; locked=false -->
Primary business workflow orchestration microservice.

- [[node-db|Read / Write State]] <!-- graph-edge: arrow=forward; line=solid; from=bottom; to=top -->

## Database Cluster {#node-db}
<!-- graph-node: shape=circle; color=blue; collapsed=false; locked=true -->
Multi-AZ PostgreSQL cluster with Redis cache.

Tags: #database #postgres #redis #persistence
```
