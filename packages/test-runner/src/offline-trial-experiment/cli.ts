// The offline-trial experiment's command line (trace plan P4, the social gate
// experiment). Provider-free: it never calls a model, starts a Lab run or
// reaches a browser. Point `--store` at a copied workspace's `.fluxiq`
// directory under `test-runs/` (opening its store applies Core's migrations).
//
//   node packages/test-runner/dist/offline-trial-experiment/cli.js survey \
//     --store <copied .fluxiq dir> --project <projectId> --steps <lab-runs/<date>/<run>/steps> \
//     [--scenario social-network-feed] [--task social-network-feed-recent-group-posts] \
//     [--brief brief-1] [--from-revision 10] [--out <file>]
//
//   Maps every `test` trace to its candidate, rebuilds every accepted
//   submission through Core's own path and checks Core's digests against the
//   recorded ones, judges each traced trial's stored rows by the task's own
//   oracle, and says whether a tier-1 correction of `--from-revision` could
//   satisfy it. Writes JSON of ids, digests, counts and codes only.
//
//   node packages/test-runner/dist/offline-trial-experiment/cli.js trial \
//     --store <dir> --project <id> --steps <dir> --trace <source trace id> \
//     ( --revision <n>                                   a recorded revision of --brief, rebuilt; refused unless its digests verify
//     | --process <process.json> [--from-revision <n>] [--step-label posts] )
//                                                        a hand tier-1 correction: revision --from-revision with only the
//                                                        labelled step's recordOutput.process replaced by the file's object
//     [--brief brief-1] [--request-out <file under test-runs/>] [--work <new dir under test-runs/>] [--session-view declared|none] [--out <file>]
//
//   Prepares the offline trial of that candidate against the source trace and,
//   with `--work`, runs it through Core's exported offline runner
//   (`runAutomationStudioOfflineCandidateTrial`, trace plan P4c). `--store` is
//   then the source and is never opened: it is copied to `<work>/fluxiq-root/
//   .fluxiq` (`./run/fresh-store-copy.ts`), and the session, the host and the
//   trial all use the copy, so runs cannot affect each other. The trial runs in
//   phase `test` with the ports a live build's trial gets and a judge that
//   calls no model (`./run/`); its stored rows are compared with the live
//   trials' and judged by the task's oracle. Without `--work` the request is
//   prepared on `--store` and not run (exit 3). `--request-out` writes the full
//   request, the candidate's plan included, which holds page content, so it
//   must lie under a `test-runs` directory. `--session-view declared` supplies
//   the extension's declared session view to Core's runner as its
//   `sessionView` (`./run/declared-session-view.ts`): Core uses it only where
//   the source trace recorded none, and reports it as `supplied`. The default,
//   `none`, supplies nothing, so a trace that recorded no view is refused.
//
// Exit codes: 0 done; 2 usage; 3 prepared, not run (no --work); 4 the
// candidate could not be prepared (refused or unverified rebuild).

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPERIMENT_USAGE, parseExperimentArguments } from "./cli-arguments.js";
import { openExperimentSession } from "./experiment-session.js";
import { offlineTrialRequest } from "./offline-trial-request.js";
import { withRecordProcessing } from "./rebuild/index.js";
import { freshStoreCopy, loadCoreTrialSeams, runExperimentTrial } from "./run/index.js";
import { surveyExperiment } from "./survey-experiment.js";

const parsed = parseExperimentArguments(process.argv.slice(2));
if ("error" in parsed) {
  process.stderr.write(`${parsed.error}\n${EXPERIMENT_USAGE}\n`);
  process.exit(2);
}
// dist/offline-trial-experiment -> repository root.
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
// With --work, only a fresh copy of --store is ever opened (header).
const copy = parsed.command === "trial" && parsed.work !== null ? await freshStoreCopy({ sourceFluxiqDir: parsed.store, work: parsed.work }) : null;
const session = await openExperimentSession({
  fluxiqDir: copy?.fluxiqDir ?? parsed.store, projectId: parsed.project, stepsDir: parsed.steps,
  oracle: { repositoryRoot, scenarioLabDist: path.join(repositoryRoot, "apps", "scenario-lab", "dist"), scenarioId: parsed.scenario, taskId: parsed.task },
});
const emit = async (value: unknown): Promise<void> => {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (parsed.out === null) process.stdout.write(text);
  else await writeFile(parsed.out, text);
};

if (parsed.command === "survey") {
  await emit(await surveyExperiment(session, { briefId: parsed.brief, fromRevision: parsed.fromRevision }));
  process.exit(0);
}

const source = session.traced.find((revision) => revision.traceId === parsed.trace);
if (!source) {
  process.stderr.write(`The store holds no candidate-trial trace ${parsed.trace}\n`);
  process.exit(4);
}
const named = parsed.revision ?? parsed.fromRevision;
const submission = [...session.steps.submissions].reverse().find((candidate) => candidate.briefId === parsed.brief && candidate.revision === named);
if (!submission) {
  process.stderr.write(`The step files hold no accepted submission of ${parsed.brief} revision ${named}\n`);
  process.exit(4);
}
const liveTwin = session.traced.find((revision) => revision.subflow?.briefId === parsed.brief && revision.subflow.digest === submission.digest) ?? null;
const correction = parsed.process === null ? null : JSON.parse(await readFile(parsed.process, "utf8")) as Record<string, unknown> | null;
const rebuild = correction === null && parsed.process === null
  ? await session.rebuild(submission, { subflow: { revision: submission.revision, digest: submission.digest }, whole: liveTwin?.whole ?? null })
  : await session.rebuild({ ...submission, script: withRecordProcessing(submission.script, parsed.stepLabel, correction) }, null);
let request;
try {
  request = offlineTrialRequest({
    store: { automationDataDir: session.automationDataDir, projectId: parsed.project, flowId: session.build.flowId },
    source, kind: parsed.process === null ? "recorded_revision" : "tier1_correction", rebuild, liveTwin: parsed.process === null ? liveTwin : null,
  });
} catch (error) {
  const { candidate: _candidate, ...summary } = rebuild;
  await emit({ prepared: false, reason: (error as Error).message, rebuild: summary });
  process.exit(4);
}
if (parsed.requestOut !== null) {
  if (!path.resolve(parsed.requestOut).split(path.sep).includes("test-runs")) {
    process.stderr.write("--request-out holds the candidate's plan, which holds page content: write it under a test-runs directory\n");
    process.exit(2);
  }
  await writeFile(parsed.requestOut, `${JSON.stringify(request, null, 2)}\n`);
}
const { candidate: _plan, ...candidate } = request.candidate;
const prepared = { prepared: true, source: request.source, candidate, liveTwin: request.liveTwin };
if (copy === null) {
  await emit({ ...prepared, ran: false, reason: "no --work named: the trial is prepared, not run" });
  process.exit(3);
}
const script = correction === null && parsed.process === null ? submission.script : withRecordProcessing(submission.script, parsed.stepLabel, correction);
const result = await runExperimentTrial({ session, stepsDir: parsed.steps, rootDir: copy.rootDir, request, script, seams: await loadCoreTrialSeams(), sessionView: parsed.sessionView });
await emit({ ...prepared, ran: true, ...result });
