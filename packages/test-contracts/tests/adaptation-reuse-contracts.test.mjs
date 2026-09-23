import assert from "node:assert/strict";
import test from "node:test";
// A namespace import, so a validator this build does not export fails its own tests rather than the whole file.
import * as contracts from "../dist/index.js";

const { assertRunEvaluation, parseRunEvaluationJson, validateRunEvaluation } = contracts;

const ADAPTATION = "adaptation.run-mu4nxysj-3234c535.temporary_target_override.1789000000000";
const CREATED = "adaptation.bootstrap.flow-lab.1789000000001";
// A card number: the kind of page value no evaluation may carry, and no refusal may quote.
const PLANTED = "4242424242424242";
const liveLlm = { mode: "live", profileId: "deepseek-lab", calls: 3 };
const disabledLlm = { mode: "disabled", profileId: null, calls: 0 };
const unmeasured = { harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null };

// Lab proof 1, the repair run: the model was asked, the renamed Save was trialled, and the run resumed from it.
const repairReuse = () => ({
  exercisedAdaptationIds: [ADAPTATION], providerCalls: 3, interventions: 2,
  resume: { fromNodeId: "node.save", fromRoute: "success", status: "succeeded", attemptCount: 2, adaptationIds: [ADAPTATION] },
});
const repairCost = () => ({ providerCalls: 3, inputTokens: 5120, outputTokens: 640, totalTokens: 5760, estimatedCostUsd: 0.0021, reservedCalls: 0 });
const repairValidation = () => ({ adaptations: [{ adaptationId: ADAPTATION, tier: "provisional", trials: 1, replays: 0, lastFailure: null }] });
const repairPersistence = () => ({ adaptations: [{ adaptationId: ADAPTATION, status: "validated", baseRevision: 3, appliedRevision: null }] });
// Lab proof 1, a replay after approval: the repaired node ran, and nothing asked the model.
const replayReuse = () => ({ exercisedAdaptationIds: [CREATED, ADAPTATION], providerCalls: 0, interventions: 0, resume: null });
const replayCost = () => ({ providerCalls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, reservedCalls: 0 });
const replayValidation = () => ({
  adaptations: [
    { adaptationId: ADAPTATION, tier: "established", trials: 1, replays: 2, lastFailure: null },
    { adaptationId: CREATED, tier: "unverified", trials: 1, replays: 0, lastFailure: "replay" },
  ],
});
const replayPersistence = () => ({ adaptations: [{ adaptationId: ADAPTATION, status: "applied", baseRevision: 3, appliedRevision: 4 }] });

const flowRun = (overrides = {}) => ({
  schemaVersion: "0.3", runId: "run-identity-drift-renamed-redesign-0", verdict: "passed", facilityFailure: null,
  invariants: [{ id: "final-state", passed: true, expected: "saved", actual: "saved", evidenceSequences: [4] }], metrics: {},
  scenarioId: "identity-drift", workflowId: null, variantId: "renamed-redesign", repeatIndex: 0, lane: "flow", flowCreated: true,
  oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null,
  harnessActivations: 2, durationMs: 9120, actions: [{ actionType: "web.dom.click", durationMs: 140 }],
  evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 },
  llm: liveLlm, extraction: null, ...unmeasured, ...overrides,
});
const repairRun = (overrides = {}) => flowRun({ adaptationReuse: repairReuse(), adaptationCost: repairCost(), adaptationValidation: repairValidation(), adaptationPersistence: repairPersistence(), ...overrides });
const replayRun = (overrides = {}) => flowRun({
  runId: "run-identity-drift-renamed-redesign-1", repeatIndex: 1, harnessActivations: 0, llm: { ...liveLlm, calls: 0 },
  adaptationReuse: replayReuse(), adaptationCost: replayCost(), adaptationValidation: replayValidation(), adaptationPersistence: replayPersistence(), ...overrides,
});
const recordingRun = (overrides = {}) => flowRun({ lane: "recording", flowCreated: null, reportedVerdict: null, harnessActivations: 0, actions: [], llm: disabledLlm, ...overrides });
const facilityRun = (overrides = {}) => flowRun({
  verdict: "inconclusive", failureCategory: "unknown", facilityFailure: { boundary: "no-final-bundle", stage: "scenario.execute", reason: "unclassified" },
  flowCreated: false, oracleVerdict: null, reportedVerdict: null, harnessActivations: 0, actions: [], llm: disabledLlm, ...overrides,
});

