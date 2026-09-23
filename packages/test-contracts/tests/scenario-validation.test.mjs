import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES as coreFailureClasses } from "@fluxiq/contracts/automation-studio";
import { ContractValidationError, assertWebScenario, expectedActionOutcomes, parseWebScenarioJson, resolveScenarioWorkflow, runActionStatuses, scenarioPageFactSchedule, AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES, scenarioExtractPaginationModes, scenarioStepOperations, validateWebScenario, webScenarioJsonSchema } from "../dist/index.js";

const validScenario = {
  schemaVersion: "0.1",
  id: "basic-form",
  title: "Basic form",
  tags: ["forms", "smoke"],
  seed: 42,
  startPath: "/scenarios/basic-form",
  capabilities: ["forms", "navigation"],
  networkPolicy: "loopback-only",
  recordingScript: [
    { id: "name", operation: "type", target: "name", value: "Ada" },
    { id: "submit", operation: "click", target: "submit" },
    { id: "done", operation: "checkpoint" },
  ],
  expected: { finalState: [{ id: "submitted", subject: "result", predicate: "text", value: "Hello Ada" }] },
};

test("accepts a valid scenario and preserves its typed value", () => {
  const result = validateWebScenario(validScenario);
  assert.equal(result.valid, true);
  assert.equal(result.valid && result.value.id, "basic-form");
  assert.doesNotThrow(() => assertWebScenario(validScenario));
});

test("rejects invalid scenarios before a runner can start", () => {
  const invalid = { ...validScenario, id: "Basic Form", startPath: "https://example.com", networkPolicy: "anything-goes", recordingScript: [{ id: "missing-target", operation: "click" }], unexpected: true };
  const result = validateWebScenario(invalid);
  assert.equal(result.valid, false);
  assert.ok(!result.valid && result.issues.some((entry) => entry.path === "$.id"));
  assert.ok(!result.valid && result.issues.some((entry) => entry.path === "$.recordingScript[0].target"));
  assert.throws(() => assertWebScenario(invalid), ContractValidationError);
});

test("a declared zero-call expectation is accepted, and anything but an absence is refused", () => {
  // The declaration exists so that a variant the deterministic runtime is
  // meant to absorb can say so; `--live-llm` otherwise fails a run that
  // correctly reached no provider. It declares an absence, never a budget --
  // the per-run call caps stay the operator's -- so a non-zero count and a
  // declaration with no reason are both scenario defects.
  const declared = { ...validScenario, expected: { ...validScenario.expected, providerCalls: { count: 0, because: "the ladder re-resolves the renamed control without asking" } } };
  assert.equal(validateWebScenario(declared).valid, true);
  assert.equal(resolveScenarioWorkflow(declared).expected.providerCalls.count, 0);

  const budgeted = validateWebScenario({ ...validScenario, expected: { ...validScenario.expected, providerCalls: { count: 2, because: "one round trip" } } });
  assert.equal(budgeted.valid, false);
  assert.ok(!budgeted.valid && budgeted.issues.some((entry) => entry.path === "$.expected.providerCalls.count"));

  const unexplained = validateWebScenario({ ...validScenario, expected: { ...validScenario.expected, providerCalls: { count: 0 } } });
  assert.equal(unexplained.valid, false);
  assert.ok(!unexplained.valid && unexplained.issues.some((entry) => entry.path === "$.expected.providerCalls.because"));

  const strange = validateWebScenario({ ...validScenario, expected: { ...validScenario.expected, providerCalls: { count: 0, because: "why", reason: "why" } } });
  assert.equal(strange.valid, false);
  assert.ok(!strange.valid && strange.issues.some((entry) => entry.path === "$.expected.providerCalls.reason"));
});

