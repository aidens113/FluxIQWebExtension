# w2-target-telemetry — why a successful action reports `unresolved_no_candidates`

**Outcome: Blocked on ownership.** The cause is established, reproduced live, and
located to the line. Every file that would have to change is one the brief put
off limits: Core, and `packages/test-runner/**`. No code was changed.

## What the field actually means

`targetResolution` is **not** the browser's account of finding the element. It is
**Core's own pre-dispatch scoring of runtime element candidates**, and for web
automation there are never any candidates to score.

Core, `packages/fluxiq/src/programs/automation-studio/runtime/io-policy.ts:232-244`:

```ts
function resolveElementTarget(target, minimumConfidence) {
  if (!target.candidates?.length) {
    // Nothing to score against, so no floor was applied, and the trace must not name one as if it had been.
    return {
      ok: true,
      target,
      diagnostics: { status: "unresolved_no_candidates", reason: "No runtime element candidates were supplied, so Core applied no confidence floor and left resolving the element to the output adapter." },
      resolution: { status: "unresolved_no_candidates", candidateCount: 0 }
    };
  }
```

Core's own contract says so in as many words
(`packages/fluxiq/src/programs/automation-studio/nodes/contracts.ts:133-142`):
"`unresolved_no_candidates` means Core was given nothing to score the target
against: it resolved nothing, applied no confidence floor, and left resolving the
element to the output's adapter."

The domain never supplies `target.candidates` and is not supposed to — the DOM
lives in the browser, so the browser resolves the element. Verified by grep:
nothing under `domain/src` writes a `candidates` array into a dispatched target
(`domain/src/output-nodes/targets/targets.ts:199-200` only *reads* Core's
`selectedCandidate`). So for **every** web action, on **every** run, Core takes
this branch. The value is a constant.

It then travels unchanged:

- `io-policy.ts:119` — attached to the success result as `prepared.resolution`
- `executor/node-execution.ts:196-209` — merged over the node result
- `executor/attempt-trace.ts:36` — onto the attempt
- `service/summaries/conversions.ts:177` — into the run detail's `metadata.targetResolution`
- `packages/test-runner/src/flow-lane/persisted-flow-run.ts:466-478` — read into the bundle
- `packages/test-runner/src/flow-lane/run-flow-lane.ts:386` — published as the action's `targetResolution`

## Which of the three explanations it is

**The third, and it is the interesting one.** Resolution honestly reported no
candidates, and the action succeeded by another route.

The record is not "never filled in" (explanation 1) and it is not "a genuine
default meaning unresolved" (explanation 2). Core truthfully recorded a fact
about *itself* — it was handed nothing to score — and that fact is then
published, under a field named `targetResolution`, beside a succeeded action, to
a reader who has no way to know the sentence is about Core rather than about the
element. The action found its element through a resolution path Core never sees.

## Where the truth actually is, and where it is dropped

The browser measures the real thing and carries it correctly all the way to Core:

- `apps/extension/src/content/action-runtime/resolve-target.ts` returns the
  element **and** its `BrowserActionTargetResolution` together (strategy,
  candidateCount, bestScore, runnerUpScore, confidence), on success as well as
  failure, since 2026-09-12.
- `apps/extension/src/content/action-runtime/results.ts:430` puts it on the result.
- `domain/src/actions/types.ts:407-413` types it; `:448` carries it on the result.
- `domain/src/client/gateway-mapping.ts:311` puts it on the wire, unredacted and
  safe to be so — a closed strategy enum and four numbers, nothing page-derived.
- Core `io-policy.ts:117` stores the whole dispatch payload at
  `attempt.outputs.result`.

**Then Core's run detail drops `outputs` entirely.**
`service/summaries/conversions.ts:157-181` builds the attempt record from
`status`, `failure`, `comparisonStatus`, `message` and a fixed `metadata` block
(`regionId`, `diffSummary`, `recoverySelected`, `hostCapabilities`, `stateRefs`,
`targetResolution`, `adaptiveFailure`, `recordCount`). The only thing read out of
`outputs` is `datasetMarkerRecordCount`. So the browser's measurement exists, is
correct, crosses the wire, is stored by Core — and no endpoint the Lab reads can
return it. Confirmed by grep over a full run's artifacts: the string `strategy`
appears nowhere in `run-mu651r34-c5160850/`.

## Live reproduction (before)

