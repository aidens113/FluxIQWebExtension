// Original complete repair/write/execute/read/match scenarios now use the actual web owners.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeAutomationStudioRuntimePatch, isAutomationStudioRuntimeTargetOverrideTarget } from "fluxiq/automation-studio";
import type { AutomationStudioAdaptationPolicy, AutomationStudioFlowDocument, AutomationStudioFlowNode, AutomationStudioNodeAttemptTrace, AutomationStudioHostRuntimeBoundary } from "fluxiq/automation-studio";
import { normalizeWebElementTarget, validateWebElementTarget } from "../target-normalization";
import { createWebElementMatcher } from "../element-fingerprint";

/** What the web domain resolves a one-element repair to, verbatim. */
const DOMAIN_RESOLVED_TARGET = {
    handles: { element: "target.3" },
    handleResolution: "named",
    tagName: "button",
    accessibleName: "Place order",
    visibleText: "Place order",
    selector: "#place-order-v2",
    metadata: { browserFrameId: 3, formId: "checkout" }
} as const;

/**
 * The observation point, and it is the real one: Core hands the host the node
 * it is about to run, parameters resolved, which is the same object
 * `applyRuntimePatchToFlow` wrote the repaired target into. A web host reads
 * exactly this. Nothing here inspects a private function or a copy of the patch.
 */
function recordingHost(): {
    hostRuntime: AutomationStudioHostRuntimeBoundary;
    nodes: AutomationStudioFlowNode[];
} {
    const nodes: AutomationStudioFlowNode[] = [];
    return {
        nodes,
        hostRuntime: {
            capabilities: ["action-dispatch", "state-snapshot"],
            captureStateSnapshot: (input) => {
                nodes.push(input.node);
                return { stateSnapshotId: `state.${nodes.length}`, stateRef: `state.${nodes.length}@${input.attemptId}:${input.point}`, capturedAt: 1 };
            }
        }
    };
}

/** The target the repaired node actually ran with. */
async function executedTarget(host: ReturnType<typeof recordingHost>): Promise<unknown> {
    const flow = flowFixture();
    const result = await executeAutomationStudioRuntimePatch({
        projectId: "project.round-trip",
        flowId: flow.flowId,
        runId: "run.failed",
        flow,
        failedAttempt: failedAttempt(),
        // The model names the handle; what the node runs with is the domain's
        // resolution of it, because an executed override passes the same domain
        // check a proposed one does.
        patch: {
            kind: "temporary_target_override",
            targetNodeId: "constant",
            target: { handles: { ...DOMAIN_RESOLVED_TARGET.handles } },
            reason: "The control moved."
        },
        validateTargetOverrideEvidence: () => ({ status: "resolved", target: { ...DOMAIN_RESOLVED_TARGET } }),
        policy: repairPolicy(),
        authorizedExternalSideEffects: true,
        options: { hostRuntime: host.hostRuntime },
        now: () => 10
    });
    assert.equal(result.preflight.ok, true, result.preflight.issues.join(" "));
    assert.equal(result.trace?.status, "succeeded");
    // The canonical Flow is never mutated, so the only place the repaired target
    // exists is the copy the rerun executed.
    assert.equal(flow.nodes.find((node) => node.id === "constant")?.parameterValues?.target, undefined);
    const repaired = host.nodes.find((node) => node.id === "constant");
    assert.notEqual(repaired, undefined, "the host was never handed the repaired node");
    return repaired!.parameterValues?.target;
}