test("a declared absorbing rung is accepted from the closed list, with a reason and an attempt ceiling", () => {
  // The rung is compared against the word the run itself publishes, so a word
  // no run can write would validate and never be met -- an expectation that
  // measures nothing. The list is therefore closed, and the ceiling is bounded
  // well above Core's three attempts and well below a number nothing reaches.
  const declared = { ...validScenario, expected: { ...validScenario.expected, recovery: { absorbedBy: "retry_node", because: "a wait that ran out is attempted again", maxAttemptsPerNode: 2 } } };
  assert.equal(validateWebScenario(declared).valid, true);
  assert.equal(resolveScenarioWorkflow(declared).expected.recovery.absorbedBy, "retry_node");

  // "none" is the control: a fixture whose arming turns out to change nothing
  // the run can see measures nothing, and saying so makes that visible.
  assert.equal(validateWebScenario({ ...validScenario, expected: { ...validScenario.expected, recovery: { absorbedBy: "none", because: "nothing in the ladder can sign a session back in" } } }).valid, true);

  const invented = validateWebScenario({ ...validScenario, expected: { ...validScenario.expected, recovery: { absorbedBy: "clairvoyance", because: "it just works" } } });
  assert.equal(invented.valid, false);
  assert.ok(!invented.valid && invented.issues.some((entry) => entry.path === "$.expected.recovery.absorbedBy"));

  const unexplained = validateWebScenario({ ...validScenario, expected: { ...validScenario.expected, recovery: { absorbedBy: "retry_node" } } });
  assert.equal(unexplained.valid, false);
  assert.ok(!unexplained.valid && unexplained.issues.some((entry) => entry.path === "$.expected.recovery.because"));

  const unbounded = validateWebScenario({ ...validScenario, expected: { ...validScenario.expected, recovery: { absorbedBy: "retry_node", because: "again and again", maxAttemptsPerNode: 500 } } });
  assert.equal(unbounded.valid, false);
  assert.ok(!unbounded.valid && unbounded.issues.some((entry) => entry.path === "$.expected.recovery.maxAttemptsPerNode"));

  const strange = validateWebScenario({ ...validScenario, expected: { ...validScenario.expected, recovery: { absorbedBy: "retry_node", because: "why", rung: "retry_node" } } });
  assert.equal(strange.valid, false);
  assert.ok(!strange.valid && strange.issues.some((entry) => entry.path === "$.expected.recovery.rung"));
});

test("a variant's declaration replaces the workflow's, like every other expectation", () => {
  const scenario = {
    ...validScenario,
    expected: { ...validScenario.expected, providerCalls: { count: 0, because: "the workflow's own" } },
    variants: [{ id: "slow-render", description: "Content arrives late.", arm: { operation: "delay" }, expected: { providerCalls: { count: 0, because: "rung 2 waits for readiness" } } }],
  };
  assert.equal(validateWebScenario(scenario).valid, true);
  assert.equal(resolveScenarioWorkflow(scenario, { variantId: "slow-render" }).expected.providerCalls.because, "rung 2 waits for readiness");

  const rungs = {
    ...validScenario,
    expected: { ...validScenario.expected, recovery: { absorbedBy: "none", because: "the unarmed page needs no recovery" } },
    variants: [{ id: "slow-render", description: "Content arrives late.", arm: { operation: "delay" }, expected: { recovery: { absorbedBy: "retry_node", because: "the wait is attempted again" } } }],
  };
  assert.equal(validateWebScenario(rungs).valid, true);
  assert.equal(resolveScenarioWorkflow(rungs, { variantId: "slow-render" }).expected.recovery.absorbedBy, "retry_node");
});

test("rejects malformed JSON with a contract error", () => {
  assert.throws(() => parseWebScenarioJson("{"), ContractValidationError);
});

