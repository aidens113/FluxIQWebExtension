# Lane T P4 FB: session view and reruns (worker report)

Brief: lane-t-p4-fb-session-view-and-reruns. Trees `fxwork/t746/{!FluxIQ,!FluxIQWebExtension}`, branch
`task/t746-offline-trials-tier1`. Nothing committed. No model call, no Lab or live run, no browser.

## Outcome

**Done.** All three lead decisions are in Core, and the tests were written first. All 8 new tests failed on the old code
and pass now. Core is rebuilt and the downstream workaround is deleted. The reruns reproduce the lane-t-p4d-run table,
with the intended changes and nothing else:
- the session view is now reported as `supplied`;
- E2's assertion is now `unverified` (finding 2 fixed);
- the as-is baseline is now **refused** with `incomplete_capture` (finding 1 fixed), where before it was a `fail`.

## What changed and why

### Core (`packages/fluxiq/src/`)

**`client-gateway/trace-matcher/`**
- `types.ts`: new `ClientGatewayTraceMatcherSessionView = { source: "recorded" | "supplied"; view }`.
- `matcher.ts`:
  - `DEFAULT_HELLO` is removed.
  - New `sessionView(supplied?)` returns the recorded `session.claimed` view when there is one, otherwise the supplied
    view, otherwise `null`.
  - `attach(scopeId, supplied?)` attaches with that view. With no view it throws `trace_matcher.no_session_view` and
    attaches nothing. A supplied view never replaces a recorded one.
  - The header now explains why a made-up default is never used.
- `tests/trial-gateway.ts` (test support): `openTrial` takes an optional `sessionView` and passes it to `attach`.
- New `tests/matcher-session-view.test.ts`, three cases:
  - the recorded view is used even when another is supplied;
  - the supplied view is used when the trace recorded none, and the trace is still matched through it (1/1, no gap);
  - with neither, `sessionView()` is `null`, `attach` throws, and the gateway was never asked to attach.

  The trace without a claim is a copy of a real recording with its `session.claimed` events removed. The copy is
  renumbered and its manifest's `completeness.lastSequence` lowered; without that it is refused as truncated.
- **Existing test edited: `tests/matcher-gaps.test.ts`, the two T14 cases** ("refuses a trace with a missing sequence…"
  and "refuses a trace recorded under a contract version…"). They relied on the old default session: a refused trace
  has no claimed view, and they attached without one. They now supply
  `{ clientType: "extension", capabilities: [ACTIONS] }`. Their assertions are unchanged.

**`programs/automation-studio/runtime/service/offline-trial/`**
- `contracts.ts`:
  - The input gains `sessionView?: ClientGatewayClientHello`. It is used only when the trace recorded none; in a
    build, it is the live session's public view for the same client.
  - New `AutomationStudioOfflineTrialNormalization { field, reason }`.
  - The `ran` outcome gains three fields:
    - `sessionView: "recorded" | "supplied"`;
    - `normalizations` (a supplied view adds `{ field: "session view", reason }`);
    - `supported: { matchedOperations, recordedOperations }`.
- `run.ts`: after the matcher's admission and before anything runs, it calls `matcher.sessionView(input.sessionView)`.
  With no view it refuses with `incomplete_capture`, detail `the source trace recorded no session view (no
  session.claimed event) and the caller supplied none: there is no client for the trial's commands to reach`. It then
  attaches with the chosen view and reports it.
- `evidence-result.ts`:
  - **Unreached client.** This applies when the matcher matched 0 operations, the trace recorded at least 1, and no
    command was answered with a gap (`ordinal > 0`). The result then gains a `missing_transition` gap at operation
    `null`, with detail `no operation reached the recorded client: 0 of N recorded operations matched`. That makes the
    verdict `inconclusive`. A first command that mismatched is unchanged: it still yields its `argument_mismatch` gap
    alone.
  - **Assertion.** The assertion is now read from the U5 verdict: `pass` gives satisfied, `fail` gives violated, and
    `inconclusive` gives unverified. Before, it was read from the judge's verdict, which marked an inconclusive
    `execution_failed` run as violated.
