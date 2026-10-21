// Which page a recorded read read (the P5 gate): the one primary snapshot its
// recorded result's trace references name (`metadata.trace.artifacts`, Core's
// `ClientGatewayTraceResultMetadata`), by its digest and its address's path --
// the document's own address as the client captured it, query and fragment
// left out. No references, or not exactly one primary, name no page.

export function recordedPage(result: unknown): Readonly<{ urlPath: string | null; snapshot: string | null }> {
  const trace = recordOf(recordOf(recordOf(result)?.metadata)?.trace);
  const artifacts = Array.isArray(trace?.artifacts) ? trace.artifacts.map(recordOf) : [];
  const primaries = artifacts.filter((artifact) => artifact?.role === "primary");
  const primary = primaries.length === 1 ? primaries[0] : undefined;
  const snapshot = typeof primary?.sha256 === "string" ? primary.sha256 : null;
  const source = typeof primary?.source === "string" && URL.canParse(primary.source) ? new URL(primary.source) : null;
  return Object.freeze({ urlPath: source?.pathname ?? null, snapshot });
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
