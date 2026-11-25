# t1037 (W3): the framework drafts the Flow -- sub-supervisor report

Phase 1 only (design, the parts wholly in W3's paths, offline proof). Phase 2 (wiring into the evidence loop) waits for W1.
Trees: `fxwork/t1037/!FluxIQWebExtension` and `fxwork/t1037/!FluxIQ`, branch `task/t1037-auto-draft`. No git run.

## Outcome

Phase 1 is done. The drafting function, the six-edit grammar and its handler path, the feedback and the framework
telling are built and tested in Core. The offline replay of the five bigbox recordings shows that every act that landed
is in the framework's Flow on all five runs. Nothing is wired into the loop yet: that is phase 2, after W1 merges. Two
rules were added after the replay showed what was wrong (see "Integration changes").

## Per-worker summary

| Worker | Tier | Brief | Outcome | What I checked myself |
| --- | --- | --- | --- | --- |
| `compose` | worker (Sonnet) | `automationStudioFlowDraftCompose` in `draft/compose/**`, plus tests | Partial at hand-back: its own folder passed, but the check and audit failed on the other worker's files mid-flight | I read `compose.ts` and `dead-end.ts`; I re-ran the draft folder's tests after my edits (41 files, 458 tests passed); the check and audit pass once both workers had finished |
| `edits` | worker (Sonnet) | The six-edit grammar (`draft/amendment/edits/**`, `apply.ts` with `grammar: "framework"`), refusals `not_an_edit` / `not_a_read`, the handler flag `draftEdits`, feedback, and the entry's framework telling with `out` lines | Done | I read the `apply.ts` diff and the telling. I found one gap and fixed it (a keep on a framework-in step). I re-ran its folders: 515 files, 5868 tests passed. It also touched three files outside its list, all additive: `ui/activity-action/refusal-words.ts` and the reason tables in `decision-handlers/tests/refusal-way-out.test.ts` and `llm/tests/draft-amendment-feedback.test.ts`. None of them is in W1's or W2's list |
| `replay` | worker (Sonnet) | Offline run of compose over the five recordings; side-by-side drafts; entry and decision tables | Done | I re-ran `replay.mts judge` after my rule changes: exit 0, idempotent on all five runs |

Worker reports: `reports/t1037/{compose,edits,replay}.md` in this folder.

## Integration changes I made

- **Stable interface** (`draft/step.ts`): the fields `drafted?: "in" | AutomationStudioFlowDraftLeftOutReason` and
  `result?: true`, plus the two types. I wrote them before dispatch.
- **Of two reads of one list, the later one stays** (`compose/compose.ts`, `markRepeats`). The replay of run
  `mwveg5ls` kept read 56, whose fields were wrong, and dropped the corrected read 58 as a copy, because the
  second-copy rule keeps the first of two copies. For reads, the latest read of a list is the model's latest word,
  so it now stays and the earlier copies go. Presses are unchanged: the first copy still stays. A model-kept read
  still wins over the framework's later copy of it.
- **Presses after the result's last read that nothing lasting follows go out** (`compose/after-result.ts`, new;
  `compose/lasting.ts`, new: one test of "lasting" shared with `dead-end.ts`). In the replay of run `mwus396e`,
  two Next page presses came after the only read; now they go out as `dead_end`. A Flow with no result read is left
  alone. I adjusted one existing test so that it still tests only the detour rule.
- **A keep of a step the framework put in makes it the model's** (`amendment/apply.ts`, `pins`). Before this, it was
  refused `already_in_flow` and stayed the framework's, so a later compose could take out a step the model had said
  to keep. It is now applied and `drafted` is deleted. Tests are in `amendment/edits/tests/edits.test.ts`.

## Offline proof (after my changes, `test-runs/t1037/out.after-fix.txt`)

