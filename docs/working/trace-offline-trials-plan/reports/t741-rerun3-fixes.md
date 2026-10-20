# Report: t741-rerun3-fixes (lane lead)

Trees: downstream `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQWebExtension`, Core
`C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ`, both on `task/t741-rerun3-fixes` (downstream
`9d11e9e1`, Core `b1f4301c`; both already contain t740). No commits, merges or pushes.

## Outcome

Done. All four units landed, and the lead verified each one: tests beside every change, the prompt
contract tests, Core/domain/extension typechecks against the rebuilt Core, both structure audits,
the six existing site-reset browser specs, and a new browser spec for office round 3's reset shape.
That spec passes on the final build and fails when A1 is switched off. Nothing was run live or
paid; the supervisor reruns live. No commits, merges or pushes.

What each round-3 run would now meet:

- **Office.** A plan port named `item` is refused at plan time (`project.plan_port_name`), so its
  subflow stays buildable. Trial and entry-preparation acts that sit in no list (act-12/15/18) are
  settled by Core's own pre-trial look: no model turn, and the judge is told they were left. A
  settling look says what it settled and lists every open act across the build. Refusals list
  build-wide open acts and issued refs. A ref named without `undoes` gets a note with an example.
  The ending is not cut mid-word.
- **Job.** A press whose first attempt was rate-limited is reported as `page_busy_try_later`, with
  the site's wait and the tab return; Core's repeat guard already exempts that code. A zero-match
  `find_on_page` names the page's wordless icon controls. The ending is said once and keeps "I".
- **Social.** A control that left the page because exploration pressed it is no longer marked
  "renumbered by reload" (marked only when `timeOrigin` changes). `incomplete_text` names the sent
  field, and its hint places the full read after the repeat. The judge prose says a list running on
  past its own end marker is not rows missing from the task's range. A judge's advice the builder
  was already given (in this brief or an earlier brief of the subflow) is replaced by a note saying
  what the trial after it answered. The no-progress note no longer recommends a revision whose trial
  failed.
- **Photo.** The script format teaches `extractList.sort` (a generic invoice example), and a
  process sort or limit on a listing whose repeat makes a lasting act is refused. The candidate
  wrap-up runs undo calls the trial demands. The supervisor's `recordingExcerpt` reaches the
  builder. Scoped `unchanged_submission` refusals name revisions and digests the trial gate accepts.
  The ending no longer claims "the site offers no way to undo it" for an act whose undo was refused.

## Plan (2026-10-20)

Sources: the four rerun-round-3 debug notes (office `run-mvgo5xft-25460ba2`, job
`run-mvgo9wzn-fad4e050`, social `run-mvgoawg4-ed85dd5a`, photo `run-mvgobp8h-b99ede98`).

Design decision for Unit A's structural part (A1). Every trial and every entry preparation that
re-runs a predecessor mints a new act that sits in no list (office: act-12, act-15, act-18, each
"confirm the office address", `modify_existing`). Today each needs its own model look under `undoes`
naming any issued list, and any list settles it. So the model's look adds nothing Core cannot do:
a trial act with no witness of its own adopts the build's issued destinations as its witnesses, and
Core's own pre-trial look (`beforeTrial`, `checks.lookAt`) settles it `unchanged` when they all hold.
`unchanged` is sticky and is listed in every later trial's `startedWith.cannotUndo`, so the judge is
told what was left. An adopted list that differs never asks the model to undo the act there (another
act may have changed it); the act stays open with today's words. Explored acts are unaffected (the
t738 witness rule covers them). This is no weaker than today's rule (any list settles) and removes
one model turn per act per brief.

Machine: 8 logical CPUs, about 3.9 GB available of 12 GB. Workers run only the tests beside their
change; the lead runs typechecks, audits and contract tests serially between waves. Core's dist was
checked current before any edit (`node ../scripts/check/core-build.mjs`: "current with its source"),
so domain workers test against it without rebuilding Core.

Work split by file (R = Core `packages/fluxiq/src/programs/automation-studio/runtime/`, L =
downstream `domain/src/runtime/llm-evidence/`):

| Wave | Worker | Unit | Owns |
| --- | --- | --- | --- |
| 1 | a-settle (high) | A1 | R `site-reset/{ledger,project-ledger,settlement-*,trial-policy,contracts,start-check,act-places,index}.ts`, `service/candidate-trial/landed-acts.ts`, `service/project-build/entry-preparation.ts` |
| 1 | a-receipts (high) | A2-A4 | R `service/project-build/{reset-calls,brief-ports}.ts`, `project-agents/dispatch/reset-loop.ts`, `site-reset/{create-baselines,reset-witness,words,undoes-tool,project-reset}.ts`, the look-answer composer |
| 1 | a5-wrapup | A5 | R `llm/loop-budget.ts`, `llm/evidence-loop.ts` |
| 1 | b1-port-name | B1 | R `project-agents/supervisor/{plan-input,guidance}.ts`, `script-statements/called-parts.ts` |
| 1 | b2-sort (high) | B2 | R `flow-bootstrap/plan/{flow-script-format,validation}.ts`, `script-statements/` parser (not called-parts) |
| 1 | b3-excerpt | B3 | R `project-agents/dispatch/run-brief.ts` |
| 1 | b4-numbering (high) | B4 | R `subflow-candidate/{submission-numbering,scoped-submission}.ts` |
| 1 | c1-retry | C | L `node-run/retries/dispatch.ts`, extension `runtime/click-landing.ts` |
| 1 | c2-reload-mark | C | L `plan-resolution/target-packets.ts` |
| 1 | c3-incomplete-text | C | L `action-failure/refusal.ts`, `rejection-next/next-sentence.ts` |
| 2 | b5-endings | B5 | R `activity/wording/{left-told,ended-reason,reason-text}.ts`, `project-agents/dispatch/reset-done.ts`, `supervisor/left-on-target.ts`, `conversations/commands/progress.ts`, `service/project-build/run.ts` |
| 2 | c4-icons-sort | C | L `page-find/search.ts`, extension `content/extraction/order-rows.ts` |
| 2 | d-judge (high) | D | R `result-verification/read-account/list-continues.ts`, judge prose, `system-prompt-pins.json`, `service/candidate-trial/feedback.ts` |
| 3 | e2e-reset | A | provider-free installed-gateway reproduction of the reset shapes |

## Shared worker rules

- Trees: downstream `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQWebExtension`, Core
  `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ`. Never edit any other tree. No commits, merges,
  pushes or branch switches.
- Edit only the files in your Owns list, new files in the directories it names, and their `tests/`.
  Other workers edit the rest of both trees at the same time: never revert, reformat or "fix" a file
  you do not own. If your work needs a change in a file you do not own, stop and say so in your
  report.
- Tests first: a failing test beside the subject (`a/b.ts` is tested in `a/tests/b.test.ts`), then
  the fix.
