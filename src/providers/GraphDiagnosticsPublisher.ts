import type { DiagnosticSeverity, GraphDiagnostic } from '../model/graphTypes';

export interface MappedPosition { line: number; character: number; }

/**
 * Plain-object diagnostic ready to be converted to a vscode.Diagnostic by the
 * provider (keeps this module free of vscode imports for unit testing).
 */
export interface MappedGraphDiagnostic {
  rangeStart: MappedPosition;
  rangeEnd: MappedPosition;
  message: string;
  severity: DiagnosticSeverity;
  code?: string;
}

export interface DiagnosticCollectionLike<TUri, TDiagnostic> {
  set(uri: TUri, diagnostics: readonly TDiagnostic[]): unknown;
  delete(uri: TUri): unknown;
}

/**
 * Maps GraphDiagnostics to range-bearing plain objects.
 * - Missing/non-finite offset defaults to line 0 / character 0.
 * - Range end = positionAt(offset + 1) so the squiggle covers at least the
 *   first character at the offset; positionAt implementations clamp
 *   out-of-range offsets, so document end is safe.
 * - Missing severity defaults to 'warning'.
 */
export function mapGraphDiagnostics(
  diagnostics: readonly GraphDiagnostic[],
  positionAt: (offset: number) => MappedPosition
): MappedGraphDiagnostic[] {
  const mapped: MappedGraphDiagnostic[] = [];
  if (!Array.isArray(diagnostics)) return mapped;
  for (const diagnostic of diagnostics) {
    if (!diagnostic || typeof diagnostic.message !== 'string') continue;
    const offset = typeof diagnostic.offset === 'number' && Number.isFinite(diagnostic.offset) && diagnostic.offset >= 0
      ? diagnostic.offset
      : 0;
    const start = safePositionAt(positionAt, offset);
    const end = safePositionAt(positionAt, offset + 1);
    mapped.push({
      rangeStart: { line: start.line, character: start.character },
      rangeEnd: { line: end.line, character: end.character },
      message: diagnostic.message,
      severity: normalizeSeverity(diagnostic.severity),
      ...(diagnostic.code !== undefined ? { code: diagnostic.code } : {}),
    });
  }
  return mapped;
}

function safePositionAt(positionAt: (offset: number) => MappedPosition, offset: number): MappedPosition {
  try {
    const position = positionAt(offset);
    if (position && typeof position.line === 'number' && typeof position.character === 'number') {
      return { line: position.line, character: position.character };
    }
  } catch {
    // Fall through to the default origin position.
  }
  return { line: 0, character: 0 };
}

function normalizeSeverity(severity: DiagnosticSeverity | undefined): DiagnosticSeverity {
  if (severity === 'error' || severity === 'warning' || severity === 'info') return severity;
  return 'warning';
}

/** Thin adapter over vscode.DiagnosticCollection.set; diagnostics are pre-converted by the provider. */
export function publishGraphDiagnostics<TUri, TDiagnostic>(
  collection: DiagnosticCollectionLike<TUri, TDiagnostic>,
  uri: TUri,
  diagnostics: readonly TDiagnostic[]
): void {
  if (!collection || typeof collection.set !== 'function') return;
  collection.set(uri, diagnostics);
}

/** Removes all diagnostics of a document from the collection. */
export function clearGraphDiagnostics<TUri, TDiagnostic>(
  collection: DiagnosticCollectionLike<TUri, TDiagnostic>,
  uri: TUri
): void {
  if (!collection || typeof collection.delete !== 'function') return;
  collection.delete(uri);
}
