import assert from "node:assert/strict";
import { it } from "node:test";
import type { JsonObject } from "fluxiq/core";
import { IoRegistry, defineOutput } from "fluxiq/io";
import { createElementMatcher } from "fluxiq/runtime/target-matching";
import { createIoOutputEffectDispatcher } from "fluxiq/runtime/output-dispatch";
import { runAutomationStudioGraph } from "fluxiq/engine/automation";
import { createWebOutputTargetPreparer } from "../index";

it("matches canonical element targets before output dispatch", async () => {
    const io = new IoRegistry();
    let dispatchedTarget: any;
    io.registerOutput("example", defineOutput({
      definition: { id: "click-element", title: "Click element", metadata: { elementTarget: true } },
      mode: "request",
      dispatch: (request) => {
        dispatchedTarget = (request.payload as any).target;
        return { ok: true, outputId: request.outputId, payload: { selected: dispatchedTarget?.selectedCandidate?.candidateId } };
      }
    }));
    const flow = {
      schemaVersion: "0.1" as const,
      flowId: "flow.element-match",
      ownerKind: "task" as const,
      ownerId: "task.element-match",
      name: "Element match",
      createdAt: 1,
      updatedAt: 1,
      nodes: [{
        id: "output",
        definitionId: "builtin.policy.action",
        parameterValues: {
          outputId: "click-element",
          parameters: {
            target: {
              kind: "element",
              fingerprint: { visibleText: "Save", testId: "save" },
              candidates: [
                { candidateId: "cancel", visibleText: "Cancel", testId: "cancel" },
                { candidateId: "save", visibleText: "Save", testId: "save" }
              ]
            }
          }
        }
      }],
      edges: []
    };

    const trace = await runAutomationStudioGraph(flow, { effectDispatcher: createIoOutputEffectDispatcher(io, "example", createWebOutputTargetPreparer(createElementMatcher({ weights: { visibleText: 1, testId: 1 } }))) });

    assert.equal(trace.status, "succeeded");
    assert.equal(dispatchedTarget?.selectedCandidate?.candidateId, "save");
    for (const signal of ["visibleText", "testId"]) assert.ok(dispatchedTarget?.selectedCandidate?.matchedSignals?.includes(signal));
    const resolution = trace.attempts[0]?.outputs.elementTargetResolution as JsonObject | undefined;
    assert.equal(resolution?.status, "matched");
    assert.equal(resolution?.candidateId, "save");
  });

it("rejects declared element outputs without an element fingerprint", async () => {
    const io = new IoRegistry();
    io.registerOutput("example", defineOutput({
      definition: { id: "click-element", title: "Click element", metadata: { elementTarget: true } },
      mode: "request",
      dispatch: () => ({ ok: true, outputId: "click-element" })
    }));
    const flow = {
      schemaVersion: "0.1" as const,
      flowId: "flow.element-missing",
      ownerKind: "task" as const,
      ownerId: "task.element-missing",
      name: "Element missing",
      createdAt: 1,
      updatedAt: 1,
      nodes: [{ id: "output", definitionId: "builtin.policy.action", parameterValues: { outputId: "click-element", parameters: {} } }],
      edges: []
    };

    const trace = await runAutomationStudioGraph(flow, { effectDispatcher: createIoOutputEffectDispatcher(io, "example", createWebOutputTargetPreparer()) });

    assert.equal(trace.status, "failed");
    assert.ok(String(trace.attempts[0]?.outputs.error).includes("declares element targeting"));
  });
