import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import type { JsonObject } from "fluxiq/core";
import { defineOutput, IoRegistry, type OutputDispatchResult } from "fluxiq/io";
import { FileRuntimeStore, FLUXIQ_RUNTIME_WITHHELD_VALUE, RuntimeService, type FluxIQRuntimeCommandAttempt, type FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import type { AutomationStudioFlowDocument, AutomationStudioElementTarget } from "fluxiq/automation";
import { classifyAutomationStudioAdaptiveFailure, runAutomationStudioGraph, packAutomationStudioLlmContext, dispatchPolicyOutput as dispatchCorePolicyOutput, createIoPolicyEffectDispatcher as createCoreIoPolicyEffectDispatcher, createRuntimePolicyEffectDispatcher as createCoreRuntimePolicyEffectDispatcher } from "fluxiq/automation";
import { createElementMatcher, type ElementMatcher } from "fluxiq/runtime/target-matching";
import { createWebOutputTargetPreparer } from "../index";
const matcher = createElementMatcher();
const effect = { type: "policy.output.dispatch", payload: { outputId: "activate-element", parameters: { elementId: "confirm" } } };
const action = { actionType: "activate-element", outputId: "activate-element", parameters: { elementId: "confirm" } };
const unmatchedTarget = { kind: "element", fingerprint: { visibleText: "Save" }, candidates: [{ candidateId: "cancel", visibleText: "Cancel" }] };
it("delegates opaque candidates without claiming confidence when no matcher was supplied", async () => {
    const target = { kind: "element", fingerprint: { selector: "#save", visibleText: "Save" }, candidates: [{ candidateId: "unrelated", selector: "#cancel", visibleText: "Cancel" }] };
    const actionWithTarget = { ...action, parameters: { target } };
    const direct = await dispatchPolicyOutput(ioWith(undefined, { elementTarget: true, elementTargetMinConfidence: 1 }), "example", actionWithTarget);
    const throughRuntime = await createRuntimePolicyEffectDispatcher(ioWith(undefined, { elementTarget: true }), "example", runtimeReturning({ status: "succeeded" }))({ type: effect.type, payload: { ...effect.payload, parameters: { target } } });
    for (const result of [direct, throughRuntime]) {
        fields(result, { status: "success", targetResolution: { status: "unresolved_no_matcher", candidateCount: 1 } });
        assert.equal("minimumConfidence" in Object(result?.targetResolution), false);
        assert.equal("confidence" in Object(result?.targetResolution), false);
        fields(result?.outputs?.elementTargetResolution, { status: "unresolved_no_matcher" });
    }
});
it("records a typed target resolution for no match, a weak match, and a confident match", async () => {
    const unmatched = await dispatchPolicyOutput(ioWith(undefined, { elementTarget: true }), "example", { ...action, parameters: { target: unmatchedTarget } }, undefined, undefined, matcher);
    fields(unmatched, {
        status: "failed",
        failure: { category: "target_not_found", code: "element_target.no_match", retryable: true, stage: "target_resolution" },
        targetResolution: { status: "no_match", candidateCount: 1, minimumConfidence: 0.5 }
    });
    const weak = await dispatchPolicyOutput(ioWith(undefined, { elementTarget: true, elementTargetMinConfidence: 0.99 }), "example", {
        ...action,
        parameters: { target: { kind: "element", fingerprint: { visibleText: "Save", testId: "save" }, candidates: [{ candidateId: "save-text", visibleText: "Save" }] } }
    }, undefined, undefined, matcher);
    fields(weak, {
        status: "failed",
        failure: { category: "target_not_found", code: "element_target.below_confidence", retryable: true, stage: "target_resolution" },
        targetResolution: { status: "below_confidence", candidateCount: 1, minimumConfidence: 0.99, candidateId: "save-text" }
    });
    assert.ok(weak.failure);
    assert.ok(weak.failure.expected !== undefined);
    assert.ok(weak.failure.actual !== undefined);
    assert.equal(weak.failure.expected.includes("99%"), true);
    assert.match(weak.failure.actual, /^best candidate confidence \d+%$/);
    const strong = await dispatchPolicyOutput(ioWith(undefined, { elementTarget: true }), "example", {
        ...action,
        parameters: { target: { kind: "element", fingerprint: { visibleText: "Save", testId: "save" }, candidates: [{ candidateId: "cancel", visibleText: "Cancel", testId: "cancel" }, { candidateId: "save", visibleText: "Save", testId: "save" }] } }
    }, undefined, undefined, matcher);
    fields(strong, { status: "success", targetResolution: { status: "matched", candidateId: "save", candidateCount: 2 } });
    assert.equal("failure" in Object(strong), false);
});
it("carries an element target miss to the attempt trace and a target override candidate", async () => {
    const flow = actionFlow({ target: unmatchedTarget });
    const trace = await runAutomationStudioGraph(flow, { delay: async () => undefined, effectDispatcher: createIoPolicyEffectDispatcher(ioWith(undefined, { elementTarget: true }), "example", matcher) });
    const attempt = trace.attempts[0]!;
    fields(attempt, { failure: { category: "target_not_found" }, targetResolution: { status: "no_match", candidateCount: 1 } });
    assert.equal(attempt.transitionComparison?.status, "target_not_found");
    fields(classifyAutomationStudioAdaptiveFailure({ projectId: "project.failure", flowId: flow.flowId, runId: "run.target", attempt }), { failureClass: "target_not_found", candidateKind: "action_target_override" });
});
it("claims no confidence floor on the trace or the run record when no candidates were supplied for one to apply to", async () => {
    const flow = actionFlow({ selector: "#save-settings", target: { kind: "element", fingerprint: { visibleText: "Save changes", testId: "save-settings" } } });
    const trace = await runAutomationStudioGraph(flow, { effectDispatcher: createIoPolicyEffectDispatcher(ioWith(undefined, { elementTarget: true, elementTargetMinConfidence: 0.68 }), "example") });
    const attempt = trace.attempts[0]!;
    assert.equal(attempt.status, "succeeded");
    assert.deepEqual(attempt.targetResolution, { status: "unresolved_no_candidates", candidateCount: 0 });
    fields(attempt.outputs?.elementTargetResolution, { status: "unresolved_no_candidates" });
    assert.equal("minimumConfidence" in Object(attempt.outputs?.elementTargetResolution), false);
});
it("preserves the original missing-fingerprint refusal", async () => {
    fields((await dispatchPolicyOutput(ioWith(undefined, { elementTarget: true }), "example", { ...action, parameters: {} })).failure, { category: "graph_validation_or_unknown_node", code: "element_target.missing_fingerprint", stage: "target_resolution" });
});
describe("a runtime-dispatched output's saved command attempt", () => {
    // Obviously synthetic: every assertion about it is where it must not appear.
    const SUPPLIED = "synthetic-policy-value-that-must-never-be-persisted";
    it("withholds a value the run resolved out of state, while the adapter executes the real one", async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-io-policy-withheld-"));
        try {
            const runtime = new RuntimeService({ store: new FileRuntimeStore({ rootDir: root }) });
            const executed: JsonObject[] = [];
            runtime.registerAdapter({
                adapterId: "example.runtime",
                label: "Example Runtime",
                transport: "direct",
                domainId: "example",
                capabilities: () => [{ id: "example.outputs", kind: "action", domainId: "example", outputIds: ["activate-element"] }],
                execute: (command) => {
                    executed.push(command.parameters ?? {});
                    return { commandId: command.commandId ?? "command.runtime", status: "succeeded" };
                }
            });
            const trace = await runAutomationStudioGraph(actionFlow({ selector: "#field", text: { $state: { path: "run.supplied.text" } } }), {
                inputs: { "run.supplied.text": SUPPLIED },
                effectDispatcher: createRuntimePolicyEffectDispatcher(ioWith(), "example", runtime)
            });
            await runtime.ready();
            assert.equal(trace.status, "succeeded");
            assert.equal(executed.length, 1);
            fields(executed[0], { selector: "#field", text: SUPPLIED });
            assert.equal((executed[0]?.target as unknown as AutomationStudioElementTarget).fingerprint.visibleText, SUPPLIED);
            const [attempt] = runtime.commandAttemptsList();
            const saved = await readFile(path.join(root, "command-attempts", attempt!.attemptId, "attempt.json"), "utf8");
            // The element-target normalizer also reads `text` into the command's target
            // fingerprint, so the value travels twice; neither copy may be saved.
            assert.equal(saved.includes(SUPPLIED), false);
            fields((JSON.parse(saved) as {
                attempt: FluxIQRuntimeCommandAttempt;
            }).attempt.command.parameters, { selector: "#field", text: FLUXIQ_RUNTIME_WITHHELD_VALUE });
        }
        finally {
            await rm(root, { recursive: true, force: true });
        }
    });
});
function dispatchPolicyOutput(io: IoRegistry, domainId: string | null | undefined, action: Parameters<typeof dispatchCorePolicyOutput>[2], signal?: AbortSignal, commandContext?: Parameters<typeof dispatchCorePolicyOutput>[4], matcher?: ElementMatcher) {
    return dispatchCorePolicyOutput(io, domainId, action, signal, commandContext, createWebOutputTargetPreparer(matcher));
}
function createIoPolicyEffectDispatcher(io: IoRegistry, domainId: string | null | undefined, matcher?: ElementMatcher) {
    return createCoreIoPolicyEffectDispatcher(io, domainId, createWebOutputTargetPreparer(matcher));
}
function createRuntimePolicyEffectDispatcher(io: IoRegistry, domainId: string | null | undefined, runtime: RuntimeService, matcher?: ElementMatcher) {
    return createCoreRuntimePolicyEffectDispatcher(io, domainId, runtime, createWebOutputTargetPreparer(matcher));
}
function ioWith(dispatch?: () => OutputDispatchResult, metadata?: JsonObject): IoRegistry {
    const io = new IoRegistry();
    io.registerOutput("example", defineOutput({
        definition: { id: "activate-element", title: "Activate element", ...(metadata ? { metadata } : {}) },
        mode: "request",
        dispatch: dispatch ?? ((request) => ({ ok: true, outputId: request.outputId }))
    }));
    return io;
}
function runtimeReturning(result: Omit<FluxIQRuntimeCommandResult, "commandId">): RuntimeService {
    const runtime = new RuntimeService();
    runtime.registerAdapter({
        adapterId: "example.runtime",
        label: "Example Runtime",
        transport: "direct",
        domainId: "example",
        capabilities: () => [{ id: "example.outputs", kind: "action", domainId: "example", outputIds: ["activate-element"] }],
        execute: (command) => ({ commandId: command.commandId ?? "command.runtime", ...result })
    });
    return runtime;
}
function actionFlow(parameters: JsonObject): AutomationStudioFlowDocument {
    return {
        schemaVersion: "0.1",
        flowId: "flow.failure-propagation",
        ownerKind: "task",
        ownerId: "task.failure-propagation",
        name: "Failure propagation",
        createdAt: 1,
        updatedAt: 1,
        nodes: [{ id: "output", definitionId: "builtin.policy.action", parameterValues: { outputId: "activate-element", parameters } }],
        edges: []
    };
}
function fields(actual: unknown, expected: Record<string, unknown>): void {
    assert.ok(actual !== null && (typeof actual === "object" || typeof actual === "function"));
    const value = actual as Record<string, unknown>;
    for (const [key, wanted] of Object.entries(expected)) {
        assert.ok(key in value, "Missing original oracle field " + key);
        if (wanted !== null && typeof wanted === "object" && !Array.isArray(wanted))
            fields(value[key], wanted as Record<string, unknown>);
        else
            assert.deepEqual(value[key], wanted);
    }
}
