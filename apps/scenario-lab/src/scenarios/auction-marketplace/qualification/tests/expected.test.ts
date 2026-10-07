import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { AUCTION_MARKETPLACE_LIVE_TASKS } from "../../live-tasks.js";
import { auctionMarketplaceManifest } from "../../manifest.js";
import { accessoryCleanupExpected } from "../index.js";

test("the new watch cleanup has its own exact dataset and deletion permission", () => {
  const task = AUCTION_MARKETPLACE_LIVE_TASKS.find(({ id }) => id === "auction-marketplace-remove-watched-accessories")!;
  const resolved = resolveScenarioWorkflow(auctionMarketplaceManifest, { workflowId: "remove-watched-accessories" });
  assert.equal(task.judgeBy, "expected-dataset");
  assert.deepEqual(task.permissionPoint, { consequence: "delete", control: "Remove" });
  assert.deepEqual(resolved.expected, accessoryCleanupExpected);
  assert.equal(task.expectedDatasetId, resolved.expected.extracted![0]!.step);
  assert.deepEqual(resolved.expected.extracted![0]!.records, [{ title: "Kestrel 35 Rangefinder Camera", price: "£41.00" }]);
  assert.deepEqual(resolved.expected.finalState!.map(({ subject }) => subject), ["watch-flyout", "bids-flyout", "purchases-flyout", "followed-sellers"]);
});
