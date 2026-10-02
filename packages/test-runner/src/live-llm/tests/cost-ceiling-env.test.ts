import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { LAB_COST_CEILING_ENV, labCostCeilingValue } from "../cost-ceiling-env.js";

// The Lab passes the per-build cost ceiling to every Core it starts from one
// configurable place (the user, 2026-10-01): the run's flag first, then the
// environment, then `.env` and `.env.local`.

function checkout(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "lab-ceiling-"));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(root, name), text);
  return root;
}

test("the run's flag wins over the environment and the checkout's env files", () => {
  const root = checkout({ ".env.local": `${LAB_COST_CEILING_ENV}=0.30\n` });
  try {
    assert.equal(labCostCeilingValue(root, ["node", "cli", "run", "--llm-cost-ceiling-usd", "0.05"], { [LAB_COST_CEILING_ENV]: "0.20" }), "0.05");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the environment wins over the env files", () => {
  const root = checkout({ ".env.local": `${LAB_COST_CEILING_ENV}=0.30\n` });
  try {
    assert.equal(labCostCeilingValue(root, ["node", "cli"], { [LAB_COST_CEILING_ENV]: "0.20" }), "0.20");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test(".env.local is read, and wins over .env, quoted or not", () => {
  const root = checkout({ ".env": `${LAB_COST_CEILING_ENV}=0.40\n`, ".env.local": `OTHER=1\nexport ${LAB_COST_CEILING_ENV}="0.15"\n` });
  try {
    assert.equal(labCostCeilingValue(root, ["node", "cli"], {}), "0.15");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("nothing configured passes nothing, so Core uses its own default", () => {
  const root = checkout({ ".env.local": "OTHER=1\n" });
  try {
    assert.equal(labCostCeilingValue(root, ["node", "cli"], {}), undefined);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a flag with no amount is refused", () => {
  assert.throws(() => labCostCeilingValue(tmpdir(), ["node", "cli", "--llm-cost-ceiling-usd"], {}), /needs an amount/u);
});
