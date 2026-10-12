import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FluxIQ } from "fluxiq";
import { WEB_AUTOMATION_DOMAIN_ID, webAutomationDomain } from "@fluxiq-web-extension/domain/node";
import { RunnerFailure } from "../../../failure.js";
import { compileMatrixFlow, MatrixAuthoringGap } from "../compile-flow-script.js";
import * as flows from "../../flows/index.js";
import { CONFIRM_QUALIFYING } from "../../flows/index.js";
import { RECOVERY_MATRIX_ROWS } from "../../matrix-rows.js";

/** A FluxIQ root set up as a workspace's Core leaves it, with one web project. */
async function workspace(): Promise<{ root: string; projectId: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "recovery-matrix-compile-"));
  const fluxiq = FluxIQ.create({ rootDir: root, loadEnv: false, domainId: WEB_AUTOMATION_DOMAIN_ID, modelProvidersEnabled: false, domains: [webAutomationDomain] });
  try {
    await fluxiq.setup();
    const project = await fluxiq.programs.automationStudio.createProject({ name: "Matrix compile", domainId: WEB_AUTOMATION_DOMAIN_ID });
    return { root, projectId: project.id };
  } finally {
    await fluxiq.close();
  }
}

const scripts = flows as Readonly<Record<string, string>>;
const used = [...new Set(RECOVERY_MATRIX_ROWS.flatMap(row => row.cases.map(matrixCase => ({ flow: matrixCase.flow, gap: row.authoringGap !== undefined, calls: row.needs.includes("call-subflow") }))).map(item => JSON.stringify(item)))].map(item => JSON.parse(item) as { flow: string; gap: boolean; calls: boolean });

for (const { flow, gap, calls } of used) {
  test(gap ? `${flow} is refused for the evidence handle its fact needs, before Core saves it` : `${flow} assembles, validates and is applied as a saved Flow through Core's own path`, { timeout: 120_000 }, async () => {
    const script = scripts[flow];
    assert.equal(typeof script, "string", `the matrix names a Flow ${flow} that flows/ does not export`);
    const { root, projectId } = await workspace();
    try {
      const flowId = `flow.matrix.${flow.toLowerCase().replaceAll("_", "-")}`;
      if (gap) {
        await assert.rejects(compileMatrixFlow({ fluxiqRoot: root, projectId, flowId, flowName: flow, script: script! }), (error: unknown) => error instanceof MatrixAuthoringGap && error.handles.length > 0);
        return;
      }
      const compiling = compileMatrixFlow({ fluxiqRoot: root, projectId, flowId, flowName: flow, script: script! });
      // A Flow that calls a part saves only on a Core whose library has Call Subflow (t392); before that, Core refuses it by that name and nothing else.
      const compiled = calls ? await compiling.catch((error: unknown) => {
        assert.ok(error instanceof RunnerFailure && Array.isArray(error.details?.codes) && error.details.codes.includes("flow_script.call_unavailable"), String(error));
        return undefined;
      }) : await compiling;
      if (!compiled) return;
      assert.equal(compiled.flowId, flowId);
      assert.ok(compiled.subflows.some(subflow => subflow.role === "primary" && subflow.nodes > 0));
      // Read back by a second, independent instance: the Core started afterwards sees what this one saved.
      const reader = FluxIQ.create({ rootDir: root, loadEnv: false, domainId: WEB_AUTOMATION_DOMAIN_ID, modelProvidersEnabled: false, domains: [webAutomationDomain] });
      try {
        const subflows = await reader.programs.automationStudio.listFlowSubflowSummaries({ projectId, flowId, limit: 10, offset: 0 });
        assert.equal(subflows.total, compiled.subflows.length);
      } finally {
        await reader.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
    }
  });
}

test("a handle anywhere in the plan refuses the script, naming the handle", { timeout: 120_000 }, async () => {
  const { root, projectId } = await workspace();
  try {
    const script = `${CONFIRM_QUALIFYING}\non before everywhere: a notice can cover the requests\n  when: exists requests-notice\n  step: close it\n    node: web.dom.click\n    selector: [aria-label="Close"]\n    consequences: none\n  then: carry on\nend`;
    await assert.rejects(compileMatrixFlow({ fluxiqRoot: root, projectId, flowId: "flow.matrix.gap", flowName: "gap", script }), (error: unknown) => error instanceof MatrixAuthoringGap && error.handles.some(item => item.handle === "requests-notice"));
  } finally {
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  }
});
