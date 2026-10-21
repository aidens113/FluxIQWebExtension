# Report: lane-t-p4d-run (run the social gate experiment offline)

Brief: lane-t-p4d-run-experiments. Trees `fxwork/t746/{!FluxIQWebExtension,!FluxIQ}`, branch
`task/t746-offline-trials-tier1`. Nothing committed. No model call, no Lab run, no live browser.

## Outcome

**Partial.** The CLI is wired to Core's exported runner and tested, and all three experiments ran on fresh copies. But
**Core as it stands cannot run any round-4 trace.** Every command is refused before it reaches the trace matcher, and
the result is a definite `fail` with no evidence gap (finding 1).

Finding 1 has a cause on each side of the boundary:
- **Core:** the matcher attaches a `custom` session with no capabilities when a trace records no session view.
- **Domain:** the web domain drives only an `extension` session that serves `web.actions`.

I did not edit Core. Instead I added an explicit, labelled experiment option, `--session-view declared`. It gives the
matcher the browser extension's declared session view only where the trace recorded none. With that option, every
expectation held:

- **E1 (parity), revisions 10 and 16 against their own traces.** All 19 recorded operations were matched, with no
  gap. The stored rows equal the live ones record by record (15 = 15, and 0 = 0). The reads' counts, the executed
  steps, where the trial stopped and the words digests all equal the live trial's. The oracle verdict is a fail,
  which matches the live "no".
- **E2, revision 16 against revision 10's trace.** There is an explicit gap at `web.dom.extract_list#17`
  (`argument_mismatch`, cause `mismatch`, field `parameters.extractList.where`, recorded sequence 78). Every later
  command is answered `missing_transition` / `after_gap`. Nothing is stored, so revision 10's rows are never passed
  off as revision 16's. The evidence is `inconclusive` with scope `segment`.
- **E3, the `minRows: 3` correction of revision 10 against f53b350b.** There is no gap and all 19 operations were
  matched. Core recomputed the processing over the replayed read and stored 15 rows, which equal the live rows. Only
  the reads' words differ. The oracle verdict is a fail.

Each offline trial captured its own trace. Every one is `derived`, with derivation `replay`, and names its source
trace (T24).

## What changed and why

Every change is under `packages/test-runner/src/offline-trial-experiment/`. Core source was not touched.

**CLI (`cli.ts`, `cli-arguments.ts`)**
- The placeholder `--runner` argument is removed.
- `trial ... --work <new dir under test-runs/>` runs the trial through `runAutomationStudioOfflineCandidateTrial`.
  `--store` is the source, and it is never opened: it is copied to `<work>/fluxiq-root/.fluxiq`, and the session,
  the host and the trial all use the copy.
- `--session-view trace|declared` chooses the session view. `trace` is the default.
- Without `--work`, the trial is prepared only (exit 3), as before.
- `--work` outside `test-runs` is refused at parse time. `--work` and `--session-view` are refused for `survey`.

**New `run/`** (one export per file, with barrels)
- `core-trial-seams.ts` loads five unexported Core helpers from the Core build beside its public entry, as
  `rebuild/core-authoring.ts` already does: `automationStudioRunGraphOptions`, `automationStudioProjectBuildTrialReads`,
  `runtimeSessionToFlowRunDetail`, and the trace service pools and project trace store. It also loads the domain's
  `registerFluxIQHost` (`domain/dist/web-panel-host.js`).
- `offline-trial/host.ts` builds the host the way the web process builds one (`!FluxIQ/apps/web/src/lib/fluxiq.ts`
  `createFluxIQWebInstance`): `FluxIQ.create` on the copy's root with `domainId: web-automation`, then
  `registerFluxIQHost`.
  - `FLUXIQ_CLIENT_GATEWAY_TRACE=1`, so the trial's own episode is captured.
  - Model providers are off, no env file is loaded, and no start hook is set.
  - Path and start-hook variables are withheld while it is built.
