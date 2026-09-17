import assert from "node:assert/strict";
import test from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import { resolveCreatedFlowSecrets } from "../secrets.js";
import { catalogScenario } from "./scenario-fixture.js";

/**
 * A created-Flow run needs only the declared secrets its own workflow could
 * ask for, and needs each of those set: a task on a workflow that types no
 * password must not be blocked by one that does, and a task that does must
 * not start without it.
 */
test("a created-Flow run resolves the declared secrets of its own workflow, and refuses when one is unset", () => {
  const primary = resolveScenarioWorkflow(catalogScenario);
  const secondary = resolveScenarioWorkflow(catalogScenario, { workflowId: "paginated-extraction" });
  assert.deepEqual(resolveCreatedFlowSecrets(catalogScenario, primary, { FLUXIQ_TEST_SECRET_CATALOG_PASSWORD: "value-from-env" }), [{ id: "catalog-password", step: "enter-password", value: "value-from-env" }]);
  assert.deepEqual(resolveCreatedFlowSecrets(catalogScenario, secondary, {}), [], "another workflow's declaration is not this task's to supply");
  assert.throws(() => resolveCreatedFlowSecrets(catalogScenario, primary, {}), (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /FLUXIQ_TEST_SECRET_CATALOG_PASSWORD must be set/u.test(error.message));
});
