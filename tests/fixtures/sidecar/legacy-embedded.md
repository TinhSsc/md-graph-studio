# System Architecture

## Authentication Service
Validates user credentials and issues tokens.

- [[Database Service|Read user]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal -->
- [[Audit Service]] <!-- graph-edge: arrow=forward; line=solid; path=orthogonal -->

## Database Service
Primary PostgreSQL cluster.

## Audit Service
Stores security audit logs.

<!-- canvas-meta
{"version":1,"nodes":{"Authentication Service":{"x":100,"y":100,"width":240,"height":160},"Database Service":{"x":450,"y":100,"width":240,"height":160},"Audit Service":{"x":450,"y":320,"width":240,"height":160}},"groups":{},"viewport":{"x":0,"y":0,"zoom":1}}
-->
