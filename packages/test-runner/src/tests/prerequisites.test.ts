import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ContractValidationError } from "@fluxiq-web-extension/test-contracts";
import { classifyRunnerFailure, RunnerFailure } from "../failure.js";
import { loadScenarioManifests } from "../scenarios.js";

test("scenario loading fails closed when the built registry is missing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-prerequisite-"));
  try { await assert.rejects(loadScenarioManifests(root), (error: unknown) => typeof error === "object" && error !== null && "category" in error && error.category === "environment.missing"); }
  finally { await rm(root, { recursive: true, force: true }); }
});

/** Text a page would show. It must never reach a failure message. */
const PAGE_TEXT = "page-sentinel-4417";
/** A valid manifest with one defect, an id that is not kebab-case, carrying page text where a manifest does. */
const defectiveManifest = {
  schemaVersion: "0.1", id: "Basic Form", title: "Basic form", tags: ["forms"], seed: 42, startPath: "/scenarios/basic-form",
  capabilities: ["forms"], networkPolicy: "loopback-only",
  recordingScript: [{ id: "name", operation: "type", target: "name", value: PAGE_TEXT }, { id: "submit", operation: "click", target: "submit" }, { id: "done", operation: "checkpoint" }],
  expected: { finalState: [{ id: "submitted", subject: "result", predicate: "text", value: PAGE_TEXT }] },
};

/** Loads a throwaway compiled scenario lab whose `registry.js`, an ES module, is `source`. */
async function loadRegistry(source: string): Promise<unknown> {
  const dist = await mkdtemp(path.join(os.tmpdir(), "fluxiq-registry-"));
  try {
    await writeFile(path.join(dist, "package.json"), JSON.stringify({ type: "module" }));
    await writeFile(path.join(dist, "registry.js"), source);
    return await loadScenarioManifests("unused-repository-root", dist).then(() => undefined, (error: unknown) => error);
  } finally { await rm(dist, { recursive: true, force: true }); }
}

function assertFixtureDefect(error: unknown, causeClass: "contract" | "lookalike"): void {
  assert.ok(error instanceof RunnerFailure, `expected a RunnerFailure, got ${String(error)}`);
  assert.equal(classifyRunnerFailure(error), "fixture.invalid");
  assert.equal(error.message, "Scenario Lab manifest failed contract validation: $.id: must be a kebab-case identifier");
  assert.deepEqual(error.details, { issuePaths: ["$.id"] });
  assert.equal(`${error.message}${JSON.stringify(error.details)}`.includes(PAGE_TEXT), false);
  if (causeClass === "contract") assert.ok(error.cause instanceof ContractValidationError);
}

test("a manifest the validator rejects fails as fixture.invalid, naming the defect and no page value", async () => {
  const contracts = import.meta.resolve("@fluxiq-web-extension/test-contracts");
  // The Lab's own path: `createScenarioManifest` validates while the registry is imported.
  assertFixtureDefect(await loadRegistry(`import { assertWebScenario } from ${JSON.stringify(contracts)};\nassertWebScenario(${JSON.stringify(defectiveManifest)});\nexport function listScenarioManifests() { return []; }\n`), "contract");
  // A registry that builds no check of its own is rejected by the runner's.
  assertFixtureDefect(await loadRegistry(`export function listScenarioManifests() { return [${JSON.stringify(defectiveManifest)}]; }\n`), "contract");
  // A Lab instance's scenario lab can resolve its own copy of the contracts package, whose error is another class.
  assertFixtureDefect(await loadRegistry(`const error = new Error("WebScenario validation failed");\nerror.name = "ContractValidationError";\nerror.issues = [{ path: "$.id", message: "must be a kebab-case identifier" }];\nthrow error;\nexport function listScenarioManifests() { return []; }\n`), "lookalike");
});

test("a registry that cannot load keeps its own failure rather than fixture.invalid", async () => {
  const unbuilt = await loadRegistry(`import "./not-built.js";\nexport function listScenarioManifests() { return []; }\n`);
  assert.equal(unbuilt instanceof RunnerFailure, false);
  assert.equal(classifyRunnerFailure(unbuilt), "environment.missing");
  const crashed = await loadRegistry(`throw new Error("registry crashed");\nexport function listScenarioManifests() { return []; }\n`);
  assert.equal(crashed instanceof RunnerFailure, false);
  assert.equal(crashed instanceof Error && crashed.message, "registry crashed");
});
