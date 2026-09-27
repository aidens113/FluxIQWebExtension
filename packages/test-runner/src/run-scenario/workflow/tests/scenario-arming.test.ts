import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { armingOf } from "../scenario-arming.js";

const resolved = (variant?: { id: string }) => ({ workflowId: "primary", recordingScript: [], expected: {}, ...(variant ? { variant } : {}) }) as unknown as ResolvedScenarioWorkflow;

test("both Flow lanes arm after the first load, because each presents the unarmed rendering first", () => {
  assert.equal(armingOf({ flow: true }, resolved({ id: "expired" })), "arms-after-loading", "the recording-built Flow lane records unarmed, then arms for the Flow run");
  assert.equal(armingOf({ creation: { task: {} } }, resolved({ id: "expired" })), "arms-after-loading", "the instruction-built lane explores unarmed, then arms for the Flow run");
  assert.equal(armingOf({ flow: true }, resolved()), "arms-after-loading", "an unarmed Flow-lane run still arms after loading: there is simply nothing to arm");
});

test("the existing and clone lanes arm before the first load, and a plain recording run never arms", () => {
  assert.equal(armingOf({}, resolved({ id: "expired" })), "arms-before-loading", "a resolved variant on neither Flow lane is the existing or clone lane, which replays a Flow that already exists");
  assert.equal(armingOf({}, resolved()), "unarmed", "the recording lane records the workflow as the fixture ships it");
  assert.equal(armingOf({ flow: false, creation: undefined }, resolved()), "unarmed");
});
