import assert from "node:assert/strict";
import test from "node:test";
import { parseCampaignArgs } from "../index.mjs";

test("arguments: defaults, ids, kinds, limits and the Lab passthrough", () => {
  const defaults = parseCampaignArgs([]);
  assert.deepEqual({ ...defaults }, { taskIds: [], kinds: [], all: false, limit: undefined, dryRun: false, build: true, maxAttempts: 3, profile: undefined, provider: "deepseek", model: "deepseek-flash", output: undefined, labArgs: [], help: false });
  assert.deepEqual(parseCampaignArgs(["--kind", "repair"]).kinds, ["repair"]);
  assert.throws(() => parseCampaignArgs(["--", "--flow"]), /sets --flow itself/u);
  assert.deepEqual(parseCampaignArgs(["table-read", "form-goal"]).taskIds, ["table-read", "form-goal"]);
  const parsed = parseCampaignArgs(["--kind", "extract,form", "--limit", "2", "--dry-run", "--max-attempts", "2", "--", "--llm-max-cost-usd", "0.25"]);
  assert.deepEqual([parsed.kinds, parsed.limit, parsed.dryRun, parsed.maxAttempts, parsed.labArgs], [["extract", "form"], 2, true, 2, ["--llm-max-cost-usd", "0.25"]]);
  assert.throws(() => parseCampaignArgs(["--kind", "scrape"]), /Unknown --kind scrape/u);
  assert.throws(() => parseCampaignArgs(["table-read", "--kind", "extract"]), /not by more than one/u);
  assert.throws(() => parseCampaignArgs(["--kind", "extract", "--all"]), /drop --all/u);
  assert.throws(() => parseCampaignArgs(["--target", "isolated"]), /Lab options go after --/u);
  assert.throws(() => parseCampaignArgs(["--", "--variant", "x"]), /sets --variant itself/u);
  assert.throws(() => parseCampaignArgs(["--", "--llm-task", "adapt"]), /sets --llm-task itself/u);
  assert.throws(() => parseCampaignArgs(["--max-attempts", "9"]), /from 1 to 5/u);
  assert.throws(() => parseCampaignArgs(["--limit"]), /requires a value/u);
  assert.throws(() => parseCampaignArgs(["Table_Read"]), /not kebab-case/u);
});
