import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

/**
 * The demonstration dry run is pinned at the source, as the runner's other call-site orders are
 * (`run-evaluation/tests/runner-wiring.test.ts`): it records, attaches and judges, then ends before
 * anything is sent or any model could be called. That is the order of statements in two files, so
 * the order is what is checked.
 */
const root = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..", "..");
const src = (...segments: string[]) => readFile(path.join(root, "packages", "test-runner", "src", ...segments), "utf8");

test("the dry-run branch precedes the live creation branch and never reaches the chat, the lane or a provider", async () => {
  const runner = await src("run-scenario.ts");
  const start = runner.indexOf("} else if (creation && demonstrationDryRun) {");
  const live = runner.indexOf("} else if (creation) {");
  assert.ok(start > 0 && live > start, "the dry-run branch comes first");
  const branch = runner.slice(start, live);
  assert.match(branch, /runRecordedEvidence\(\{[^}]*judgeExtract: true/u, "it records and judges the demonstration's own extract");
  assert.ok(branch.indexOf("evidence.attach()") > branch.indexOf("runRecordedEvidence("), "it attaches after recording");
  assert.ok(branch.indexOf('demonstrationPicture("attached")') > branch.indexOf("evidence.attach()"), "the chip is pictured once attached");
  assert.match(branch, /providerCallCount: 0/u, "the summary says no model was called");
  for (const forbidden of [/createdFlowChatEntry/u, /runCreatedFlowLane/u, /startLabPerson/u, /live\./u, /chat\.type/u, /\.send\(/u]) assert.doesNotMatch(branch, forbidden, `the dry run must not ${forbidden}`);
});

test("a dry run builds no Flow, so the Flow lane's own verdict is skipped and no lane observation is made", async () => {
  const runner = await src("run-scenario.ts");
  assert.match(runner, /if \(!demonstrationDryRun\) assertFlowLaneBuiltFlow\(/u);
  assert.match(runner, /const observation = demonstrationDryRun \? undefined : selectLaneObservation\(/u);
  assert.match(runner, /else if \(creation && !demonstrationDryRun\) throw new RunnerFailure\("fixture\.invalid", "An instruction task is built only by a live run/u, "any other creation run still needs --live-llm");
});

test("a live recorded-evidence run records before the chat entry and attaches in the panel just before Send", async () => {
  const runner = await src("run-scenario.ts");
  const recorded = runner.indexOf("const recordedEvidence: RecordedEvidence | undefined = options.demonstration ? await runRecordedEvidence(");
  const chat = runner.indexOf("const chat = buildEntry === \"chat\" ? createdFlowChatEntry(");
  assert.ok(recorded > 0 && chat > recorded, "the demonstration is recorded before the chat entry exists");
  assert.match(runner, /\.\.\.\(recordedEvidence \? \{ beforeSend: \(\) => recordedEvidence\.attach\(\) \} : \{\}\)/u);
  assert.match(runner, /if \(recordedEvidence\) await assertRecordedEvidenceFacts\(/u, "the recordings, the saved instruction's link and the detours are checked after the build");
  const entry = await src("run-scenario", "chat-build", "chat-entry.ts");
  assert.ok(entry.indexOf("await input.beforeSend?.()") < entry.indexOf("await panel.send(text)"), "the attachment comes before the instruction is sent");
});

test("a demonstration dry run reads no provider key, whatever profile was typed beside it", async () => {
  const cli = await src("cli.ts");
  assert.match(cli, /const demonstrationDryRun = command\.demonstrationId !== undefined && command\.dryRun === true;/u);
  assert.match(cli, /const live = command\.llm && !demonstrationDryRun \? await beginLiveLlmRun\(/u);
  assert.match(cli, /if \(command\.dryRun && !demonstration\) \{/u, "the old provider-free readiness check is for runs with no demonstration");
});
