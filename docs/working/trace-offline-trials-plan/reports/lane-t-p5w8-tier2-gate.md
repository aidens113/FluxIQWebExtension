# Lane T P5 W8 (t749): tier 2 in the offline-trial experiment, the changed-read gate tool, and the round-4 runs

Worker report. Downstream tree `C:/Users/osrs_/FluxStuff/fxwork/t749/!FluxIQWebExtension`, branch
`task/t749-offline-reads-tier2`; Core tree `.../t749/!FluxIQ` read only (built). Nothing committed. No model call, no
Lab run; headed Chrome pages over recorded snapshots only. Counts, field paths, codes and digests only.

## Progress log

### 2026-10-20, unit 1: the content message builder moves into the domain

- `domain/src/client/execute-action-message.ts` (`executeActionMessage`, `ExecuteActionMessage`), typed on the domain's
  `WebAutomationActionCommand` (the extension's `BrowserActionCommand` is that type). Its three rows moved to
  `domain/src/client/tests/execute-action-message.test.ts`. Exported from `domain/src/client/index.ts` and, one line,
  from `domain/src/index.ts`, which is what `@fluxiq-web-extension/domain/node` (the test-runner's entry) serves.
- Deleted `apps/extension/src/shared/execute-action-message.ts` and `shared/tests/execute-action-message.test.ts`.
  Callers switched in the same unit: `apps/extension/src/runtime/action-runner.ts` (imports it from
  `@fluxiq-web-extension/domain/client` beside its other domain imports) and
  `apps/extension/e2e/content/tests/offline-reads/tests/harness-content-code.ts`. The comment in
  `packages/test-runner/src/offline-snapshot-page/page-options.ts` names the new home.
- Checks:
  - `DOMAIN_TEST_BUILD_LABEL=t749-w8 node scripts/test-domain.mjs client/tests/execute-action-message client/tests/browser-result-mapping`
    (domain) -> `# tests 14`, `# pass 14`, `# fail 0`.
  - `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.test.json` in `domain` and in `apps/extension` -> exit 0 (all four).
  - `EXTENSION_TEST_BUILD_LABEL=t749-w8 node scripts/test-extension.mjs runtime/tests/action-runner` (apps/extension)
    -> `# tests 39`, `# pass 39`, `# fail 0`.

- The root barrel line first named `./client/execute-action-message`; the audit failed `[imports] domain/src/index.ts: 3
  import(s) reach into another directory's files ... Baseline for this entry is 2`. It now re-exports the two names
  from `./client` (the barrel); the audit then printed `structure-audit: passed (218 warning(s), 651 baselined).` and
  domain `tsc -p tsconfig.json` exit 0.

UNIT READY: domain/src/client/execute-action-message.ts, domain/src/client/tests/execute-action-message.test.ts,
domain/src/client/index.ts, domain/src/index.ts, apps/extension/src/runtime/action-runner.ts,
apps/extension/src/shared/execute-action-message.ts (deleted), apps/extension/src/shared/tests/execute-action-message.test.ts
(deleted), apps/extension/e2e/content/tests/offline-reads/tests/harness-content-code.ts,
packages/test-runner/src/offline-snapshot-page/page-options.ts

### 2026-10-20, unit 2: the production content code for Node

- Test first: `offline-snapshot-page/tests/extension-content-code.test.ts` (4 rows). Before the module existed the
  test-runner `tsc` failed `TS2307: Cannot find module '../extension-content-code.js'` (and `TS2305` for
  `executeActionMessage` until the domain dist was rebuilt).
- `offline-snapshot-page/extension-content-code.ts`: `loadExtensionContentCode({ extensionDir, target? })` reads
  `dist/<target>/content/index.js` and `dist/<target>/page-world/index.js` (target `chrome` by default, the production
  Chromium build of `apps/extension/scripts/build-extension.mjs`) with the domain's `executeActionMessage`. A missing
  bundle, or bundles older than any file under the extension's `src/`, are refused with an error naming the file and
  `pnpm --filter @fluxiq-web-extension/extension build`. Exported from the directory barrel.
- `node scripts/domain-dist.mjs` -> `{"build-cache":"build","step":"domain:build",...}`; test-runner `npx tsc -p
  tsconfig.json` exit 0; `node --test dist/offline-snapshot-page/tests/extension-content-code.test.js` -> `# tests 4`,
  `# pass 4`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension build` -> `extension build: chrome: verified 22 files`, firefox and
  e2e-chromium verified, `{"build-cache":"build","step":"extension:build",...}`.

UNIT READY: packages/test-runner/src/offline-snapshot-page/extension-content-code.ts,
packages/test-runner/src/offline-snapshot-page/tests/extension-content-code.test.ts,
packages/test-runner/src/offline-snapshot-page/index.ts

### 2026-10-20, unit 3 and 4 code: tier 2 in `trial`, and the `reads` gate tool

- `offline-trial-experiment/tier2/` (new): `openTier2Reevaluation({ extensionDir, channel?, headless? })` loads the
  production content code, opens `openWebSnapshotPage` headed and returns `createWebOfflineReadReevaluator` over it;
  both are watched (`recording-snapshot-page.ts`, `recording-reevaluator.ts`) so a report lists every ask (recorded
  sequence, action, differing field paths, status, gap reason) with the page evaluations it made (command id, action,
  snapshot digest prefix, status/reason, result status, failure code, row count, sandbox counts, ms). Tests: 5 rows.
- `trial --tier2 [--channel chrome|msedge]` (needs `--work`): `cli.ts` opens tier 2, passes its reevaluator through
  `runExperimentTrial` -> `runOfflineExperimentTrial` to Core's `runAutomationStudioOfflineCandidateTrial` as
  `reevaluator`, closes the browser in `finally`, and emits `tier2: { channel, asks }`. `offlineTrialReport` now carries
  Core's `reevaluated` list and each matched operation's `answeredFrom`. Argument rows added to
  `tests/cli-arguments.test.ts`.
- `offline-trial-experiment/reads/` (new), the `reads` subcommand: `trace-reads.ts` admits each trace with Core's
  `admitClientGatewayTraceForMatching` (the runner's reader contracts) and builds, per read, Core's
  `clientGatewayTraceReevaluationRequest` at its cursor (its recorded command and one recorded result);
  `strict-read-pairs.ts`, `same-snapshot-read-pairs.ts`, `one-pair-per-fields.ts` select pairs (fields = Core's
  `clientGatewayTraceOperationDifferences(B, A)`); `reevaluate-read-pair.ts` asks the reevaluator with Core's request
  over A's admission, cursor A, command B's recorded payload; `answer-comparison.ts` compares status, failure code,
  records position by position with cell counts, a single value, and summary counts; `snapshot-fidelity.ts` runs each
  recorded read over its own snapshot; `run-reads-gate.ts` orchestrates and summarizes; `reads-arguments.ts`,
  `reads-command.ts`. Tests first for each pure part (comparison 5, pairs 4, recorded page 2, pair request 3,
  fidelity 3, arguments 3).
- First test run of fidelity: 2 failures, both fixture errors (an `extractList.fields` shape the domain rejects, and a
  hand-made summary the builder drops); fixed in the fixtures, not the code.
- Audit after the first pass: `[naming] reads/: 3 files share the prefix "read-"` (renamed to `answer-comparison.ts`,
  `trace-reads.ts`, `snapshot-fidelity.ts`) and `[statement-packing]` in two tests (unpacked).
- Two defects found by the first real run, both mine and fixed: (1) the `reads` dispatch in `cli.ts` had not been
  written (a scripted edit missed; the CLI answered `the first argument is the command, survey or trial, not reads`),
  nor the usage line for `--tier2`; (2) pair reports carried no page evaluations, because the watched reevaluator
  already takes them per ask; `run-reads-gate.ts` now reads them from the new asks. The job gate was rerun after (2).
- Final code checks: `pnpm --filter @fluxiq-web-extension/test-runner build` ->
  `{"build-cache":"build","step":"test-runner:build",...}`; `node --test "dist/offline-snapshot-page/**/*.test.js"
  "dist/offline-trial-experiment/**/*.test.js"` (packages/test-runner) -> `# tests 98`, `# pass 98`, `# fail 0`;
  `node scripts/structure-audit.mjs` -> `structure-audit: passed (218 warning(s), 651 baselined).`

UNIT READY: packages/test-runner/src/offline-trial-experiment/** (tier2/ and reads/ new; cli.ts, cli-arguments.ts,
index.ts, run/run-offline-experiment-trial.ts, run/experiment-trial.ts, run/offline-trial/report.ts,
tests/cli-arguments.test.ts changed)

### 2026-10-20, unit 5: the runs (fresh copies under `test-runs/p5w8/`, outputs in `test-runs/p5w8/out/`)

Every run made its own fresh copy with `--work`; the `test-runs/p5/` sources were never opened. Headed Chrome, the
production `dist/chrome` content code. Commands from the repository root, with
`C=packages/test-runner/dist/offline-trial-experiment/cli.js`:

- job: `node $C reads --store test-runs/p5/run-mvgw1854-5d10955b/fluxiq-root/.fluxiq --project 1fa185e9-b435-4616-9d51-72a92e54b135 --work test-runs/p5w8/job2 --out test-runs/p5w8/out/job-reads.json`
  -> `pairs {"total":10,"answeredEqual":2,"answeredDifferent":0,"gaps":{"dynamic_content":8},"declined":0,"notAsked":{},"threw":0}`,
  `fidelity {"total":10,"equal":10,"different":0,"controlReproduced":10,"unavailable":{},"notEvaluated":{},"threw":0}` (56 s).
- photo: `node $C reads --store test-runs/p5/run-mvgw7320-de416190/fluxiq-root/.fluxiq --project 46260e60-39ac-433d-a319-1b814a0c45ac --work test-runs/p5w8/photo --pairs same-snapshot --out test-runs/p5w8/out/photo-reads.json`
  -> `pairs {"total":6,"answeredEqual":0,"answeredDifferent":0,"gaps":{"dynamic_content":6},"declined":0,"notAsked":{},"threw":0}`,
  `fidelity {"total":9,"equal":9,"different":0,"controlReproduced":9,"unavailable":{},"notEvaluated":{},"threw":0}` (217 s).
- social: `node $C reads --store test-runs/p5/run-mvgw3ve5-294881b5/fluxiq-root/.fluxiq --project a846814f-becd-4569-934f-f3a10df1ce79 --work test-runs/p5w8/social --pairs strict --one-per-fields 25 --pair-list 5c07f127@164/5c07f127@265,5c07f127@265/5c07f127@291,f53b350b@78/a4d59680@78 --out test-runs/p5w8/out/social-reads.json`
  -> `pairs {"total":26,"answeredEqual":22,"answeredDifferent":4,"gaps":{},"declined":0,"notAsked":{},"threw":0}`,
  `fidelity {"total":62,"equal":50,"different":12,"controlReproduced":50,"unavailable":{},"notEvaluated":{},"threw":0}`
  (601 s). Selection: 233 strict pairs available (the survey's count), 3 named, 26 asked (the 3 named plus the first
  strict pair of each of 25 differing-path sets, two of which were named ones).
- E1 corrected candidate: `node $C trial --store test-runs/p5/run-mvgw3ve5-294881b5/fluxiq-root/.fluxiq --project a846814f-becd-4569-934f-f3a10df1ce79 --steps C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgw3ve5-294881b5/steps --trace trace.f53b350b-3146-40b2-a44d-15ddbf0913a7 --revision 16 --tier2 --session-view declared --work test-runs/p5w8/e1-rev16 --out test-runs/p5w8/out/e1-rev16.json`
  -> exit 0.
- Reverse control as written: the same with `--trace trace.3e353455-9e9e-48da-baba-a06b73f0ccc9 --revision 10 --tier2`
  and no session view (work `rev10-on-3e35`) -> `refused incomplete_capture the source trace recorded no session view
  (no session.claimed event) and the caller supplied none`; rerun with `--session-view declared` (work
  `rev10-on-3e35-declared`) -> exit 0.

## Results

### Pairs: changed reads answered by tier 2, compared with B's live result

| Site | Pairs asked | Answered equal | Answered different | Gap (reason) | Declined / not asked |
| --- | --- | --- | --- | --- | --- |
| job | 10 (all strict) | 2 | 0 | 8 `dynamic_content` | 0 / 0 |
| photo | 6 (same-snapshot; all labelled `timeoutMs_only`) | 0 | 0 | 6 `dynamic_content` | 0 / 0 |
| social | 26 (3 named, 23 further strict) | 22 | 4 | 0 | 0 / 0 |

- job, equal: 130 -> 144 (`parameters.extractList.where` added; 7 -> 3 rows; 12/12 cells) and 1255 -> 1284
  (`parameters.recordOutput`; 4/4 rows, 20/20 cells).
- job, 8 gaps (1234/1237/1240/1243 -> 1255/1284). Cause: the D37 rule. A is the legacy `handle`/`fields` form, which
  failed live (`web.action.failed`); its control over the snapshot failed the same way (fidelity equal) and asked the
  page for nothing (`scrollsPastEnd` 0). B, an `extractList` read, revealed its list's end once (`scrollsPastEnd` 1),
  more than the control, and a failed recorded read cannot prove its list ended (`recorded-list-ended.ts`), so the
  rule calls it dynamic. B's own fidelity is equal (4 rows, 20/20 cells), so the answer would have matched: the gap is
  conservative, never a false pass.
- photo, 6 gaps. Cause: the D37 rule (`dynamic-content.ts`, a list that never appeared). All four reads (891, 1023,
  1208, 1414) recorded `listPresence: "never_appeared"` with 0 rows; offline the control reproduces exactly and the
  changed read asks no more (0 and 0), but a changed read whose list never appeared is dynamic by rule. Photo has no
  strict pair; its only changed pairs differ in `parameters.timeoutMs` alone, which Core compares (it lies under
  `parameters` in these commands), so the matcher would offer them.
- social, 22 equal: every same-snapshot pair, including the survey's three best: 164 -> 265 (failed live -> 34 rows;
  offline 34/34 rows, 136/136 cells), 265 -> 291 (34/34), and cross-trace f53b350b@78 -> a4d59680@78 (17 rows -> failed
  `output_not_observed`; offline failed with the same code); also 803 -> 851 (16/16 rows, 64/64 cells).
- social, 4 different: 136 -> 189, 251, 265, 291. Cause: different pages (label `different_snapshot`). A's snapshot
  (`c554300708d3`) is not B's (`8bb19fe7df78`); offline B over A's page keeps 10 records where live B on its later page
  kept 34 (`recordCount`, `itemsSeen`, `emptyRecords` differ). Nothing that acts on the page lies between them (page
  views only), so the feed grew on its own; B's live result is not the counterfactual of B run at A's point, which is
  what the matcher asks. Not a tier-2 fault; see open question 2. (136 -> 164 and 136 -> 201 are equal: both fail.)

### Reads over their own snapshot (fidelity)

| Site | Reads | Equal | Different | Control reproduced | Unavailable / not evaluated |
| --- | --- | --- | --- | --- | --- |
| job | 10 (extract_list) | 10 | 0 | 10 | 0 / 0 |
| photo | 9 (7 extract_list, 2 extract) | 9 | 0 | 9 | 0 / 0 |
| social | 62 (58 extract_list, 4 wait_for_text) | 50 | 12 | 50 | 0 / 0 |

- job: rows and cells equal everywhere (7/28, 3/12, 4/20, 4/20, 4/12, 5/15; the four legacy reads fail the same way).
  photo: read 211 24 rows / 24 cells, the 0-row reads equal, both single values equal.
- social, 12 different. Cause: content-code drift, a deliberate rule change, not snapshot fidelity. All 12 are trial
  reads (b414b6a4@295/307/316/327 on `fff583393e15`; b2b5984c@78/90/101/110 and 92d5ddeb@88/99/108/119 on
  `a57645902a11`) that failed live with `output_not_observed` (`incomplete_text`); offline they succeed (18 rows, or 0).
  Traced with a scratch probe over the same snapshots: without `where` each fails `incomplete_text`; with only the
  condition that drops the rows carrying a "see more" control it succeeds. The live round ran the round-4 build, which
  held every item to full disclosure before the conditions; t743 (`d2302b5f`, 2026-10-20 15:33, after round 4) checks
  disclosure only on the rows `where` keeps, and its comment cites this run (`run-mvgw3ve5-294881b5`). Exploration reads
  whose kept rows still hold unexpanded text reproduce the failure. The D37 control catches the drift: a changed read
  over any of these 12 would be a `dynamic_content` gap, never a pass.

### The two trials

| | E1: rev 16 on trace f53b350b (declared view) | Reverse: rev 10 on trace 3e353455 (declared view) |
| --- | --- | --- |
| Request | whole rev 8 `cfa2549ce1e8`, subflow 16 `a6aaeb05c6a6` | whole rev 5 `86d511cb0b83`, subflow 10 |
| Matcher | 19/19 matched, 0 gaps, no refusal | 19/19 matched, 0 gaps |
| Reevaluated | 1: ordinal 17, `web.dom.extract_list`, `parameters.extractList.where` | 1: ordinal 17, same field |
| Tier-2 ask (recorded seq 78) | answered; control 17 rows on `a89251e6c353` (live rev 10's read), changed read 0 rows; 0 scripts, 0 leaks | answered; control 0 rows on `639e1b0f9e2d` (live rev 16's read), changed read 16 kept |
| U5 | `inconclusive`, origins recorded + pure_computation + snapshot_evaluation, scope full_recorded_path | same |
| Stored rows | 0; vs live twin (rev 16, trace 3e353455): 0 and 0, `equal: true` | 14; vs live twin (rev 10, trace f53b350b): 15 live, 14 positions equal, `equal: false` |
| Oracle | fail, 0 stored vs 3 expected; live judged `no`: equal | fail, 14 stored vs 3 expected, 0 matched; live `no`: equal |
| Trial | `not_judged` (`candidate.trial_not_judged`), judge asked once, 0 model calls, runner 17.3 s | same, 12.4 s |

- E1 meets every expected value: 19/19 operations with one reevaluated read, stored rows equal revision 16's live 0,
  oracle verdict equal to the live judged "no".
- Reverse control: 14 stored where live revision 10 stored 15. Cause: different pages. Trace 3e353455's read snapshot
  holds 30 items (`639e1b0f9e2d`); live revision 10 read 32 (`a89251e6c353`; the survey's not-same-snapshot finding).
  All 14 offline rows equal live rows position by position; the 15th live row comes from the items this page lacks.
- Without `--session-view declared` the reverse control is refused (trace 3e353455 recorded no `session.claimed`), as
  P4d found for f53b350b.

## What changed and why

- `executeActionMessage` now lives in `domain/src/client/` beside the gateway result builder, so the Node snapshot
  page and the background build the tab message with the same code (unit 1).
- `loadExtensionContentCode` gives the snapshot page the extension's production bundles, refusing a missing or stale
  build (unit 2).
- `trial --tier2` hands Core's runner the domain's reevaluator over a headed snapshot page and reports what was
  reevaluated and every ask (unit 3).
- `reads` asks changed-read pairs exactly as Core's matcher would, through Core's exported request builder, and
  compares each answer with the live result; it also checks every read over its own snapshot (unit 4).

## Outcome

Done. All four items landed; the gate ran on job, photo and social; both trials ran. No gap was reported as a match,
no answer differed from live on the same page, and every difference is traced: D37's conservative rules (job 8,
photo 6 gaps), different pages (social 4 pairs, the reverse control), and content-code drift since round 4 (social
12 fidelity reads, caught by the control).

## Commands run and observed results

Each is in the progress log; the final state:

| Command (directory) | Observed |
| --- | --- |
| `DOMAIN_TEST_BUILD_LABEL=t749-w8 node scripts/test-domain.mjs client/tests/execute-action-message client/tests/browser-result-mapping` (domain) | `# tests 14`, `# pass 14`, `# fail 0`; final rerun of the first: `# tests 3`, `# pass 3`, `# fail 0` |
| `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.test.json` (domain) | exit 0, exit 0 |
| `npx tsc --noEmit -p tsconfig.json` and `-p tsconfig.test.json` (apps/extension, includes e2e) | exit 0, exit 0 |
| `EXTENSION_TEST_BUILD_LABEL=t749-w8 node scripts/test-extension.mjs runtime/tests/action-runner` (apps/extension) | `# tests 39`, `# pass 39`, `# fail 0` |
| `pnpm --filter @fluxiq-web-extension/extension build` (root) | chrome, firefox, e2e-chromium `verified 22 files` |
| test-runner build, then `node --test` over the `offline-snapshot-page` and `offline-trial-experiment` dist tests | `# tests 98`, `# pass 98`, `# fail 0` |
| `node scripts/structure-audit.mjs` (root) | `structure-audit: passed (218 warning(s), 651 baselined).` |
| the five runs | summary lines in unit 5 |

## Not verified

- The headed e2e spec `apps/extension/e2e/content/tests/offline-reads` was typechecked (extension
  `tsconfig.test.json`, exit 0) but not rerun after its one-line import switch.
- Edge (`--channel msedge`) was not run; every run used Chrome.
- `run-reads-gate.ts` and `trace-reads.ts` have no unit test of their own (they need a complete Core trace store); the
  three real runs exercise them. Every other new module is unit-tested.
- No full suites, per the narrow-check rule. Core untouched.
- `test-runs/p5w8/` (ignored) holds seven store copies, about 2.5 GB; left in place.

## Open questions or contradictions found

1. Root barrel line: the test-runner reads the domain through `@fluxiq-web-extension/domain/node`
   (`domain/src/index.ts`), so `executeActionMessage` needed one export line there besides the client barrel; I read
   "barrel line" as covering it. It re-exports from `./client`, since the audit refuses the deep path.
2. D37 on a page that grows by itself: in social 136 -> 189 and the like, A failed (`incomplete_text`), its control
   failed the same way, and the changed read asked no more (`scrollsPastEnd` 1 and 1), so the rule answered from A's
   page (10 records) although the next read on the same address, with nothing acting between, saw a grown page (34).
   The answer is right for "B run at A's point", but nothing in the rule notices a feed still loading. Lead's call
   whether a failed control should also block answering a changed read that reveals its list's end.
3. Content-code drift: tier 2 runs today's content code over round-4 traces, so a read whose rule changed since then
   (t743's disclosure after `where`) differs from live. The control turns that into a gap, the safe side, but any
   comparison of tier-2 answers with older live reads measures drift as well as fidelity.
4. Photo gaps are by rule only: no photo pair can pass, since every changed read's list never appeared. A photo trace
   with a read that found rows under a changed condition needs a later round.
5. The reverse control as written (no `--session-view`) is refused; the declared-view rerun is the result above.
