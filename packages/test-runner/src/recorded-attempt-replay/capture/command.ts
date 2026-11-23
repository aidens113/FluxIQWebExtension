import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { evaluateClientGatewayTraceCompleteness } from "fluxiq/client-gateway";
import { runExtensionChatCheck } from "../../extension-chat-check/index.js";
import { createBlankCreationFlow, loadCreatedFlowRequest, type CreatedFlowBuildRequest } from "../../flow-lane/index.js";
import { resolveLabPaths } from "../../lab-instance/index.js";
import { loadScenarioManifest } from "../../scenarios.js";
import { freshStoreCopy } from "../../offline-trial-experiment/run/index.js";
import { openOfflineTrialHost } from "../../offline-trial-experiment/run/offline-trial/index.js";
import { captureRecordedStoppedStart } from "./stopped-start.js";
import { recordedStoreDigest } from "../store-digest.js";
import { verifyRecordedStartingPosition } from "../position.js";
import { admitRecordedAttempt } from "../admit.js";
import { recordedCaptureRequest } from "./request.js";
import { RECORDED_CAPTURE_FILES } from "./files.js";
import { recordedRequestDigest } from "../request-digest.js";

/** Produces fresh, stopped bootstrap-prefix evidence. It never admits or repairs an old campaign. */
export async function runRecordedCaptureCommand(input: { repositoryRoot: string; fluxiqRepositoryRoot: string; scenarioId: string; taskId: string; evidenceDirectory: string; source: { core: string; extension: string } }) {
  const relative = path.relative(path.join(input.repositoryRoot, "test-runs"), path.resolve(input.evidenceDirectory));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("recorded_capture_output_scope_refused");
  await mkdir(path.dirname(input.evidenceDirectory), { recursive: true });
  await mkdir(input.evidenceDirectory);
  const paths = resolveLabPaths(input.repositoryRoot);
  const scenario = await loadScenarioManifest(input.repositoryRoot, input.scenarioId, paths.scenarioLabDist);
  const task = await loadCreatedFlowRequest({ repositoryRoot: input.repositoryRoot, scenarioLabDist: paths.scenarioLabDist, scenarioId: input.scenarioId, taskId: input.taskId });
  if (task.task.permissionPoint || task.task.permits?.length) throw new Error("recorded_capture_readonly_task_required");
  const workflow = resolveScenarioWorkflow(scenario, { ...(task.workflowId ? { workflowId: task.workflowId } : {}), ...(task.variantId ? { variantId: task.variantId } : {}) });
  const oracleDigest = createHash("sha256").update(JSON.stringify({ request: task, expected: workflow.expected })).digest("hex");
  let request: CreatedFlowBuildRequest | undefined;
  let snapshot: Awaited<ReturnType<typeof captureRecordedStoppedStart>> | undefined;
  let archive: Awaited<ReturnType<typeof freshStoreCopy>> | undefined;
  let originalRoot: string | undefined;
  let wireRecorded = false;
  let extraNativeRequests = 0;
  let bound: { entry: { request: CreatedFlowBuildRequest & { caller: unknown }; chat: null }; receipt: { entryDigest: string; storeDigest: string } } | undefined;
  let hostRefusal: string | undefined;
  const wireFile = path.join(input.evidenceDirectory, "capture-wire.json");
  const result = await runExtensionChatCheck({ ...input, browser: "chrome", pagePath: scenario.startPath, ask: false,
    hostModulePath: fileURLToPath(new URL("./host-module.js", import.meta.url)),
    prepare: async ({ topology, control, projectId, authorizationPin }) => {
      if (!topology.restartCore || topology.targetMode !== "isolated") throw new Error("recorded_capture_owned_stop_boundary_missing");
      const flowId = await createBlankCreationFlow(control, { projectId, name: "Fresh recorded bootstrap prefix", authorizationPin });
      await control.automationStudioCall("save-flow-generation-instruction", { projectId, flowId, instruction: task.task.instruction }, {}, "web-automation");
      request = recordedCaptureRequest({ projectId, flowId, startLocation: new URL(scenario.startPath, topology.scenarioOrigin).href, taskId: input.taskId });
      originalRoot = topology.allocation.fluxiqRoot;
      await topology.restartCore(async () => {
        snapshot = await captureRecordedStoppedStart({ ...input, rootDir: originalRoot!, work: path.join(input.evidenceDirectory, "starting"), projectId, flowId, oracleDigest }, async () => undefined);
        // The child is genuinely stopped by its owner here. The host binds these store facts to the
        // entry its service actually receives (`./entry-binding.ts`); `request` is what must reach it.
        await writeFile(path.join(originalRoot!, RECORDED_CAPTURE_FILES.configuration), JSON.stringify({ facts: snapshot.facts, declared: request, wireFile: path.join(originalRoot!, RECORDED_CAPTURE_FILES.wire) }));
      });
    },
    proof: async ({ topology, control }) => {
      if (!request || !snapshot || !topology.restartCore) throw new Error("recorded_capture_not_prepared");
      await control.selectExistingContext(request.projectId, undefined, {}, request.flowId);
      try {
        await control.generateFlowBootstrapAdaptation(request, { longRequest: true });
      } catch { /* best-effort: a stopped diagnostic may return a refusal; actual trace admission below decides proof */ }
      finally {
        await topology.restartCore(async () => {
          archive = await freshStoreCopy({ sourceFluxiqDir: path.join(topology.allocation.fluxiqRoot, ".fluxiq"), work: path.join(input.evidenceDirectory, "source-archive") });
          const root = topology.allocation.fluxiqRoot;
          try {
            await writeFile(wireFile, await readFile(path.join(root, RECORDED_CAPTURE_FILES.wire)));
            wireRecorded = true;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
          const entryBytes = await readFile(path.join(root, RECORDED_CAPTURE_FILES.entry)).catch(absent);
          if (entryBytes) {
            await writeFile(path.join(input.evidenceDirectory, "capture-entry.json"), entryBytes);
            bound = JSON.parse(entryBytes.toString("utf8"));
          }
          const refusal = await readFile(path.join(root, RECORDED_CAPTURE_FILES.refusal), "utf8").catch(absent);
          if (refusal) {
            const code: unknown = JSON.parse(refusal).code;
            hostRefusal = typeof code === "string" && /^recorded_capture_[a-z_]+$/u.test(code) ? code : "recorded_capture_refusal_unreadable";
          }
          for (const name of (await readdir(root)).filter((name) => name.startsWith(`${RECORDED_CAPTURE_FILES.wire}.extra-`))) {
            extraNativeRequests += 1;
            await writeFile(path.join(input.evidenceDirectory, name.slice(1)), await readFile(path.join(root, name)));
          }
        });
      }
    },
  });
  const gaps: string[] = [];
  if (extraNativeRequests) gaps.push("unmatched_extra_native_requests");
  let traceId: string | null = null;
  if (!request || !snapshot || !archive || !originalRoot) gaps.push("capture_did_not_reach_archive");
  else if (hostRefusal) gaps.push(hostRefusal);
  else if (!bound) gaps.push("capture_entry_not_bound");
  else if (bound.receipt.storeDigest !== snapshot.storeDigest || bound.receipt.entryDigest !== recordedRequestDigest(JSON.stringify(bound.entry))) gaps.push("capture_receipt_inconsistent");
  else if (!wireRecorded) gaps.push("native_request_not_captured");
  else {
    const entry = bound.entry;
    const wire = JSON.parse(await readFile(wireFile, "utf8"));
    traceId = wire.position.sourceTraceId;
    const host = openOfflineTrialHost({ rootDir: archive.rootDir });
    try {
      const store = host.traceStore(request.projectId);
      const manifest = await store.readManifest(traceId!);
      const events = await store.readEventRange(traceId!, 1, Number.MAX_SAFE_INTEGER);
      const availableArtifacts = [];
      for (const artifact of manifest?.artifacts ?? []) {
        const bytes = await store.readArtifact(traceId!, artifact.id);
        if (bytes) availableArtifacts.push({ id: artifact.id, byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") });
      }
      // This producer used this exact Core; replay independently checks contract compatibility again.
      const completeness = manifest && evaluateClientGatewayTraceCompleteness({ manifest, events, availableArtifacts, compatibility: { status: "compatible" }, recorderActive: false });
      if (!manifest || manifest.origin.kind !== "live" || completeness?.status !== "complete" || completeness.limitations.length) gaps.push("source_trace_not_complete_live");
      else if (!gaps.length) {
        const domainEvidenceDigest = createHash("sha256").update(JSON.stringify({ manifest, events })).digest("hex");
        const artifact = { version: 1, provenance: "synthetic-fixture", scenarioId: input.scenarioId, taskId: input.taskId, oracleDigest, source: input.source, startingStore: { copied: true, digest: snapshot.storeDigest, position: wire.position }, domainEvidenceDigest, exchanges: [{ stream: "build", ordinal: 1, request: wire.request, responseBase64: wire.responseBase64, status: wire.status, contentType: wire.contentType, historicalUsd: 0 }] };
        const artifactFile = path.join(input.evidenceDirectory, "artifact.json");
        const decoded = { ...artifact, version: 1 as const, provenance: "synthetic-fixture" as const, exchanges: artifact.exchanges.map((exchange) => ({ ...exchange, response: Buffer.from(exchange.responseBase64, "base64") })) };
        const admission = admitRecordedAttempt(decoded, true);
        if (!admission.admitted) gaps.push("capture_artifact_not_admitted");
        else {
          await verifyRecordedStartingPosition({ artifact: decoded, manifest, store, entry, projectId: request.projectId, flowId: request.flowId });
          await writeFile(artifactFile, JSON.stringify(artifact));
          await writeFile(path.join(input.evidenceDirectory, "replay-input.json"), JSON.stringify({ artifact: artifactFile, rootDir: snapshot.snapshot.rootDir, sourceRootDir: archive.rootDir, originalRoot, allowedWorkRoot: input.evidenceDirectory, snapshotMethod: "closed-store-copy", traceId, stream: "build", request: entry.request }));
        }
      }
    } finally { await host.close(); }
    if (await recordedStoreDigest(snapshot.snapshot.fluxiqDir) !== snapshot.storeDigest) gaps.push("starting_snapshot_changed");
  }
  if (result.failure) gaps.push("browser_capture_failed");
  // The native transport has no network, so provider traffic is zero by construction; browser
  // network is not observed by this command, so it is reported unknown rather than zero.
  const report = { proof: "fresh_stopped_bootstrap_prefix", fullAttemptAccepted: false, conversationBuildProven: false, providerCalls: 0, providerUsd: 0, externalCalls: null, externalUsd: null, extraNativeRequests, hostRefusal: hostRefusal ?? null, traceId, complete: gaps.length === 0, gaps, stage: result.stage };
  await writeFile(path.join(input.evidenceDirectory, "capture-report.json"), JSON.stringify(report, null, 2));
  return report;
}

function absent(error: NodeJS.ErrnoException): undefined {
  if (error.code === "ENOENT") return undefined;
  throw error;
}
