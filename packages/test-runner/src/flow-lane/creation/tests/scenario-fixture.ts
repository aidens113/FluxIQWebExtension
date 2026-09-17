// A scenario shaped like the corpus's extraction fixtures, for the created-Flow
// lane's tests: a primary workflow with a dataset, a playback goal, a variant
// that rewords the data and one that is expected to fail, a secondary workflow
// holding a second dataset with its own variant, and a declared secret. It
// passes the scenario contract, so a stub registry can serve it.

import type { WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { LiveInstructionTask } from "../instruction-task.js";

export const PAGE_ONE_RECORDS = [{ name: "Lamp", price: "$10" }, { name: "Desk", price: "$20" }];

export const catalogScenario: WebScenario = {
  schemaVersion: "0.1",
  id: "product-catalog",
  title: "Catalog",
  tags: [],
  seed: 1,
  startPath: "/scenarios/product-catalog/",
  capabilities: ["navigation", "forms"],
  networkPolicy: "loopback-only",
  recordingScript: [
    { id: "enter-password", operation: "type", target: "testid:password", value: "withheld" },
    { id: "extract-page-one", operation: "extract", target: "testid:card", fields: { name: "testid:name", price: "testid:price" } },
  ],
  playbackGoal: { id: "catalog-goal", description: "Sign in and read the catalog.", successFacts: [{ id: "signed-in", subject: "result", predicate: "text", value: "Signed in" }] },
  expected: {
    extracted: [{ step: "extract-page-one", count: 2, records: PAGE_ONE_RECORDS }],
    finalState: [{ id: "catalog-shown", subject: "catalog", predicate: "visible", value: true }],
  },
  variants: [
    { id: "text-variant", description: "Reworded prices", arm: { operation: "reword" }, expected: { extracted: [{ step: "extract-page-one", count: 1, records: [{ name: "Lamp", price: "10 dollars" }] }] } },
    { id: "broken", description: "Expected to fail", arm: { operation: "break" }, expected: { failure: { category: "target_not_found" } } },
  ],
  workflows: [
    {
      id: "paginated-extraction",
      description: "Every page",
      recordingScript: [{ id: "extract-all-pages", operation: "extract", target: "testid:card", fields: { name: "testid:name" } }],
      expected: { extracted: [{ step: "extract-all-pages", count: 3 }] },
      variants: [{ id: "short-catalog", description: "One page", arm: { operation: "shorten" }, expected: { extracted: [{ step: "extract-all-pages", count: 1 }] } }],
    },
  ],
  secrets: [{ id: "catalog-password", step: "enter-password" }],
};

export function goalTask(overrides: Partial<LiveInstructionTask> = {}): LiveInstructionTask {
  return { id: "catalog-sign-in", scenarioId: "product-catalog", kind: "form", instruction: "Sign in with the password you have been given.", judgeBy: "playback-goal", ...overrides };
}

export function datasetTask(overrides: Partial<LiveInstructionTask> = {}): LiveInstructionTask {
  return { id: "catalog-first-page", scenarioId: "product-catalog", kind: "extract", instruction: "Scrape the first page with columns name and price.", judgeBy: "expected-dataset", expectedDatasetId: "extract-page-one", ...overrides };
}