const week2Keys = ["adaptationReuse", "adaptationCost", "adaptationValidation", "adaptationPersistence"];
const validators = {
  adaptationReuse: "validateRunAdaptationReuse",
  adaptationCost: "validateRunAdaptationCost",
  adaptationValidation: "validateRunAdaptationValidation",
  adaptationPersistence: "validateRunAdaptationPersistence",
};
const without = (value, key) => { const copy = { ...value }; delete copy[key]; return copy; };
const issuesOf = (value) => { const checked = validateRunEvaluation(value); return checked.valid ? [] : checked.issues.map((issue) => issue.path); };
const messagesOf = (value) => { const checked = validateRunEvaluation(value); return checked.valid ? [] : checked.issues.map((issue) => issue.message); };
/** Applies each mutation to a fresh run and requires a refusal at its path that never quotes the planted value. */
function refusesAt(build, mutations) {
  for (const [path, mutate] of Object.entries(mutations)) {
    const evaluation = build(); mutate(evaluation);
    assert.ok(issuesOf(evaluation).includes(path), `${path}: ${JSON.stringify(issuesOf(evaluation))}`);
    for (const message of messagesOf(evaluation)) assert.equal(message.includes(PLANTED), false, `${path}: a refusal never quotes the value it refused`);
  }
}

test("the four Week 2 measurements are exported with a validator each", () => {
  for (const name of Object.values(validators)) assert.equal(typeof contracts[name], "function", name);
  assert.deepEqual(contracts.adaptationConfidenceTiers, ["unverified", "provisional", "established"]);
  assert.deepEqual(contracts.adaptationRecordStatuses, ["testing", "validated", "applied", "rejected", "disabled", "reverted", "superseded"]);
});

test("a repair run and its replay carry every Week 2 measurement, and round-trip", () => {
  for (const evaluation of [repairRun(), replayRun()]) {
    assert.doesNotThrow(() => assertRunEvaluation(evaluation), JSON.stringify(issuesOf(evaluation)));
    assert.deepEqual(parseRunEvaluationJson(JSON.stringify(evaluation)), evaluation);
    for (const key of week2Keys) assert.deepEqual(contracts[validators[key]](evaluation[key]), { valid: true, value: evaluation[key] }, key);
  }
});

test("a measurement the run did not make stays null, and is never a fabricated zero", () => {
  for (const key of week2Keys) {
    assert.deepEqual(issuesOf(repairRun({ [key]: null })), [], `${key} unmeasured`);
    assert.ok(issuesOf(without(repairRun(), key)).includes(`$.${key}`), `${key} missing`);
    for (const bare of [0, [], "", false]) assert.ok(issuesOf(repairRun({ [key]: bare })).includes(`$.${key}`), `${key} as ${JSON.stringify(bare)}`);
  }
  // Every evaluation written before the four were defined holds null for each, and still reads as it did.
  assert.deepEqual(issuesOf(flowRun()), []);
  assert.deepEqual(issuesOf(recordingRun()), []);
});

test("only a run whose Flow was created and ran has adaptations to measure", () => {
  for (const key of week2Keys) {
    const value = replayRun()[key];
    assert.deepEqual(issuesOf(recordingRun({ [key]: value })), [`$.${key}`], `${key} on the recording lane`);
    assert.deepEqual(issuesOf(facilityRun({ [key]: value })), [`$.${key}`], `${key} when no Flow was created`);
    assert.deepEqual(issuesOf(recordingRun({ [key]: null })), [], `${key} unmeasured on the recording lane`);
  }
});

