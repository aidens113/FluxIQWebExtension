// `lab run --authoring-mode answer-first` is not held to the plan's default call cap, which would read as budget out.

import assert from "node:assert/strict";
import test from "node:test";
import { labBuildCallLimitFor } from "../index.js";

const run = (coreAuthoringMode: string) => ({ coreAuthoringMode, authorizedBuildCallLimit: 26 });

test("an answer-first run is held to no call cap unless it typed one", () => {
  assert.deepEqual(labBuildCallLimitFor(run("answer-first"), ["run", "--authoring-mode", "answer-first"]), {});
  assert.deepEqual(labBuildCallLimitFor(run("answer-first"), ["run", "--llm-max-calls", "40"]), { buildCallLimit: 26 });
});

test("every other mode keeps the plan's allowance", () => {
  for (const mode of ["legacy", "candidate", "project"]) assert.deepEqual(labBuildCallLimitFor(run(mode), ["run"]), { buildCallLimit: 26 });
});
