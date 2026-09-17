import { mkdir } from "node:fs/promises";
import path from "node:path";
import { repositoryRoot } from "../lab-instance.mjs";
import { DEFAULT_PROFILES, displayCommand, labEnvironment, labRunArguments, parseLabResult, ramFaultSignature } from "./lab-run/index.mjs";
import { EMPTY_BUNDLE, readRunBundle, summarizeTask } from "./row/index.mjs";
import { totalsOf, writeSummary } from "./summary/index.mjs";

/**
 * Runs `tasks` in order, one at a time, and writes the summary after each.
 * Each run gets `secretsFor(scenarioId)`, its scenario's own replay secrets,
 * and none the machine set. `execute` and `readBundle` are injected so the
 * runner can be tested against a stubbed Lab.
 */
export async function runCampaign({ tasks, options, outputDir, execute, secretsFor = () => ({}), readBundle = readRunBundle, log = (line) => process.stderr.write(`${line}\n`), now = () => new Date() }) {
  const profiles = { create: options.profile ?? DEFAULT_PROFILES.create, repair: options.profile ?? DEFAULT_PROFILES.repair };
  const summary = { schemaVersion: "0.1", campaignId: path.basename(outputDir), startedAt: now().toISOString(), finishedAt: null, options: { profiles, provider: options.provider, model: options.model, maxAttempts: options.maxAttempts, labArgs: options.labArgs }, environment: { npm_config_workspace_concurrency: "1", labInstance: process.env.FLUXIQ_LAB_INSTANCE?.trim() || null }, totals: totalsOf([]), tasks: [] };
  await mkdir(path.join(outputDir, "logs"), { recursive: true });
  for (const [position, task] of tasks.entries()) {
    const args = labRunArguments(task, options);
    const attempts = [];
    let final;
    for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
      log(`[campaign] ${position + 1}/${tasks.length} ${task.id}, attempt ${attempt}/${options.maxAttempts}: ${displayCommand(args)}`);
      final = await execute({ taskId: task.id, args, env: labEnvironment(process.env, secretsFor(task.scenarioId)), logPath: path.join(outputDir, "logs", `${task.id}.attempt-${attempt}.log`) });
      const ramFault = ramFaultSignature(final);
      attempts.push({ attempt, exitCode: final.code, ramFault });
      if (ramFault === null) break;
      log(`[campaign] ${task.id}: attempt ${attempt} died with this machine's RAM-fault signature (${ramFault})${attempt < options.maxAttempts ? "; retrying" : "; no attempts left"}`);
    }
    const result = parseLabResult(final.stdout);
    const runPath = result?.path ? path.resolve(repositoryRoot, result.path) : null;
    const row = summarizeTask(task, attempts, final, runPath ? await readBundle(runPath) : EMPTY_BUNDLE);
    summary.tasks.push(row);
    summary.totals = totalsOf(summary.tasks);
    log(`[campaign] ${task.id}: ${row.verdict}${row.runId ? ` (${row.runId})` : ""}, judgement ${row.judgement.passed === null ? "not measured" : row.judgement.passed ? "passed" : "failed"}`);
    await writeSummary(outputDir, summary);
  }
  summary.finishedAt = now().toISOString();
  await writeSummary(outputDir, summary);
  return summary;
}
