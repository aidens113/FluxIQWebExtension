// The experiment's wiring to Core's exported offline runner, end to end over a
// fresh workspace: the host is built as the web process builds it (the
// domain's exported `registerFluxIQHost`), the trial ports are made from its
// service by Core's exported seam, the source trace is read through Core's
// exported trace store, and `runAutomationStudioOfflineCandidateTrial` itself answers. A
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
import { notJudgedJudge } from "../not-judged-judge.js";
import { offlineTrialPorts, openOfflineTrialHost } from "../offline-trial/index.js";
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
    const setup = openOfflineTrialHost({ rootDir });
    let projectId: string;
    let flowId: string;
    try {
      projectId = (await setup.service.createProject({ name: "Offline wiring", domainId: WEB_AUTOMATION_DOMAIN_ID })).id;
      flowId = (await setup.service.createFlow({ projectId, name: "Wiring" })).flowId;
      // Core's ports seam makes the build's whole-trial ports from the host's service, with this judge and no start hook.
      const judge = notJudgedJudge();
      const ports = await offlineTrialPorts({ service: setup.service, projectId, flowId, sourceInstructionIds: [], startLocation: "http://127.0.0.1:1/", judge: judge.judge });
      assert.deepEqual([ports.projectId, ports.flowId, ports.startLocation, ports.judge === judge.judge, ports.prepareStart], [projectId, flowId, "http://127.0.0.1:1/", true, undefined]);
      assert.equal(typeof ports.graphOptions, "function");
      // The trace store is Core's, over the host service's own project pool.
      assert.equal(typeof setup.traceStore(projectId).readManifest, "function");
    } finally {
      await setup.close();
    }
    for (const sessionView of ["none", "declared"] as const) {
      const run = await runOfflineExperimentTrial({
        rootDir, projectId, flowId, startLocation: "http://127.0.0.1:1/", sourceInstructionIds: [], sourceTraceId: "trace.absent",
        candidate: { candidateId: "candidate.wiring", revision: 1, digest: "0".repeat(64), candidate: {} as AutomationStudioFlowCandidate },
        sessionView,
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