test("adaptationReuse carries identifiers and whole counts, never text", () => {
  refusesAt(repairRun, {
    "$.adaptationReuse.exercisedAdaptationIds[0]": (run) => { run.adaptationReuse.exercisedAdaptationIds[0] = `adaptation for card ${PLANTED}`; },
    "$.adaptationReuse.exercisedAdaptationIds": (run) => { run.adaptationReuse.exercisedAdaptationIds.push(ADAPTATION); },
    "$.adaptationReuse.providerCalls": (run) => { run.adaptationReuse.providerCalls = 1.5; },
    "$.adaptationReuse.interventions": (run) => { run.adaptationReuse.interventions = -1; },
    "$.adaptationReuse.resume": (run) => { run.adaptationReuse.resume = "resumed at Save"; },
    "$.adaptationReuse.resume.fromNodeId": (run) => { run.adaptationReuse.resume.fromNodeId = `Save ${PLANTED}`; },
    "$.adaptationReuse.resume.fromRoute": (run) => { run.adaptationReuse.resume.fromRoute = ""; },
    "$.adaptationReuse.resume.status": (run) => { run.adaptationReuse.resume.status = `Succeeded after ${PLANTED}`; },
    "$.adaptationReuse.resume.attemptCount": (run) => { run.adaptationReuse.resume.attemptCount = 0.5; },
    "$.adaptationReuse.resume.adaptationIds": (run) => { run.adaptationReuse.resume.adaptationIds = [ADAPTATION, ADAPTATION]; },
    "$.adaptationReuse.resume.page": (run) => { run.adaptationReuse.resume.page = PLANTED; },
    "$.adaptationReuse.selector": (run) => { run.adaptationReuse.selector = "#save"; },
    "$.adaptationReuse.resume.adaptationIds[0]": (run) => { run.adaptationReuse.resume.adaptationIds[0] = 7; },
  });
  // A Core that states no call count leaves it unmeasured rather than zero: such a record certifies no replay.
  assert.deepEqual(issuesOf(replayRun({ adaptationReuse: { ...replayReuse(), providerCalls: null }, adaptationCost: { ...replayCost(), providerCalls: null } })), []);
  for (const key of ["exercisedAdaptationIds", "providerCalls", "interventions", "resume"]) {
    assert.ok(issuesOf(repairRun({ adaptationReuse: without(repairReuse(), key) })).includes(`$.adaptationReuse.${key}`), `${key} missing`);
  }
});

test("adaptationValidation grades each adaptation with a closed tier it has earned", () => {
  refusesAt(replayRun, {
    "$.adaptationValidation.adaptations[0].tier": (run) => { run.adaptationValidation.adaptations[0].tier = "high"; },
    "$.adaptationValidation.adaptations[0].adaptationId": (run) => { run.adaptationValidation.adaptations[0].adaptationId = `the ${PLANTED} fix`; },
    "$.adaptationValidation.adaptations[1].lastFailure": (run) => { run.adaptationValidation.adaptations[1].lastFailure = "structural"; },
    "$.adaptationValidation.adaptations[0].replays": (run) => { run.adaptationValidation.adaptations[0].replays = 2.5; },
    "$.adaptationValidation.adaptations[0].trials": (run) => { delete run.adaptationValidation.adaptations[0].trials; },
    "$.adaptationValidation.adaptations[0].score": (run) => { run.adaptationValidation.adaptations[0].score = 0.9; },
    "$.adaptationValidation.adaptations": (run) => { run.adaptationValidation.adaptations.push({ ...run.adaptationValidation.adaptations[0] }); },
    "$.adaptationValidation.summary": (run) => { run.adaptationValidation.summary = PLANTED; },
  });
  // Established is earned by replays alone: a trial is not a replay.
  assert.deepEqual(issuesOf(replayRun({ adaptationValidation: { adaptations: [{ adaptationId: ADAPTATION, tier: "established", trials: 3, replays: 0, lastFailure: null }] } })), ["$.adaptationValidation.adaptations[0].tier"]);
  // Provisional needs one succeeded trial or replay.
  assert.deepEqual(issuesOf(repairRun({ adaptationValidation: { adaptations: [{ adaptationId: ADAPTATION, tier: "provisional", trials: 0, replays: 0, lastFailure: "trial" }] } })), ["$.adaptationValidation.adaptations[0].tier"]);
  // Unverified is the floor, with or without history; and a run with nothing to grade says so with an empty list.
  assert.deepEqual(issuesOf(repairRun({ adaptationValidation: { adaptations: [{ adaptationId: ADAPTATION, tier: "unverified", trials: 0, replays: 0, lastFailure: null }] } })), []);
  assert.deepEqual(issuesOf(repairRun({ adaptationValidation: { adaptations: [] } })), []);
});

