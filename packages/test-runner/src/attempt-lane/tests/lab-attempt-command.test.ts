import assert from "node:assert/strict";
import test from "node:test";
import { parseLabCommand } from "../../commands.js";

const SCRIPTED = ["attempt", "company-website", "--task", "company-website-apprentices", "--authoring-mode", "answer-first", "--scripted-model"];
const PAID = ["attempt", "company-website", "--task", "company-website-apprentices", "--authoring-mode", "answer-first", "--live-llm", "--llm-max-cost-usd", "5"];

test("the scripted form names one task and no model options", () => {
  assert.deepEqual(parseLabCommand(SCRIPTED), { command: "attempt", scenarioId: "company-website", taskId: "company-website-apprentices", authoringMode: "answer-first", model: { kind: "scripted" } });
  assert.throws(() => parseLabCommand([...SCRIPTED, "--llm-max-cost-usd", "5"]), /--scripted-model takes no LLM options/u);
});

test("the paid form defaults its profile and task, and keeps the budget it names", () => {
  const parsed = parseLabCommand(PAID);
  assert.equal(parsed.command, "attempt");
  if (parsed.command !== "attempt" || parsed.model.kind !== "live") throw new Error("not a live attempt");
  assert.equal(parsed.model.llm.task, "create-flow");
  assert.equal(parsed.model.llm.budget.maxEstimatedCostUsd, 5);
  assert.equal(parsed.model.llm.mode, "live");
  assert.equal(parseLabCommand([...PAID, "--dry-run"]).command, "attempt");
});

test("it takes exactly one model, its task, and the mode it drives", () => {
  assert.throws(() => parseLabCommand(["attempt", "company-website", "--task", "x", "--authoring-mode", "answer-first"]), /exactly one of --scripted-model or --live-llm/u);
  assert.throws(() => parseLabCommand([...SCRIPTED, "--live-llm"]), /exactly one of --scripted-model or --live-llm/u);
  assert.throws(() => parseLabCommand(["attempt", "company-website", "--authoring-mode", "answer-first", "--scripted-model"]), /--task/u);
  assert.throws(() => parseLabCommand(["attempt", "company-website", "--task", "x", "--scripted-model"]), /--authoring-mode answer-first/u);
  assert.throws(() => parseLabCommand(["attempt", "company-website", "--task", "x", "--authoring-mode", "project", "--scripted-model"]), /--authoring-mode answer-first/u);
  assert.throws(() => parseLabCommand([...SCRIPTED, "--surprise"]), /Unknown option: --surprise/u);
  assert.throws(() => parseLabCommand(["attempt", "--task", "x", "--authoring-mode", "answer-first", "--scripted-model"]), /scenario ID/u);
  assert.throws(() => parseLabCommand([...PAID, "--llm-task", "diagnose"]), /--llm-task must be create-flow/u);
});
