# A failed extraction now tells the model why, and a repeated answer says so

Task: carry the extraction's own account of a failed read through to the model,
map the failure codes that fell through to a bare `action_failed`, and make a
byte-identical repeat visible instead of silent. Diagnosed from
[the debug of `run-mulryg6h-ff241a12`](debug-run-mulryg6h.md).

## Outcome

Done, for everything this repository owns. Three items belong to FluxIQ Core and
are reported rather than approximated here (section "For Core").

Two pre-existing test failures and one pre-existing check failure remain, none
of them caused by this change and none in a file this work touched. They are
attributed in "What was already red".

## What changed and why

### 1. The diagnosis already reached the domain; the domain threw it away

The first thing worth recording is that **no extension change was needed**. The
account was already arriving.

`apps/extension/src/content/actions/extract-list.ts:97` builds the summary
(`recordCount`, `pagesRead`, `truncated`, `missingFields`, `fieldNames`,
`itemsSeen`, `emptyRecords`, `listPresence`, `listWait`, `conditions`).
`apps/extension/src/content/action-runtime/results.ts:406` puts it on the result
**whatever the status** (`if (evidence.extraction) result.extraction = ...`, in
`buildResult`, which every verb returns through).
`domain/src/client/gateway-mapping.ts:308` copies it field by field onto the
gateway payload. `apps/extension/src/runtime/result-mapping.ts:60` puts that
payload on the gateway result.

So by the time `domain/src/runtime/llm-evidence/` saw the failure, the whole
diagnosis was sitting on `result.payload.extraction`. What was missing was that
the domain's own `WebFailedActionResult` type named only `status` and `failure`,
so nothing could read it, and `capture.ts` wrote `detail: undefined` beside the
code it did read.

### 2. `action-failure.ts` became `action-failure/`

`domain/src/runtime/llm-evidence/action-failure.ts` (43 lines, two exports) is
now a directory with a barrel, because the mapping and the read diagnosis are
two responsibilities and the parent directory was two files from its 25-file
budget:

- `action-failure/result.ts` — `WebFailedActionResult`, now naming `payload`.
- `action-failure/read-shortfall.ts` — `webActionReadShortfall(payload)`: reads
  the summary through the existing closed copier
  (`domain/src/actions/extraction/summary.ts`
  `webAutomationExtractionSummaryValue`) and routes it to one of seven reasons.
- `action-failure/refusal.ts` — `webActionFailureRefusal(result)`, which returns
  `{ code, detail }` together. `webActionFailureRejectionCode` is kept for the
  one caller that reports under a code of its own (`node-run/replay.ts`).
- `action-failure/tests/refusal.test.ts` — the pinning tests.

**No diagnosis is invented.** Each reason is one branch of a fact the page
already states. The order is the order the repairs have to happen in:

| Condition in the summary | Reason | What it tells the model to do |
| --- | --- | --- |
| `listPresence: "never_appeared"`, or no `listPresence` and `itemsSeen: 0` | `list_never_appeared` | Re-detect the list; the fields and conditions are irrelevant |
| `conditions.applied > 0 && conditions.kept === 0` | `conditions_kept_nothing` | Widen or drop `where` |
| `recordCount === 0` and `listWait.stoppedOn !== "list_present"` | `list_did_not_finish_loading` | The list is late or elsewhere |
| `recordCount === 0`, nothing above | `no_records_read` | The page held nothing here |
| `emptyRecords === recordCount > 0` | `records_have_no_fields` | Fields read off the wrong element |
| `missingFields.length > 0` | `required_fields_missing` | Those declared columns |
| otherwise | `fewer_records_than_required` | Rows, just not enough |

The detail carries `recordsRead`, `itemsSeen`, `emptyRecords`, `missingFields`
and `waitStoppedOn` — exactly what the debug report recommended, and exactly the
kinds of value `tool-rejection.ts` already permits: counts, one closed word, and
the call's own declared field keys. `missingFields` is validated as field keys
by the summary copier before it is ever seen here, and is always a subset of the
call's own `fieldNames`. No selector, no value, no page text.

The read's account is read **whatever code the action failed under**, including
`timed_out` — the three failing attempts in the run burned 11–14 s each, which
is the shape of a read that ran out of time, and reading the account for only
one code would have left that one bare again.

### 3. The code table: eight of nineteen were mapped, now fifteen

| Client code | Was | Now | Reason |
| --- | --- | --- | --- |
| `web.validation.output_not_observed` | `action_failed` | `output_not_observed` (new) | from the read's account; none for an action that counts nothing |
| `web.validation.state_mismatch` | `action_failed` | `output_not_observed` | `state_not_as_asserted` |
| `web.browser.permission_denied` | `action_failed` | `not_permitted_here` (new) | `page_not_scriptable` |
| `web.transport.transient` | `action_failed` | `action_failed` | `channel_to_page_failed` |
| `web.action.unsupported_type` | `action_failed` | `invalid_input` | `node_not_runnable_here` |
| `web.action.not_implemented` | `action_failed` | `invalid_input` | `node_not_runnable_here` |
| `web.action.invalid_parameter` | `action_failed` | `invalid_input` | `parameter_not_readable` |

