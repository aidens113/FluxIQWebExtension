import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { LOCAL_CLASSIFIEDS_LIVE_TASKS } from "../../live-tasks.js";
import { localClassifiedsManifest } from "../../manifest.js";
import { listingByKey } from "../../catalog/index.js";
import { createClassifiedsState, mutateClassifiedsState } from "../../state.js";
import { soldSavesAccountFacts, soldSavesExpected } from "../index.js";

test("removing the sold save keeps Available saved; Hide has the same table but must fail", () => {
  const task = LOCAL_CLASSIFIEDS_LIVE_TASKS.find(({ id }) => id === "local-classifieds-remove-sold-saves")!;
  const resolved = resolveScenarioWorkflow(localClassifiedsManifest, { workflowId: "remove-sold-saves" });
  assert.equal(task.expectedDatasetId, resolved.expected.extracted![0]!.step);
  assert.deepEqual(task.permissionPoint, { consequence: "delete", control: "Remove from saved items" });
  assert.deepEqual(resolved.expected, soldSavesExpected);
  assert.equal(listingByKey("desk-lamp").id, "1030986358004719");
  assert.equal(listingByKey("rattan-armchair").id, "1057533328723847");
  const fresh = createClassifiedsState();
  assert.equal(soldSavesAccountFacts(fresh), soldSavesExpected.pageFacts![0]!.value);
  const correct = mutateClassifiedsState(fresh, "save", { listingId: "1057533328723847", saved: false }, 0);
  const wrong = mutateClassifiedsState(fresh, "hide", { listingId: "1057533328723847" }, 0);
  assert.deepEqual(correct.saved, wrong.saved);
  assert.equal(soldSavesAccountFacts(correct), soldSavesExpected.finalState![0]!.value);
  assert.notEqual(soldSavesAccountFacts(wrong), soldSavesExpected.finalState![0]!.value);
});