- `offline-trial/ports.ts` builds the ports a live build's whole-candidate trial gets. It mirrors
  `runtime/service.ts:1583-1585` member by member, over the same service objects, plus the build's trial reads
  (`project-build/trial-reads.ts`). Two members differ:
  - `judge` is replaced, so that no model is called;
  - `prepareStart` is omitted, because the runner runs no start hook offline.
- `not-judged-judge.ts` answers `not_judged` at zero spend and counts how often it was asked.
- `declared-session-view.ts` holds the extension's hello as `extensionHello` declares it
  (`apps/extension/src/background/connection/gateway-session.ts:157-175`): `clientType: "extension"`,
  `webAutomationClientCapabilities` and `metadata.domainId`. The browser descriptor and capture settings are left out
  because nothing recorded them. A gateway wrapper substitutes this view only for the matcher's default (`custom`,
  with no capabilities) and counts the substitutions.
- `fresh-store-copy.ts` copies `.fluxiq` minus `security/` (sign-in counters) into a work directory under
  `test-runs/`, which must not exist yet. Identity, sessions and the browser profile live outside `.fluxiq` and are
  never copied.
- `run-offline-experiment-trial.ts` runs the trial in phase `test`, using the host's own trace store and gateway. It
  records wall time, how often the judge was asked, the session view and every trace the run captured.
- `experiment-trial.ts` adds three things to the run:
  - the judge's view of the source trial and of the live twin, compared field by field;
  - the stored rows, compared record by record;
  - the oracle verdict, with the read count taken from the script.
- `trial-observation.ts`, `stored-rows-comparison.ts`, `offline-trial/report.ts` and `live-trial-feedback.ts` reduce
  results to counts, codes, ids, definition ids, statuses and field names. Words are compared only, through SHA-256
  digests: one for the reads, one for the steps.

**Experiment-side fix.** The rebuilt candidate carries its fresh controller's revision, 1. It is now run under the
recorded whole revision, as the live trial was. Without this, the first run was refused with
`candidate.execution_identity_mismatch` (`flow-bootstrap/verification/detached-execution.ts:51` requires
`candidate.revision === identity.revision`). Core's digest does not cover the revision: the rebuilt digest equals the
recorded one.

**Tests (new):**
- `run/tests/`: `trial-observation`, `stored-rows-comparison`, `declared-session-view`, `not-judged-judge`,
  `fresh-store-copy` and `run-offline-experiment-trial`.
- The last one is the wiring test. It sets up a fresh workspace and builds the real host, ports and seams. It then
  calls Core's exported runner in both session-view modes, and asserts the runner's own `incomplete_capture` refusal
  for an absent trace, with no judge asked and no episode captured.
- `tests/cli-arguments.test.ts` gains a case for `--work`, `--session-view` and the removed `--runner`.

## Commands run and observed results

All run from the downstream worktree root unless noted.

**Builds, tests and checks**
- `node scripts/check/core-build.mjs` reported `not current` (exit 1). I rebuilt Core with
  `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` (in `!FluxIQ`),
  which printed `fluxiq:build ... "build-cache":"build" ... Done`. The check then printed `core-build: ... is current
  with its source.` (exit 0).
- `pnpm exec tsc -p tsconfig.json` (in `packages/test-runner`) printed no output; `tsc exit=0`. This was the final
  run, after removing the stale `dist/offline-trial-experiment/run`.
- `node --test "dist/offline-trial-experiment/**/*.test.js"` (in `packages/test-runner`) printed `# tests 48`,
  `# pass 48` and `# fail 0`. That is the prep's 33 tests plus 15 new ones. The wiring test alone took about 7 s.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (218 warning(s), 618 baselined).`, and no line
  names `offline-trial-experiment`.
  - An earlier run failed 5 times on my files, under three rules:
    - an import reached into `./run/fresh-store-copy.js` instead of the barrel;
    - three `offline-trial-*` files shared a prefix;
    - fixed `os.tmpdir()` paths in a test.
  - I fixed all of them.

