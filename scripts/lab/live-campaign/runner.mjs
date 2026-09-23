import { mkdir } from "node:fs/promises";
import path from "node:path";
import { repositoryRoot } from "../lab-instance.mjs";
import { DEFAULT_PROFILES, describeAttemptFailure, displayCommand, labEnvironment, labRunArguments, parseLabResult, ramFaultSignature, STARTUP_FAILURE } from "./lab-run/index.mjs";
import { EMPTY_BUNDLE, readRunBundle, summarizeTask } from "./row/index.mjs";
import { totalsOf, writeSummary } from "./summary/index.mjs";

/**
 * Runs `tasks` in order, one at a time, and writes the summary after each.
 * Each run gets `secretsFor(scenarioId)`, its scenario's own replay secrets,
 * and none the machine set. `execute` and `readBundle` are injected so the
 * runner can be tested against a stubbed Lab.
 *
 * An attempt that died the way this machine's memory fault kills things is
 * retried, up to `maxAttempts`. One exception: a classified startup failure
 * that comes back identical on the retry is deterministic, so it is reported
 * as what it is and not retried again (`lab-run/attempt-failure.mjs` says why).
 */
export async function runCampaign({ tasks, options, outputDir, execute, secretsFor = () => ({}), readBundle = readRunBundle, log = (line) => process.stderr.write(`${line}\n`), now = () => new Date() }) {
  const profiles = { create: options.profile ?? DEFAULT_PROFILES.create, repair: options.profile ?? DEFAULT_PROFILES.repair };
  const summary = { schemaVersion: "0.1", campaignId: path.basename(outputDir), startedAt: now().toISOString(), finishedAt: null, options: { profiles, provider: options.provider, model: options.model, maxAttempts: options.maxAttempts, labArgs: options.labArgs }, environment: { npm_config_workspace_concurrency: "1", labInstance: process.env.FLUXIQ_LAB_INSTANCE?.trim() || null }, totals: totalsOf([]), tasks: [] };
  await mkdir(path.join(outputDir, "logs"), { recursive: true });
  /** Consecutive tasks whose run never started, cleared by any task that did. */
  const neverStarted = [];
  for (const [position, task] of tasks.entries()) {
    const args = labRunArguments(task, options);
    const attempts = [];
    // Before the attempt loop, so a task retried after this machine's memory
    // fault is measured as what it cost the campaign rather than as its last
    // attempt alone.
    const taskStartedAt = Number(now());
    let final;
    for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
      log(`[campaign] ${position + 1}/${tasks.length} ${task.id}, attempt ${attempt}/${options.maxAttempts}: ${displayCommand(args)}`);
      final = await execute({ taskId: task.id, args, env: labEnvironment(process.env, secretsFor(task.scenarioId)), logPath: path.join(outputDir, "logs", `${task.id}.attempt-${attempt}.log`) });
      const ramFault = ramFaultSignature(final);
      const failure = ramFault === STARTUP_FAILURE ? await describeAttemptFailure(final) : null;
      const previous = attempts.at(-1);
      if (failure !== null && previous?.failure === failure.fingerprint) {
        // The same classified failure twice is not the hardware, so neither
        // attempt was: the earlier one is un-labelled too.
        for (const earlier of attempts) if (earlier.failure === failure.fingerprint) earlier.ramFault = null;
        attempts.push({ attempt, exitCode: final.code, ramFault: null, failure: failure.fingerprint, repeatedFailure: failure.description });
        log(`[campaign] ${task.id}: attempt ${attempt} failed exactly as attempt ${previous.attempt} did (${failure.description}). A failure that repeats identically is deterministic, not this machine's memory fault; not retrying.`);
        break;
      }
      attempts.push({ attempt, exitCode: final.code, ramFault, ...(failure === null ? {} : { failure: failure.fingerprint }) });
      if (ramFault === null) break;
      const left = attempt < options.maxAttempts ? "; retrying" : "; no attempts left";
      log(failure === null
        ? `[campaign] ${task.id}: attempt ${attempt} died with this machine's RAM-fault signature (${ramFault})${left}`
        : `[campaign] ${task.id}: attempt ${attempt} failed before the run could start (${failure.description}). This machine's memory fault can cause that, and so can a real defect; only a retry tells them apart${left}`);
    }
    const result = parseLabResult(final.stdout);
    const runPath = result?.path ? path.resolve(repositoryRoot, result.path) : null;
    const row = summarizeTask(task, attempts, final, runPath ? await readBundle(runPath) : EMPTY_BUNDLE, { durationMs: Math.max(0, Number(now()) - taskStartedAt) });
    summary.tasks.push(row);
    summary.totals = totalsOf(summary.tasks);
    // A task whose run never started measured nothing. One can be a bad
    // scenario; two in a row, on different sites, is the environment -- a stale
    // Core build, a missing project id, a Lab that cannot boot. Carrying on
    // spends the whole list printing one refusal per task and ends on a totals
    // line that reads like a product result: the run that provoked this stopped
    // 55 times over a Core build that was 1,995 minutes behind its source.
    if (row.runId) neverStarted.length = 0;
    else neverStarted.push({ id: task.id, why: labRefusal(final.stdout) ?? labRefusal(final.stderr) ?? `exit ${final.code}` });
    log(`[campaign] ${task.id}: ${row.verdict}${row.runId ? ` (${row.runId})` : ""}, judgement ${row.judgement.passed === null ? "not measured" : row.judgement.passed ? "passed" : "failed"}`);
    await writeSummary(outputDir, summary);
    if (neverStarted.length >= 2) {
      const ids = neverStarted.map((entry) => entry.id).join(" and ");
      summary.abandoned = { after: position + 1, of: tasks.length, why: neverStarted.at(-1).why, tasks: neverStarted.map((entry) => entry.id) };
      log(`[campaign] stopping after ${position + 1} of ${tasks.length}: ${ids} never started (${neverStarted.at(-1).why}). Nothing measured here is a product result until that is fixed.`);
      break;
    }
  }
  summary.finishedAt = now().toISOString();
  await writeSummary(outputDir, summary);
  return summary;
}

/**
 * The Lab's own reason for refusing to run, when it printed one. It emits a
 * `{"lab":...}` line for each guard it applies, and the refusal is the last one
 * carrying a `why` -- written for a person to act on, so it is the right thing
 * to repeat back rather than an exit code.
 */
function labRefusal(output) {
  let refusal = null;
  for (const line of String(output ?? "").split(/\r?\n/u)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const value = JSON.parse(line);
      if (typeof value?.why === "string" && value.why.length > 0) refusal = value.why;
      else if (value?.status === "failed" && typeof value.message === "string" && value.message.length > 0) refusal = value.message;
    } catch { /* the Lab prints many lines; one that does not parse is not a refusal */ }
  }
  return refusal;
}