```
FLUXIQ_TEST_RUNS_DIR='F:\r17' FLUXIQ_TEST_ENV_FILES=none FLUXIQ_TEST_TARGET=isolated \
FLUXIQ_LAB_INSTANCE=t017 pnpm lab:campaign social-scheduler-week-ahead
```

Run `run-mu7dhczs-0297ea11`, `F:\r17\run-mu7dhczs-0297ea11`. Flow status
**succeeded**, oracle verdict **passed**, 3 live DeepSeek calls, 21102 tokens,
$0.0098. Extraction: 14 expected records, **14 observed**, 14 compared, 14
matched, 56 of 56 fields present, 0 unexpected.

`snapshots/flow-lane.json`, every action:

| action | status | comparison | targetResolution |
| --- | --- | --- | --- |
| `web.browser.navigate` | succeeded | matched | *(absent)* |
| `web.dom.select` | succeeded | matched | `unresolved_no_candidates`, `candidateCount 0` |
| `web.dom.select` | succeeded | matched | `unresolved_no_candidates`, `candidateCount 0` |
| `web.dom.select` | succeeded | matched | `unresolved_no_candidates`, `candidateCount 0` |
| `web.dom.extract_list` | succeeded | matched | *(absent)* |

Three selects each found their `<select>`, chose an option, and had the choice
read back off the element and confirmed (`comparisonStatus: matched`); the
extraction that followed pulled 14 of 14 records off the page they configured.
All three report that no candidates were found.

The same holds for failures. In `test-runs/run-mu651r34-c5160850/` a
`web.dom.click` that failed with `auth_required` / `web.auth.required` at stage
`confirmation` — a failure that has nothing to do with finding the element —
also reports `unresolved_no_candidates, candidateCount 0`.

**Absent is worse than it looks.** In the same bundle the field is missing for two
different reasons. `web.browser.navigate` needs no element. `web.dom.extract_list`
very much used one — it read 14 records off a list — but its schema requires
`extractList` rather than `selector` (`domain/src/actions/schemas.ts`, the
`web.dom.extract_list` row), so the domain does not set `elementTarget`
(`domain/src/output-nodes/definitions.ts:167`), so Core runs no target
preparation and writes nothing. So *present* means "Core scored nothing",
*absent* means either "no element" or "an element Core was never asked about",
and none of the three says anything about whether the element was found.

## The consequence nobody has measured yet

This is not only a reporting field. Core feeds it to the repair model.
`runtime/recovery/context.ts:268` sets `failed_target:
targetResolutionSection(metadata?.targetResolution)`, and `:324-334` passes
`status` and `candidateCount` straight through. So on every failed web action the
model is told the target was unresolved with zero candidates — including the
`auth_required` click above, where the element was resolved exactly and the
failure was a sign-in gate. Any repair reasoning that starts from "the element
was not found" starts from a false premise.

## Why no code was changed

The brief reserves `packages/test-runner/**` and Core entirely for other units of
work, and says to stop rather than edit them. Every candidate site is in one of
them:

- the producer of the constant — Core `io-policy.ts:236-244`
- the status vocabulary — Core `nodes/contracts.ts:141-152`
- the recorder that publishes it and drops `outputs` — Core `conversions.ts:157-181`
- the surface that shows it to the model — Core `recovery/context.ts:268`
- the bundle reader and writer — `persisted-flow-run.ts:466`, `run-flow-lane.ts:386`

I checked for an honest in-territory fix and found none:

- **The domain cannot supply candidates.** It has no DOM. Core's comment says the
  adapter is meant to resolve the element, which is the correct design.
- **The domain cannot set `targetResolution`.** Its node implementations run
  *before* dispatch (`domain/src/output-nodes/native-runtime.ts:49-72`, and the
  comment there says so), and Core overwrites whatever they set with the
  dispatcher's value (`node-execution.ts:196-209`). No domain-bound effect
  dispatcher exists — grep for `effectDispatcher` under `domain/src` and
  `apps/` returns only a comment.
- **The domain's one channel into run-detail metadata does not fit.**
  `captureStateSnapshot` (`domain/src/runtime/host-runtime.ts:87-110`) reaches
  `metadata.stateRefs`, but it issues its own separate
  `web.dom.capture_snapshot` dispatch and never sees the action's result, so it
  has no resolution to record. Writing one there anyway would be smuggling, and
  the bundle reader only takes `summary.truncated` and a byte count from it, so
  the corpus field would still lie.
- **Removing `elementTarget: true`** would silence the constant but also disable
  Core's missing-fingerprint gate, which stops a selector-requiring action from
  running with no element. Strictly worse.

