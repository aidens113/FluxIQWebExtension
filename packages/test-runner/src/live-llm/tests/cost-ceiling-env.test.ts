import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { LAB_COST_CEILING_ENV, labCostCeilingValue } from "../cost-ceiling-env.js";

// The Lab passes the per-build cost ceiling to every Core it starts from one
// configurable place: environment, then `.env` and `.env.local`. A run flag
// may only lower that configured amount (user clarification, 2026-10-03).

function checkout(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "lab-ceiling-"));
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(root, name), text);
  return root;
}

test("a lower run flag narrows the ceiling configured by environment and env files", () => {
  const root = checkout({ ".env.local": `${LAB_COST_CEILING_ENV}=0.30\n` });
  try {
    assert.equal(labCostCeilingValue(root, ["node", "cli", "run", "--llm-cost-ceiling-usd", "0.05"], { [LAB_COST_CEILING_ENV]: "0.20" }), "0.05");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the environment wins over the env files", () => {
  const root = checkout({ ".env.local": `${LAB_COST_CEILING_ENV}=0.30\n` });
  try {
    assert.equal(labCostCeilingValue(root, ["node", "cli"], { [LAB_COST_CEILING_ENV]: "0.20" }), "0.2");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test(".env.local is read, and wins over .env, quoted or not", () => {
  const root = checkout({ ".env": `${LAB_COST_CEILING_ENV}=0.40\n`, ".env.local": `OTHER=1\nexport ${LAB_COST_CEILING_ENV}="0.15"\n` });
  try {
    assert.equal(labCostCeilingValue(root, ["node", "cli"], {}), "0.15");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("nothing configured explicitly passes the Lab default, independent of ordinary UI defaults", () => {
  const root = checkout({ ".env.local": "OTHER=1\n" });
  try {
    assert.equal(labCostCeilingValue(root, ["node", "cli"], {}), "0.1");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a run flag cannot raise the checkout's $0.10 Lab ceiling", () => {
  const root = checkout({ ".env": `${LAB_COST_CEILING_ENV}=0.10\n` });
  try {
    assert.throws(() => labCostCeilingValue(root, ["node", "cli", "--llm-cost-ceiling-usd", "0.30"], {}), /cannot raise the configured Lab ceiling of \$0\.10/u);
    assert.equal(labCostCeilingValue(root, ["node", "cli", "--llm-cost-ceiling-usd", "0.04"], {}), "0.04");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("the default ceiling cannot be raised by a flag and invalid configured amounts cannot be masked", () => {
  const root = checkout({});
  try {
    assert.throws(() => labCostCeilingValue(root, ["node", "cli", "--llm-cost-ceiling-usd", "0.30"], {}), /cannot raise/u);
    assert.throws(() => labCostCeilingValue(root, ["node", "cli", "--llm-cost-ceiling-usd", "0.04"], { [LAB_COST_CEILING_ENV]: "invalid" }), /FLUXIQ_LLM_RUN_COST_CEILING_USD/u);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a flag with no amount is refused", () => {
  assert.throws(() => labCostCeilingValue(tmpdir(), ["node", "cli", "--llm-cost-ceiling-usd"], {}), /needs an amount/u);
});
