/** Metadata is publishable; raw requests and replies stay in ignored fixture artifacts. */
export type RecordedExchange = Readonly<{
  stream: string;
  ordinal: number;
  request: string;
  response: Uint8Array | null;
  status: number | null;
  contentType: string | null;
  historicalUsd: number | null;
}>;

export type RecordedAttemptArtifact = Readonly<{
  version: 1;
  provenance: "synthetic-fixture";
  scenarioId: string;
  taskId: string;
  oracleDigest: string;
  source: Readonly<{ core: string; extension: string }>;
  /** An isolated starting-state copy, never the campaign's original store. */
  startingStore: Readonly<{ copied: boolean; digest: string; position?: Readonly<{ sourceTraceId: string; artifactId: string; sha256: string }> }>;
  domainEvidenceDigest: string | null;
  exchanges: readonly RecordedExchange[];
}>;

export type ReplayDivergence = Readonly<{
  code: "unknown_stream" | "exhausted_stream" | "unreadable_request" | "request_changed";
  stream: string;
  ordinal: number;
  expectedDigest: string | null;
  actualDigest: string | null;
}>;
