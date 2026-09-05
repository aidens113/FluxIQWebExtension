#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { readAuditLog, verifyAuditRecords } from "./audit.js";
import { evaluateReviewGate, validateCandidateResult } from "./review.js";
import { createTaskPacket, renderTaskMarkdown, validateTaskPacket, type CreateTaskInput } from "./task.js";
import type { AgentTaskPacket, CandidateSubmission, PolicyIssue, PolicyResult } from "./types.js";
import { createWorktreePlan, validateWorktreePlanRequest, type WorktreePlanRequest } from "./worktree.js";

type CliResult = { exitCode: 0 | 1 | 2; output: Record<string, unknown> };

async function readJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Cannot read JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function policyOutput(operation: string, result: PolicyResult, extra: Record<string, unknown> = {}): CliResult {
  return { exitCode: result.accepted ? 0 : 2, output: { ok: result.accepted, operation, ...extra, issues: result.issues } };
}

function usage(): never {
  throw new Error("usage: fluxiq-agent-orchestrator <task create|result validate|review evaluate|audit verify|worktree plan> <json files>");
}

export async function runCli(argv: readonly string[]): Promise<CliResult> {
  const [group, action, ...files] = argv;
  if (group === "task" && action === "create" && files.length === 1) {
    const packet = createTaskPacket(await readJson(files[0]!) as CreateTaskInput);
    const validation = validateTaskPacket(packet);
    return policyOutput("task.create", validation, { packet, renderedMarkdown: renderTaskMarkdown(packet) });
  }
  if (group === "result" && action === "validate" && files.length === 3) {
    const [packet, response, observedEdits] = await Promise.all(files.map(readJson));
    const result = validateCandidateResult(packet as AgentTaskPacket, response, observedEdits);
    return policyOutput("result.validate", result);
  }
  if (group === "review" && action === "evaluate" && files.length === 1) {
    const submission = await readJson(files[0]!) as CandidateSubmission;
    const result = evaluateReviewGate(submission);
    return policyOutput("review.evaluate", result, { verdict: result.verdict });
  }
  if (group === "audit" && action === "verify" && files.length === 1) {
    const records = await readAuditLog(files[0]!);
    const issues: PolicyIssue[] = [];
    if (records.length === 0) issues.push({ code: "audit.empty", message: "Audit log must contain at least one record" });
    if (!verifyAuditRecords(records)) issues.push({ code: "audit.invalid", message: "Audit hash chain is invalid" });
    return policyOutput("audit.verify", { accepted: issues.length === 0, issues }, { recordCount: records.length, headHash: records.at(-1)?.hash ?? null });
  }
  if (group === "worktree" && action === "plan" && files.length === 1) {
    const request = await readJson(files[0]!) as WorktreePlanRequest;
    const validation = validateWorktreePlanRequest(request);
    return policyOutput("worktree.plan", validation, validation.accepted ? { plan: createWorktreePlan(request) } : {});
  }
  return usage();
}

async function main(): Promise<void> {
  try {
    const result = await runCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result.output)}\n`);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ ok: false, operation: "input", issues: [{ code: "input.invalid", message: error instanceof Error ? error.message : String(error) }] })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
