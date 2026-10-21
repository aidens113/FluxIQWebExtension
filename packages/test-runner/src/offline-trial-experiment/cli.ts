// The offline-trial experiment's command line (trace plan P4, the social gate
// experiment). Provider-free: it never calls a model or starts a Lab run, and
// reaches a browser only for tier 2 (`trial --tier2`, `reads`), over recorded
// page snapshots with the network off. Point `--store` at a copied workspace's `.fluxiq`
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
//     [--brief brief-1] [--request-out <file under test-runs/>] [--work <new dir under test-runs/>] [--session-view declared|none]
//     [--tier2 [--channel chrome|msedge]] [--out <file>]
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
//   `--tier2` (P5) hands Core's runner the web domain's offline reevaluator
//   over a headed snapshot page (Chrome, or Edge by `--channel`) running the
//   extension's production content code (`./tier2/`; build it first with
//   `pnpm --filter @fluxiq-web-extension/extension build`): a changed read is
//   then answered from the trace's recorded page snapshot where the domain's
//   rule allows, and the report lists the operations so answered and every
//   ask with its outcome. This reaches a browser, over recorded pages only.
//
//   node packages/test-runner/dist/offline-trial-experiment/cli.js reads //     --store <copied .fluxiq dir> --project <projectId> --work <new dir under test-runs/> //     [--pairs strict|same-snapshot|none] [--pair-list <trace>@<seq>/<trace>@<seq>,...] //     [--one-per-fields <cap>] [--fidelity all|none] [--channel chrome|msedge] [--out <file>]
//
//   The changed-read gate tool (P5; `./reads/`). `--store` is copied to
//   `--work` and only the copy is opened. Every trace is admitted as Core's
//   offline runner admits it; each changed-read pair (A, B) -- the named ones
//   (a trace is its id or the 8 hex digits after `trace.`), then every strict
//   pair (default) or same-snapshot pair, or one per differing-path set up to
//   `--one-per-fields` -- is asked of tier 2's reevaluator with Core's own
//   request at A's cursor carrying B's recorded command, and the answer is
//   compared with B's recorded live result (status, failure code, records one
//   by one with cell counts, summary counts); a gap is reported with its
//   reason, never as a match. With `--fidelity all` (default) every recorded
//   read is also run over its own snapshot and compared with its live result.
//   Headed Chrome (or Edge) over recorded snapshots, network off.
//
// Exit codes: 0 done; 2 usage; 3 prepared, not run (no --work); 4 the
// candidate could not be prepared (refused or unverified rebuild).

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPERIMENT_USAGE, parseExperimentArguments } from "./cli-arguments.js";
import { openExperimentSession } from "./experiment-session.js";
import { offlineTrialRequest } from "./offline-trial-request.js";
import { READS_USAGE, readsCommand } from "./reads/index.js";
import { withRecordProcessing } from "./rebuild/index.js";
import { freshStoreCopy, runExperimentTrial } from "./run/index.js";
import { surveyExperiment } from "./survey-experiment.js";
import { openTier2Reevaluation } from "./tier2/index.js";

// dist/offline-trial-experiment -> repository root.
const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
if (process.argv[2] === "reads") process.exit(await readsCommand(process.argv.slice(3), repositoryRoot));
const parsed = parseExperimentArguments(process.argv.slice(2));
if ("error" in parsed) {
  process.stderr.write(`${parsed.error}\n${EXPERIMENT_USAGE}\n${READS_USAGE}\n`);
  process.exit(2);
}
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
// Tier 2: the domain's reevaluator over a headed snapshot page running the extension's production content code.
const tier2 = parsed.tier2 ? await openTier2Reevaluation({ extensionDir: path.join(repositoryRoot, "apps", "extension"), channel: parsed.channel }) : null;
let result;
try {
  result = await runExperimentTrial({ session, stepsDir: parsed.steps, rootDir: copy.rootDir, request, script, sessionView: parsed.sessionView, ...(tier2 === null ? {} : { reevaluator: tier2.reevaluator }) });
} finally {
  await tier2?.close();
}
await emit({ ...prepared, ran: true, ...result, tier2: tier2 === null ? null : { channel: tier2.channel, asks: tier2.asks() } });