- Narrow checks only. Core: `cd C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ/packages/fluxiq &&
  pnpm exec vitest run <test files>`. Domain: `cd .../!FluxIQWebExtension/domain &&
  DOMAIN_TEST_BUILD_LABEL=t741-<label> node scripts/test-domain.mjs <path fragments>`. Extension:
  `cd .../!FluxIQWebExtension/apps/extension && EXTENSION_TEST_BUILD_LABEL=t741-<label> node
  scripts/test-extension.mjs <path fragments>`. Never run typechecks, builds, `pnpm test`,
  `pnpm check`, `core-build.mjs`, a whole-package vitest run, or anything that rebuilds Core: the lead
  runs those serially (the machine's 12 GB is shared with other lanes).
- Core structure: one exported thing per file, a barrel in every directory (export a new file from
  its directory's `index.ts`), the budgets in Core `docs/architecture/code-structure.md`; never
  extract-and-drop. A test opening a real SQLite database carries `// @fluxiq-test-group real-sql`.
- Model-facing text is generic: never a realistic scenario's site, product, task, names or answer
  (no stores, carts, addresses, job boards, saves, hearts, photos, likes, feeds, posts). Examples use
  another kind of site with the same structure (a library catalogue, an invoice list, a recipe site).
- Only d-judge edits `R/llm/deepseek/tests/system-prompt-pins.json`; only b2-sort edits
  `R/flow-bootstrap/plan/tests/{issue-feedback,extraction-vocabulary}.test.ts`. If your change moves
  another worker's pin or contract test, stop and report it.
- Never put tokens, keys, recorded page data or typed values in tests or reports.
- Report to `docs/working/trace-offline-trials-plan/reports/t741-<label>.md` in the downstream tree:
  what changed and why, each test command with its observed output, what was not verified.

## Worker briefs

### Brief: a-settle
- Repository: FluxIQ Core (worker-high).
- Task (A1, structural): Core settles trial and entry-preparation acts that sit in no list itself.
  An act with no witness (settlement reason `name`: "nothing read shows where its effect would be ...
  name that list's ref as resetDestination on a look that names this act under undoes") needs one
  model look per act, and every trial and entry preparation mints a new one (office act-12/15/18).
  Make a trial act (one with no exploration call: a trial step's or an entry preparation's act) that
  has no witness of its own adopt the build's issued destinations (`createBaselines.issuedRefs()` and
  `named()`; do not edit create-baselines.ts) as its witnesses, so Core's own pre-trial look
  (`beforeTrial` with `checks.lookAt` on stale witnesses) settles it `unchanged` when every adopted
  list holds, sticky and listed in later trials' `startedWith.cannotUndo` exactly as today's
  `unchanged`. An adopted list that differs must never yield "undo this act there": keep the act open
  with its `name` words. Explored acts behave as today. With no issued ref, keep the "cannot be
  settled in this build" words. Update the ledger header to record the rule and why (office r3).
- Evidence: office note `C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-mvgo5xft-25460ba2.md`,
  sections "Why act-18 was left" and "Proposed fix" 4(a); steps 0048, 0053, 0070, 0105-0117 under
  `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgo5xft-25460ba2/steps`.
- Required reads: Shared worker rules above; R `flow-bootstrap/site-reset/ledger.ts` (header and
  `explored`, `trialRan`, `beforeTrial`, `named`, `inPlace`), `settlement-decision.ts`,
  `settlement-words.ts`, `settlement-trial-repeat.ts`, `trial-policy.ts`, `project-ledger.ts`;
  `service/project-build/entry-preparation.ts`.
- Owns: R `flow-bootstrap/site-reset/{ledger,project-ledger,settlement-*,trial-policy,contracts,start-check,act-places,index}.ts`,
  new files in `site-reset/`, `service/candidate-trial/landed-acts.ts`,
  `service/project-build/entry-preparation.ts`, and the tests of those subjects
  (`site-reset/tests/{ledger*,settlement-*,project-ledger*,trial-policy,start-check*,act-places}.test.ts`,
  `service/project-build/tests/project-build-{entry-preparation,trial-reset}.test.ts`).
- Must not touch: `site-reset/{create-baselines,reset-witness,words,undoes-tool,project-reset}.ts`,
  `service/project-build/{reset-calls,brief-ports}.ts`, `llm/`, `project-agents/` (other workers).
- Definition of done: tests showing (1) a trial act with no witness settles `unchanged` by Core's own
  pre-trial look with no model call under `undoes`, and is in `startedWith.cannotUndo`; (2) three
  entry-preparation repeats across three briefs of a project build all settle so the next judged
  trial is admitted; (3) a differing adopted list leaves it open and never asks to undo it there;
  (4) no issued ref keeps today's words; (5) explored acts unchanged; every existing test in
  `site-reset/tests/` and `service/project-build/tests/project-build-*reset*` and
  `-entry-preparation` passes (list the files run and the counts).
- Report to: `reports/t741-a-settle.md`.

### Brief: a-receipts
- Repository: FluxIQ Core (worker-high).
- Task (A2-A4): tell the model what a settling look did and list the whole build's open acts.
  1. A look under `undoes` answers whether it settled its act (`settled: "act-N"`, or still open
     with its `settle`) and every act still open across the build (the union
     `service/project-build/brief-ports.ts` `openActs` builds), each with its `settle`. Find where a
     look's answer gets `resetDestinations` and add it there.
  2. `candidate.undo_act_kept`, `undo_unknown_act` and `undo_already_done` in a project build carry
     the build-wide open acts. Cause: `reset-calls.ts` `claim` routes to `owner(undoes)`, whose
     ledger fills `actsToUndo` from its own `inPlace()` (office 0110: `actsToUndo: []` with act-15
     and act-18 open). Fix it in the routing, not in `ledger.ts`.
  3. `project.reset_acts_in_place` (`project-agents/dispatch/reset-loop.ts`) lists each open act with
     its `settle` and the issued refs; `candidate.reset_witness_required` (`create-baselines.ts`,
     `words.ts` `witnessRequired`) names the refs already issued when there are any; the
     `resetDestination` description in `undoes-tool.ts` covers any reversible press made before the
     seal with no other witness, not only `create_new`.
  4. A call naming `resetDestination` with no `undoes` while acts are open gets a note: it settled
     nothing, the open acts, and one example `"undoes": "<act>", "resetDestination": "<ref>"` built
     from a real open act and an issued ref.
- Evidence: office note (path in a-settle's brief) sections "What went wrong in brief-4/brief-5" and
  "Proposed fix" 2-3, steps 0108-0119 and 0125-0139; job note
  `C:/Users/osrs_/FluxStuff/fxwork/t719/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-mvgo9wzn-fad4e050.md`,
  "t738's rule" and "Small, Core" fix.
- Required reads: Shared worker rules; the Owns files; `site-reset/ledger.ts` `claim`/`explored`
  (read only).
- Owns: R `service/project-build/{reset-calls,brief-ports}.ts`, `project-agents/dispatch/reset-loop.ts`,
  `flow-bootstrap/site-reset/{create-baselines,reset-witness,words,undoes-tool,project-reset}.ts`,
  the one file that composes a look's answer (name it in your report; it must not be in a-settle's,
  a5-wrapup's or b-workers' lists), new files in `service/project-build/`, and the tests beside each
  (`service/project-build/tests/{reset-calls,project-build-reset,project-build-reset-settle,project-build-brief-ports}.test.ts`,
  `site-reset/tests/{create-baselines,reset-witness,words,undoes-tool,project-reset}.test.ts`,
  `project-agents/dispatch/tests/` for reset-loop).
- Must not touch: `site-reset/{ledger,project-ledger,settlement-*,trial-policy,contracts,start-check,act-places,index}.ts`
  (a-settle; put new files in `service/project-build/`), `llm/` (a5-wrapup), `run-brief.ts`.
- Definition of done: a two-brief project-build test (settle brief A's act from brief C while brief
  B's act is open: the answer names A settled and B open; a repeat's `actsToUndo` is not empty); the
  no-`undoes` note test; reset-loop and witness words naming issued refs; the tool description test;
  every existing test in the files above passes (list files and counts).
- Report to: `reports/t741-a-receipts.md`.

### Brief: a5-wrapup
- Repository: FluxIQ Core (worker).
- Task (A5): R `llm/loop-budget.ts` `automationStudioLlmEvidenceLoopWrapUp().withholds(toolId)`,
  applied at `llm/evidence-loop.ts` (around line 757), withholds every `core.run_node` in a
  candidate's wrap-up, including the undo calls `core.test_subflow` (a finishing tool) demands before
  it will run, so finishing is impossible (photo 0150-0158: undo navigations refused
  `llm_evidence_loop.not_offered`, the trial refused `trial_reset_required` again, revision 8 never
  tried). Make `withholds` judge the call (tool id and input): a `core.run_node` whose input names an
  act under `undoes` (a string `act-N`) runs; an exploring `core.run_node` without `undoes` is still
  withheld. Where the wrap-up tells the model what still runs ("only core.submit_subflow,
  core.test_subflow and completing run now"), add that a call undoing a named act under `undoes`
  still runs (generic words).
- Evidence: photo note `C:/Users/osrs_/FluxStuff/fxwork/t567/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-mvgobp8h-b99ede98.md`,
  contributor 1 and fix 2; steps 0150-0158 under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgobp8h-b99ede98/steps`.
- Required reads: Shared worker rules; `llm/loop-budget.ts`; `llm/evidence-loop.ts` around the
  `withholds` call; the existing loop-budget tests in `llm/tests/`.
- Owns: R `llm/loop-budget.ts`, `llm/evidence-loop.ts` (the withheld check and the wrap-up words
  only), and the loop-budget / wrap-up tests in `llm/tests/`.
- Must not touch: anything else; if the wrap-up words sit in a pinned prompt
  (`llm/deepseek/tests/system-prompt-pins.json`), stop and report instead.
- Definition of done: tests: in a candidate wrap-up an exploring `core.run_node` is still answered
  `not_offered`; one naming `act-N` under `undoes` runs; a non-candidate wrap-up is unchanged; the
  existing `llm/tests/` loop-budget and evidence-loop wrap-up tests pass (list files and counts).
- Report to: `reports/t741-a5-wrapup.md`.

### Brief: b1-port-name
- Repository: FluxIQ Core (worker).
- Task (B1): one port-name rule for plan and script. R `project-agents/supervisor/plan-input.ts`
  `ports()` checks only `PORT_NAME` (`/^[a-z][A-Za-z0-9]{0,31}$/u`), so `item` passes;
  `flow-bootstrap/script-statements/called-parts.ts` `partOf()` refuses `name === ROW_NAME` (`item`,
  a loop row's name); the subflow scope check demands the plan's names, so a plan naming a port
  `item` is unbuildable (office 0057-0067, two briefs lost). Make one exported predicate in its own
  file in `script-statements/` (exported from that directory's barrel), used by both `ports()` and
  `partOf()`, applied to inputs and outputs alike as the script applies it. `ports()` refuses `item`
  with `project.plan_port_name` at the port's path (for example `subflows.0.outputs.0`). Add "and
  never `item`, the name a loop's row takes" to the `project.plan_port_name` words in
  `supervisor/guidance.ts`. Keep the script's reservation.
- Evidence: office note (path in a-settle's brief), "First divergent step" and "Proposed fix" 1.
- Required reads: Shared worker rules; the Owns files; their existing tests.
- Owns: R `project-agents/supervisor/plan-input.ts`, `project-agents/supervisor/guidance.ts` (the
  `plan_port_name` words only), `flow-bootstrap/script-statements/called-parts.ts`, the new predicate
  file and its barrel line, `supervisor/tests/plan-input.test.ts`, guidance tests, and
  `script-statements/tests/` for called-parts and the predicate.
- Must not touch: other `script-statements/` files (b2-sort), `plan/` (b2-sort), `dispatch/`.
- Definition of done: tests: outputs `["item"]` refused at `subflows.0.outputs.0` with
  `project.plan_port_name`; a parity test (every name the plan accepts, `partOf` accepts, over
  `item`, `items`, `itemName`, `row`, `total`); the guidance words; existing tests of the touched
  files pass (list files and counts).
- Report to: `reports/t741-b1-port-name.md`.

### Brief: b2-sort
- Repository: FluxIQ Core (worker-high).
- Task (B2): (1) In R `flow-bootstrap/plan/flow-script-format.ts`, beside the `extractList.where`
  line (around lines 396-408), name `extractList.sort` with the exact shape the domain accepts (read
  downstream `domain/src/runtime/llm-evidence/plan-resolution/extraction/slot.ts` `LIST_KEYS` and
  `domain/src/actions/extraction/order-request.ts`, read only), and say that a `repeat over` visits
  the listing's rows in that order, so `repeat most: N` acts on the first N of it. One generic
  example on another kind of site (for example "pay the two oldest unpaid invoices"). (2) Prove by a
  test that the script parser carries `extractList.sort` into the step's parameters as it carries
  `extractList.where`; fix the parser if it does not. (3) Refuse once at submission, with a precise
  issue placed on the listing step, a Flow where a listing step's `recordOutput.process` carries
  `sort` or `limit` and a `repeat over` that listing has a step in its span declaring a lasting class
  (`create_new`, `modify_existing`, `delete`): the repeat visits the listing's own order; ordering
  or narrowing the rows it visits goes on `extractList.sort` / `extractList.where`; a process sort
  only shapes the saved table. A process sort whose repeat makes no lasting act stays allowed.
- Evidence: photo note (path in a5-wrapup's brief), "Where it went wrong" item 4, fix 1 and "Next
  likely failure"; steps 0249, 0272, 0284.
- Required reads: Shared worker rules; `flow-script-format.ts`; `plan/validation.ts`; the parser
  files that read `extractList.where`.
- Owns: R `flow-bootstrap/plan/{flow-script-format,validation}.ts` (or the one submission check you
  choose; name it, and not in `subflow-candidate/`), new files in `plan/`, `plan/tests/` (including
  the pinned `issue-feedback.test.ts` and `extraction-vocabulary.test.ts` if your text moves them),
  parser files under `flow-bootstrap/script-statements/` except `called-parts.ts`, and their tests.
- Must not touch: `script-statements/called-parts.ts` (b1), `system-prompt-pins.json` (if it moves,
  report), `subflow-candidate/`, `site-reset/`.
- Definition of done: tests: the format sentence present and free of realistic-scenario words; the
  parser carries `extractList.sort`; the refusal fires for process sort/limit + lasting repeat, and
  not for `extractList.sort` or for a repeat with no lasting act; run and report the contract tests
  `llm/deepseek/tests/system-prompt.test.ts`, `plan/tests/extraction-vocabulary.test.ts`,
  `plan/tests/issue-feedback.test.ts`, plus existing tests of touched files.
- Report to: `reports/t741-b2-sort.md`.

### Brief: b3-excerpt
- Repository: FluxIQ Core (worker).
- Task (B3): the supervisor's `recordingExcerpt` never reaches the builder. It is read by
  R `project-agents/contracts/subflow-brief.ts` (around line 304) and counted in
  `supervisor/dispatch-tool.ts` `sentKey`, but `project-agents/dispatch/run-brief.ts` reads no
  excerpt (photo 0394 carries one; 0397 `request.txt` has none). Put `brief.recordingExcerpt` into
  the builder's opening words, framed as the supervisor's notes from the person's recording (data to
  weigh, not instructions), beside where `repairOf`'s `said` goes. A brief with no excerpt yields
  opening words byte-identical to today.
- Evidence: photo note (path in a5-wrapup's brief), contributor 2 and fix 3.
- Required reads: Shared worker rules; `run-brief.ts`; `contracts/subflow-brief.ts` (read only).
- Owns: R `project-agents/dispatch/run-brief.ts` and its tests in `project-agents/dispatch/tests/`.
- Must not touch: anything else (`reset-loop.ts` is a-receipts', `reset-done.ts` b5's).
- Definition of done: tests: a brief with an excerpt yields a builder request containing it, framed
  as notes; one without is unchanged; existing run-brief tests pass (list files and counts).
- Report to: `reports/t741-b3-excerpt.md`.

### Brief: b4-numbering
- Repository: FluxIQ Core (worker-high).
- Task (B4): scoped `unchanged_submission` refusals must name revisions and digests the trial gate
  accepts, and the numbering must stay stable. R `flow-bootstrap/subflow-candidate/submission-numbering.ts`
  moves a refusal's revisions by the brief's offset but leaves its `digest`, which is the inner probe
  candidate's, not the subflow proposal's that `scoped-submission.ts` `proposalOf` / `matches()`
  compares; and `proposalOf` answers a cached older proposal when the inner controller re-accepts an
  earlier plan, so the inner numbering runs ahead (photo 0375 "revision 12"; 0381 "revision 14",
  never issued; 0379 and 0385 `subflow.trial_stale_revision`, latest 12). Map every revision/digest
  pair a refusal names (`revision`/`digest`, `standingRevision`, any other) to the receipt the trial
  gate matches, and answer a re-accepted earlier plan with its existing revision, never a number the
  brief never issued. Also check social steps 0155 and 0166-0169 (a resubmit accepted as revision 5,
  then called stale; `core.no_progress` recommending a revision whose trial had failed) and fix them
  if the cause is in your files; otherwise report where it is.
- Evidence: photo note (path in a5-wrapup's brief), contributor 4 and fix 4, steps 0332-0385; social
  note `C:/Users/osrs_/FluxStuff/fxwork/t566/!FluxIQWebExtension/docs/working/language-driven-flow-loop-plan/debugs/run-mvgoawg4-ed85dd5a.md`
  fix 5, steps under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgoawg4-ed85dd5a/steps`.
- Required reads: Shared worker rules; the Owns files and their tests.
- Owns: R `flow-bootstrap/subflow-candidate/{submission-numbering,scoped-submission}.ts`, new files
  in `subflow-candidate/`, and their tests in `subflow-candidate/tests/`.
- Must not touch: `subflow-candidate/builder-loop.ts` (d-judge), `llm/`, `candidate/`.
- Definition of done: a test that submits A, then B, then A, then A again: every revision/digest the
  answers name is accepted by `matches()` or is the standing latest, and a re-submitted earlier plan
  answers its own revision; existing tests of both files pass (list files and counts).
- Report to: `reports/t741-b4-numbering.md`.

### Brief: c1-retry
- Repository: this repository (worker).
- Task (C): a press whose first attempt the site rate-limited is reported by its last attempt's
  failure. L `node-run/retries/dispatch.ts` `webNodeDispatchWithRetries` returns Core's
  `automationStudioDispatchWithNodeRetries` `outcome.result`, the last attempt's answer. On job 0116
  attempt 1 landed on a 429 page (the extension's `RATE_LIMITED` landing, which takes the tab back:
  `apps/extension/src/runtime/click-landing.ts`), and attempts 2-4 failed because the option inside a
  menu was no longer shown, so the model got `target_not_actionable` and Core's repeat guard (which
  exempts retry-later outcomes, Core `llm/repeat-guard/retry-later.ts`, read only) refused the
  correct retry three times. When an earlier attempt failed because the site refused for now (the
  failure the domain maps to `page_busy_try_later`) and later attempts failed only because the target
  was no longer shown or actionable, answer that earlier failure, with its retry-after and the fact
  the tab was taken back, and `attempts` the total. All attempts `TARGET_NOT_SHOWN` stays as today.
  If the extension's `RATE_LIMITED` failure carries no retry-after, add it in `click-landing.ts`.
- Evidence: job note (path in a-receipts' brief), "The failed call at 0116" and the "Decisive" fix;
  steps 0114-0124 under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-20/run-mvgo9wzn-fad4e050/steps`.
- Required reads: Shared worker rules; `dispatch.ts` and `retries/tests/dispatch.test.ts`; how the
  domain maps `RATE_LIMITED` to `page_busy_try_later` (find it).
- Owns: L `node-run/retries/dispatch.ts`, new files in `node-run/retries/`, `node-run/retries/tests/`;
  `apps/extension/src/runtime/click-landing.ts` and its tests, only if needed.
- Must not touch: other domain files (c2, c3, c4 work beside you); any Core file.
- Definition of done: tests with a fake gateway on a generic page (a library catalogue's filter
  link): attempt 1 `RATE_LIMITED` (retry-after 5 s, tab returned), attempts 2-4 `TARGET_NOT_SHOWN`;
  the answer is the rate-limited one, reaches the model as `page_busy_try_later`, `attempts` is 4,
  the retry-after is said; all-`TARGET_NOT_SHOWN` is unchanged; `node-run/retries/tests` passes.
- Report to: `reports/t741-c1-retry.md`.

### Brief: c2-reload-mark
- Repository: this repository (worker).
- Task (C): L `plan-resolution/target-packets.ts` `markRenumbered()` marks every handle a new view
  dropped as renumbered whenever the view's `navigation.type` is `reload` and another control has the
  same tag and words. `navigation.type` stays `reload` for the document's whole life, so a control
  that left the page because exploration pressed it (an expanding "Read more") is marked, and
  `resolveFromHistory()` refuses it before the view-history / acted-identity fallback (social
  0137-0165: `web.handle.renumbered_by_reload` on the pressed control, no reload happened). Mark only
  when the view is the first view of a new document: its `navigation.timeOrigin` differs from the
  previous view's of that page (keep it per page beside `flow.renumbered`). Where `timeOrigin` is
  absent on either view, keep today's behaviour. Check that the extension's page evidence actually
  fills `navigation.timeOrigin` (domain `page-evidence.ts` carries it); if it does not, add it in the
  extension file that fills `navigation` and name that file in your report.
- Evidence: social note (path in b4-numbering's brief), "The decisive point" and fix 1.
- Required reads: Shared worker rules; `target-packets.ts`; `plan-resolution/tests/target-packets*.test.ts`.
- Owns: L `plan-resolution/target-packets.ts`, new files in `plan-resolution/`, its tests; the one
  extension file that fills `navigation`, only if `timeOrigin` is missing there.
- Must not touch: other domain files; any Core file.
- Definition of done: tests on a generic review list: two views of one reloaded document with the
  same `timeOrigin`, a "Read more" pressed in the first and gone from the second while another "Read
  more" shows: the dropped handle is not `renumberedByReload` and `view_history` resolution returns
  the acted identity; a view with a new `timeOrigin` still marks; absent `timeOrigin` behaves as
  today; `plan-resolution/tests` passes.
- Report to: `reports/t741-c2-reload-mark.md`.

### Brief: c3-incomplete-text
- Repository: this repository (worker).
- Task (C): (1) L `action-failure/refusal.ts` (around lines 159-163) turns the client's
  `incomplete_text: field <name> ...` marker into `{reason: "incomplete_text", next:
  INCOMPLETE_TEXT_NEXT}` and drops the field on purpose, so builders re-sent the same field
  repeatedly (social 0029, 0056, 0083, 0186, 0241). Name the field key (in `missing` and in the
  sentence) only when it is one of the keys of the `extractList.fields` the domain sent (the
  request's own parameters), the way t738 names bad scroll keys from the request; never echo a key
  that was not sent. (2) L `rejection-next/next-sentence.ts` `INCOMPLETE_TEXT_NEXT` ends "Then read
  the full text."; replace that end with generic words that place the read: after that repeat, not
  inside it and with no only-after, read the same listing again with the text field, because by
  then every row is disclosed; with a known key, name it ("without the field `<key>`").
- Evidence: social note (path in b4-numbering's brief), "Why the other briefs never wrote the loop"
  and fixes 2-3.
- Required reads: Shared worker rules; both files and their tests.
- Owns: L `action-failure/refusal.ts`, `rejection-next/next-sentence.ts`,
  `action-failure/tests/refusal.test.ts`, `rejection-next/tests/next-sentence.test.ts`.
- Must not touch: other domain files; any Core file.
- Definition of done: tests: a sent key is named; an unsent key in the marker is never echoed; the
  sentence says "after that repeat" and has no "only after" instruction to tie the read; existing
  tests in both test folders pass.
- Report to: `reports/t741-c3-incomplete-text.md`.

### Wave 2 notes for every worker

Directories already at the 25-file budget (add no file there; merge into an existing test file or
pick another owning directory): Core `site-reset/`, `service/project-build/`, `plan/`,
`plan/tests/`, `llm/harness-options/tests/`, `subflow-candidate/tests/`; domain
`plan-resolution/tests/`. Check a directory's count before adding a file.

### Brief: b5-endings
- Repository: FluxIQ Core (worker).
- Task (B5, endings tell the truth): (1) Photo's ending says a reversible act the build named under
  `cannotUndo` remains "(the site offers no way to undo it)". That is false: those acts (trial acts
  whose undos were refused `undo_wrong_target`) were reversible, and later reads showed the control
  back. The words live in R `activity/wording/left-told.ts` (`kept`), `project-agents/dispatch/reset-done.ts`
  (`kept`) and `project-agents/supervisor/left-on-target.ts` (around line 78). Say only what is known:
  the build could not undo it and it may still be on the site; keep "the site offers no way to undo
  it" only for acts recorded as not undoable through the site (a class such as `move_money` or
  `send_or_publish`, `undoable: false`). Find how the act record tells the two apart.
  (2) Job's ending says its sentence twice ("FluxIQ could not finish the Flow. -- I could not finish
  ..." and then "The build failed: FluxIQ could not finish the Flow: i could not finish ..."), and
  `lowerFirst` in `conversations/commands/progress.ts` lower-cases the pronoun "I". Office's final
  chat line was cut mid-word ("... The part that takes t."). Trace the `endedBecause` path
  (`service/project-build/run.ts` `toldEnding`/`endedSaid`, `activity/wording/ended-reason.ts`,
  `reason-text.ts`, `progress.ts` `supervisorEndingWords`): say it once, never lower-case "I" or a
  word in capitals, and never cut mid-word (cut at a sentence or word end with an ellipsis if a limit
  is needed).
- Evidence: the "Chat and UI" sections of the photo note (path in a5-wrapup's brief), the job note
  (path in a-receipts' brief) and the office note (path in a-settle's brief).
- Owns: the files named above, other files on the ending path in `activity/wording/` or
  `conversations/commands/`, and their tests.
- Must not touch: `site-reset/`, `project-agents/dispatch/{reset-loop,run-brief}.ts`,
  `service/project-build/{reset-calls,brief-ports}.ts`, `llm/`, `result-verification/`,
  `service/candidate-trial/`.
- Definition of done: tests for each wording (a reversible kept act versus a class-irreversible one;
  one ending sentence; "I" kept; no mid-word cut); existing tests of touched files pass.
- Report to: `reports/t741-b5-endings.md`.

### Brief: c4-icons-sort
- Repository: this repository (worker).
- Task (C): (1) L `page-find/search.ts`: a zero-match answer ("Nothing on this page holds those words
  ... hidden elements included", then "type it into the site's search field ... or follow a link")
  steers away from the page's wordless controls (job: ten searches for a save control that is a bare
  icon with no text, label or title; the view prints it `clickable icon class="..."`, domain
  `page-view/element/icon-hints.ts`). When the page holds wordless icon controls, add one generic
  sentence naming the first few handles: some controls here show no words, only an icon; what one
  does is written nowhere, so describe one (`web.describe_element`) or watch what it changes. Keep
  the site-search sentence. A page with no wordless icon reads as today. (2) Check that the
  extension's in-page list sort (`apps/extension/src/content/extraction/order-rows.ts`, with domain
  `src/actions/extraction/order-request.ts`) orders rows `as: "date"` when the date sits inside
  prose, e.g. an image's alt text "Picture by A. Baker on October 2, 2026. May show a bowl." Fix it
  if not (use the first full date in the text), with a test beside it.
- Evidence: job note (path in a-receipts' brief), "First divergent step" and the "Secondary" fix;
  photo note (path in a5-wrapup's brief), "Next likely failure".
- Owns: L `page-find/search.ts` and `page-find/tests/`; `apps/extension/src/content/extraction/order-rows.ts`,
  a date helper beside it if needed, and their tests.
- Must not touch: any other domain or extension file; any Core file.
- Definition of done: tests: a zero-match query on a page with wordless icons names them, one on a
  page without reads as today (generic fixtures, e.g. a recipe card's star icon); prose-date sort
  orders correctly; `page-find/tests` and the order-rows tests pass.
- Report to: `reports/t741-c4-icons-sort.md`.

### Brief: c1b-retry-words
- Repository: this repository (worker).
- Task (C, follow-up to c1-retry): the node answer for a rate-limited press now reaches the model as
  `page_busy_try_later`, but the model is still not told the site's retry-after or that the tab was
  taken back. Carry both on the rejection the model sees: add the fields to
  `WebLlmToolRejectionDetail` (L `tool-rejection.ts`) and set them in `webActionFailureRefusal`
  (L `action-failure/refusal.ts`) from the failure record (`retryAfterMs`, and the extension's
  tab-return words or flag as `node-run/retries/answer.ts` keeps them). Words generic: the site
  asked to wait N seconds; the tab was taken back to the page before the press.
- Evidence: job note (path in a-receipts' brief) "The failed call at 0116";
  `reports/t741-c1-retry.md`.
- Owns: L `tool-rejection.ts`, `action-failure/refusal.ts`, their tests.
- Must not touch: `node-run/retries/` (done), `page-find/` (c4), any Core file.
- Definition of done: tests: a `RATE_LIMITED` failure with retry-after 5 s and a returned tab yields
  a rejection naming both; one without them is unchanged; `action-failure/tests` and the
  tool-rejection tests pass; `node-run/retries/tests` still passes.
- Report to: `reports/t741-c1b-retry-words.md`.

### Brief: llm-followups
- Repository: FluxIQ Core (worker).
- Task: (1) The wrap-up's `not_offered` answer (R `llm/evidence-loop/answered-request.ts`, around
  line 110) still says nothing of the undo exception a5-wrapup added (`llm/loop-budget.ts`
  `withholds`): in a candidate wrap-up, add that a call naming one of this build's own acts under
  `undoes` still runs; a draft wrap-up's words stay as they are. (2) Social 0166-0167:
  `core.no_progress` and `already_answered` told the builder to test revision 5, whose trial had
  already answered `execution_failed`, and `core.test_subflow` then refused it as stale. Cause per
  b4-numbering: `llm/candidate-receipt/receipt.ts` returns the last accepted submission even after a
  later refusal cleared it. Never recommend testing a revision whose latest trial is on record as not
  passing, or one the trial gate would call stale; say instead what its trial answered and that a
  changed submission is needed.
- Evidence: `reports/t741-a5-wrapup.md`, `reports/t741-b4-numbering.md`; social note (path in
  b4-numbering's brief) fix 5, steps 0164-0171.
- Owns: R `llm/evidence-loop/answered-request.ts`, `llm/candidate-receipt/`, the no-progress note's
  file if it is in `llm/evidence-progress/` (name it), and their tests.
- Must not touch: `llm/loop-budget.ts`, `llm/evidence-loop.ts`, `subflow-candidate/`, `site-reset/`.
- Definition of done: tests for both; `llm/evidence-loop/tests/wrap-up-not-offered.test.ts` and the
  receipt and no-progress tests pass.
- Report to: `reports/t741-llm-followups.md`.

### Brief: d-judge
- Repository: FluxIQ Core (worker-high).
- Task (D, generic judge guidance): (1) The trial read account says a list "was still growing when
  the read stopped revealing more of it" (R `result-verification/read-account/list-continues.ts`,
  lines 40-41), and judges read that as rows missing from the task's range even when the list had
  gone past its own end marker into unrelated units (social 0141, 0144, 0145, 0214, 0218; one judge
  said the end marker was reached, the others asked to page further). Make the read account and the
  judge prose (`loop_verification`; find its source) say generically that a list continuing past an
  end marker the page shows, or past the range the task asks for, is not rows missing from that
  range: judge coverage against the task's own range. Re-pin both `loop_verification` pins in
  `llm/deepseek/tests/system-prompt-pins.json` by exactly the new sentence(s) and extend the history
  in `system-prompt.test.ts`'s header. (2) Identical judge advice is not passed to the builder again:
  when a judged-no trial's `changed` advice is the same as advice this builder was already given for
  an earlier trial in the build, the builder gets a short note that the judge repeated its earlier
  advice and what the trial that followed it answered, instead of the same paragraph again. Find
  where advice reaches the builder (`service/candidate-trial/feedback.ts`, the builder loop).
- Evidence: social note (path in b4-numbering's brief), "Why the other briefs never wrote the loop"
  (judge bullets) and fix 4.
- Owns: R `result-verification/read-account/list-continues.ts`, the `loop_verification` prose
  file(s), `llm/deepseek/tests/{system-prompt-pins.json,system-prompt.test.ts}`,
  `service/candidate-trial/feedback.ts`, `flow-bootstrap/subflow-candidate/builder-loop.ts` if
  needed, and their tests.
- Must not touch: `project-agents/dispatch/run-brief.ts`, `subflow-candidate/{scoped-submission,submission-numbering}.ts`,
  `llm/candidate-receipt/`, `llm/evidence-loop/answered-request.ts`, `site-reset/`, `activity/`.
- Definition of done: tests for both parts with generic fixtures; the contract tests
  `system-prompt.test.ts`, `plan/tests/extraction-vocabulary.test.ts`, `plan/tests/issue-feedback.test.ts`
  pass; existing tests of touched files pass.
- Report to: `reports/t741-d-judge.md`.

## Progress log

- 2026-10-20: plan written; wave 1 (ten workers) dispatched.
- 2026-10-20, wave 1 verified by the lead (all ten back; three Partial, all resolved or followed up):
  - a-settle (A1) and a-receipts (A2-A4): diffs reviewed. Two of a-receipts' existing
    `project-build-reset-settle.test.ts` cases asserted the pre-A1 behaviour (the witnessless trial
    act open). The lead updated them: case 1 now expects Core's own look to settle act-3
    `unchanged`; case 2 adds a second issued list that changes before the reset, so act-3 stays open
    and is listed with its `name` words (7/7 pass). The lead also replaced a-receipts' eight
    `as never` casts with a typed `ResetToolCall`, and removed `reset-loop.ts`'s direct import of
    `site-reset/contracts.ts` (the words now write `undoes` as the rest of that file does).
  - Type fixes by the lead in b1's and a5's new tests (missing `line` on steps; one cast).
  - `pnpm exec vitest run --maxWorkers=3` over every touched Core test folder (site-reset,
    project-build, dispatch, supervisor, script-statements, plan, system-prompt, loop-budget,
    evidence-loop, harness-options, subflow-candidate, refusal-locator-corpus, candidate-trial):
    `Test Files 219 passed (219)`, `Tests 2006 passed (2006)`. After the lead's fixes, the five
    re-touched files: `Tests 75 passed (75)`.
  - Core `pnpm run check` (packages/fluxiq): clean. Core `node scripts/structure-audit.mjs`:
    `passed (426 warning(s), 1152 baselined)`.
  - Domain `node scripts/test-domain.mjs node-run/retries/tests plan-resolution/tests
    action-failure/tests rejection-next/tests`: `# tests 239`, `# pass 239`, `# fail 0`.
  - Domain `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json --noEmit`: clean (run
    directly, against Core's pre-wave dist; the domain changes use no new Core API).
  - Downstream `node scripts/structure-audit.mjs`: `passed (213 warning(s), 618 baselined)`.
  - Follow-ups taken into wave 2: c1-retry was Partial (the model is not yet told the retry-after or
    the tab return) -> c1b-retry-words; a5-wrapup noted the `not_offered` words, and b4-numbering
    traced social's no-progress revision advice to `llm/candidate-receipt/receipt.ts` ->
    llm-followups.
- 2026-10-20: wave 2 (b5-endings, c4-icons-sort, c1b-retry-words, llm-followups, d-judge) dispatched.
- 2026-10-20, wave 2 verified by the lead (all five Done):
  - d-judge's advice memory only spans briefs when the dispatch hands one memory to every brief of a
    subflow (on social the judges reworded advice within a brief; the repeat was across briefs).
    The lead wired it in `project-agents/dispatch/run-brief.ts` (`ADVICE`, per build and subflow,
    like `STANDING`) with `dispatch/tests/repeated-advice-memory.test.ts` (same memory for a later
    dispatch of the same subflow, another for another subflow, a new one per build): `2 passed`.
  - c1b's fields were dropped on a repeated refusal: the lead passed `retryAfterMs` and `tabReturned`
    through `repeated-refusal.ts` `repeatedRejectionDetail`, with an assertion in
    `action-failure/tests/refusal.test.ts`.
  - b5 fixed `lowerFirst` in `conversations/commands/progress.ts`; the lead applied the same "I" rule
    to Core's UI copy in `ui/activity-status/supervisor-ending.ts`, with a test (`7 passed`).
  - Pin check: only `loop_verification` and `loop_verification_build_test` moved, each by exactly one
    added sentence ("A read whose paging words say its list goes on past what it read has not by
    that alone left rows out: ... judge coverage against the request's own range ...").
  - Downstream audit first failed on wave 2: `contract-spread` in `action-failure/refusal.ts`
    (`...siteWait(result)` and two conditional spreads) and `tool-rejection.ts` at 825 lines. The
    lead wrote the wait fields by name, and moved the wait-and-return words into their owner,
    `rejection-next/wait-words.ts` (`webLlmRejectionNextWithWait`, test `wait-words.test.ts`);
    `tool-rejection.ts` is 790 lines.
  - Core `pnpm run check`: clean. Core vitest over every touched folder (wave 1's plus
    activity/wording, conversations/commands, candidate-receipt, evidence-progress,
    decision-handlers, candidate, read-account, repair-directive, diagnosis-channel, deepseek,
    ui/activity-status): `Test Files 345 passed (345)`, `Tests 3047 passed (3047)`.
  - Core audit: `passed (427 warning(s), 1152 baselined)`. Downstream audit: `passed (214
    warning(s), 618 baselined)`.
  - Domain `test-domain.mjs` over action-failure, tool-rejection-detail, repeat-across,
    node-run/retries, page-find, rejection-next, plan-resolution, page-refusal, press: `# tests 308`,
    `# pass 308`, `# fail 0`. Extension `test-extension.mjs extraction/tests/order-rows`: 8/8.
  - Core rebuilt in the t741 worktree (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter
    @fluxiq/client-gateway-websocket build`: Done), then `pnpm --filter
    @fluxiq-web-extension/domain check` and `... extension check`: both clean against it.
- 2026-10-20, wave 3 (lead): `pnpm test:e2e:build` -> `EXT_BUILD 0`. The four site-reset
  installed-gateway specs, headed (the extension fixture), scripted provider, `--workers=1`, output
  under the lead's scratchpad: `6 passed (5.6m)` (installed-project 2, job-failed-save 1,
  office-buy-now 2, photo-toggle 1). No regression from A1-A4.
- 2026-10-20: e2e-office-r3 dispatched (new spec for the office round-3 shape).
- 2026-10-20, e2e-office-r3 verified by the lead. New spec
  `apps/extension/e2e/site-reset/tests/office-address-confirm.spec.ts`: Buy Now on the cart's ref,
  then on checkout choose another saved address and confirm it (`modify_existing`, on no list: every
  read of checkout has 0 lists), two revisions tested.
  - Lead run on the final build (headed, scripted provider, `--workers=1`): `1 passed (2.4m)`;
    diagnostic `"tests":["yes","yes"]`, `"looksBefore":[1,1]`, no builder call under `undoes`, and
    the trial's confirm act in the second trial's `startedWith.cannotUndo` with the left-unchanged
    words.
  - Falsification: with A1 switched off in `ledger.ts` (`witnessless = false && ...`), Core and the
    extension rebuilt, the same spec -> `1 failed`, diagnostic `"tests":["yes","candidate.trial_reset_required"]`:
    office round 3's stall. `ledger.ts` was then restored from a saved copy (checked: no `false &&`),
    Core's build came back from its store with matching inputs, the extension was rebuilt, and the
    spec passed again: `1 passed (1.3m)`.
  - `pnpm --filter @fluxiq-web-extension/extension check` (which typechecks `e2e/**`): clean.
    Downstream audit: `passed (214 warning(s), 618 baselined)`.

UNIT READY: Core `flow-bootstrap/site-reset/{ledger,settlement-decision,create-baselines,words,undoes-tool}.ts`, `site-reset/tests/{settlement-adopted,project-ledger-entry-repeats,settlement-shapes,project-ledger-repeats,reset-witness,undoes-tool,words}.test.ts`, `service/project-build/{reset-calls,brief-ports}.ts`, `service/project-build/tests/{reset-calls,project-build-reset-settle}.test.ts`, `project-agents/dispatch/reset-loop.ts`, `project-agents/dispatch/tests/reset-loop.test.ts`, `llm/{loop-budget,evidence-loop}.ts`, `llm/tests/loop-budget.test.ts`, `llm/evidence-loop/answered-request.ts`, `llm/evidence-loop/tests/wrap-up-not-offered.test.ts`; downstream `apps/extension/e2e/site-reset/tests/office-address-confirm.spec.ts` (Unit A: reset settlement)

UNIT READY: Core `project-agents/supervisor/{plan-input,guidance}.ts`, `supervisor/tests/plan-input.test.ts`, `flow-bootstrap/script-statements/{part-port-name,listing-order-in-repeat,loop-body,called-parts,record-replace-in-repeat,index}.ts`, `script-statements/tests/{part-port-name,called-parts,listing-order-in-repeat}.test.ts`, `flow-bootstrap/plan/flow-script-format.ts`, `plan/tests/loop-format.test.ts`, `llm/harness-options/bootstrap-completion.ts`, `harness-options/tests/listing-order-in-repeat-feedback.test.ts`, `flow-bootstrap/candidate/tests/refusal-locator-corpus.test.ts`, `project-agents/dispatch/run-brief.ts`, `dispatch/tests/{recording-notes,repeated-advice-memory}.test.ts`, `flow-bootstrap/subflow-candidate/{scoped-submission,submission-numbering}.ts`, `subflow-candidate/tests/revisions-after.test.ts`, `llm/candidate-receipt/{receipt,not-testable,index}.ts`, `candidate-receipt/tests/receipt.test.ts`, `llm/evidence-progress/stall-redirect.ts`, `evidence-progress/tests/stall-redirect.test.ts`, `activity/wording/left-told.ts`, `activity/wording/tests/left-told.test.ts`, `project-agents/dispatch/reset-done.ts`, `dispatch/tests/reset-done.test.ts`, `project-agents/supervisor/left-on-target.ts`, `supervisor/tests/{left-on-target,whole-trial}.test.ts`, `conversations/commands/progress.ts`, `conversations/commands/tests/plain-failure.test.ts`, `service/project-build/run.ts`, `service/project-build/tests/{project-build-facade,project-build-reset}.test.ts`, `src/ui/activity-status/supervisor-ending.ts`, `src/ui/activity-status/tests/supervisor-ending.test.ts` (Unit B: plan, script, brief, numbering, endings)

UNIT READY: downstream `domain/src/runtime/llm-evidence/node-run/retries/{answer,dispatch,index}.ts`, `node-run/retries/tests/{answer,dispatch}.test.ts`, `plan-resolution/target-packets.ts`, `plan-resolution/tests/target-packets.test.ts`, `action-failure/refusal.ts`, `action-failure/tests/refusal.test.ts`, `rejection-next/{next-sentence,wait-words,index}.ts`, `rejection-next/tests/{next-sentence,wait-words}.test.ts`, `tool-rejection.ts`, `tests/tool-rejection-detail.test.ts`, `repeated-refusal.ts`, `page-find/search.ts`, `page-find/tests/search.test.ts`; `apps/extension/src/content/extraction/tests/order-rows.test.ts` (Unit C: domain and extension)

UNIT READY: Core `result-verification/read-account/list-continues.ts`, `read-account/tests/list-continues.test.ts`, `llm/diagnosis-instructions.ts`, `llm/deepseek/tests/{system-prompt-pins.json,system-prompt.test.ts}`, `service/candidate-trial/tests/paging-feedback.test.ts`, `flow-bootstrap/subflow-candidate/{repeated-advice,builder-loop,index}.ts`, `subflow-candidate/tests/builder-loop.test.ts` (Unit D: judge guidance). Unit B's `run-brief.ts` carries D's cross-brief wiring, so B and D commit together or B after D.

Paths above are relative to Core `packages/fluxiq/src/programs/automation-studio/runtime/` unless they
start with `src/`, and to the downstream root where marked.

## Open points for the supervisor

- **Merge:** the trees were made from dev after t740 (both already contain it). Lane T (t736) edits
  trace-capture files; this lane touched none of them, but `builder-loop.ts`, `run-brief.ts`,
  `brief-ports.ts` and `evidence-loop.ts` are busy files, so re-run the tests beside them after
  `git merge dev`.
- **Not reproduced in a browser:** the job rate-limit shape (the fixture's every-sixth-request 429)
  and social's reload mark. Both are covered by unit tests on generic fixtures. The photo wrap-up
  undo and the multi-brief entry-preparation variant of office are covered by Core unit tests only.
- **Seen, not fixed (outside the brief):** when a press reloads the page, the trial feedback drops
  the control's name (`control` absent, act words lack `on "..."`), found by e2e-office-r3. Social
  note fix 4 bullet 1 (attach the disclosure order to the builder's `changed` after an
  `incomplete_text` refusal) was not done; C3's hint now places the read instead.
- **Judgement calls:** llm-followups treats `unsure` and `not_judged` trials as still testable (the
  gate retests those). A list adopted by A1 never counts as the act's own change, so a settled
  witnessless act is always `unchanged` and always told to the judge. c4 kept "or watch what it
  changes" for wordless icons; a lasting press still goes through the permission gate.
- **Directory budgets:** Core `site-reset/`, `service/project-build/`, `plan/`, `plan/tests/`,
  `harness-options/tests/`, `subflow-candidate/tests/` and domain `plan-resolution/tests/` are at
  25 files.
- **Live rerun:** Core must be rebuilt in each lane tree after sync (the lead's rebuild was in t741
  only). Expect office's brief-1 to pass again and its judged run to reach the row step. Expect
  photo to sort on the listing.

### Brief: e2e-office-r3
- Repository: this repository (worker-high).
- Task: a provider-free, headed, installed-gateway reproduction of office round 3's reset shape on
  the everything-store scenario, as a new spec beside `apps/extension/e2e/site-reset/tests/office-buy-now.spec.ts`
  (read it and `e2e/site-reset/` helpers first, and reuse them). A scripted builder: reads the cart
  complete (ref issued), presses Buy Now with that ref, then on checkout opens the address chooser,
  chooses another saved address and confirms it, declaring `modify_existing` (an act on no list:
  no list read shows its effect). It submits a subflow with those steps and tests it twice (two
  revisions, as office-buy-now does, since a revision judged yes is answered from the stored yes).
  Assert from the diagnostics: the confirm step's trial act settled by Core's own look before the
  second trial, with no builder call naming it under `undoes`; the second trial ran (not refused
  `candidate.trial_reset_required`); the act is reported to the judge as left unchanged
  (`startedWith.cannotUndo`, the words office-buy-now's `LEFT_UNCHANGED` checks). If the fixture
  gives the confirm press a witness of its own (a toggle or a list), so the shape cannot occur,
  report exactly why instead of forcing it.
- Evidence: office note (path in a-settle's brief); `reports/t741-a-settle.md`.
- Required reads: Shared worker rules; `office-buy-now.spec.ts`; `e2e/site-reset/*.ts`; the
  everything-store checkout fixture under `apps/scenario-lab/src/scenarios/everything-store/`.
- Owns: one new spec in `apps/extension/e2e/site-reset/tests/`, new helper files in
  `apps/extension/e2e/site-reset/` and their line in its `index.ts`.
- Must not touch: any source outside those, any Core file. Do not rebuild the extension: the lead
  built it from the final source (`EXT_BUILD 0`). Run only your spec: `cd apps/extension && node
  --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts
  e2e/site-reset/tests/<your spec> --workers=1 --reporter=list --output
  C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/e2e-office-r3-<N>`
  (a new N per run). No paid or live Lab run; no recorded page data or tokens in the spec or report.
- Definition of done: the spec passes headed with the scripted provider, its assertions above hold,
  and the report quotes the run's result line and the diagnostic proving the settlement.
- Report to: `reports/t741-e2e-office-r3.md`.