- `tests/offline-harness.ts` (test support): `runOffline` takes an optional `{ store, sessionView }`.
- New `tests/session-view.test.ts`, five cases:
  - the recorded view is used, and a supplied view that serves nothing does not override it (the trial passes 1/1);
  - the supplied view is used when the trace recorded none, and declared as a normalization;
  - with neither, the trial is refused before anything runs: no judge call, no episode, no command to the live client,
    no local dispatch;
  - with a capability-less supplied view (the old default) the trial matches 0 of 1 with no gap. The result is
    inconclusive `missing_transition` with the assertion unverified, never a fail;
  - a changed argument gives inconclusive `argument_mismatch` with the assertion unverified.

  In all five, `supported` reports the matched / recorded counts.
- No other existing offline-trial, model or gateway-trace test was edited.

### Downstream (`packages/test-runner/src/offline-trial-experiment/`)

- `run/declared-session-view.ts`:
  - The gateway wrapper `declaredSessionViewGateway`, which substituted the view and counted substitutions, is deleted.
  - Only `DECLARED_EXTENSION_SESSION_VIEW` remains: the extension's declared hello, as before.
  - The header now describes it as the view supplied to Core's `sessionView`.
- `run/run-offline-experiment-trial.ts`:
  - It passes `sessionView: DECLARED_EXTENSION_SESSION_VIEW` to `runAutomationStudioOfflineCandidateTrial` when asked
    (`declared`), and nothing for `none`. The real host gateway is passed through unwrapped.
  - The run's `sessionView` is now `{ supplied: "declared" | "none", used: "recorded" | "supplied" | null }`, where
    `used` comes from Core's outcome.
- `run/experiment-trial.ts`: types follow.
- `run/offline-trial/report.ts`: the report also carries Core's `sessionView`, the `normalizations` (field and reason)
  and `supported`.
- `cli-arguments.ts` and `cli.ts`: the option is now `--session-view declared|none`. The default is `none`, which is
  Core as is. `trace` is refused, and the header is updated.
- Tests:
  - `run/tests/declared-session-view.test.ts` keeps only the view test; the two wrapper tests are gone with the
    wrapper.
  - `run/tests/run-offline-experiment-trial.test.ts` loops `none` and `declared` and asserts
    `{ supplied, used: null }` on the absent-trace refusal.
  - `tests/cli-arguments.test.ts` covers `none`, the default and `trace` being refused.

## Commands run and observed results

Core commands ran from `!FluxIQ/packages/fluxiq` unless noted.

**Before the change**
- Baseline: `pnpm exec vitest run src/client-gateway/trace-matcher src/programs/automation-studio/runtime/service/offline-trial src/programs/automation-studio/model/offline-trial src/programs/automation-studio/runtime/gateway-trace`
  -> `Test Files 25 passed (25)`, `Tests 161 passed (161)`.
- The new tests on the old code -> `Tests 8 failed (8)`:
  - `trial.matcher.sessionView is not a function`;
  - `expected undefined to be 'recorded'`;
  - the neither case *ran* instead of being refused;
  - `expected undefined to deeply equal { matchedOperations: +0, …}`.
- One earlier attempt failed for a fault in my test helper: the copy was refused as `truncated: sequences 4-4 …`. I
  fixed the helper's manifest before writing the implementation.

**After the change**
- The new tests -> `Tests 8 passed (8)`.
- The brief's suite, first run -> `Tests 3 failed | 166 passed (169)`:
  - the two T14 cases threw `trace_matcher.no_session_view` (the old-default dependency, edited as described above);
  - `provenance.test.ts` T24 once got `verdict: 'inconclusive'` instead of `pass` (see Not verified).
- After the T14 edit, the trace-matcher directory -> `Tests 24 passed (24)`.
- The brief's suite, run again -> `Tests 2 failed | 167 passed (169)`. That was before the T14 edit, and it had the T14
  cases only; provenance passed.
