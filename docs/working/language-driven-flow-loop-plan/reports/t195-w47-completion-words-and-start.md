# t195-w47: completion words and start location

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, branch `task/t195-live-control-flow`.
`R` = `packages/fluxiq/src/programs/automation-studio/runtime`. Nothing was staged or committed.

## Outcome

Done for all three tasks. Each new test failed first, and passes now. The tests in every directory
the brief names pass (59 files, 519 tests). `pnpm --filter fluxiq check` exits 2 and the structure
audit exits 1. Every error and violation in both is in a file other workers are editing, and none
is in a file I changed (details below).

## What changed and why

### 1. Words for `repeat_not_after_its_source` reach the model

**Where the message was dropped.** `R/flow-bootstrap/plan/issue-feedback.ts`
(`automationStudioFlowBootstrapIssueFeedback`) copies `message` only for codes in `AUTHORED_CODES`.
None of draft-routing's six refusal codes are in that list, though `flow_draft.routing_unavailable`
from the same module is. I don't own that file, so the carry is in a file I do own:

- `R/llm/harness-options/bootstrap-completion.ts`: `refused()` maps each feedback entry through the
  new `withRoutingSentence(entry, failure.issues[index])`. It adds the issue's `message` when the
  code is in the new `DRAFT_ROUTING_CODES` (`check_not_before_step`, `recovery_behind_step`,
  `recovery_is_routed`, `repeat_span_unknown`, `repeat_not_after_its_source`,
  `repeat_body_is_routed`) and the feedback left the message out. These sentences contain only step
  numbers and amendment JSON.
  - **Cleaner alternative for the supervisor:** add those six codes to `AUTHORED_CODES` in
    `R/flow-bootstrap/plan/issue-feedback.ts`. Then delete `DRAFT_ROUTING_CODES`,
    `withRoutingSentence` and the `.map(...)` line from `bootstrap-completion.ts`. The model sees the
    same output either way.

**What the words say.** In `R/flow-bootstrap/authoring/draft-routing.ts`, the new
`overAfterSpan()` handles the `overAt >= index` case. It looks at the draft and picks the fix:

- **The step is the listing another span repeats over** (run 0072, step 15): "Step 15 repeats over
  step 16, which comes after it, and step 15 is itself the listing step 16 repeats over. A listing
  runs once, before the act that walks its rows; it never repeats. Take the repeat off step 15 with
  amend_draft {"step": 15, "change": "always"}; step 16's repeat over step 15 then stands as it is."
- **The step is a listing (it has a list output) and no span repeats over it:** take the repeat off
  with `always`, then repeat the act over the listing (`{"step": <the act>, "change": "repeat", "over": N}`).
- **The act's listing merely comes after the act:** `{"step": <listing>, "change": "reorder", "to": <act>}`.
  The act then becomes step act+1 and keeps its repeat.
- **The step repeats over a later check that is not a listing:** both options, `always` or a
  reorder of the check to just before it.

The second refusal (run 0072, step 16) used to say "which another step already runs inside its own
branch or loop". The source is now detected as never emitted because its own repeat was refused:
the step is not consumed, has no emitted entry, and its routing is `repeat`. In that case the
message is: "Step 16 repeats over step 15, and step 15 also says it repeats, which was refused, so
the Flow has no listing on its own line for step 16 to walk. Take the repeat off step 15 with
amend_draft {"step": 15, "change": "always"}; step 16's repeat over step 15 then stands as it is."

The `{"step": N, "change": "always"}` spelling matches w45's change in progress. I checked that
`R/flow-draft/amendment.ts` now lists `"always"` in `AUTOMATION_STUDIO_FLOW_DRAFT_AMENDMENT_CHANGES`.

### 2. R18: the read-before-act note

`R/flow-bootstrap/authoring/instruction-record-columns.ts`: the sentence no longer says "the draft
needs a read after step N". It now says: "... so it shows the page as it was before that act. If the
instruction asks for what the page shows after it, run a new read after step N and add it; " and
ends with one of two clauses:

- when the last act is in a repeated span: "the listing step N repeats over stays where it is, before step N."
- otherwise: "leave every read before step N where it is."

It still never names a read's step. There is a new optional input, `lastActRepeats`.

`R/llm/harness-options/draft-acts.ts`: the new `inRepeatedSpan()` sets `lastActRepeats` when a kept
step's `repeat` span covers the last act step. The span runs from that step to its `through`, so it
covers the act starting the span or sitting inside it.

### 3. Start location

- `R/llm/deepseek/request-body.ts`: `FLOW_START_LOCATION_NOTE` gains two sentences:
  - The Flow's first step may instead go straight to the address where the work begins, deeper on
    the same site. Once the build has seen that the address is stable (the same on every visit,
    with no session, token or one-time value in it), it reruns step 1 with that address and drops
    the steps that only travelled there.
  - Keep every optional dismissal.

  The note is not in `system-prompt-pins.json`. The pins test passes unchanged, so no substitution
  is needed.
- **Reach check: no change needed.** `checkAutomationStudioFlowBootstrapReachesStartLocation`
  (`R/flow-bootstrap/reachability/check.ts`) counts a step as reaching the start when its value
  shares at least 12 leading characters with the start location (`location-agreement.ts`). A
  deeper address on the same origin passes, and the existing test "counts the front page, a deeper
  page and a neighbouring one" already covers it. Since t195-w28a this check only adds a note; it
  never refuses. The arrival restore (`start-step.ts`) uses the same agreement, so a kept rerun to
  the deeper address also stops the old front-page arrival from being put back.