describe("Automation Studio opaque repair target, written and read back", () => {
    it("survives being written into the repaired node's parameters and executed", async () => {
        // Core will carry it: bounded handles, JSON, small.
        assert.equal(isAutomationStudioRuntimeTargetOverrideTarget(DOMAIN_RESOLVED_TARGET), true);
        const written = await executedTarget(recordingHost());
        assert.deepEqual(written, DOMAIN_RESOLVED_TARGET);
        // And it is still a target after the round trip, rather than only looking
        // like one: the actual web normalizer reads the original repaired object.
        const normalized = normalizeWebElementTarget(written, { source: "runtime" });
        assert.notEqual(normalized, null, "the repaired node ran with a target Core can no longer read as an element");
        assert.deepEqual(validateWebElementTarget(normalized!).issues.filter((issue) => issue.severity === "error"), []);
        assertTargetFields(normalized!.fingerprint, {
            tagName: "button",
            accessibleName: "Place order",
            visibleText: "Place order",
            selector: "#place-order-v2"
        });
        // The handles ride along without Core ascribing meaning to them, which is
        // the whole point: they are how the domain gets back to what it resolved.
        assert.deepEqual((written as Record<string, unknown>).handles, { element: "target.3" });
    });
    it("would have caught a repair that applied, reported success, and pointed at nothing", () => {
        // The negative that makes the row above worth having. A target carrying only
        // its handles is perfectly valid to Core -- it is carried, written into the
        // node, executed, and the rerun succeeds -- and it identifies no element at
        // all. Nothing but this check stands between that and a green run.
        assert.equal(isAutomationStudioRuntimeTargetOverrideTarget({ handles: { element: "target.3" } }), true);
        assert.equal(normalizeWebElementTarget({ handles: { element: "target.3" } }, { source: "runtime" }), null);
    });
    it("identifies the repaired element by its fingerprint, with the selector as one signal among many", async () => {
        const written = await executedTarget(recordingHost());
        const fingerprint = normalizeWebElementTarget(written, { source: "runtime" })!.fingerprint;
        const matcher = createWebElementMatcher();
        const wanted = { candidateId: "wanted", tagName: "button", accessibleName: "Place order", visibleText: "Place order", selector: "#place-order-v2" };
        const decoy = { candidateId: "decoy", tagName: "button", accessibleName: "Cancel order", visibleText: "Cancel order", selector: "#cancel-order" };
        assert.equal(matcher.bestCandidate(fingerprint, [decoy, wanted])?.candidateId, "wanted");
        // The page renumbers its DOM and every selector changes. A repair whose
        // identity was the selector would now be pointing at nothing, or worse at
        // the decoy; this one still lands, because the name, the text and the tag
        // outweigh the selector in the actual web matcher's calibrated weights.
        const movedWanted = { ...wanted, selector: "#checkout-submit-7f31a" };
        const movedDecoy = { ...decoy, selector: "#place-order-v2" };
        assert.equal(matcher.bestCandidate(fingerprint, [movedDecoy, movedWanted])?.candidateId, "wanted");
    });
});

function flowFixture(): AutomationStudioFlowDocument {
    return {
        schemaVersion: "0.1",
        flowId: "flow.round-trip",
        ownerKind: "routine",
        ownerId: "routine.round-trip",
        name: "Round Trip Flow",
        createdAt: 1,
        updatedAt: 1,
        nodes: [
            { id: "constant", definitionId: "builtin.data.constant", parameterValues: { value: "ok" } },
            { id: "end", definitionId: "builtin.control.end", parameterValues: { resultStatus: "success" } }
        ],
        edges: [
            { id: "constant.end", sourceNodeId: "constant", sourcePortId: "success", targetNodeId: "end", targetPortId: "in" }
        ]
    };
}

function failedAttempt(): AutomationStudioNodeAttemptTrace {
    return {
        attemptId: "constant.attempt.1",
        nodeId: "constant",
        definitionId: "builtin.data.constant",
        startedAt: 1,
        finishedAt: 2,
        status: "failed",
        route: "failed",
        inputs: {},
        outputs: {},
        effects: [],
        message: "The target was not found.",
        failure: { category: "target_not_found", code: "example.target.not_found", retryable: true }
    };
}

function repairPolicy(): AutomationStudioAdaptationPolicy {
    return {
        schemaVersion: "0.1",
        policyId: "policy.round-trip",
        scope: { kind: "flow", flowId: "flow.round-trip" },
        preset: "repair",
        proposalMode: "auto",
        allowRuntimeRecovery: true,
        allowCreateRecoveryPaths: true,
        allowModifySubflows: true,
        allowCreateSubflows: true,
        allowModifyRouter: true,
        allowModifyExpectations: true,
        allowModifyActionTargets: true,
        allowExternalSideEffects: true,
        allowDeleteOrDisableBehavior: false,
        requireApprovalForDestructiveChanges: true,
        requireApprovalForExternalSideEffects: false,
        createdAt: 1,
        updatedAt: 1
    };
}

function assertTargetFields(actual: unknown, expected: Record<string, unknown>): void {
  assert.notEqual(actual, null);
  assert.equal(typeof actual, "object");
  const values = Object.fromEntries(Object.keys(expected).map(key => [key, (actual as Record<string, unknown>)[key]]));
  assert.deepEqual(values, expected);
}