**Deliberately left unmapped, and why.** Two, and only two:

- `web.action.failed` is *defined* as "the action failed for a reason no other
  code names" (`domain/src/runtime/failure/codes.ts:121`). A reason invented for
  it would be this domain claiming to know something the client said it does not.
- `web.action.unknown` is "nothing said why the action failed". Same answer.

`web.action.rejected` was already special-cased into `target_covered` /
`target_not_actionable` and is unchanged. `web.validation.output_not_observed`
carries no code-derived reason on purpose: where there is a read account the
reason comes from it, and where there is none — a click whose post-condition did
not hold — the new code already says the whole of it.

Two new refusal codes rather than reasons alone, because each implies a move no
existing code implies: `output_not_observed` says nothing on the page is in the
way (so there is nothing to press or close), and `not_permitted_here` says no
retry of any kind can clear it. Both flow automatically into
`WEB_LLM_EVIDENCE_RESULT_CODES`, which `packages/test-runner` derives rather than
restates. Core's exploration classifier
(`harness-options/exploration-terms.ts`) special-cases only the two scope
refusals, so neither new code changes any routing.

### 4. A code and a detail can no longer be taken apart

`pageRefusal` took a `WebLlmToolRejectionCode` and wrote `detail: undefined`
beside it on all three of its return paths. It now takes the whole
`WebActionRefusal`. That is the structural half of the fix: a signature that
hands back only a code is what made forgetting the detail possible.

`node-run/replay.ts` also gained the reason. It previously passed
`resultReason: undefined` with a comment saying the page's code "is not one of
this domain's reasons and must not be dressed up as one" — true when nothing
translated it, and no longer true. A replay that failed because its read came
back empty used to be recorded identically to one that failed because the
browser would not script the page.

### 5. A repeated answer says so

New: `domain/src/runtime/llm-evidence/repeated-refusal.ts`, wired into
`tools.ts` `executeTool` on **both** ways out (node-run catches its own refusals
and returns them; detection and the resolver throw past to the catch block — a
repeat noticed on only one of the two would miss whichever half a build spent
itself on).

It keys on (session, project, flow, tool), compares the serialized refusal
against the last one for that slot, and on a match:

- writes `repeatedAnswer: n` (counting from 2) into the packet's `detail`, so
  **the model is told**, and so the answer is no longer byte-identical;
- sets the execution's `resultReason` to `answered_the_same_again`, so **a
  reader of the bundle is told** — `resultCode` and `resultReason` are the only
  two fields of a refusal that Core's step record keeps
  (`AS/runtime/flow-bootstrap/evidence-loop-steps.ts:278`).

A success clears the slot; a different refusal starts the count again. Sixteen
slots, oldest let go.

**The one tradeoff, stated plainly.** A trace row has one `resultReason` and
Core's record has no room for a second, so on a repeat the reason is *swapped*,
not added. The cause is not lost: the first row of a run of identical refusals
carries it, every repeat says it is a repeat of that, and the full reason stays
in the packet's own `detail` where the model reads it. A bundle scan counting
`list_never_appeared` will now count the first of each run rather than all of
them, which is the honest number anyway.

**What it deliberately does not do:** it does not refuse the call and it does
not end the loop. Ending a build is Core's no-progress guard's job, and a domain
that declined to answer would be refusing the automation's own work. What it
removes is the silence.

## For Core (not done here, not approximated here)

1. **Core's no-progress guard should act on `answered_the_same_again`.** This
   domain can now say that a call produced nothing new; only Core can decline to
   spend the next iteration on it. On the measured run `maxUnusableDecisionsInARow`
   and `maxStepsWithoutProgress` were both 24 against a 26-iteration budget, so
   neither guard could ever have fired.
2. **`exhausted()` mislabels an iteration-limit exit** as
   `flow_bootstrap.evidence_unusable_decision` /
   `provider_output_validation` / `retryable: false` purely because the last
   decision happened to be unusable
   (`AS/runtime/llm/evidence-loop.ts:337-342`). Cause 4 of the debug report.
   Core's `evidence-loop/exhaustion.ts` is currently uncommitted in
   `F:\!FluxIQ`, so this may already be in hand.
3. **A creation task inherits the repair-shaped budget of 26 calls**
   (`DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun`) unless the campaign wrapper names
   48. Cause 3 of the debug report; the Lab's default, not this domain's.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`.

- `pnpm --filter @fluxiq-web-extension/domain check`
  (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`) — **clean, exit 0,
  no output.**
- `DOMAIN_TEST_BUILD_LABEL=extract-detail3 pnpm --filter @fluxiq-web-extension/domain test`
  — `# tests 855 / # pass 853 / # fail 2`. The two failures are named below and
  are not this change's.
