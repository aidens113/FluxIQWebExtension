import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { armingOf } from "../scenario-arming.js";

const resolved = (variant?: { id: string }) => ({ workflowId: "primary", recordingScript: [], expected: {}, ...(variant ? { variant } : {}) }) as unknown as ResolvedScenarioWorkflow;

test("the created-Flow lane arms after the first load, because it presents the unarmed rendering first", () => {
  assert.equal(armingOf({ creation: { task: {} } }, resolved({ id: "expired" })), "arms-after-loading", "the instruction-built lane explores unarmed, then arms for the Flow run");
  assert.equal(armingOf({ creation: { task: {} } }, resolved()), "arms-after-loading", "an unarmed created-Flow run still arms after loading: there is simply nothing to arm");
});

test("the existing and clone lanes arm before the first load, and a plain recording run never arms", () => {
  assert.equal(armingOf({}, resolved({ id: "expired" })), "arms-before-loading", "a resolved variant off the created-Flow lane is the existing or clone lane, which replays a Flow that already exists");
  assert.equal(armingOf({}, resolved()), "unarmed", "the recording lane records the workflow as the fixture ships it");
  assert.equal(armingOf({ creation: undefined }, resolved()), "unarmed");
});
