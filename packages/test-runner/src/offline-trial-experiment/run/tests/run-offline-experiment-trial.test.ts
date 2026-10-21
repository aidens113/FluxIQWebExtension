// The experiment's wiring to Core's exported offline runner, end to end over a
// fresh workspace: the Core and domain seams load from their builds, the host
// is built as the web process builds it, the trial ports are made from its
// service, and `runAutomationStudioOfflineCandidateTrial` itself answers. A
// source trace the store does not hold is refused by the runner before
// anything runs, no judge is asked and no episode is captured. Opens real
// SQLite stores in a temporary directory.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WEB_AUTOMATION_DOMAIN_ID } from "@fluxiq-web-extension/domain/node";
import { FluxIQ } from "fluxiq";
import { runAutomationStudioOfflineCandidateTrial, type AutomationStudioFlowCandidate } from "fluxiq/automation-studio";
import { loadCoreTrialSeams } from "../core-trial-seams.js";
import { openOfflineTrialHost } from "../offline-trial/index.js";
import { runOfflineExperimentTrial } from "../run-offline-experiment-trial.js";

test("the runner is Core's export and refuses a source trace the store does not hold, before anything runs", async () => {
  assert.equal(typeof runAutomationStudioOfflineCandidateTrial, "function");
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "p4d-wiring-"));
  try {
    // A fresh workspace gets Core's storage layout first, as `fluxiq setup` gives one.
    const layout = FluxIQ.create({ rootDir, domainId: WEB_AUTOMATION_DOMAIN_ID, modelProvidersEnabled: false, loadEnv: false });
    try {
      await layout.setup();
    } finally {
      await layout.close();
    }
    const seams = await loadCoreTrialSeams();
    const setup = openOfflineTrialHost({ rootDir, seams });
    let projectId: string;
    let flowId: string;
    try {
      projectId = (await setup.service.createProject({ name: "Offline wiring", domainId: WEB_AUTOMATION_DOMAIN_ID })).id;
      flowId = (await setup.service.createFlow({ projectId, name: "Wiring" })).flowId;
    } finally {
      await setup.close();
    }
    for (const sessionView of ["none", "declared"] as const) {
      const run = await runOfflineExperimentTrial({
        rootDir, projectId, flowId, startLocation: "http://127.0.0.1:1/", sourceInstructionIds: [], sourceTraceId: "trace.absent",
        candidate: { candidateId: "candidate.wiring", revision: 1, digest: "0".repeat(64), candidate: {} as AutomationStudioFlowCandidate },
        seams, sessionView,
      });
      assert.deepEqual(run.outcome, { status: "refused", reasonCode: "incomplete_capture", detail: "the store holds no manifest for the source trace" });
      assert.equal(run.judgeAsked, 0);
      assert.deepEqual(run.captured, []);
      assert.deepEqual(run.sessionView, { supplied: sessionView, used: null });
    }
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