**Experiment runs.** Each ran on its own fresh copy under `test-runs/p4d-run/final/<name>/` with
`cli.js trial --store test-runs/round4/run-mvgw3ve5-294881b5/fluxiq-root/.fluxiq --project a846814f-... --steps
C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgw3ve5-294881b5/steps ...`. Every run exited 0. The JSON is at
`final/<name>.json`.

| Run | Exit / seconds |
| --- | --- |
| `e1-rev10-trace` | 0 / 62 |
| `e2-rev16-on-f53b-trace` | 0 / 64 |
| `e1-rev10-declared` | 0 / 72 |
| `e1-rev16-declared` | 0 / 74 |
| `e2-rev16-on-f53b-declared` | 0 / 59 |
| `e3-minrows3-declared` | 0 / 48 |

The seconds include copying about 700 MB.

**Trial durations** from the runtime sessions:

| Trial | Duration |
| --- | --- |
| Live 9ddb30fe (rev 10) | 55,123 ms |
| Live f0b2dfbd (rev 16) | 44,581 ms |
| Offline e067e41d (rev 10), on the virtual clock | 53,012 ms |

The offline trial's wall time was 12,906 ms.

### E1-E3 (all with `--session-view declared`, except the two `trace` baseline rows)

| | E1 rev 10 / f53b350b | E1 rev 16 / 3e353455 | E2 rev 16 / f53b350b | E3 minRows 3 of rev 10 / f53b350b | Baseline rev 10 / f53b350b, `trace` view (E2 the same) |
| --- | --- | --- | --- | --- | --- |
| Request (whole rev / digest) | 5 / 86d511cb0b83 | 8 / cfa2549ce1e8 | 8 / cfa2549ce1e8 | 5 / 751bed0edfaa (correction) | 5 / 86d511cb0b83 |
| U5 verdict | inconclusive | inconclusive | inconclusive | inconclusive | **fail** |
| U5 origins | recorded, pure_computation | same | same | same | same |
| U5 scope | full_recorded_path | full_recorded_path | segment | full_recorded_path | segment |
| U5 source episode (`liveEpisodeId` null in every run) | trial.9ddb30fe | trial.f0b2dfbd | trial.9ddb30fe | trial.9ddb30fe | trial.9ddb30fe |
| U5 reasons / missing evidence | judgement_unavailable (operation null, `not_judged`) | same | argument_mismatch at `web.dom.extract_list#17` ("differs at parameters.extractList.where; compared with recorded sequence 78"); missing_transition at `web.dom.capture_snapshot#18` (after_gap) | judgement_unavailable | assertion_failure, **no missing evidence** |
| U5 assertion | unverified | unverified | violated (see finding 2) | unverified | violated |
| Candidate outcome | not_judged; execution succeeded; 10/10 steps | not_judged; succeeded; 10/10 | execution_failed `candidate.execution_incomplete`; step 10 extract_list failed `web.action.unknown`, 1 attempt | not_judged; succeeded; 10/10 | execution_failed; step 1 navigate failed `web.action.failed` after 4 attempts |
| Matcher: matched / recorded | 19/19, last capture_snapshot@85 | 19/19 | 16/19, last capture_snapshot@73 | 19/19 | **0/19** |
| Matcher gaps | none | none | #17 extract_list argument_mismatch / mismatch / fields `[parameters.extractList.where]` / seq 78; #18 missing_transition / after_gap | none | **none** |
| Sequences delivered | 37 | 37 | 32 | 37 | 0 |
| Refused deliveries / unanswered types | 0 / none | 0 / none | 0 / none | 0 / none | 0 / none |
| Reads (seen, kept, rejected / by itself per condition) | 32, 17, 9/1, 0/0, 14/6 | 30, 0, 30/17, 13/0 | none | 32, 17, 9/1, 0/0, 14/6 | none |
| Stored rows offline / live (record by record) | 15 / 15, 15 equal | 0 / 0, equal | 0 / 15 (source), 0 / 0 (twin, which stored a dataset; offline stored none) | 15 / 15, 15 equal | 0 / 15 |
| Judge view vs source trial | stored, reads, steps, stoppedAt, words all equal | all equal | all differ | all equal except the reads' words | all differ |
| Oracle | fail: 15 vs 3 expected, 0 matched, fields 12/15 | fail: 0 vs 3 | fail: no extraction records | fail: 15 vs 3, fields 12/15 | fail: no extraction records |
| Live judged result | no (0114, 0115) | no (0150, 0151) | live twin 3e353455: no | none (a new candidate) | no |
| Oracle = live | yes | yes | (inconclusive run; not comparable) | (not applicable) | (not comparable) |
| Wall time (runner only) | 12,906 ms | 12,326 ms | 5,830 ms | 11,143 ms | 2,050 ms |
| Judge asked | 1 (not_judged) | 1 | 0 | 1 | 0 |
| Own trace | trace.68ef2215, derived/replay from f53b350b, 89 events, episode = the offline run | trace.cb6ac013, derived/replay from 3e353455, 89 events | trace.fe71f699, derived/replay from f53b350b, 84 events | trace.8f084419, derived/replay from f53b350b, 89 events | trace.fece5bc4, derived/replay from f53b350b, **0 events** |

