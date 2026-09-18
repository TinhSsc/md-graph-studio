# Clean System Architecture

Tài liệu thiết kế kiến trúc hệ thống dạng clean Markdown chuẩn AI-readable và human-readable.

## Authentication Service {#auth-service}
<!-- graph-node: shape=rounded-rectangle; color=blue -->
Validates user credentials and issues tokens.

- [[#database-service|Read user]]
- [[#audit-service]]

## Database Service {#database-service}
<!-- graph-node: shape=rectangle; color=green -->
Primary PostgreSQL cluster.

## Audit Service {#audit-service}
<!-- graph-node: shape=rectangle; color=gray -->
Stores security audit logs.