- The two new suites, run in isolation first:
  `action-failure/tests/refusal.test.ts` — `# tests 5 # pass 5 # fail 0`;
  `tests/extraction-failure-detail.test.ts` — `# tests 3 # pass 3 # fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension check` — **fails**, with every
  error in one file: `e2e/content/tests/dialog-dismissal.spec.ts`. That file is
  **untracked** (`git status` shows `?? apps/extension/e2e/content/tests/dialog-dismissal.spec.ts`),
  created by the concurrent extension worker. Scoped to the source project,
  `npx tsc -p apps/extension/tsconfig.json --noEmit` is **clean, exit 0**.
- `pnpm --filter @fluxiq-web-extension/extension test` —
  `# tests 848 / # pass 848 / # fail 0`.
- `pnpm --filter @fluxiq-web-extension/domain build` — clean; 504 files emitted,
  812 specifiers rewritten. This confirms the new `action-failure/` directory
  resolves through the barrel in `dist` as well as in source.
- `pnpm --filter @fluxiq-web-extension/test-runner check` — clean, exit 0. It is
  the only other consumer of `WEB_LLM_EVIDENCE_RESULT_CODES`, and derives the
  set rather than restating it.
- `node scripts/structure-audit.mjs` — `1 violation(s) across 1 rule(s)`: the
  pre-existing `[working-docs] docs/working/README.md is out of date`. Nothing
  from the new files; `llm-evidence/` is at 23 of 25 source files (advisory
  warning at 15, as before), and `tool-rejection.ts` at 550 lines against the
  800-line limit.

### Three existing tests updated, each because the behaviour they pinned changed

- `tests/page-refusal.test.ts:196` — `OUTPUT_NOT_OBSERVED` was pinned to
  `action_failed`. That assertion *was* the defect.
- `structure/tests/detect.test.ts:375` — two consecutive identical
  `sensitive_value` refusals; the second now carries `repeatedAnswer: 2`.
- `tests/tool-rejection-detail.test.ts:126` — the `gone` and `moved` handle
  refusals produce the same bytes; the second now carries `repeatedAnswer: 2`.

## What was already red before this work

- `press.test.ts` — *"with no permission check to ask, every high-risk
  declaration is refused"* and `tool-rejection-detail.test.ts` — *"a refusal
  with no run behind it to ask says nobody could be asked, and still names the
  classes"*. Both assert that `send_or_publish` is refused when there is no
  permission check. FluxIQ Core commit `68bad85` (2026-09-28 13:59 -0700, *"The
  panel stops asking permission for its own work"*) set `send_or_publish: false`
  in `AS/runtime/action-permissions/destructive.ts`, which is the decision the
  pinned memory *grants gate only genuinely risky actions* records. These two
  downstream expectations are simply stale.

  **Not fixed here on purpose.** They live in my owned path but they are the
  consequence of another worker's in-flight Core change, and that worker may be
  updating them now; two agents editing one file is how one of them loses its
  work. The fix is one line each: drop `"send_or_publish"` from the expected
  `missing` array, and drop the `call.send` assertion pair (or expect
  `web.action.succeeded`).

- `docs/working/README.md` out of date (structure audit). Pre-existing; the
  supervisor regenerates it with `pnpm structure:baseline` at handoff.

- `apps/extension/e2e/content/tests/dialog-dismissal.spec.ts` type errors. An
  untracked file from the concurrent extension worker.

## Not verified

- **No live run.** Nothing here has been exercised against a real page or a real
  provider. The integration test drives the real `createWebAutomationLlmEvidenceRuntime`
  with a fake gateway, so the refusal path, the packet and the trace row are
  proved; the page's own summary is not re-proved (it is already covered by the
  extension's own suites, which pass).
- **Which shortfall `run-mulryg6h-ff241a12` actually hit.** Still unrecoverable:
  that bundle carries no `WebAutomationFailureCode` and no payload. The debug
  report reasoned to `web.validation.output_not_observed` /
  `list_never_appeared`, and that is now the path that would be recorded, but the
  original run cannot be re-diagnosed retrospectively.
- **Whether `repeatedAnswer` changes model behaviour.** It is information the
  model did not have; whether it stops re-asking is a question only a live run
  answers.
- **Root `pnpm check` / `pnpm test` / `pnpm build`.** Not run whole, because the
  tree carries another worker's in-flight extension changes; the per-package
  checks above are the narrowest honest scope.

## Open questions

1. Should `answered_the_same_again` reach Core's no-progress guard as an input,
   or should Core keep counting identical `resultCode`s itself? This domain can
   now supply the fact either way.
2. The repeat count is per (session, project, flow, tool). A build that alternates
   two failing calls — extract, detect, extract, detect — has each slot see a
   repeat, which is right. A build that alternates two *different* extractions
   sees neither, which is also right but means the waste is only caught when the
   answer is genuinely identical. Widening that to "no new information" rather
   than "identical bytes" would need a notion of what counts as new, which is a
   judgement this domain should not make alone.
3. `web.transport.transient` is mapped to `action_failed` with reason
   `channel_to_page_failed`. It is retryable and nothing about the call was
   wrong, so arguably it should not reach the model as a refusal at all — the
   runtime should absorb it (the *defensive runtime* rule). That is a
   `node-run/run.ts` question, not an `action-failure/` one, and is left open.
