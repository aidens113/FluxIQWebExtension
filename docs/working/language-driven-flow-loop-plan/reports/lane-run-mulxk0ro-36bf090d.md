# Lane debug: run-mulxk0ro-36bf090d (local-classifieds-save-dining-tables)

Worker lane t172, debug only, no product code changed.

## Outcome

**Failed. A Flow was created and ran, but it does only the first half of the
job.** The instruction was to save the three cheapest dining tables within 5
miles of Kelford, then list everything in saved items. The Flow searched for
"dining table" and extracted the first results page. It never saved anything,
never set the 5-mile radius, and never opened saved items. The build was
accepted as complete anyway. The verifier refuted the answer twice, correctly.
The re-author then failed before producing anything, with
`flow_bootstrap.unexpected_error`.

| Field | Value |
| --- | --- |
| Task | `local-classifieds-save-dining-tables` |
| Worktree / commits | `F:\fxwork\t172-live-lane-hard-sites` @ 260a4e17, Core @ 717f035 via `FLUXIQ_LAB_ALLOW_BEHIND_CORE=1` (Core `dev` is at 8b56084) |
| Build | `proposed`, 19 provider calls (18 in the loop), 180,654 tokens, $0.0201, 111 s |
| Flow | 6 nodes: navigate, click "Decline optional cookies", merge, type into "Search Marketplace", Enter, `dom-extract_list` |
| Extraction | 10 of 12 items kept (`where` dropped 2), 1 page, fields `title, price, location, url` |
| Oracle | `extract-saved-items`: 5 expected, 10 observed, 0 matched, `status` column absent |
| Verification | 2 of 2 `does_not_answer` |
| Re-author | routed, **failed in `generate()`**: `flow_bootstrap.unexpected_error`, stage `provider_request`, invocation `unknown`, no adaptation |
| Run duration | 172.5 s |

## Iteration walk (`snapshots/live-llm.json`)

| # | +s | Tool | Result | Draft rev / steps | Note |
| --- | --- | --- | --- | --- | --- |
| 0 | 0.0 | run_node `dom-capture_snapshot` | `not_at_start_location` | 0 | Normal first move |
| 1 | 7.2 | run_node | `action.succeeded` | 0 to 1 | Navigate |
| 2 | 11.3 | run_node | `action.succeeded`, page changed | 1 to 2 | Decline optional cookies (light DOM on this site, so the model could press it) |
| 3 | 15.2 | run_node | `action.succeeded`, page changed | 2 to 3 | Type the search |
| 4 | 19.4 | run_node | `action.succeeded`, page changed | 3 to 4 | Enter |
| 5 | 22.8 | detect_repeating_structure | `structure.detected` | 4 | Results |
| 6 | 29.4 | run_node (inspect) | `inspect.succeeded`, page changed | 4 to 5 | |
| 7 | 32.5 | detect_repeating_structure | `structure.detected` | 5 | |
| 8 | 34.9 | detect_repeating_structure | `already_answered` | 5 | Stall starts |
| 9-10 | 38.7-42.4 | decision_unusable | **`llm.provider_malformed_response` x2** | 5 | Provider sent unparseable replies |
| 11 | 45.7 | detect_repeating_structure | `already_answered` | 5 | |
| 12 | 49.7 | amend_draft (rerun d7) | `draft_rerun`, inspect | 5 to 7 / 5 | |
| 13-14 | 59.3-64.6 | amend_draft | `draft_unchanged`, 1 refused, identical twice | 7 / 6 | |
| 15 | 80.7 | decision_unusable | **`llm_evidence_loop.dry_run_refused`** | 7 | First completion: the draft did not replay clean |
| 16 | 83.8 | decision_unusable | `llm_output.invalid_evidence_decision` | 7 | |
| 17 | 86.2 | amend_draft | `draft_amended`, 1 applied (d3) | 7 to 8 / 6 | |
| 18 | 101.9 | **decision_complete** | accepted: answerability `recordsRequested`, producer present, store present | 8 / 6 | Build closed with no save step |

The model did no action after #4. From #5 to #18 it worked only on the reading
half. It never opened a listing, never pressed Save, and never touched the
radius.

## Divergence point and causes

The divergence is **#18**. The loop accepted `complete` on a draft that
performs none of the lasting changes the instruction asks for. The build's own
consequence cross-check knew this: `instructed: [modify_existing, create_new]`,
`declared: []`, `verdict: "undeclared"`, 22 of 28 gate calls declaring nothing.

