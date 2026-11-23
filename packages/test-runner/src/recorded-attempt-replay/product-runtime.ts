import { createHash } from "node:crypto";
import { realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAutomationStudioAnthropicPanelCommandModel, createAutomationStudioAnthropicProvider, isAutomationStudioAnthropicModel, runAutomationStudioRecordedTraceSession, type AutomationStudioService } from "fluxiq/automation";
import { openOfflineTrialHost, type OfflineTrialHost } from "../offline-trial-experiment/run/offline-trial/index.js";
import { recordedReplyCursor } from "./cursor.js";
import { recordedStoreDigest } from "./store-digest.js";
import type { RecordedAttemptArtifact } from "./types.js";
import { admitRecordedAttempt } from "./admit.js";
import { verifyRecordedStartingPosition } from "./position.js";

/** A real public build entry on recorded domain evidence. Its first changed request is a diagnostic prefix, never task acceptance. */
export async function reproduceRecordedBuild(input: {
  artifact: RecordedAttemptArtifact;
  rootDir: string;
  sourceRootDir: string;
  originalRoot: string;
  allowedWorkRoot: string;
  snapshotMethod: "closed-store-copy" | "sqlite-backup";
  traceId: string;
  stream: string;
  request: Parameters<AutomationStudioService["generateFlowBootstrapAdaptation"]>[0];
  chat?: Parameters<AutomationStudioService["conversations"]["respondToPersonTurn"]>[0];
  /** Where the first request that left the recording is kept, so its difference can be traced; ignored run scope only. */
  divergedRequestFile?: string;
}) {
  const admission = admitRecordedAttempt(input.artifact, true);
  if (!admission.admitted) throw new Error(`recorded_build_not_admitted:${admission.gaps.join(",")}`);
  const originalRoot = realpath(input.originalRoot).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return path.resolve(input.originalRoot);
    throw error;
  });
  const [root, archive, original, allowed] = await Promise.all([realpath(input.rootDir), realpath(input.sourceRootDir), originalRoot, realpath(input.allowedWorkRoot)]);
  for (const candidate of [root, archive]) {
    const relative = path.relative(allowed, candidate);
    if (candidate === original || relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("recorded_starting_copy_outside_run_scope");
  }
  if (root === archive) throw new Error("recorded_source_archive_is_not_starting_snapshot");
  if (!["closed-store-copy", "sqlite-backup"].includes(input.snapshotMethod)) throw new Error("recorded_starting_copy_consistency_unproved");
  if (await recordedStoreDigest(path.join(root, ".fluxiq")) !== input.artifact.startingStore.digest) throw new Error("recorded_starting_store_changed");
  const cursor = recordedReplyCursor(input.artifact);
  const wire = JSON.parse(input.artifact.exchanges.find((exchange) => exchange.stream === input.stream)?.request ?? "null") as { model?: unknown } | null;
  if (!wire || !isAutomationStudioAnthropicModel(wire.model)) throw new Error("recorded_start_model_unavailable");
  const model = wire.model;
  const sourceHost = openOfflineTrialHost({ rootDir: archive });
  let targetHost: OfflineTrialHost | undefined;
  try {
    const store = sourceHost.traceStore(input.request.projectId);
    const manifest = await store.readManifest(input.traceId);
    const events = await store.readEventRange(input.traceId, 1, Number.MAX_SAFE_INTEGER);
    const digest = createHash("sha256").update(JSON.stringify({ manifest, events })).digest("hex");
    if (digest !== input.artifact.domainEvidenceDigest) throw new Error("recorded_domain_evidence_changed");
    if (!manifest) throw new Error("recorded_source_manifest_missing");
    const position = await verifyRecordedStartingPosition({ artifact: input.artifact, manifest, store, entry: { request: input.request, chat: input.chat ?? null }, projectId: input.request.projectId, flowId: input.request.flowId });
    const host = openOfflineTrialHost({ rootDir: root });
    targetHost = host;
    let assertDomainSupported = (): void => { throw new Error("recorded_domain_scope_not_entered"); };
    const fetchImpl: typeof fetch = async (_url, init) => {
      try { assertDomainSupported(); } catch (error) {
        host.service.buildCancellation.cancel(input.request.projectId, input.request.flowId);
        throw error;
      }
      if (init?.signal?.aborted) throw new DOMException("Recorded reproduction stopped", "AbortError");
      const reply = cursor.take(input.stream, typeof init?.body === "string" ? init.body : "");
      if (!reply) {
        host.service.buildCancellation.cancel(input.request.projectId, input.request.flowId);
        // The digest says only that it changed; the request itself says what changed. Kept once, never sent anywhere.
        if (input.divergedRequestFile && typeof init?.body === "string") await writeFile(input.divergedRequestFile, init.body, { flag: "wx" }).catch(keptOnce);
        throw new DOMException("Recorded request diverged", "AbortError");
      }
      return new Response([204, 205, 304].includes(reply.status!) ? null : Buffer.from(reply.response!), { status: reply.status!, headers: { "content-type": reply.contentType! } });
    };
    const provider = createAutomationStudioAnthropicProvider({ model, fetchImpl, secretReference: { kind: "secret_reference", id: "secret:recorded-fixture" }, resolveSecret: async () => "recorded-fixture-only" });
    host.service.bindLlmExecutionProvider(async () => ({ provider }));
    host.service.conversations.bindModel(createAutomationStudioAnthropicPanelCommandModel({ model, fetchImpl, resolveKey: async () => "recorded-fixture-only" }));
    const session = await runAutomationStudioRecordedTraceSession({ source: { store, traceId: input.traceId }, gateway: host.gateway }, async (environment) => {
      assertDomainSupported = () => {
        environment.assertSupported();
        environment.signal.throwIfAborted();
      };
      const stopped = () => { host.service.buildCancellation.cancel(input.request.projectId, input.request.flowId); };
      environment.signal.addEventListener("abort", stopped);
      try {
        if (input.chat) await host.service.conversations.respondToPersonTurn(input.chat);
        if (cursor.report().divergence) return { buildStatus: "prefix_diverged" };
        try {
          const result = await host.service.generateFlowBootstrapAdaptation(input.request);
          return { buildStatus: result.status };
        } catch (error) {
          if (cursor.report().divergence) return { buildStatus: "prefix_diverged" };
          throw error;
        }
      } finally { environment.signal.removeEventListener("abort", stopped); }
    });
    return { proof: "recorded_build_prefix" as const, fullAttemptAccepted: false as const, position, modelTiming: "not_replayed" as const, entry: input.chat ? "conversation_interpretation_then_existing_build" : "existing_build", session, model: cursor.report(), historicalUsd: input.artifact.exchanges.every((exchange) => exchange.historicalUsd !== null) ? input.artifact.exchanges.reduce((sum, exchange) => sum + exchange.historicalUsd!, 0) : null };
  } finally {
    try { await targetHost?.close(); } finally { await sourceHost.close(); }
  }
}

/** A later divergence never replaces the first one kept. */
function keptOnce(error: NodeJS.ErrnoException): void {
  if (error.code !== "EEXIST") throw error;
}