- I added a completion-level test with run 0072's shape:
  - step 1 navigates straight to `.../social-network-feed/friends/requests/`
  - an optional dismissal
  - the listing
  - the Confirm repeating over the listing
  - the replaced front-page arrival, dropped, with `replacedBy`

  It is accepted with no `notes`, no `restoredStep`, and the first node's url set to the deeper
  address. It passed the first time it ran, because nothing needed fixing.

### Tests added or changed

- `R/flow-bootstrap/authoring/tests/draft-routing.test.ts`: new describe "a span whose over comes
  after it", 6 tests. The fixture is the kept steps of run 0072's draft.
- `R/llm/harness-options/tests/bootstrap-completion.test.ts`: 2 new tests. One checks that the
  routing sentence is carried, with the 0072 shape. The other checks that a first step going to a
  deeper address is admitted.
- `R/flow-bootstrap/authoring/tests/instruction-record-columns.test.ts`: `BEFORE` text updated,
  `BEFORE_REPEATED` added, 1 new test.
- `R/llm/harness-options/tests/draft-acts.test.ts`: `BEFORE` text updated, `BEFORE_REPEATED`
  added, 1 new test covering an act that starts the span and an act inside it.
- `R/llm/deepseek/tests/request-body.test.ts`: new describe "what a build is told about where its
  Flow starts", 1 test.

## Commands run and observed results

All run from the Core root. Scratch output is in the session scratchpad as `t195-w47-*.txt`.

- **Failing first, task 1:**
  `npx vitest run --exclude ".tmp/**" --testTimeout=30000 R/flow-bootstrap/authoring/tests/draft-routing.test.ts R/llm/harness-options/tests/bootstrap-completion.test.ts -t "over comes after it|run 0072"`
  - Result: `6 failed | 1 passed | 51 skipped`.
  - Step 15 received "...which does not come before it. The list step a span walks runs before the
    span: move step 16 ahead of step 15 with an amend_draft reorder."
  - Step 16 received "...which another step already runs inside its own branch or loop...".
  - The completion check had 2 keys per issue (no `message`).
- **After the fix**, the same two files plus `repeat-loop.test.ts`: `64 passed (64)`.
- **Failing first, task 2:** `instruction-record-columns.test.ts` and `draft-acts.test.ts` gave
  `4 failed | 25 passed`. After the fix: `29 passed (29)`.
- **Task 3, reach check:** `bootstrap-completion.test.ts -t "deeper address"` gave `1 passed`
  before any code change, so no fix was needed.
- **Failing first, task 3 note:** `request-body.test.ts` gave `1 failed | 4 passed`, with "expected
  'The build opened by going to startLoc…' to contain 'may instead go straight to the addres…'".
  After the fix, `R/llm/deepseek/tests` gave `9 passed (9) files, 106 passed`, including the
  system-prompt pins.
- **Brief directories:**
  `npx vitest run --exclude ".tmp/**" --testTimeout=30000 R/flow-bootstrap/authoring R/llm/harness-options R/llm/deepseek R/tests/service-authoring R/tests/service-bootstrap R/tests/deepseek-bootstrap`
  gave `Test Files 59 passed (59)`, `Tests 519 passed (519)`.
- **Typecheck:** `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w47 core check" pnpm --filter fluxiq check`
  exits 2. All errors are outside my files, in two groups:
  - `repeat_taken_off` is missing from records in `activity/wording/draft-edit-refused.ts`,
    `flow-bootstrap/evidence-loop-steps.ts`, `llm/draft-amendment-feedback.ts` and
    `llm/tests/draft-amendment-feedback.test.ts`. This follows from w45's change in progress to
    `flow-draft/amendment.ts`.
  - `llm/evidence-loop/tests/repeat-guard.test.ts(181)` and
    `llm/repeat-guard/tests/outcomes.test.ts(101,116)` have errors. Both are being edited by
    another worker.

  None of the errors is in a file I changed.
- **Audit:** `node scripts/structure-audit.mjs` exits 1 with 2 violations, neither mine:
  - `flow-draft/amendment.ts` is 817 lines (limit 800). It is w45's file.
  - `llm/tests/` holds 26 files (limit 25). The new untracked `llm/tests/evidence-loop-decision.test.ts`
    belongs to another worker.

  My files produce only advisory warnings. `draft-routing.ts` grew from 364 to 417 lines and is now
  past the 400-line advisory threshold. `bootstrap-completion.ts` (563), `draft-routing.test.ts`
  and `bootstrap-completion.test.ts` were already past it.

## Not verified

- No live run, so the model's reaction to the new words is not tested.
- I did not check whether the loop accepts `amend_draft rerun` on step 1 (the opening arrival) with
  a new url, or whether the web domain's gate admits a navigation to a deeper address as the
  arrival. Both are outside my files. The note tells the build to do this.
- A typecheck run with zero errors was not possible while other workers' edits are in progress.

## Open questions or contradictions found

- The header of `bootstrap-completion.ts` says feedback is "never a validator's prose". The routing
  sentences are Core's own words, so that still holds. The allowlist really belongs in
  `issue-feedback.ts` (see the alternative under task 1).
- Step 16's refusal in 0072 is a consequence of step 15's. It is still emitted, now with the same
  fix, instead of being suppressed. If you want one issue per root cause, drop that branch's issue
  instead.