test("adaptationPersistence names Core's status and the revisions the change was proposed against and applied at", () => {
  refusesAt(replayRun, {
    "$.adaptationPersistence.adaptations[0].status": (run) => { run.adaptationPersistence.adaptations[0].status = "approved"; },
    "$.adaptationPersistence.adaptations[0].adaptationId": (run) => { run.adaptationPersistence.adaptations[0].adaptationId = ""; },
    "$.adaptationPersistence.adaptations[0].baseRevision": (run) => { run.adaptationPersistence.adaptations[0].baseRevision = null; },
    "$.adaptationPersistence.adaptations[0].appliedRevision": (run) => { run.adaptationPersistence.adaptations[0].appliedRevision = "4"; },
    "$.adaptationPersistence.adaptations[0].statusReason": (run) => { run.adaptationPersistence.adaptations[0].statusReason = `Applied for ${PLANTED}`; },
    "$.adaptationPersistence.adaptations": (run) => { run.adaptationPersistence.adaptations = {}; },
  });
  // Core records the base revision as the applied one when it was not told otherwise (`adaptation-store.ts`), so the two may be equal.
  assert.deepEqual(issuesOf(replayRun({ adaptationPersistence: { adaptations: [{ adaptationId: ADAPTATION, status: "applied", baseRevision: 4, appliedRevision: 4 }] } })), []);
  assert.deepEqual(issuesOf(replayRun({ adaptationPersistence: { adaptations: [] } })), []);
  assert.deepEqual(issuesOf(replayRun({ adaptationPersistence: { adaptations: [{ adaptationId: ADAPTATION, status: "applied", baseRevision: 3, appliedRevision: 4 }, { adaptationId: ADAPTATION, status: "applied", baseRevision: 3, appliedRevision: 4 }] } })), ["$.adaptationPersistence.adaptations"]);
});

test("adaptationCost states Core's accounting whole or not at all, and never a figure no call produced", () => {
  refusesAt(repairRun, {
    "$.adaptationCost.inputTokens": (run) => { run.adaptationCost.inputTokens = 12.5; },
    "$.adaptationCost.estimatedCostUsd": (run) => { run.adaptationCost.estimatedCostUsd = -0.01; },
    "$.adaptationCost.reservedCalls": (run) => { run.adaptationCost.reservedCalls = 4; },
    "$.adaptationCost.totalTokens": (run) => { run.adaptationCost.totalTokens = 5000; },
    "$.adaptationCost.model": (run) => { run.adaptationCost.model = "deepseek-flash"; },
    "$.adaptationCost.providerCalls": (run) => { delete run.adaptationCost.providerCalls; },
  });
  // Partial accounting would be a figure the run did not measure: the four totals are one reading.
  for (const key of ["inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd"]) {
    assert.deepEqual(issuesOf(repairRun({ adaptationCost: { ...repairCost(), [key]: null } })), ["$.adaptationCost"], `${key} alone unstated`);
  }
  assert.deepEqual(issuesOf(repairRun({ adaptationCost: { ...repairCost(), inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null } })), []);
  // A run that made no call spent nothing, and cannot have reserved anything.
  for (const [key, value] of [["inputTokens", 10], ["totalTokens", 10], ["estimatedCostUsd", 0.001], ["reservedCalls", 1]]) {
    const cost = { ...replayCost(), [key]: value };
    if (key === "inputTokens") cost.totalTokens = 10;
    assert.ok(issuesOf(replayRun({ adaptationCost: cost })).includes(`$.adaptationCost.${key}`), `${key} without a call`);
  }
  // A record that states nothing is not a measurement: it is null.
  assert.deepEqual(issuesOf(repairRun({ adaptationCost: { providerCalls: null, inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null, reservedCalls: null }, adaptationReuse: null })), ["$.adaptationCost"]);
  // A breach of the Lab's budget is a measurement to report, not a malformed record.
  assert.deepEqual(issuesOf(repairRun({ adaptationCost: { ...repairCost(), estimatedCostUsd: 3.5 } })), []);
});

test("the provider calls agree across reuse and cost, and a disabled provider made none", () => {
  assert.deepEqual(issuesOf(repairRun({ adaptationCost: { ...repairCost(), providerCalls: 2 } })), ["$.adaptationCost.providerCalls"]);
  assert.deepEqual(issuesOf(repairRun({ adaptationReuse: null, adaptationCost: { ...repairCost(), providerCalls: 2 } })), []);
  // A bench run is provider-free: Core cannot have called a provider the run never configured.
  const offline = { llm: disabledLlm, harnessActivations: 0 };
  assert.deepEqual(issuesOf(replayRun(offline)), []);
  assert.deepEqual(issuesOf(repairRun(offline)).sort(), ["$.adaptationCost.providerCalls", "$.adaptationReuse.providerCalls"]);
  assert.deepEqual(issuesOf(repairRun({ ...offline, llm: { mode: "deterministic-dry", profileId: "deterministic-dry", calls: 0 } })).sort(), ["$.adaptationCost.providerCalls", "$.adaptationReuse.providerCalls"]);
  assert.deepEqual(issuesOf(replayRun({ ...offline, adaptationReuse: { ...replayReuse(), providerCalls: null }, adaptationCost: { ...replayCost(), providerCalls: null } })), []);
});