| Run | Model's Flow | Framework Flow | Left out (besides looks) | Judgement |
| --- | --- | --- | --- | --- |
| mwus396e | 5 | 3 | not_the_result 4; dead_end 17, 18, 19 (Next page after the only read) | Every act is in. The model's two Next page presses do nothing without its repeat edit, so they go out |
| mwuuo3zk | 5 | 8 | did_not_work 2; not_the_result 12; dead_end 36; repeat 68 | Every act is in, and it adds result read 31, which the model's Flow lacked. Filter 33 and Next page 35 come after 31 and stay in: their recorded page changes count as `changed`, so they count as lasting (see open question 1) |
| mwuxd2v9 | 7 | 8 | not_the_result 3 | Every act is in (store, add, cart). Whether read 46 holds cart rows is unknown from the recording |
| mwv5m906 | 6 | 6 | repeat 37 | Same Flow as the model's: 38 (the later read) stays, as the model chose |
| mwveg5ls | 12 | 18 | did_not_work 8, 33; not_the_result 3, 57; repeat 6, 56, 58, 59, 60 | Every act is in. The paging is unrolled (reads 10-16, Next page 11/13/15), which is the work the repeat edit is for. The result is the last read, 61. Neither Flow has the cart read the run needed |

Entry size per request (steps only, from `reports/t1037/replay.md`, measured before my rule changes): +3 to 4%
(every left-out line carries `out`, and looks are still listed). The whole entry, telling included, is 8 to 18%
smaller, but the telling is sent once in the head. The saving is in decisions: across the five runs, 44
`amend_draft` decisions (28 of them refused) and 31 `add: true` calls existed only to author the draft. Page tokens
are not this workstream's: W1 measures them.

## Where phase 2 hooks in (files and owners)

1. `runtime/llm/evidence-loop.ts` `draftRecord` and the rerun-replaced block (W1): append as `taken`, then compose
   over `draftSteps` in place of the `add` / second-copy / opener / reversal calls; `act` / `place` still claim.
   Set `draftEdits: "framework"` on the handler context and pass `authored: "framework"` to the draft entry.
2. `runtime/llm/decision-handlers/amendment.ts` (W3): compose again after an applied edit.
3. `runtime/llm/loop-configuration.ts` (no list): `draftAuthoring` gets a framework value, as the default.
4. `runtime/llm/evidence-loop-decision.ts` (no list; W2 may touch it for native tools): offer
   `AUTOMATION_STUDIO_FLOW_DRAFT_EDIT_SCHEMA`, and reword or drop the `add` flag.
