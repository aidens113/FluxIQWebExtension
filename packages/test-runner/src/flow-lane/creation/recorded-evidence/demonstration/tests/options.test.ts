import assert from "node:assert/strict";
import test from "node:test";
import { parseLabCommand } from "../../../../../commands.js";

// The recorded-evidence lane (t770-D1): `--demonstration <id>` and `--demonstration-probe` on `lab run`.
const live = ["--live-llm", "--llm-profile", "p", "--llm-provider", "deepseek", "--llm-task", "create-flow"];

test("parses --demonstration beside an instruction task, live or as a provider-free dry run", () => {
  const built = parseLabCommand(["run", "job-board", ...live, "--instruction-task", "job-board-remote-easy-apply", "--demonstration", "job-board-remote-easy-apply-demo"]);
  assert.equal(built.command === "run" && built.demonstrationId, "job-board-remote-easy-apply-demo");
  assert.equal(built.command === "run" && built.demonstrationProbe, undefined);
  const dry = parseLabCommand(["run", "job-board", "--instruction-task", "job-board-remote-easy-apply", "--demonstration", "job-board-remote-easy-apply-demo", "--dry-run"]);
  assert.deepEqual(dry, { command: "run", scenarioId: "job-board", instructionTaskId: "job-board-remote-easy-apply", dryRun: true, demonstrationId: "job-board-remote-easy-apply-demo" });
  const probe = parseLabCommand(["run", "job-board", "--instruction-task", "t-x", "--demonstration", "d-x", "--demonstration-probe", "--dry-run"]);
  assert.equal(probe.command === "run" && probe.demonstrationProbe, true);
});

test("refuses --demonstration without its task, with a direct build, or without a model or --dry-run", () => {
  assert.throws(() => parseLabCommand(["run", "job-board", ...live, "--demonstration", "d-x"]), /--demonstration requires --instruction-task/u);
  assert.throws(() => parseLabCommand(["run", "job-board", ...live, "--instruction-task", "t-x", "--demonstration", "d-x", "--direct-api-build"]), /cannot be combined with --direct-api-build/u);
  assert.throws(() => parseLabCommand(["run", "job-board", "--instruction-task", "t-x", "--demonstration", "d-x"]), /needs --live-llm --llm-task create-flow, or --dry-run/u);
  assert.throws(() => parseLabCommand(["run", "job-board", "--instruction-task", "t-x", "--demonstration", "Not Kebab", "--dry-run"]), /kebab-case/u);
  assert.throws(() => parseLabCommand(["run", "job-board", "--instruction-task", "t-x", "--demonstration", "--dry-run"]), /--demonstration requires a value/u);
  assert.throws(() => parseLabCommand(["run", "job-board", "--instruction-task", "t-x", "--demonstration", "a", "--demonstration", "b", "--dry-run"]), /only be specified once/u);
});

test("refuses --demonstration-probe alone, and a bare --dry-run still needs a live profile", () => {
  assert.throws(() => parseLabCommand(["run", "job-board", ...live, "--instruction-task", "t-x", "--demonstration-probe"]), /--demonstration-probe requires --demonstration/u);
  assert.throws(() => parseLabCommand(["run", "job-board", "--instruction-task", "t-x", "--dry-run"]), /require --live-llm --llm-task create-flow/u);
});
