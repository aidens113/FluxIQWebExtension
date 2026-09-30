// The budget file a person sets: absent or malformed is no budget.

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readSpendBudget } from "../index.mjs";

test("a valid budget is read; anything else is 'no live spend budget is set', with the reason", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "live-guards-budget-"));
  try {
    const file = path.join(directory, "spend-budget.json");
    const absent = await readSpendBudget(file);
    assert.equal(absent.ok, false);
    assert.match(absent.reason, /^no live spend budget is set: .*does not exist$/u);

    const cases = [
      ["{", /not valid JSON/u],
      ["{\"window\":\"day\"}", /"maxUsd"/u],
      ["{\"maxUsd\":-1,\"window\":\"day\"}", /"maxUsd"/u],
      ["{\"maxUsd\":\"2\",\"window\":\"day\"}", /"maxUsd"/u],
      ["{\"maxUsd\":2}", /"window": "day"/u],
      ["{\"maxUsd\":2,\"window\":\"week\"}", /it says "week"/u],
    ];
    for (const [text, reason] of cases) {
      await writeFile(file, text, "utf8");
      const budget = await readSpendBudget(file);
      assert.equal(budget.ok, false, text);
      assert.match(budget.reason, /^no live spend budget is set/u);
      assert.match(budget.reason, reason, text);
    }

    await writeFile(file, "{\"maxUsd\":1.5,\"window\":\"day\"}", "utf8");
    assert.deepEqual(await readSpendBudget(file), { ok: true, maxUsd: 1.5, window: "day" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