- The brief's suite, three consecutive runs after all edits -> `Tests 169 passed (169)` each time.
- `provenance.test.ts` alone, three times -> `Tests 4 passed (4)` each time.
- `pnpm exec tsc --noEmit` -> no output; `tsc exit=0`.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (430 warning(s), 1152 baselined).`, exit
  0. No line names `offline-trial` or `trace-matcher`. It also printed "1 baseline entries can be lowered", as before
  this lane; I did not run `structure:baseline`.
- Core rebuild, `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`
  (in `!FluxIQ`):
  - `fluxiq:build` printed `"build-cache":"build","reason":"inputs changed: packages/fluxiq"` … `Done`;
  - contracts and the websocket package were reused from the stamp.
- Downstream `node scripts/check/core-build.mjs` -> `core-build: FluxIQ Core's build at …\!FluxIQ is current with its
  source.`, exit 0.

**Downstream** (in `packages/test-runner` unless noted)
- `pnpm exec tsc -p tsconfig.json`, after removing the stale `dist/offline-trial-experiment` -> no output; `tsc exit=0`.
- `node --test "dist/offline-trial-experiment/**/*.test.js"` -> `# tests 46`, `# pass 46`, `# fail 0`. That is 48
  before, minus the two deleted wrapper tests.
- `node scripts/structure-audit.mjs` (downstream root) -> `structure-audit: passed (218 warning(s), 618 baselined).`,
  exit 0. No line names `offline-trial-experiment`.

## Reruns

**How they ran**
- Each run had its own fresh copy, made by the CLI's `--work test-runs/p4-fb/<name>` from
  `test-runs/round4/run-mvgw3ve5-294881b5/fluxiq-root/.fluxiq`.
- Arguments: project `a846814f-becd-4569-934f-f3a10df1ce79`, steps
  `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgw3ve5-294881b5/steps`, the non-model judge, and phase `test`.
- Each work copy was deleted after its run with `fs.rmSync`. `test-runs/p4-fb/` now holds only the six JSON results,
  six logs and `summary.txt` (87K in all).
- Each log holds only Node's SQLite experimental warning.
- Script: scratchpad `fb-reruns.sh`. Summarizer: `fb-summarize.cjs`, which prints ids, codes, counts and statuses only.

`summary.txt`:
```
e1-rev10-declared exit=0 seconds=50
e1-rev16-declared exit=0 seconds=38
e2-rev16-on-f53b-declared exit=0 seconds=31
e3-minrows3-declared exit=0 seconds=33
baseline-rev10-none exit=0 seconds=27
baseline-e2-rev16-on-f53b-none exit=0 seconds=28
all done
```