5. `answer-first/completion/result-columns.ts` (W1): its words name `add: true` and `take`; they must name `result`.
6. The caller's `isAskedTable` comes from answer-first's asked columns (W1, plus t1034's asked-table list).
7. After the switch, delete the old 13-change grammar, the authored telling and the `taken`-until-added path, so no
   dead code remains.

## Commands run and observed results

This is the final run, after every edit. It ran on the heavy gate with `NODE_OPTIONS=--max-old-space-size=3072` for vitest.
- In Core `packages/fluxiq`: `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/flow-authoring/draft src/runtime/flow-authoring/bootstrap src/runtime/llm/decision-handlers src/runtime/llm/draft-amendment-feedback src/runtime/llm/evidence-loop src/runtime/llm/provider-task src/runtime/llm/tests src/runtime/automation-activity src/ui/activity-action` -> `Test Files 515 passed | 1 skipped (516)`, `Tests 5875 passed | 2 skipped (5877)`; the real-sql group gave `2 passed`, `12 passed`; exit 0. These folders cover every changed module and the folders that import them.
- Core `pnpm --filter fluxiq check` -> exit 0. The build cache reused a stamp for these exact inputs, and the run before it built them fresh: exit 0.
- Core `node scripts/structure-audit.mjs` -> `structure-audit: passed (572 warning(s), 903 baselined).`
- Downstream `node scripts/check/model-text.mjs` -> `model-text: ok (203 scenario tokens, 545 model-facing Core files, 14211 string literals)`.
- Downstream `node scripts/structure-audit.mjs` -> `structure-audit: passed (261 warning(s), 551 baselined).`
- Offline: in `test-runs/t1037`, `node --experimental-transform-types --no-warnings replay.mts judge` -> exit 0, `compose idempotent: true` on all five runs (`out.after-fix.txt`).
- The domain and extension checks were not run, because no downstream source changed.

## Not verified

- No loop run uses any of this yet (phase 2). The handler flag is tested against a stand-in context.
- The replay approximates state digests (by page address) and `reads` codes (by extract handle), and cannot recover
  `acts` claims or `isAskedTable`.
- A repeat that is applied and later taken off by revalidation leaves the read it pulled in still in the Flow
  (edits worker's note).
- No live, provider or Lab run, per the brief.

## Open questions for the lead

1. **There is no host signal for "lasting".** `changed` lines come from any change on the page that stayed, a filter's
   new list included, so the detour and after-result rules keep such steps. That errs toward keeping, which is safe.
   The true lasting signal is an act claim (`acts`), which phase 2 gets from the act checklist and judge.
2. **The entry still lists every look.** Numbering needs them today. W1's D10 (state, not transcripts) may let the
   framework draft drop them from the entry.

## Design (written before building)

### Today
- The loop appends every call as a draft step the moment it returns (`evidence-loop.ts`, `draftRecord`) with
  `disposition: "taken"`; it joins the Flow only by `add: true` on the call or an `amend_draft` `add` / `take`.
  `transcript` mode (`draftAuthoring`) keeps every step that ran. 13 amendment kinds; the audit counted 44
  `amend_draft` decisions, 28 of them refused `draft_unchanged`.
- The step already records every fact a drafting rule needs, as the host stated it on the call: `effect`,
  `effectApplied`, `proposes`, `resultCode`, `stateBefore`/`stateAfter` digests, `reads` (list code), `toggle`,
  `changed`, `acts`, `written`, `replacedBy`, `routing`.

### Inputs: which recorded facts say a call "worked"
A step is a candidate for the Flow when it is an action or a read that worked:
`automationStudioFlowDraftStepIsProposable(step)` (proposes, or mutate when the host said nothing; not
`effectApplied: false`; a written step counts) and no `replacedBy`. Everything else is out, with a reason:

| Reason | Rule (first that applies) |
| --- | --- |
| `replaced` | `replacedBy` set: a rerun stands in its place |
| `look` | not an action (`automationStudioFlowDraftStepIsAction` false): looks, searches, detections, describes |
| `did_not_work` | an action that is not proposable: failed, refused, or changed nothing |
| `undone` | a press a later press of the same control undid (host's `toggle`, the existing `reversal.ts` pairing rule) |
| `repeat` | copies a step already in the Flow (the existing `second-copy.ts` rule: same press from the same state, or a read of the same list with nothing changed between) |
| `dead_end` | inside a detour: from a step that left state S to the last later step that returned to S (`stateAfter === S`), with nothing lasting in between (no `changed`, `acts`, `toggle`, `written`, model-kept step or result read) |
| `not_the_result` | a read that is not one of the result's reads |

### The draft it produces
`automationStudioFlowDraftCompose({ steps, isAskedTable? })` (Core `runtime/flow-authoring/draft/compose/`), pure:
returns a copy of the steps, in run order (positions unchanged), where every step that is still the framework's
(`drafted` set, or `taken` with none) gets `drafted: "in"` + `disposition: "kept"`, or `drafted: <reason>` +
`disposition: "taken"`. A step the model ruled on (any other step: `kept` without `drafted`, `dropped`,
`exploratory`, seeded steps carried from a saved Flow) is never touched, so the model has the last word.
Result reads: a read the model marked `result: true` wins; otherwise the last read that worked, among those the
caller's `isAskedTable` accepts when it accepts any (the answer contract's asked columns live in answer-first, W1's),
and every other read of the same list (`reads` code) that is not a copy. Re-run after every append and every edit,
so a later, better read moves the result and an earlier pick goes back out.

New step fields (the stable interface, written by the sub-supervisor in `draft/step.ts`): `drafted?: "in" |
AutomationStudioFlowDraftLeftOutReason` and `result?: true`.

### The edits kept and dropped
Kept (6): `keep` (put back a step the framework left out, or as today; carries `act`, `place`), `drop` (takes in
`exploratory`), `result` (this read is the result), `repeat` and `unrepeat` (loops over repeated steps; a repeat
`over` a left-out read puts that read in), `bind` (parameters for typed values). Each model ruling deletes `drafted`.
Dropped from the framework grammar: `add` and `take` (every step that worked is already in; `keep` covers the
rest), `exploratory` (= `drop`), `reorder` (the draft is the run's order), `rerun` (make the call again: the failed
one is out by itself, the new one in), `optional`, `only_if`, `on_failed` (interruptions are already optional from
the host's word, `sometimes-present.ts`), and the keys `call`, `to`, `check`, `settings`. Any other change under
framework drafting is refused `not_an_edit`, telling the six edits. The old grammar stays selectable until phase 2
switches the loop over and deletes it, so nothing between the phases breaks the running loop.

### Guidance words
A new framework telling in `draft/entry.ts` (W3-owned, in no other list), and the reduced edit schema's
descriptions in `draft/amendment/` (W3-owned). Generic only. Each left-out line shows `out: <reason>`.

### Where it hooks into the evidence loop (phase 2, through W1's merged shape)
1. `runtime/llm/evidence-loop.ts` `draftRecord` (W1): append as `taken`, then compose over `draftSteps` in place of
   the `add`-flag, second-copy, opener and reversal calls; `add` on a call becomes a no-op, `act`/`place` still claim.
2. After rerun replacement (`evidence-loop.ts`, the rerun-replaced block) and after every applied edit
   (`decision-handlers/amendment.ts`, W3): compose again.
3. `runtime/llm/loop-configuration.ts` (no list): `draftAuthoring` gains the framework value, default.
4. `runtime/llm/evidence-loop-decision.ts` (no list; W2 may touch it for native tools): the `add` flag's words and
   the draft-edit schema chosen for the decision.
5. `answer-first/completion/result-columns.ts` (W1): its words name `add: true` and `take`; they must name `result`.
6. `runtime/llm/provider-task/draft-guide.ts` (W2) reads `AUTOMATION_STUDIO_FLOW_DRAFT_GUIDES`; a new telling is
   one more entry, no change there.

### Rules kept
Drafting runs nothing: no act is done twice and no permission gate is touched. `keep` of a landed step runs
nothing. Completion still needs one judged whole run from the start (untouched). Flows stay general: targets are
the resolved `ranWith`, and the telling asks for loops and bindings.

## Phase 2 (2026-11-25): the loop drafts the Flow

### Outcome

Phase 2 is done.
- **The loop drafts the Flow itself.** Framework drafting is the evidence loop's only mode. The model edits the draft
  with seven edits, `keep`, `drop`, `result`, `repeat`, `unrepeat`, `bind` and `rerun`, and the 13-edit grammar, the
  transcript mode and the authored telling are deleted.
- **The provider-free scripted bigbox run passed 4 of 4.** Attempt 1 explored. Attempts 2-4 ran the saved Flow, with
  1, 0 and 0 model calls, the same as t1036's run.
- **Checks:** the narrow checks pass, apart from one test that fails only under load and passes alone (listed below).

### Workers (phase 2)

| Worker | Tier | Brief | Outcome | What I checked myself |
| --- | --- | --- | --- | --- |
| `wiring` | worker-heavy | Wire the framework draft into the loop (your 9 items, 2 passes); then fix the 20 real-sql failures at their causes; then make the paging `repeat while/through` put in a left-out step | Done (`t1037/wiring.md`) | My own full group run after every worker had landed (below); the Lab run |
| `text` | worker | Your items 2-3: look wording and `EXTRACTION_FROM`; then `amend_draft add` and "detect the list" wording (2 passes) | Done (`t1037/text.md`) | model-text ok; the parity pin it moved (below) |
| `delete-grammar` | worker-heavy | Delete the 13-edit grammar, the transcript mode and stale words; migrate tests | Done (`t1037/delete-grammar.md`) | My full group run; the typecheck; both audits |
| `scripted-reorder` | worker | Remove `reorder` from the local-classifieds scripted model | Done (`t1037/scripted-reorder.md`) | The test-runner check, exit 0 |
| `carried-undeclared` | worker-heavy | t1043's test under framework drafting | Done (`t1037/carried-undeclared.md`) | I re-ran the test: it passes |
| `docs` | worker | Core `llm-flow-bootstrap.md` and the other docs pass | Done (`t1037/docs.md`) | Both audits pass |

That is more workers than phase 1's budget of three. The extra ones cover the items you added in phase 2.

### Integration changes I made in phase 2

- **Loop guidance restored** (Core `draft/entry.ts`, `FRAMEWORK_INSTRUCTION`). The framework telling now says how to
  loop: one act to every item of a list is read with a where, act on one kept row, then `repeat over` the read, and
  never act on items the read left out; a list that continues is `repeat while` the step that moves it on. The old
  tellings carried this, and it went when they were deleted.
- **Scripted models.** The professional-network scripted model and its 3 test assertions now send `change: "result"`
  where they sent `add` (`packages/test-runner/.../scripts/professional-network-accept-messaged-invitations.ts:110`).
- **Domain pin** (`domain/src/runtime/llm-evidence/script-examples/tests/parity.test.ts`). I re-pinned `format` from
  6154 to 6159 bytes, with a comment, because the text worker changed one generic Core sentence from "for looking" to
  "for reading the page". The completion-schema digest moved from 02c7667... to 4f2fce8...
- **carried-undeclared.** I tried and reverted my own rewrite of it, then sent it to a worker-heavy, which found the
  cause:
  - On dev, `add: true` put a press into the Flow with a parameter its node does not take (`target`), so attempt 2
    could not assemble it and repaired.
  - Under framework drafting, that press, which nobody asked for, is left out as `dead_end`. Attempt 2 then runs the
    saved Flow and never presses it again.
  - The test now covers both: the model keeps the press (attempt 2 repairs, Core's note is shown, the result is
    confirmed), and the default (attempt 2 runs the saved Flow).

### Scripted bigbox Lab run (provider-free)

Command: `FLUXIQ_LAB_INSTANCE=t1037-lab node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1037-lab -- pnpm lab attempt bigbox-retail --task bigbox-retail-rated-delivery-towels --authoring-mode answer-first --scripted-model --attempts 4`. It ran headed with the run watcher.
- Run: `run-mwwol1vu-1a8e7146`, folder `test-runs/instances/t1037-lab/attempts/run-mwwol1vu-1a8e7146`.
- Result: `{"status":"passed","answerVerdict":"right","ended":"achieved"}`, lab exit 0.
- Watcher: `{"lab":"watch","state":"finished","alerts":0}` (`test-runs/lab-watch/t1037-lab-21556/watch-alerts.ndjson`).

| Attempt | Verdict | Path | Continuation | Model calls | Time |
| --- | --- | --- | --- | --- | --- |
| 1 | right, achieved, 16 rows stored and shown | explore | (first) | 14: interpretation 1, judge 1, decisions 12 (t1036: 13) | 76 s |
| 2 | right, 16 rows | run_flow (same Flow id) | from 1, held, refused [] | 1: judge 1, decisions 0 | 17 s |
| 3 | right, 16 rows | run_flow | from 2, held, refused [] | 0 | 17 s |
| 4 | right, 16 rows | run_flow | from 3, held, refused [] | 0 | 19 s |

Attempt 1 made 12 browser calls for 9 steps (1.3x), with 0 repeated and 0 whole-Flow runs from step 1. Attempts 2-4
found none of the asked acts already done and changed nothing on the site.

**What `attempt-N/flow.png` shows.**
- I opened attempts 1 and 4 as images. Attempts 2 and 3 differ from attempt 1's SVG only in the title.
- All four show the framework's draft, saved as "Flow chart, attempt N (saved Flow)":
  - INPUT: the instruction, with the parameters Search (step 3) = "paper towels" and Sort by (step 6) = "rating_high";
  - 1 NAVIGATE;
  - 3 ACT: TYPE "paper towels" into Search;
  - 4 ACT: CLICK "Paper Towels (28)";
  - 5 ACT: CLICK "Delivery (21)";
  - 6 ACT: CHOOSE Sort by "rating_high";
  - a loop bracket, "repeats over name, price, rating and 2 more until nothing more", around 8 READ * RESULT (12 rows
    on page 1; first row Hearthside Select-A-Size Paper Towels, $14.47, 4.9) and 9 ACT: NEXT PAGE;
  - "2 other steps tried (looks, failed tries, dropped repeats) are not in the Flow";
  - OUTPUT: 16 rows, "Found 16 of 16".
- t1036's chart said "3 other steps". Here the consent and offer detours were dropped by the script's `drop` edits,
  and the paging press came in through the `repeat`.

### Offline replay, re-run on the final composer (`test-runs/t1037/out.phase2.txt`)

`node --experimental-transform-types --no-warnings replay.mts judge` gave exit 0, idempotent on all five runs.

| Run | Model's Flow | Framework's Flow | Left out, besides looks |
| --- | --- | --- | --- |
| mwus396e | 5 | 3 | not_the_result 1, dead_end 3 |
| mwuuo3zk | 5 | 9 | did_not_work 1, not_the_result 1, repeat 1 |
| mwuxd2v9 | 7 | 8 | not_the_result 1 |
| mwv5m906 | 6 | 6 | repeat 1 |
| mwveg5ls | 12 | 18 | did_not_work 2, not_the_result 2, repeat 5 |

Every act that landed is still in the framework's Flow on all five runs.

### Commands run and observed results (phase 2, mine)

- **Core libraries:** `pnpm --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build` (heavy gate), after the last Core source edit: exit 0.
- **Core tests:** `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql src/runtime/llm src/runtime/flow-authoring src/framework/automation-service src/runtime/adaptation src/server/fluxnode-api src/runtime/project-agents src/runtime/automation-activity src/ui src/runtime/result-verification`:
  - parallel: `Test Files 1 failed | 1635 passed | 1 skipped (1637)`, `Tests 1 failed | 14803 passed | 2 skipped`. The 1 is
    `project-build-offline-first` "the whole trial's offline-first port > is present on a candidate build, live without
    a recording, ..." (`expected kind live to match kept`). Run alone it passes (`8 passed`), and again in the re-run
    below. It is timing under load; no file of mine is in it.
  - real-sql: `Test Files 1 failed | 258 passed (259)`, `Tests 1 failed | 1628 passed`. The 1 was `carried-undeclared`,
    fixed since.
- **Re-run after those fixes:** `vitest-groups --groups=parallel,real-sql src/framework/automation-service/service/answer-first/witnesses .../project-build-offline-first.test.ts` -> `3 passed (25 tests)` and `1 passed (2 tests)`, exit 0. The `carried-undeclared` worker also ran the whole answer-first folder in both groups: 832 + 506 tests, all passed.
- **Core checks:** `pnpm --filter fluxiq check` -> exit 0; `node scripts/structure-audit.mjs` -> `passed (576 warning(s), 902 baselined)`.
- **Domain:**
  - `DOMAIN_TEST_BUILD_LABEL=t1037 node scripts/test-domain.mjs llm-evidence` -> first run `# tests 1823 # pass 1821 # fail 2` (the two parity pins above); after the re-pin `# tests 1823 # pass 1823 # fail 0`.
  - `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0.
- **Extension:** `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0. Extension tests were not run, because
  `apps/extension` did not change.
- **Test-runner:** `pnpm --filter @fluxiq-web-extension/test-runner check` -> exit 0.
- **Downstream:** `node scripts/structure-audit.mjs` -> `passed (264 warning(s), 550 baselined)`; `node scripts/check/model-text.mjs` -> `ok (203 scenario tokens, 570 model-facing Core files, 14315 string literals)`.
- **Docs worker:** Core `--rule docs-links` passed and `docs-reference --check` reported current.

### Not verified (phase 2)

- No live or provider run, as the brief says.
- `packages/test-runner` full tests: the scripted-reorder worker saw 34 failures, in week1 smoke, launcher/readiness,
  oracle, W17 upload and the reset helper. None is in scripted-model, and none was compared with a clean dev tree.
  Your t1047 merge brought new demo-llm launcher tests, which may account for some of them.
- The professional-network and local-classifieds scripted Lab runs were not run, only their unit tests.

### Answers and open questions for the lead

1. **t1044's two findings: neither is fixed by this work, so t1047 should take both.**
   - `result-feed/feed.ts` `working` is still a count only.
   - `decision-context/current-view.ts` still groups every read under one `holder:read`.
   - What t1037 changed: answer-first now treats every read not marked intermediate as a result read
     (`draft.resultRead`), and two reads of one list with nothing between them become one step in the Flow, the later
     one. Rows still come from every read that ran. Neither change touches what the judge or the decider is shown of a
     working read's rows.
2. **There is no host signal for "lasting".** It matters more now:
   - `after-result.ts` leaves out a press after the result's last read that shows no change on the page, no act claim
     and no declared consequence. That is how carried-undeclared's renewal press, which nobody asked for, went out.
   - An asked act that lands that way, unclaimed and with no visible change, would also be left out. In live use the
     act checklist marks it lasting through its claim, and the model can `keep` it back.
3. **The judge is not shown a carried act on a run_flow attempt** (summary acts `[]`). This predates t1037; it is the
   judge-evidence owner's question.
4. **Pre-existing, noted by the delete worker:**
   - `route.ts`: a `repeat` whose `over` names a step that does not exist quietly uses the step before it.
   - `settings` on an amendment is still parsed, though no edit offers it.