### Cause 1 (new): completion checks only for records, never for the instruction's actions

- The completion gate `checkAutomationStudioFlowBootstrapAnswersInstruction`
  asks one question: does the instruction want records, and does some step
  produce or store them
  (`!FluxIQ/.../runtime/flow-bootstrap/answerability/check.ts:57-78`). A Flow
  with an extract step passes, whatever else the instruction asked for.
- The cross-check that sees the gap is advisory by design: "It refuses nothing
  ... it is here so the person approving this Flow approves it in sight of the
  contradiction" (`!FluxIQ/.../flow-bootstrap/adaptation.ts:127-133`). It is
  computed after the loop (`flow-bootstrap/action-permissions.ts:209-216`), so
  the model is never told that its draft does not do what was asked.
- Under the grants rule this should not become a permission gate: saving is the
  automation's own work. It should become a completeness issue fed back at
  `complete`, the way `bootstrap.cannot_answer_instruction` and
  `dry_run_refused` already are: "the instruction asks for create_new and
  modify_existing, and no step of this draft causes either".

### Cause 2 (new): the re-author failed inside `generate()` with an anonymous guard error

`resultReauthor`: routed, no adaptation id, `flow_bootstrap.unexpected_error`
at `provider_request`, invocation and response `unknown`. The re-author's
`failureCode` maps any plain `Error` thrown inside generation to that code
(`!FluxIQ/.../flow-bootstrap/generation-failure/phase-failure.ts:84-87`), and
the harness wraps every throw at stage `provider_request`
(`!FluxIQ/.../runtime/service.ts`, `runHarness` in
`generateFlowBootstrapAdaptationInternal`, about line 1547). The message is
deliberately discarded, so **which guard threw cannot be named from the
bundle**. Candidates are the grant purpose guard in the re-author's own
`generate` (`service.ts:2645`, "The run's grant does not admit Flow
extension.") and the plain-`Error` grant and binding checks
(`runtime/llm/execution/grants.ts:188-310`, `grant-checks.ts:20-72`). Run 1's
re-author, under the same grant shape, got past all of them. The visible
structural difference is that this Flow contains a `builtin.control.merge` node
and run 1's did not. It is not proven that this matters. The consequence: the
feature that should have added the missing save steps never ran. A fixer needs
the throwing guard's identity recorded (a closed code per guard) before this
can be diagnosed.

### Cause 3 (known): stalled turns and malformed provider replies

#8, #11, #13-14: `already_answered` and identical `draft_unchanged`
amendments. #9-10: two `llm.provider_malformed_response` in a row, and #16
`invalid_evidence_decision`. Seven of 18 decisions made no progress. This run
predates Core 8b56084's stall redirect.

### Cause 4 (contributing, related to run 1's shadow-DOM cause): radius control not reachable

The 5-mile radius is set in `<kf-location>`, whose chip, select and Apply
button live in an open shadow root
(`apps/scenario-lab/src/scenarios/local-classifieds/client/location-element.ts:1-40`).
The snapshot never enters shadow roots
(`apps/extension/src/content/dom-snapshot.ts:254`), so the model had no handle
for the radius. The Flow read the default 20-mile results (it includes a
"Dining table legs x4" accessory and £95 tables beyond the three cheapest).
The model did not try the radius at all, so this run does not prove the
shadow DOM stopped it. It only shows there was no way for it to succeed except
a URL parameter (`radius=5`), which it did not use.

## Ranked for fixers

1. **Cause 1**: completion must check that the instruction's lasting actions
   have a step, and say so to the model at `complete`. This alone would have
   kept the build open on the half it never did.
2. **Cause 2**: give each generation guard a closed code, so a failed
   re-author says which guard refused. Then find and fix that guard.
3. Cause 4 (shadow DOM in the snapshot) is shared with run 1.
4. Cause 3 is the known stall. Re-measure on Core 8b56084.

## Not verified

- The throwing guard in the re-author (see cause 2).
- Whether the page's pre-existing saved items would have been read correctly:
  no step reached the saved-items page.
- What each model decision contained. The bundle keeps result codes only, and
  the Lab deletes the run root with Core's store
  (`packages/test-runner/src/run-scenario.ts:600-602`).