| | E1 rev 10 / f53b350b | E1 rev 16 / 3e353455 | E2 rev 16 / f53b350b | E3 minRows 3 of rev 10 / f53b350b | Baseline rev 10 / f53b350b, no view (E2 the same) |
| --- | --- | --- | --- | --- | --- |
| Request (whole rev / digest) | 5 / 86d511cb0b83 | 8 / cfa2549ce1e8 | 8 / cfa2549ce1e8 | 5 / 751bed0edfaa | 5 / 86d511cb0b83 |
| Runner outcome | ran | ran | ran | ran | **refused `incomplete_capture`**: "the source trace recorded no session view (no session.claimed event) and the caller supplied none: …" |
| Session view (Core) / normalizations | supplied / `session view` | same | same | same | none supplied; used null |
| U5 verdict | inconclusive | inconclusive | inconclusive | inconclusive | (no result: refused) |
| U5 origins | recorded, pure_computation | same | same | same | — |
| U5 scope | full_recorded_path | full_recorded_path | segment | full_recorded_path | — |
| U5 source episode (`liveEpisodeId` null) | trial.9ddb30fe | trial.f0b2dfbd | trial.9ddb30fe | trial.9ddb30fe | — |
| U5 reasons / missing evidence | judgement_unavailable (operation null, `not_judged`) | same | argument_mismatch at `web.dom.extract_list#17` ("mismatch; differs at parameters.extractList.where; compared with recorded sequence 78"); missing_transition at `web.dom.capture_snapshot#18` (after_gap) | judgement_unavailable | — |
| U5 assertion | unverified | unverified | **unverified** (was violated) | unverified | — |
| `supported` matched / recorded | 19 / 19 | 19 / 19 | 16 / 19 | 19 / 19 | — |
| Candidate outcome | not_judged; succeeded; 10/10 steps | not_judged; succeeded; 10/10 | execution_failed `candidate.execution_incomplete`; step 10 failed `web.action.unknown` | not_judged; succeeded; 10/10 | not run |
| Matcher: matched / recorded, last | 19/19, capture_snapshot@85 | 19/19, @85 | 16/19, capture_snapshot@73 | 19/19, @85 | — |
| Matcher gaps | none | none | #17 extract_list argument_mismatch / mismatch / `[parameters.extractList.where]` / seq 78; #18 missing_transition / after_gap | none | — |
| Sequences delivered / refused / unanswered | 37 / 0 / none | 37 / 0 / none | 32 / 0 / none | 37 / 0 / none | — |
| Reads (seen, kept, rejected / by itself per condition) | 32, 17, 9/1, 0/0, 14/6 | 30, 0, 30/17, 13/0 | none | 32, 17, 9/1, 0/0, 14/6 | — |
| Stored rows offline / live (record by record) | 15 / 15, 15 equal | 0 / 0, equal | 0 / 15 (source), 0 / 0 (twin) | 15 / 15, 15 equal | — |
| Judge view vs source trial | all equal | all equal | all differ | all equal except the reads' words | — |
| Oracle | fail: 15 vs 3, 0 matched, fields 12/15 | fail: 0 vs 3 | fail: 0 stored | fail: 15 vs 3, fields 12/15 | none (nothing ran) |
| Judge asked | 1 (not_judged) | 1 | 0 | 1 | 0 |
| Wall time (runner only) | 7,636 ms | 6,759 ms | 4,877 ms | 6,786 ms | 401 ms (E2 none: 394 ms) |
| Own trace | trace.ebd80959, derived/replay from f53b350b, 89 events | trace.94f3b873, derived/replay from 3e353455, 89 | trace.8b9363f5, derived/replay from f53b350b, 84 | trace.3b55bcdc, derived/replay from f53b350b, 89 | none captured |

**The results match lane-t-p4d-run.md.** A script compared the old and new summaries field by field. It left out wall
time, the captured trace ids and the new session-view, normalization and `supported` fields:
- E1 rev 10: identical.
- E1 rev 16: identical.
- E3: identical.
- E2: one difference, `u5.assertion: ["violated"] -> ["unverified"]` (decision 3).
- The earlier `trace`-view baseline was `ran / fail / violated`. The `none` baseline is now refused with no judge
  asked and no episode captured, for both rev 10 and E2's rev 16 on f53b350b.

## Not verified

- **One provenance failure that did not come back.** On the first full run after the change, `provenance.test.ts` T24
  ("records its own capture as a derived trace…") once returned `inconclusive` where it expects `pass`. The failure
  output did not keep the reason codes, so the cause is unknown. It did not recur in four later full runs or in three
  runs of that file alone.
  - My new gap fires only when 0 operations matched. A pass needs 1/1 matched, so if this is load-related flakiness it
    may predate the lane. That is not shown: I did not stress-test the old code.
- The unreached-client gap is tested end to end only through a capability-less supplied view. I did not run a
  candidate that simply sends no command while the trace recorded some; the same code path covers it.
- The production build does not yet pass the live session's view. The brief says the build will; I added only the
  argument.
- The earlier notes still hold:
  - the declared view leaves out the browser descriptor and capture settings;
  - no LLM judge was used;
  - E3 reproduces revision 10's rows, not changed ones.
- No full suites, by the narrow-checks rule.

## Open questions or contradictions found

1. **"Report matched / recorded counts in `supported`."** U5's `supported` holds string lists (observations,
   operations), and the U5 model is outside my ownership. So the counts are a new `supported` field on the runner's
   `ran` outcome. U5's `supported.operations` already lists the matched operations. Putting a recorded count into U5
   itself would be a model vocabulary edit.
2. **"Declared normalization"** has no U5 field either. It is the runner outcome's `normalizations` list, shaped
   `{ field, reason }` like the replay parity report's, and the experiment's report carries it.
3. **Disk.** p4d's leftover run copies (about 9.4 GB under `test-runs/p4d-run/final/`) were not mine to delete and are
   untouched.
