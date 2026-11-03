import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionEntry } from "fluxiq/automation";
import { validateRecordingSession } from "fluxiq/automation";
import { normalizeWebElementTarget, validateWebElementTarget, webRecordingTargetPolicy } from "../index";

describe("automation studio element targets", () => {
    it("normalizes legacy selector-style targets into canonical element targets", () => {
        const target = normalizeWebElementTarget({
            selector: "button[data-testid='save']",
            label: "Save",
            metadata: { token: "secret", visibleText: "Save changes" }
        }, { source: "recording" });
        assert.deepEqual(target, {
            kind: "element",
            source: "recording",
            fingerprint: {
                selector: "button[data-testid='save']",
                label: "Save",
                visibleText: "Save changes"
            }
        });
        assert.equal(target?.fingerprint.metadata, undefined);
    });
    it("sanitizes canonical targets while preserving matching signals", () => {
        const target = normalizeWebElementTarget({
            kind: "element",
            fingerprint: {
                visibleText: "Submit order",
                id: "submit",
                attributes: { "data-testid": "submit", "aria-label": "Submit order", password: "nope" },
                metadata: { roleSource: "dom", authorization: "Bearer nope" }
            },
            selectedCandidate: { candidateId: "candidate.submit", confidence: 2, matchedSignals: ["id"], failedSignals: [""] }
        });
        assert.deepEqual(target, {
            kind: "element",
            fingerprint: {
                visibleText: "Submit order",
                id: "submit",
                attributes: { "data-testid": "submit", "aria-label": "Submit order" },
                metadata: { roleSource: "dom" }
            },
            selectedCandidate: { candidateId: "candidate.submit", confidence: 1, matchedSignals: ["id"] }
        });
    });
    it("validates persisted element targets on recording actions", () => {
        const action = actionFixture({
            parameters: {
                target: {
                    kind: "element",
                    fingerprint: { selector: "#save", bounds: { x: 0, y: 0, width: -1, height: 10 } },
                    selectedCandidate: { candidateId: "candidate.save", confidence: 1.2, matchedSignals: [], failedSignals: [] }
                }
            }
        });
        const result = validateRecordingSession({
            schemaVersion: "0.1",
            recordingId: "recording.element-target",
            startedAt: 1,
            environment: { id: "env", kind: "test", label: "Test", domainId: "example" },
            sources: [{ id: "source.host", kind: "event", label: "Host" }],
            actionChannels: [],
            initialState: { timestamp: 1, namespaces: {} },
            timeline: [action],
            notes: [],
            metadata: {}
        }, webRecordingTargetPolicy);
        assertIssueCodes(result.issues.map((issue) => issue.code), ["element_target.invalid_bounds", "element_target.selection_invalid_confidence"]);
    });
    it("requires at least one durable fingerprint signal", () => {
        assert.equal(validateWebElementTarget({ kind: "element", fingerprint: {} }).issues.map((issue) => issue.code).includes("element_target.empty_fingerprint"), true);
    });
    it("enriches fingerprints from action visual targets", () => {
        const target = normalizeWebElementTarget({
            selector: "#submit",
            visualTarget: { entityId: "checkout.submit", entityKind: "button", statePath: { namespace: "app", path: "checkout.submit" } }
        });
        assert.deepEqual(target?.fingerprint, {
            selector: "#submit",
            entityId: "checkout.submit",
            entityKind: "button",
            statePath: { namespace: "app", path: "checkout.submit" }
        });
    });
    it("takes a type action's target identity from its element and never from the typed text", () => {
        const target = normalizeWebElementTarget({
            selector: "#display-name",
            statePath: "web.elements.display.name",
            text: "Ada Lovelace",
            element: { selector: "input#display-name", tagName: "input", implicitRole: "textbox", accessibleName: "Display name", id: "display-name", attributes: { name: "displayName" } }
        }, { source: "mapper" });
        assert.deepEqual(target?.fingerprint, {
            selector: "#display-name",
            statePath: "web.elements.display.name",
            tagName: "input",
            role: "textbox",
            accessibleName: "Display name",
            id: "display-name",
            attributes: { name: "displayName" }
        });
        assert.equal(JSON.stringify(target).includes("Ada Lovelace"), false);
    });
    it("carries a clicked element's own text, identifiers and implied role onto the target", () => {
        const target = normalizeWebElementTarget({
            selector: "#save-settings",
            statePath: "web.elements.save.changes",
            element: { text: "Save changes", tagName: "button", implicitRole: "button", testId: "save-settings", id: "save-settings", classNames: ["btn", "primary"] }
        }, { source: "mapper" });
        assert.deepEqual(target?.fingerprint, {
            selector: "#save-settings",
            statePath: "web.elements.save.changes",
            visibleText: "Save changes",
            tagName: "button",
            role: "button",
            testId: "save-settings",
            id: "save-settings",
            classNames: ["btn", "primary"]
        });
    });
    it("keeps a drawing digest as an opaque token through every shape it arrives in, and still drops unknown fields", () => {
        // A repaired target, flat as a domain resolves it: the digest survives, the
        // fields Core does not declare do not.
        const repaired = normalizeWebElementTarget({
            handles: { element: "t4" },
            handleResolution: "named",
            selector: "span.x9k2",
            tagName: "span",
            classNames: ["x9k2"],
            drawing: "d1.q8f2k7",
            unknownSignal: "kept nowhere"
        }, { source: "runtime" });
        assert.deepEqual(repaired?.fingerprint, { selector: "span.x9k2", tagName: "span", classNames: ["x9k2"], drawing: "d1.q8f2k7" });
        assert.equal(JSON.stringify(repaired).includes("kept nowhere"), false);
        // Already canonical (Core's own rewrite, normalized again), on a candidate,
        // from metadata, and from an action's element.
        const canonical = normalizeWebElementTarget({
            kind: "element",
            fingerprint: { selector: "#a", drawing: "d1.q8f2k7", stray: 1 },
            candidates: [{ candidateId: "c1", selector: "#a", drawing: "d1.q8f2k7" }]
        });
        assert.deepEqual(canonical?.fingerprint, { selector: "#a", drawing: "d1.q8f2k7" });
        assert.equal(canonical?.candidates?.[0]?.drawing, "d1.q8f2k7");
        assert.deepEqual(normalizeWebElementTarget({ selector: "#a", metadata: { drawing: "d1.zz" } })?.fingerprint, { selector: "#a", drawing: "d1.zz" });
        assert.equal(normalizeWebElementTarget({ selector: "#a", element: { tagName: "button", drawing: "d1.q8f2k7" } })?.fingerprint.drawing, "d1.q8f2k7");
        // Not a token: page words, a long value, or a non-string are not kept, and never cut down to one.
        for (const drawing of ["Save this job", "d".repeat(65), 42, "", "  "]) {
            assert.deepEqual(normalizeWebElementTarget({ selector: "#a", drawing })?.fingerprint, { selector: "#a" });
        }
        assert.equal(normalizeWebElementTarget({ selector: "#a", drawing: "d".repeat(64) })?.fingerprint.drawing, "d".repeat(64));
    });
    it("does not count a drawing as an identifying signal of its own", () => {
        assert.equal(normalizeWebElementTarget({ tagName: "span", drawing: "d1.q8f2k7" }), null);
    });
    it("keeps an authored role over the implied one, and reads parameters without an element as before", () => {
        assert.equal(normalizeWebElementTarget({ selector: "#tab", element: { role: "tab", implicitRole: "button", tagName: "button" } })?.fingerprint.role, "tab");
        assert.deepEqual(normalizeWebElementTarget({ selector: "#search", text: "Search" })?.fingerprint, { selector: "#search", visibleText: "Search" });
    });
});

function actionFixture(overrides: Partial<ActionEntry> = {}): ActionEntry {
    return {
        id: "entry.action",
        recordingId: "recording.element-target",
        timestamp: 2,
        monotonicOffsetMs: 1,
        sequence: 0,
        sourceId: "source.host",
        type: "action",
        actionType: "click",
        parameters: {},
        origin: "operator",
        startedAt: 2,
        ...overrides
    };
}

function assertIssueCodes(actual: readonly string[], expected: readonly string[]): void {
  for (const code of expected) assert.equal(actual.includes(code), true, code);
}