Approximating a Core fix downstream is also against the standing rule that a
change belonging to the Core framework is made in Core.

## The fix, specified for whoever owns Core and the test runner

Three changes, in order of value:

1. **Stop publishing a non-answer as an answer.** Core should not write
   `targetResolution` at all when it scored nothing. `io-policy.ts:242` should
   return `resolution: undefined` in the no-candidates branch (the `diagnostics`
   string on `:241` can stay — it is accurate and already says the adapter did
   the resolving). `targetResolutionField` already omits an absent resolution, so
   `matched` / `no_match` / `below_confidence` keep working unchanged, and the
   field becomes what it reads as: present only when Core really scored
   candidates. This alone removes the false "not found" from every bundle and
   from every repair prompt.

2. **Carry the browser's measurement.** Add the adapter's resolution to the
   attempt so the truth survives. The cheapest honest route is for Core to lift
   `attempt.outputs.result.resolution` into the run detail as a *separately
   named* field — `metadata.adapterTargetResolution`, say — in
   `conversions.ts:170-180`, field by field against the closed shape in
   `domain/src/actions/types.ts:407-413` (strategy enum plus four numbers,
   nothing page-derived, so no redaction rule is needed). `packages/test-runner`
   then reads it beside `targetResolution` exactly as `targetResolutionOf` reads
   Core's, and the bundle finally says `strategy: "selector", candidateCount: 1`
   on an action that matched outright, or `strategy: "scored-candidate",
   candidateCount: 2, confidence: 0.51` on one recovered by a margin.

3. **Make absent unambiguous.** With (1) and (2), an action that used an element
   and reports no adapter resolution is a real defect rather than a naming
   accident — worth an invariant in the Lab evaluation.

The browser half needs nothing. `pnpm --filter @fluxiq-web-extension/extension
test:content identity-resolution` passes 24/24, including "an exact match reports
the strategy that answered, and claims no score it did not measure" and "a verb
that resolves nothing gains no measurement". The measurement is already correct,
already safe to carry, and already arrives at Core.

## Commands run and observed results

- `pnpm lab:campaign social-scheduler-week-ahead` (live, isolated, instance
  t017, runs dir `F:\r17`) — exit 1. Flow **succeeded** and the judgement
  **passed**; the run verdict is `failed` only on `security.redaction`, which is
  the separate `w2-unscanned-store` finding, not this one. Artifacts:
  `F:\r17\run-mu7dhczs-0297ea11`. The contradiction is in
  `snapshots/flow-lane.json` as tabulated above.
- `pnpm --filter @fluxiq-web-extension/extension test:content identity-resolution`
  — **24 passed (34.1s)**, 0 failed.
- Grep over `test-runs/run-mu651r34-c5160850/` for `strategy` /
  `scored-candidate` — no matches in any artifact, log or snapshot.

Not run: `pnpm check`, `pnpm test`, the domain tests, and the "after" live run —
there is no change to validate. No mutation test was written, for the same
reason.

## Not verified

- I did not confirm that removing the resolution in Core's no-candidates branch
  leaves Core's own tests green. `runtime/tests/io-policy.test.ts:169-173` and
  `recovery/tests/request-locator-shapes.test.ts:159` assert the current value
  and would have to be updated by whoever makes the change.
- I did not measure how often a real run produces a `scored-candidate`
  resolution rather than an exact one, so I cannot say how much fix (2) would
  reveal in practice. The content harness proves both shapes are produced; a
  live corpus number would need fix (2) to exist first.
- I read Core only to diagnose and changed nothing there.
- The live evidence is one run of one task. The `unresolved_no_candidates`
  constant is structural rather than intermittent — it follows from a branch
  that is always taken — and an older run from a different scenario
  (`run-mu651r34-c5160850`, an auth-gate Flow) shows the same value on a
  `web.dom.type` success and a `web.dom.click` failure, so this is not a
  single-observation finding.

## Open questions

- Fix (1) removes a field that `domain/src/runtime/llm-evidence/**` and the
  repair-proposal path may read (`llm-evidence/tests/repair-proposal.test.ts`
  references `targetResolution`). That directory is owned by another unit of
  work; whoever takes the Core change should check it handles an absent field,
  which it must already do for non-element actions such as `navigate`.
- Whether `web.dom.extract_list` *should* declare `elementTarget` is a real
  question this turned up, but it is a separate one: today it acts on an element
  with no Core-side fingerprint gate at all.