test("exports a standalone versioned JSON schema", () => {
  assert.equal(webScenarioJsonSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(webScenarioJsonSchema.properties.schemaVersion.const, "0.1");
  assert.ok(webScenarioJsonSchema.required.includes("recordingScript"));
});

test("allows an empty recording script only for an explicit playback goal", () => {
  const instructionOnly = {
    ...validScenario,
    id: "instruction-only-form",
    recordingScript: [],
    playbackGoal: {
      id: "submit",
      description: "Complete the form from instructions.",
      successFacts: [{ id: "submitted", subject: "result", predicate: "text", value: "Submitted" }],
    },
  };
  assert.equal(validateWebScenario(instructionOnly).valid, true);
  const missingGoal = validateWebScenario({ ...instructionOnly, playbackGoal: undefined });
  assert.equal(missingGoal.valid, false);
  assert.ok(!missingGoal.valid && missingGoal.issues.some(issue => issue.path === "$.recordingScript"));
  assert.equal(webScenarioJsonSchema.properties.recordingScript.minItems, undefined);
  assert.deepEqual(webScenarioJsonSchema.allOf[0].then.required, ["playbackGoal"]);
});

const catalogScenario = {
  ...validScenario,
  id: "product-catalog",
  recordingScript: [
    { id: "search", operation: "type", target: "testid:search", value: "lamp" },
    { id: "submit", operation: "press", target: "testid:search", value: "Enter" },
    { id: "in-stock", operation: "check", target: "testid:in-stock", value: true },
    // The no-results variant expects an empty list, so the step declares minItems: 0 (D4).
    { id: "products", operation: "extract", target: "testid:product", fields: { name: "testid:name", url: "testid:link@href" }, minItems: 0 },
  ],
  expected: { extracted: [{ step: "products", count: 2, records: [{ name: "Lamp", url: "/p/1" }, { name: "Desk lamp", url: "/p/2" }] }] },
  variants: [
    { id: "no-results", description: "Search returns nothing.", arm: { operation: "set-mode", payload: { mode: "empty" } }, expected: { extracted: [{ step: "products", count: 0 }] } },
    { id: "session-expired", description: "Login is required mid-run.", arm: { operation: "expire" }, expected: { failure: { category: "auth_required" } } },
  ],
  workflows: [{
    id: "paginated",
    description: "Extract every page by following Next.",
    recordingScript: [{ id: "all-products", operation: "extract", target: "testid:product", fields: { name: "testid:name" }, pagination: { next: "testid:next", maxPages: 5 } }],
    expected: { extracted: [{ step: "all-products", count: 23 }] },
    variants: [{ id: "short-catalog", description: "Only one page exists.", arm: { operation: "set-mode", payload: { mode: "short" } }, expected: { extracted: [{ step: "all-products", count: 6 }] } }],
  }],
};

test("accepts workflows, variants, extraction steps, and expected failures", () => {
  const result = validateWebScenario(catalogScenario);
  assert.equal(result.valid, true, result.valid ? "" : JSON.stringify(result.issues));
  assert.ok(scenarioStepOperations.includes("extract"));
  assert.ok(AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES.includes("auth_required"));
});

test("resolves the primary or a named workflow, and a variant replaces only the fields it sets", () => {
  const primary = resolveScenarioWorkflow(catalogScenario);
  assert.equal(primary.workflowId, undefined);
  assert.equal(primary.recordingScript, catalogScenario.recordingScript);
  assert.deepEqual(primary.expected, catalogScenario.expected);
  assert.deepEqual(resolveScenarioWorkflow(catalogScenario, { variantId: "no-results" }).expected.extracted, [{ step: "products", count: 0 }]);
  const expired = resolveScenarioWorkflow(catalogScenario, { variantId: "session-expired" });
  assert.deepEqual(expired.expected.failure, { category: "auth_required" });
  assert.deepEqual(expired.expected.extracted, catalogScenario.expected.extracted);
  const short = resolveScenarioWorkflow(catalogScenario, { workflowId: "paginated", variantId: "short-catalog" });
  assert.equal(short.recordingScript[0].id, "all-products");
  assert.deepEqual(short.expected.extracted, [{ step: "all-products", count: 6 }]);
  assert.equal(short.variant.arm.operation, "set-mode");
  assert.throws(() => resolveScenarioWorkflow(catalogScenario, { workflowId: "missing" }), /has no workflow missing/);
  assert.throws(() => resolveScenarioWorkflow(catalogScenario, { variantId: "short-catalog" }), /has no variant short-catalog/);
});

const UNARMED_FACT = { id: "result-count", subject: "result-count", predicate: "text", value: "23 products" };
const ARMED_FACT = { id: "result-count", subject: "result-count", predicate: "text", value: "5 products" };

/** A workflow whose rendering is described, one variant that describes its own armed rendering and one that does not. */
const factScenario = {
  ...catalogScenario,
  expected: { ...catalogScenario.expected, pageFacts: [UNARMED_FACT] },
  variants: [
    { id: "short-catalog", description: "Five products on one page.", arm: { operation: "set-mode", payload: { mode: "short" } }, expected: { pageFacts: [ARMED_FACT] } },
    { id: "text-variant", description: "Prices are rewritten; the rendering is not described.", arm: { operation: "set-mode", payload: { mode: "text" } }, expected: { extracted: [{ step: "products", count: 2 }] } },
  ],
};

test("every lane checks a page fact against the rendering it was declared on", () => {
  const selection = { variantId: "short-catalog" };
  const flow = scenarioPageFactSchedule(factScenario, selection, "arms-after-loading");
  const preArmed = scenarioPageFactSchedule(factScenario, selection, "arms-before-loading");
  // The defect this pins: the Flow lane armed the variant, reloaded, and then
  // ran the Flow without ever checking the rendering it had just armed, while
  // the existing and clone lanes checked exactly that rendering at load. The
  // same declared facts must now be judged against the same page state on
  // both, whichever moment each lane arms at.
  assert.deepEqual(flow.afterArm, preArmed.atLoad);
  assert.deepEqual(flow.afterArm, [ARMED_FACT]);
  assert.deepEqual(preArmed.afterArm, []);
  // ...and the rendering the Flow lane records against is still the unarmed
  // one, described by the workflow's own facts and never by the variant's.
  assert.deepEqual(flow.atLoad, [UNARMED_FACT]);
  assert.deepEqual(flow.atLoad, scenarioPageFactSchedule(factScenario).atLoad);
  assert.deepEqual(scenarioPageFactSchedule(factScenario).afterArm, []);
});

test("a variant that declares no page facts makes no claim about its armed rendering", () => {
  const selection = { variantId: "text-variant" };
  const flow = scenarioPageFactSchedule(factScenario, selection, "arms-after-loading");
  assert.deepEqual(flow.atLoad, [UNARMED_FACT]);
  assert.deepEqual(flow.afterArm, []);
  assert.deepEqual(scenarioPageFactSchedule(factScenario, selection, "arms-before-loading").atLoad, []);
  // Every other expectation still inherits: page facts are the one field that
  // describes a rendering rather than the run, so they are the one exception.
  const resolved = resolveScenarioWorkflow(factScenario, selection);
  assert.deepEqual(resolved.expected.extracted, [{ step: "products", count: 2 }]);
  assert.deepEqual(resolved.expected.finalState, factScenario.expected.finalState);
});

test("the page-fact schedule follows the named workflow and rejects an unknown variant", () => {
  assert.deepEqual(scenarioPageFactSchedule(factScenario, { workflowId: "paginated" }), { atLoad: [], afterArm: [] });
  const short = scenarioPageFactSchedule(factScenario, { workflowId: "paginated", variantId: "short-catalog" }, "arms-after-loading");
  assert.deepEqual(short, { atLoad: [], afterArm: [] });
  assert.throws(() => scenarioPageFactSchedule(factScenario, { variantId: "nothing" }), /has no variant nothing/);
});

test("an expectation may only name an attempt status a run can actually record", () => {
  assert.deepEqual([...expectedActionOutcomes], ["succeeded", "failed"]);
  for (const outcome of expectedActionOutcomes) assert.ok(runActionStatuses.includes(outcome), `${outcome} is not a run action status`);
  // "rejected" was in the enum and in no lane's vocabulary, so a scenario that
  // declared it failed on its own expectation whatever the page did.
  assert.ok(!runActionStatuses.includes("rejected"));
  assert.ok(!expectedActionOutcomes.includes("rejected"));
  assert.deepEqual([...webScenarioJsonSchema.$defs.action.properties.outcome.enum], [...expectedActionOutcomes]);
  const actions = (outcome) => ({ ...validScenario, expected: { ...validScenario.expected, actions: [{ action: "web.dom.click", outcome }] } });
  const rejected = validateWebScenario(actions("rejected"));
  assert.equal(rejected.valid, false);
  assert.ok(!rejected.valid && rejected.issues.some((entry) => entry.path === "$.expected.actions[0].outcome" && entry.message.includes("expected.failure")));
  assert.equal(validateWebScenario(actions("failed")).valid, true);
  assert.equal(validateWebScenario(actions("succeeded")).valid, true);
});

/**
 * W11, W15 and admin-console each pinned a `web.dom.extract` no recording held.
 * Since X5.1 an extract records one: only a pin no step yields is unmeetable.
 */
test("an expected action that no step of its workflow's recording script records is rejected as a scenario defect", () => {
  const unmeetable = {
    ...validScenario,
    recordingScript: [
      ...validScenario.recordingScript,
      { id: "read-result", operation: "extract", target: "testid:result", fields: { text: "testid:result-text" } },
    ],
    expected: { ...validScenario.expected, actions: [{ action: "web.dom.type" }, { action: "web.dom.extract", outcome: "succeeded" }] },
    // A variant never changes the recording, so its entries are judged against the workflow's script.
    variants: [{ id: "keyboard-only", description: "Submit is reachable by keyboard only.", arm: { operation: "set-mode" }, expected: { actions: [{ action: "web.dom.keypress", outcome: "succeeded" }] } }],
    // A named workflow is judged against its own script, never the primary workflow's click. It extracts nothing, so its `web.dom.extract` pin is the unmeetable-extract case.
    workflows: [{ id: "scroll-only", description: "Scroll the page.", recordingScript: [{ id: "scroll-down", operation: "scroll", value: 500 }], expected: { actions: [{ action: "web.dom.scroll" }, { action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.extract" }] } }],
  };
  const result = validateWebScenario(unmeetable);
  assert.equal(result.valid, false);
  const issues = result.valid ? [] : result.issues;
  assert.deepEqual(issues.map(({ path }) => path), ["$.variants[0].expected.actions[0].action", "$.workflows[0].expected.actions[1].action", "$.workflows[0].expected.actions[2].action"]);
  assert.match(issues[2].message, /^names web\.dom\.extract, which no step of this workflow's recordingScript records/);
  assert.ok(issues.every(({ message }) => message.endsWith("so it is a scenario defect, not a product failure")), JSON.stringify(issues));
  assert.throws(() => assertWebScenario(unmeetable), ContractValidationError);
});

test("an expected action some step records is accepted, and a playback goal with no script is not judged", () => {
  // delayed-ui's shape: the wait is proposed from the DOM addition recorded before a click.
  const recordable = { ...validScenario, expected: { ...validScenario.expected, actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }, { action: "web.dom.wait_for_selector", outcome: "succeeded" }] } };
  const accepted = validateWebScenario(recordable);
  assert.equal(accepted.valid, true, accepted.valid ? "" : JSON.stringify(accepted.issues));
  const playback = {
    ...validScenario,
    recordingScript: [],
    playbackGoal: { id: "submit", description: "Complete the form from instructions.", successFacts: [{ id: "submitted", subject: "result", predicate: "text", value: "Submitted" }] },
    expected: { ...validScenario.expected, actions: [{ action: "web.dom.select", outcome: "succeeded" }] },
  };
  assert.equal(validateWebScenario(playback).valid, true);
  // Pagination belongs to the one recorded extract node, so a paginated extract records the same `web.dom.extract_list` an unpaginated one does, and neither yields a `web.dom.click` for the Flow lane to judge.
  const readStep = { id: "all-products", operation: "extract", target: "testid:product", fields: { name: "testid:name" } };
  const readsPages = (step, action) => ({ ...validScenario, workflows: [{ id: "read-catalog", description: "Read the catalog.", recordingScript: [step], expected: { actions: [{ action, outcome: "succeeded" }] } }] });
  const paged = { ...readStep, pagination: { next: "testid:next", maxPages: 3 } };
  const extracts = validateWebScenario(readsPages(paged, "web.dom.extract_list"));
  assert.equal(extracts.valid, true, extracts.valid ? "" : JSON.stringify(extracts.issues));
  // Neither form records a click, so a `web.dom.click` pin is refused on both.
  for (const step of [paged, readStep]) assert.deepEqual(validateWebScenario(readsPages(step, "web.dom.click")).issues?.map(({ path }) => path) ?? [], ["$.workflows[0].expected.actions[0].action"], JSON.stringify(step));
});

/**
 * A recorded file choice maps to `web.dom.upload`, and a recorded tab switch or
 * close to `web.browser.tab`. W17 pins its upload before its click, so the
 * validator must accept that pin, and still refuse an action neither step records.
 */
test("an upload step records web.dom.upload, and a tab switch or close records web.browser.tab", () => {
  const workflow = (id, recordingScript, actions) => ({ id, description: `Workflow ${id}.`, recordingScript, expected: { actions } });
  const choose = { id: "choose-file", operation: "upload", target: "testid:file", value: "notes.txt" };
  const close = { id: "close-details", operation: "closeTab" };
  const pinned = validateWebScenario({
    ...validScenario,
    workflows: [
      workflow("upload", [choose, { id: "submit", operation: "click", target: "testid:submit" }], [{ action: "web.dom.upload", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }]),
      workflow("switch", [{ id: "to-details", operation: "switchTab", path: "/details" }], [{ action: "web.browser.tab", outcome: "succeeded" }]),
      workflow("close", [close], [{ action: "web.browser.tab", outcome: "succeeded" }]),
    ],
  });
  assert.equal(pinned.valid, true, pinned.valid ? "" : JSON.stringify(pinned.issues));
  // A file choice is never text entry, and closing a tab is never a click.
  const unrecorded = validateWebScenario({ ...validScenario, workflows: [workflow("upload", [choose], [{ action: "web.dom.type" }]), workflow("close", [close], [{ action: "web.dom.click" }])] });
  assert.deepEqual(unrecorded.valid ? [] : unrecorded.issues.map(({ path }) => path), ["$.workflows[0].expected.actions[0].action", "$.workflows[1].expected.actions[0].action"]);
});

test("rejects malformed workflows, variants, extraction, and step values", () => {
  const invalid = {
    ...catalogScenario,
    recordingScript: [
      { id: "press", operation: "press", target: "testid:search" },
      { id: "check", operation: "check", target: "testid:box", value: "yes" },
      { id: "click", operation: "click", target: "testid:x", fields: { name: "testid:name" } },
      { id: "products", operation: "extract", target: "testid:product", fields: {}, pagination: { next: "testid:next", maxPages: 0 } },
      { id: "tab", operation: "switchTab" },
    ],
    expected: { extracted: [{ step: "click", count: 1 }], failure: { category: "NOT_A_CATEGORY" } },
    variants: [
      { id: "dup", description: "one", arm: { operation: "a" }, expected: {} },
      { id: "dup", description: "two", arm: {}, expected: { extracted: [{ step: "products" }] } },
    ],
    workflows: [
      { id: "empty", description: "No steps.", recordingScript: [], expected: {} },
      { id: "empty", description: "Borrows a primary step.", recordingScript: [{ id: "noop", operation: "checkpoint" }], expected: { extracted: [{ step: "products", count: 1 }] } },
    ],
  };
  const result = validateWebScenario(invalid);
  assert.equal(result.valid, false);
  const paths = result.valid ? [] : result.issues.map((entry) => entry.path);
  for (const path of [
    "$.recordingScript[0].value", "$.recordingScript[1].value", "$.recordingScript[2].fields",
    "$.recordingScript[3].fields", "$.recordingScript[3].pagination.maxPages", "$.recordingScript[4].path",
    "$.expected.extracted[0].step", "$.expected.failure.category",
    "$.variants", "$.variants[1].arm.operation", "$.variants[1].expected.extracted[0]",
    "$.workflows", "$.workflows[0].recordingScript", "$.workflows[1].expected.extracted[0].step",
  ]) assert.ok(paths.includes(path), `expected an issue at ${path}; got ${paths.join(", ")}`);
});

/** A scenario's issue paths, empty when it is valid. */
const issuePaths = (scenario) => {
  const result = validateWebScenario(scenario);
  return result.valid ? [] : result.issues.map(({ path }) => path);
};
const catalogStep = { id: "products", operation: "extract", target: "testid:product", fields: { name: "testid:name", price: "testid:price" } };
/** A scenario whose one named workflow runs `step` and expects `extraction` of it, with optional variants judged against the same step. */
const readingCatalog = (step, extraction, variants) => ({
  ...validScenario,
  workflows: [{ id: "read-catalog", description: "Read the catalog.", recordingScript: [step], expected: { extracted: [{ step: step.id, ...extraction }] }, ...(variants ? { variants } : {}) }],
});

test("accepts every pagination mode, and next when mode is absent", () => {
  const paginations = [
    { next: "testid:next", maxPages: 3 },
    { mode: "next", next: "testid:next", maxPages: 3 },
    { mode: "loadMore", control: "testid:load-more", maxPages: 3 },
    { mode: "scroll", maxScrolls: 10 },
    { mode: "numbered", pages: "testid:pagination-page", maxPages: 3 },
  ];
  for (const pagination of paginations) {
    assert.deepEqual(issuePaths(readingCatalog({ ...catalogStep, pagination }, { count: 23, pages: 3 })), [], JSON.stringify(pagination));
  }
  assert.deepEqual([...new Set(paginations.map(({ mode }) => mode ?? "next"))], [...scenarioExtractPaginationModes]);
});

test("rejects an unknown pagination mode, a key its mode does not take, and a missing control", () => {
  const paginated = (pagination) => issuePaths(readingCatalog({ ...catalogStep, pagination }, { count: 23 }));
  const at = (key) => `$.workflows[0].recordingScript[0].pagination.${key}`;
  assert.deepEqual(paginated({ mode: "infinite", next: "testid:next", maxPages: 3 }), [at("mode")]);
  // A key another mode owns is an extra key: load more has no `next`, next has no `control`, and scrolling is bounded by scrolls, not pages.
  assert.deepEqual(paginated({ mode: "loadMore", control: "testid:load-more", next: "testid:next", maxPages: 3 }), [at("next")]);
  assert.deepEqual(paginated({ next: "testid:next", maxPages: 3, control: "testid:load-more" }), [at("control")]);
  assert.deepEqual(paginated({ mode: "scroll", maxScrolls: 10, maxPages: 3 }), [at("maxPages")]);
  assert.deepEqual(paginated({ mode: "numbered", maxPages: 3 }), [at("pages")]);
  assert.deepEqual(paginated({ mode: "scroll", maxScrolls: 0 }), [at("maxScrolls")]);
});

test("allows minItems on an extract step only, as a non-negative integer", () => {
  const withStep = (step) => issuePaths({ ...validScenario, recordingScript: [...validScenario.recordingScript, step] });
  assert.deepEqual(withStep({ ...catalogStep, minItems: 0 }), []);
  assert.deepEqual(withStep({ ...catalogStep, minItems: 5 }), []);
  assert.deepEqual(withStep({ id: "open", operation: "click", target: "testid:open", minItems: 0 }), ["$.recordingScript[3].minItems"]);
  assert.deepEqual(withStep({ ...catalogStep, minItems: -1 }), ["$.recordingScript[3].minItems"]);
  assert.deepEqual(withStep({ ...catalogStep, minItems: 1.5 }), ["$.recordingScript[3].minItems"]);
});

test("rejects optionalFields that are not fields of the step they name", () => {
  assert.deepEqual(issuePaths(readingCatalog(catalogStep, { count: 2, optionalFields: ["price"] })), []);
  assert.deepEqual(issuePaths(readingCatalog(catalogStep, { count: 2, optionalFields: ["price", "rating"] })), ["$.workflows[0].expected.extracted[0].optionalFields[1]"]);
  // A variant is judged against the same step.
  const hidden = { id: "no-ratings", description: "Ratings are hidden.", arm: { operation: "hide-ratings" }, expected: { extracted: [{ step: "products", count: 2, optionalFields: ["rating"] }] } };
  assert.deepEqual(issuePaths(readingCatalog(catalogStep, { count: 2 }, [hidden])), ["$.workflows[0].variants[0].expected.extracted[0].optionalFields[0]"]);
});

test("rejects pages on a step that does not paginate", () => {
  const paginated = { ...catalogStep, pagination: { next: "testid:next", maxPages: 3 } };
  assert.deepEqual(issuePaths(readingCatalog(catalogStep, { count: 2, pages: 1 })), ["$.workflows[0].expected.extracted[0].pages"]);
  assert.deepEqual(issuePaths(readingCatalog(paginated, { count: 2, pages: 1 })), []);
  assert.deepEqual(issuePaths(readingCatalog(paginated, { count: 2, pages: 0 })), ["$.workflows[0].expected.extracted[0].pages"]);
});

/**
 * D4: an extract step fails on an empty list unless it declares minItems: 0,
 * so an expectation of no records against any other step can never be met.
 */
test("rejects an expectation of no records unless its step declares minItems: 0", () => {
  const cleared = { id: "cleared", description: "The catalog is emptied.", arm: { operation: "clear" }, expected: { extracted: [{ step: "products", records: [] }] } };
  const entries = ["$.workflows[0].expected.extracted[0]", "$.workflows[0].variants[0].expected.extracted[0]"];
  const unmeetable = validateWebScenario(readingCatalog(catalogStep, { count: 0 }, [cleared]));
  assert.deepEqual(unmeetable.valid ? [] : unmeetable.issues.map(({ path }) => path), entries);
  assert.ok(!unmeetable.valid && unmeetable.issues.every(({ message }) => message.includes("minItems: 0")), JSON.stringify(unmeetable.issues));
  // minItems: 1 is the default spelled out, so it is no better.
  assert.deepEqual(issuePaths(readingCatalog({ ...catalogStep, minItems: 1 }, { count: 0 }, [cleared])), entries);
  assert.deepEqual(issuePaths(readingCatalog({ ...catalogStep, minItems: 0 }, { count: 0 }, [cleared])), []);
  // The primary workflow is held to the same rule: W06's no-results shape without its declaration.
  const { minItems: _declared, ...undeclared } = catalogScenario.recordingScript[3];
  assert.deepEqual(issuePaths({ ...catalogScenario, recordingScript: [...catalogScenario.recordingScript.slice(0, 3), undeclared] }), ["$.variants[0].expected.extracted[0]"]);
});

test("accepts null record values and a boolean truncated, and rejects anything else", () => {
  const records = [{ name: "Lamp", price: null }, { name: "Desk lamp", price: "$12.00" }];
  assert.deepEqual(issuePaths(readingCatalog(catalogStep, { count: 2, records, optionalFields: ["price"], truncated: false })), []);
  assert.deepEqual(
    issuePaths(readingCatalog(catalogStep, { count: 1, records: [{ name: 7, price: null }], truncated: "no" })),
    ["$.workflows[0].expected.extracted[0].records[0].name", "$.workflows[0].expected.extracted[0].truncated"],
  );
});

test("the JSON schema lists every pagination mode and the extraction fields the validator takes", () => {
  const { step, pagination, extraction } = webScenarioJsonSchema.$defs;
  assert.equal(step.properties.pagination.$ref, "#/$defs/pagination");
  assert.deepEqual(pagination.oneOf.map((member) => member.properties.mode.const), [...scenarioExtractPaginationModes]);
  // Only `next` may omit its mode (D14).
  assert.deepEqual(pagination.oneOf.map((member) => member.required.includes("mode")), [false, true, true, true]);
  // Every key a schema member lists is one the validator accepts for that mode.
  for (const member of pagination.oneOf) {
    const filled = Object.fromEntries(Object.entries(member.properties).map(([key, schema]) => [key, "const" in schema ? schema.const : schema.type === "integer" ? 3 : "testid:control"]));
    assert.deepEqual(issuePaths(readingCatalog({ ...catalogStep, pagination: filled }, { count: 2 })), [], JSON.stringify(filled));
  }
  assert.deepEqual(step.properties.minItems, { type: "integer", minimum: 0 });
  assert.deepEqual(extraction.properties.records.items.additionalProperties.type, ["string", "null"]);
  assert.deepEqual(Object.keys(extraction.properties), ["step", "count", "records", "pages", "optionalFields", "truncated"]);
});

test("the JSON schema lists every step operation and failure category", () => {
  assert.deepEqual([...webScenarioJsonSchema.$defs.step.properties.operation.enum], [...scenarioStepOperations]);
  assert.deepEqual([...webScenarioJsonSchema.$defs.failure.properties.category.enum], [...AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES]);
  // The categories are Core's own list, re-exported, not a copy that can drift from it.
  assert.equal(AUTOMATION_STUDIO_ADAPTIVE_FAILURE_CLASSES, coreFailureClasses);
  assert.ok(webScenarioJsonSchema.properties.variants);
  assert.ok(webScenarioJsonSchema.properties.workflows);
});
