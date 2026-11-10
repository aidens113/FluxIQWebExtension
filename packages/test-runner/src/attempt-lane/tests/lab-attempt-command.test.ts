import assert from "node:assert/strict";
import test from "node:test";
import { parseLabCommand } from "../../commands.js";

const SCRIPTED = ["attempt", "company-website", "--task", "company-website-apprentices", "--authoring-mode", "answer-first", "--scripted-model"];
const PAID = ["attempt", "company-website", "--task", "company-website-apprentices", "--authoring-mode", "answer-first", "--live-llm", "--llm-max-cost-usd", "5"];

test("the scripted form names one task and no model options", () => {
  assert.deepEqual(parseLabCommand(SCRIPTED), { command: "attempt", scenarioId: "company-website", taskId: "company-website-apprentices", authoringMode: "answer-first", model: { kind: "scripted" }, attempts: 4 });
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

test("--attempts takes any whole number from 1, and four is the default", () => {
  assert.deepEqual(parseLabCommand([...SCRIPTED, "--attempts", "2"]), { command: "attempt", scenarioId: "company-website", taskId: "company-website-apprentices", authoringMode: "answer-first", model: { kind: "scripted" }, attempts: 2 });
  assert.equal((parseLabCommand([...SCRIPTED, "--attempts", "1"]) as { attempts: number }).attempts, 1);
  assert.equal((parseLabCommand([...PAID, "--attempts", "2"]) as { attempts: number }).attempts, 2);
  assert.equal((parseLabCommand([...SCRIPTED, "--attempts", "3"]) as { attempts: number }).attempts, 3);
  assert.equal((parseLabCommand([...PAID, "--attempts", "6"]) as { attempts: number }).attempts, 6);
  assert.equal((parseLabCommand([...PAID]) as { attempts: number }).attempts, 4, "the paid form defaults to four too");
  for (const bad of ["0", "-1", "2.5", "x", "01"]) assert.throws(() => parseLabCommand([...SCRIPTED, "--attempts", bad]), /--attempts takes a whole number/u);
  assert.throws(() => parseLabCommand([...SCRIPTED, "--attempts"]), /--attempts|value/u);
  assert.throws(() => parseLabCommand([...SCRIPTED, "--reseed"]), /Unknown option: --reseed/u);
});

test("--restart-between restarts Core before every later attempt, and needs two or more", () => {
  assert.deepEqual(parseLabCommand([...SCRIPTED, "--attempts", "2", "--restart-between"]), { command: "attempt", scenarioId: "company-website", taskId: "company-website-apprentices", authoringMode: "answer-first", model: { kind: "scripted" }, attempts: 2, restartBetween: true });
  assert.equal((parseLabCommand([...PAID, "--restart-between", "--attempts", "2"]) as { restartBetween?: boolean }).restartBetween, true);
  assert.equal((parseLabCommand([...SCRIPTED, "--attempts", "4", "--restart-between"]) as { restartBetween?: boolean }).restartBetween, true);
  assert.equal((parseLabCommand([...SCRIPTED, "--restart-between"]) as { restartBetween?: boolean }).restartBetween, true, "the default is four");
  assert.throws(() => parseLabCommand([...SCRIPTED, "--attempts", "1", "--restart-between"]), /needs --attempts 2 or more/u);
  assert.throws(() => parseLabCommand([...SCRIPTED, "--attempts", "2", "--restart-between", "--restart-between"]), /only be specified once/u);
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
