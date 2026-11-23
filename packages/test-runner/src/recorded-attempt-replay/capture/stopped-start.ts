import path from "node:path";
import { mkdir, realpath } from "node:fs/promises";
import { freshStoreCopy } from "../../offline-trial-experiment/run/index.js";
import { recordedStoreDigest } from "../store-digest.js";
import type { RecordedStartFacts } from "./receipt.js";

type CaptureInput = { repositoryRoot: string; rootDir: string; work: string; projectId: string; flowId: string; taskId: string; oracleDigest: string };

/**
 * The caller owns the child stop boundary; copying starts only after its stop promise succeeds.
 * Answers the closed store's facts; the entry they precede is bound by `recordedStartReceipt`.
 */
export async function captureRecordedStoppedStart(input: CaptureInput, stop: () => Promise<void>) {
  if (!/^[a-f0-9]{64}$/u.test(input.oracleDigest) || !input.projectId || !input.flowId || !input.taskId) throw new Error("recorded_capture_identity_unproved");
  const runRoot = path.resolve(input.repositoryRoot, "test-runs");
  for (const candidate of [input.rootDir, input.work]) {
    const relative = path.relative(runRoot, path.resolve(candidate));
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("recorded_capture_requires_owned_fixture_scope");
  }
  await mkdir(path.dirname(input.work), { recursive: true });
  const [actualRoot, actualWorkParent, actualAllowed] = await Promise.all([realpath(input.rootDir), realpath(path.dirname(input.work)), realpath(runRoot)]);
  for (const candidate of [actualRoot, actualWorkParent]) {
    const relative = path.relative(actualAllowed, candidate);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("recorded_capture_symlink_scope_refused");
  }
  await stop();
  const source = path.join(actualRoot, ".fluxiq");
  const before = await recordedStoreDigest(source, ["security"]);
  const snapshot = await freshStoreCopy({ sourceFluxiqDir: source, work: input.work });
  const storeDigest = await recordedStoreDigest(snapshot.fluxiqDir);
  if (before !== storeDigest || before !== await recordedStoreDigest(source, ["security"])) throw new Error("recorded_capture_closed_store_changed");
  const facts: RecordedStartFacts = Object.freeze({ projectId: input.projectId, flowId: input.flowId, taskId: input.taskId, oracleDigest: input.oracleDigest, storeDigest, capturedAt: new Date().toISOString() });
  return { snapshot, storeDigest, facts };
}
