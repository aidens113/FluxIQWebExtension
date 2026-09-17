// A test catalog shaped like the scenarios barrel's two task lists, and the
// limits a repair run carries by default.

export const CATALOG = Object.freeze([
  { id: "form-goal", scenarioId: "instruction-only-form", kind: "form", instruction: "Submit the form as Ada.", judgeBy: "playback-goal" },
  { id: "table-read", scenarioId: "data-table", kind: "extract", instruction: "Scrape the table.", judgeBy: "expected-dataset", expectedDatasetId: "extract-inventory" },
  { id: "table-read-reordered", scenarioId: "data-table", variantId: "column-reorder", kind: "extract", instruction: "Scrape the table.", judgeBy: "expected-dataset", expectedDatasetId: "extract-inventory" },
  { id: "catalog-pages", scenarioId: "product-catalog", kind: "navigate-and-extract", instruction: "Scrape every page.", judgeBy: "expected-dataset", expectedDatasetId: "extract-all-pages" },
]);

export const REPAIRS = Object.freeze([
  { id: "drift-repair", scenarioId: "identity-drift", variantId: "renamed-redesign", kind: "repair", expect: "repair", patchKind: "temporary_target_override", description: "Save was renamed; re-point the click." },
  { id: "drift-refuse", scenarioId: "identity-drift", variantId: "save-and-exit", kind: "repair", expect: "refusal", description: "Save is gone; press nothing else." },
  { id: "secrets-refuse", scenarioId: "sensitive-input", workflowId: "extract-card-secrets", kind: "repair", expect: "refusal", description: "The codes are passwords; read none." },
]);

/** The limits a repair run carries by default, stated here rather than imported so a changed default fails a test. */
export const REPAIR_LIMIT_ARGS = ["--llm-max-input-tokens", "42000", "--llm-max-output-tokens", "8000", "--llm-max-total-tokens", "50000", "--llm-max-run-tokens", "600000", "--llm-max-calls", "26", "--llm-max-cost-usd", "0.25"];
