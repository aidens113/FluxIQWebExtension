import { isRealisticScenario } from "../realistic-scenarios/index.js";
import { recordedRequestDigest } from "./request-digest.js";
import type { RecordedAttemptArtifact } from "./types.js";

/** Admission reports missing evidence without inventing a response or repairing malformed reply bytes. */
export function admitRecordedAttempt(artifact: RecordedAttemptArtifact, requireDomainEvidence = false): Readonly<{ admitted: boolean; gaps: readonly string[]; buildGaps: readonly string[]; calls: number; historicalUsd: number | null }> {
  const gaps: string[] = [];
  const buildGaps: string[] = [];
  const digest = (value: unknown): boolean => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
  if (artifact.version !== 1) gaps.push("unsupported_version");
  if (artifact.provenance !== "synthetic-fixture") gaps.push("unproved_synthetic_provenance");
  if (!isRealisticScenario(artifact.scenarioId)) gaps.push("unsupported_scenario");
  if (typeof artifact.taskId !== "string" || !artifact.taskId.startsWith(`${artifact.scenarioId}-`)) gaps.push("task_scenario_mismatch");
  if (!digest(artifact.oracleDigest)) gaps.push("missing_oracle_digest");
  if (typeof artifact.source.core !== "string" || !artifact.source.core || typeof artifact.source.extension !== "string" || !artifact.source.extension) gaps.push("missing_source_fingerprints");
  if (artifact.startingStore.copied !== true || !digest(artifact.startingStore.digest)) buildGaps.push("unproved_starting_copy");
  if (!artifact.startingStore.position?.sourceTraceId || !artifact.startingStore.position.artifactId || !digest(artifact.startingStore.position.sha256)) buildGaps.push("unproved_starting_position");
  if (!digest(artifact.domainEvidenceDigest)) buildGaps.push("missing_domain_evidence");
  const ordinals = new Map<string, number>();
  let historicalUsd: number | null = 0;
  for (const exchange of artifact.exchanges) {
    const key = `${exchange.stream}:${exchange.ordinal}`;
    if (typeof exchange.stream !== "string" || !exchange.stream || !Number.isSafeInteger(exchange.ordinal) || exchange.ordinal !== (ordinals.get(exchange.stream) ?? 0) + 1) gaps.push(`unproved_stream_order:${key}`);
    ordinals.set(exchange.stream, exchange.ordinal);
    try { recordedRequestDigest(exchange.request); } catch { gaps.push(`unreadable_request:${key}`); }
    if (!(exchange.response instanceof Uint8Array)) gaps.push(`missing_response:${key}`);
    if (!Number.isInteger(exchange.status) || exchange.status === null || exchange.status < 200 || exchange.status > 599) gaps.push(`missing_status:${key}`);
    if (typeof exchange.contentType !== "string" || !exchange.contentType || /[\r\n]/u.test(exchange.contentType)) gaps.push(`missing_content_type:${key}`);
    if (exchange.historicalUsd === null || !Number.isFinite(exchange.historicalUsd) || exchange.historicalUsd < 0) historicalUsd = null;
    else if (historicalUsd !== null) historicalUsd += exchange.historicalUsd;
  }
  if (!artifact.exchanges.length) gaps.push("no_model_exchanges");
  if (requireDomainEvidence) gaps.push(...buildGaps);
  return { admitted: gaps.length === 0, gaps, buildGaps, calls: artifact.exchanges.length, historicalUsd };
}
