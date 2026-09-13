import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

/**
 * That the runner *calls* the evaluator is not something a unit of the
 * evaluator can show, and running `runScenario` needs the whole Lab. A new
 * evaluation nothing reads would be the same defect as the lane observation it
 * was built to rescue, so the wiring is checked here at the call site: the
 * runner builds the evaluation, persists it inside the bundle where
 * `lab inspect` hashes it, and returns it so `lab run` prints it.
 */
const root = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");
const runnerSource = () => readFile(path.join(root, "packages", "test-runner", "src", "run-scenario.ts"), "utf8");

test("the runner evaluates every run it observes, exactly once", async () => {
  const source = await runnerSource();
  assert.equal(source.match(/singleRunEvaluation\(/gu)?.length, 1, "one evaluation per run, built in one place");
  assert.match(source, /const evaluation = observation\s*\r?\n\s*\? singleRunEvaluation\(/u, "no observation, no evaluation: the existing and clone targets run on no evaluation lane");
  assert.match(source, /import \{ singleRunEvaluation \} from "\.\/run-evaluation\/index\.js";/u, "through the barrel the bench also evaluates through");
});

test("the evaluation is a hashed artifact of the bundle, written before it is sealed", async () => {
  const source = await runnerSource();
  const manifestWritten = source.indexOf('bundle.writeStructured("run.json", manifest)');
  const written = source.indexOf('bundle.writeStructured("evaluation.json", evaluation)');
  const finalized = source.indexOf("await bundle.finalize(");
  assert.ok(written > 0, "the evaluation is persisted in the run bundle");
  assert.ok(finalized > 0);
  assert.ok(manifestWritten > 0 && manifestWritten < written, "the evaluation reads the manifest the run just wrote");
  // Written after finalization it would be an unlisted file the artifact index
  // does not cover, so `lab inspect` would never verify it.
  assert.ok(written < finalized, "evaluation.json is written before the bundle is finalized, so it enters the artifact index");
});

test("the evaluation reaches the caller, so lab run reports it without a bench", async () => {
  const source = await runnerSource();
  assert.match(source, /export type RunScenarioResult = \{[^{}]*evaluation\?: RunEvaluation[^{}]*\};/u);
  // `cli.ts` prints the whole result of a `lab run`, so returning it is what
  // puts the judgement in front of whoever ran the scenario.
  assert.ok(source.includes("...(evaluation ? { evaluation } : {})"), "the result carries the evaluation");
});
