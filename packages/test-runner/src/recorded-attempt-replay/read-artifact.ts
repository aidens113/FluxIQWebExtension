import { readFile } from "node:fs/promises";
import type { RecordedAttemptArtifact } from "./types.js";
import { admitRecordedAttempt } from "./admit.js";

/** An ignored local artifact contains base64 raw bytes, not decoded model answers. */
export async function readRecordedArtifact(file: string): Promise<RecordedAttemptArtifact> {
  const value = JSON.parse(await readFile(file, "utf8"));
  if (!value || !Array.isArray(value.exchanges) || !value.source || !value.startingStore) throw new Error("recorded_artifact_shape_invalid");
  const artifact: RecordedAttemptArtifact = { ...value, exchanges: value.exchanges.map((exchange: Record<string, unknown>) => {
    const encoded = exchange.responseBase64;
    if (encoded !== null && (typeof encoded !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded))) throw new Error("recorded_response_encoding_invalid");
    return { ...exchange, response: encoded === null ? null : Buffer.from(encoded as string, "base64") };
  }) };
  const admission = admitRecordedAttempt(artifact);
  if (!admission.admitted) throw new Error(`recorded_artifact_not_admitted:${admission.gaps.join(",")}`);
  return artifact;
}