The source traces each have 89 events. The `trace`-view run of E2 (`e2-rev16-on-f53b-trace`) is identical to the
baseline column: 0/19 matched, no gap, fail with `assertion_failure`, navigate failed after 4 attempts.

### Finding 1: Core cannot run any round-4 trace (the difference from expectation)

**Evidence**
- A probe wrapped `ClientGatewayService.prototype.snapshot` and `attachScopedSession`, logging only ids, status,
  type and capability ids. Inside the trial's scope it showed one session,
  `{"status":"ready","type":"custom","caps":[]}`, on every call.
- A second probe counted the source traces' events by kind and message type. f53b350b and 3e353455 each have 19
  outbound `server.execute_action`, 19 `client.action_result`, 11 `client.state_update`, 3 `client.recording_event`
  and 4 artifacts. They have **no `session` reference on any event**, **no `session.claimed` lifecycle event** and no
  manifest capability snapshot. The exploration trace 5c07f127 has none either.

**Cause, source by source**
- `client-gateway/trace-matcher/trace-admission.ts:47`: `claimedView` comes only from a recorded `session.claimed`,
  so here it is `null`.
- `client-gateway/trace-matcher/matcher.ts:64` and `:102`: with no view, `attach` uses `DEFAULT_HELLO = { clientType:
  "custom" }`.
- `runtime/service/offline-trial/run.ts:69`: `matcher.attach(environment.scopeId)` passes no hello, and the runner's
  input has no field for one.
- `domain/src/runtime/web-sessions/criteria.ts:10` (with `pick-web-session.ts`): the web domain drives only an
  `extension` session that serves `web.actions`.
- `domain/src/io/gateway-output-dispatcher.ts:21-22`: with no eligible session it answers "A single paired
  web-automation client must be selected" and **sends nothing**.

**Effect**
- The executor retried the first navigate 4 times and failed the trial (`web.action.failed`).
- The matcher saw 0 commands and recorded 0 gaps.
- `evidence-result.ts:55` and `:81` then report verdict **`fail` / `assertion_failure` / assertion `violated` with no
  missing evidence**, for a trial that never consulted its trace.

That is not an honest outcome. With no gap it reads as a real failure of the candidate. It holds for every trace
captured before the session-claim record existed, all round-4 traces among them.

**Possible Core fixes (not made)**
- Let the runner accept a session view for a trace that recorded none.
- Make "no command reached the matcher" (0 matched with recorded operations pending) an evidence gap
  (`incomplete_capture`).

### Finding 2: E2's U5 result says inconclusive but marks the assertion `violated`

`evidence-result.ts:81` marks the assertion `violated` for any `execution_failed`. In E2 the trial failed only
because the matcher answered the changed read with a gap: step 10 failed `web.action.unknown`, with 1 attempt. The
verdict is correctly `inconclusive` (`:55`), but the assertion list claims the candidate violated the task goal, which
nothing showed. `unverified` would agree with the verdict.

### E3's word difference

The judge's view equals live on stored rows, read counts, steps and stopping point, and on the steps' words. Only the
reads' words digest differs. The read's account in words most likely mentions the processing that changed (`minRows`).
I did not look at the words, so this is not verified.

### Disclosure

While diagnosing finding 1, I printed one copied **live** runtime command attempt to this session's output. I had
taken it for the offline run's. It held a CSS selector path, a control's two-word visible label, and failure text
naming counts. None of it is in this report or in any tracked file. Every other inspection printed only ids, codes,
counts, statuses and definition ids.

## Not verified

- **Not run with Core as it stands.** Every E1-E3 result above that matches its expectation depends on the declared
  session view, which is an experiment-side substitution and not the recorded view. The as-is runner fails at step 1
  (finding 1).
- **No LLM judge.** The live "no" is compared through the judge's input (what it was shown) and the task's oracle, not
  through a verdict.
- **E3 shows the tier-1 path reproduces the stored answer, not a changed one.** `minRows` only reports, so the
  recomputed rows equal revision 10's. A processing change that alters the rows (such as `where` or `limit`) was not
  run.
- **The extension view leaves out the browser descriptor and capture settings** (`metadata.settings`). Nothing in
  these runs depended on them, judging by 19/19 matches, but I did not check that they cannot matter.
- **`observedStateKeys`** in the ports comes from the bound domain's evidence-runtime binding. A live build takes it
  from its harness-option registry (`llm/harness-options/registry.ts:235`). It only shapes what the judge is shown,
  and no judge was called.
- **The domain's host entry** is loaded from `domain/dist/web-panel-host.js`. The Lab's Core loads the bundled
  `dist/host/web-panel-host.mjs`, which is not built in this tree. Both come from the same source.
- **Run output occupies about 9.4 GB** under `test-runs/p4d-run/`. The safety check refused my `rm -rf` of the stale
  directories, so I left them. They are safe to delete: `e1-rev10-on-f53b`, `e1-rev10-on-f53b-declared`,
  `e1-rev16-on-3e35-declared`, `e2-rev16-on-f53b-declared`, `e3-minrows3-on-f53b-declared`, `probe-1` and `out/`.
  The results of record are in `final/`, which also holds six copies of about 700 MB each.
- Probe scripts are in this session's scratchpad (`p4d-probe-*.mjs`, `p4d-summarize.cjs`). They are not in the
  repository.

## Open questions or contradictions found

1. **Finding 1 needs a Core decision.** The round-4 traces cannot run offline unless one of these happens:
   - the runner accepts a session view, from the caller or from the domain's declaration;
   - traces are re-captured with `session.claimed`.

   Separately, a trial where no command reached the matcher should be inconclusive, not `fail`. Lead to decide; I did
   not edit Core.
2. **Finding 2.** `evidence-result.ts:81` should say `unverified` when a gap exists.
3. **The gate claim, stated plainly.** On parity, the offline trial reproduced exactly the outcome data the live judge
   saw, and the oracle equals the live "no" for both revisions. On the corrected candidate (E2), strict matching
   correctly refuses to answer the changed read. So "an offline trial of a corrected candidate reproducing the judged
   result" is **not** achievable from round 4 under tier 1.

   That fits P4s and prep. The build's correction changes `extractList.where`, which the extension applies inside the
   read. Answering it needs snapshot re-execution (tier 2), or a traced run whose correction is Core-side (like run
   1's revision 9 to revision 10).
