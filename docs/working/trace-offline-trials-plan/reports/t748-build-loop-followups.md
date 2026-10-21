# Report: t748-build-loop-followups (lane lead)

Trees: downstream `C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQWebExtension`, Core
`C:/Users/osrs_/FluxStuff/fxwork/t748/!FluxIQ`, both on `task/t748-build-loop-followups` (base: downstream
`99b15b70`, Core `d4f08e13`). No commits, merges or pushes.

## Outcome

Done. All five items landed, each test-first and verified by the lead. Nothing ran live or paid. Nothing was committed
by the lane (the supervisor committed units as they were marked ready).

- **Item 1 (photo):** a candidate's step resolves in the dialog the steps before it opened. Core sends each node
  `precedingSteps`, and the domain keeps no cursor between calls. A new headed photo-social spec fails on the pre-fix
  resolver with `web.target.ambiguous` and passes now.
- **Item 2 (job):** an act whose differing list no undo could put back is `gate_unsatisfiable` with
  `no_admissible_undo`. A test pins the copied admission paths.
- **Item 3:** a read step is named by the value it read. A press keeps its control's name. The cause was the screen
  dropping "address", not the page reload.
- **Item 4:** the window counts only what is sent.
- **Item 5:**
  - Office C6: `retryRefused`.
  - Office C5: words only. No sound generic rule exists.
  - An unidentified creation now needs a witness.
  - A looped act names its pass.
  - The repeat stall names the refusal it followed. The person's ending ignores that code.
  - The ending filter keeps a failure that says why.
  - The job spec's wrong-job undo check was already restored by t743.

## Plan (2026-10-20)

R = Core `packages/fluxiq/src/programs/automation-studio/runtime/`; D = downstream root.

Round 5 can meet items 1, 2, 3 and office C5/C6, so they go first. Everything that shares no file runs in
parallel; the site-reset files are serial (item 2, then C5/C6 and the reset-witness rule, then trialRan).

| Wave | Unit | Effort | Item | Owns |
| --- | --- | --- | --- | --- |
| 1 | u1-dialog-view | worker-high | 1 | D `domain/src/runtime/llm-evidence/plan-resolution/**`, `llm-evidence/stable-handles.ts`, `docs/architecture/build-loop.md` |
| 1 | u2-undo-unmeetable | worker-high | 2 | R `flow-bootstrap/site-reset/**` except `create-baselines.ts`, `reset-witness.ts`; R `flow-bootstrap/reset-answers/**`, `reset-settlement/**` |
| 1 | u3-trial-labels | worker-high | 3 | R `service/candidate-trial/**` |
| 1 | u4-request-size | worker | 4 | R `llm/deepseek/{preflight,request-shape}.ts`, `llm/harness/run.ts`, their tests, R `tests/deepseek-bootstrap/tests/exploration.test.ts` |
| 1 | u6-small-points | worker | 5 (part) | R `llm/decision-handlers/refused-repeat.ts`, R `service/project-build-ending/**`, D `apps/extension/e2e/site-reset/tests/job-failed-save.spec.ts` |
| 2 | u5-office-baselines | worker-high | 5 C5/C6, t738 witness rule | R `site-reset/{create-baselines,reset-witness,words}.ts`, R `service/project-build/brief-ports.ts` |
| 2/3 | u7-trial-pass | worker | 5 trialRan | decided after u2 |

Browser runs: u1 runs the photo specs while Core is mid-edit, so it runs Playwright directly against the dev Core
dist (the core-build gate would report Core stale); no worker rebuilds Core. The lead rebuilds Core once Core work
lands and runs the whole `e2e/site-reset` suite headed at the end.

## Worker briefs

Each brief was given in full in the dispatch prompt; summarised here.

- **u1-dialog-view**: choose the view a Flow step stands on from the step before it, or key handles per document,
  so a dialog and a standalone page at one address do not share a view; first find why t743's d5 broke
  `photo-dialog-destination.spec.ts`. Tests first; domain plan-resolution and node-run tests; photo specs headed.
- **u2-undo-unmeetable**: an act whose differing list has no admissible undo becomes `gate_unsatisfiable` with its
  condition named, in general, before the repeat guard.
- **u3-trial-labels**: trial feedback labels a read step with the words it read; a press that reloads the page keeps
  its control's name.
- **u4-request-size**: the pre-provider size check counts only what is sent; restore t744's test window.
- **u6-small-points**: `refused-repeat.ts` carries the last refusal code; assess the ending filter that drops part-level
  test claims; restore the job spec's wrong-job undo check.

## Progress log

- 2026-10-20: plan written; wave 1 dispatched (u1, u2, u3, u4, u6). Baseline: `node scripts/check/core-build.mjs`
  -> `core-build: FluxIQ Core's build at ...\t748\!FluxIQ is current with its source.`
- 2026-10-20, wave 1 back, verified by the lead:
  - Core vitest over every touched folder (site-reset, reset-answers, reset-settlement, llm/decision-handlers,
    llm/harness*, llm/deepseek, tests/deepseek-bootstrap, service/candidate-trial, service/project-build-ending, the
    prompt contract tests) -> `Test Files 145 passed (145)`, `Tests 1212 passed (1212)`. Domain
    `test-domain.mjs plan-resolution/tests node-run/tests` -> `# tests 444`, `# pass 444`, `# fail 0`.
  - Core `pnpm exec tsc --noEmit -p .` first failed with 2 errors in worker files: `reset-settlement/judge.ts(218,5)`
    (u2: a differing group's `group` is optional) and `llm/harness/tests/run-size.test.ts(238,40)` (u4: optional
    `tokenLimits`). Lead fixed both: `differing` keeps an unnamed group and `undo-reach.ts` judges nothing when any
    differing list has no group id (conservative: never lists an act apart on a list it cannot name); the test takes
    `NonNullable<...>`. Re-run -> `tsc exit=0`.
  - u2 (item 2, Done): new `site-reset/undo-reach.ts`, condition `no_admissible_undo`. It copies the admission paths of
    `undo-admission.ts`, so the lead added a pin to `tests/settlement-unmeetable.test.ts` (the admitting lines' kinds
    and a digest). Falsified: a one-line change to an admitting line -> `AssertionError: an admitting line of
    ../undo-admission.ts changed: update ../undo-reach.ts to match, then this pin`; restored, `git diff --stat` shows
    only u2's header lines. site-reset, reset-settlement, reset-answers -> `Test Files 27 passed`, `Tests 329 passed`.
  - u3 (item 3, Partial -> Done with the lead): read steps named by what they read (`candidate-trial/step-control.ts`).
    The press name was not lost to the reload: `llm/model-facing/sayable-text.ts` drops any text holding "address", and
    the fixture's button says "Deliver to this address". Lead fix: new `llm/model-facing/control-text.ts`, the screen
    for a control's own words (locator shapes, match scores, the finding-only words selector/fingerprint);
    `sayable-text.ts` is that plus "address"/"score" for failure text; `control-words.ts` and `step-control.ts` use
    the control screen. Test first: `tests/control-words.test.ts` new case -> `1 failed | 17 passed`, then passed.
    model-facing, candidate-trial, every caller's folder (executor/step-skip, instructed-acts, script-statements,
    recovery/refuted-result) and the prompt contract tests -> `Test Files 72 passed (72)`, `Tests 915 passed (915)`.
  - u4 (item 4, Done): `llm/harness/run.ts` measures the window by the sent messages only (the packed request only
    when the provider gives no measure); exploration test back at 20,000/22,000. Verified in the 145-file run above.
  - u6 (item 5 part, Done): the repeat stall carries `llm_evidence_loop.last_refusal:<code>`; the ending filter keeps a
    part's failure that says why; (c) not real: the job spec already checks the pre-build undo (t743 `d2302b5f`, spec
    lines 157-167). Lead follow-up on u6's flag: `flow-bootstrap/unfinished-build/not-done.ts` says nothing for the
    carried code (it could match "node" or "plan" by chance and add a wrong clause). Test first ->
    `Received: "... which changes nothing, and the Flow it wrote was not one that could run"`, `1 failed`; after:
    unfinished-build and project-agents/dispatch -> `Test Files 49 passed (49)`, `Tests 357 passed (357)`.
  - u1 (item 1, Done, being revised): the step before decides the view; photo specs `2 passed (4.8m)` headed. It infers
    the plan's position from the order Core resolves nodes in, and Core never asks the domain about untouched inherited
    steps or refused handlers, so the inferred position can be stale (u1's own open gap). Revision u1b: Core hands the
    domain the steps before each node explicitly.

UNIT READY: Core `R/llm/harness/run.ts`, `R/llm/harness/tests/run-size.test.ts`, `R/tests/deepseek-bootstrap/tests/exploration.test.ts` (item 4: the size check counts only what is sent)

UNIT READY: Core `R/llm/decision-handlers/refused-repeat.ts`, `R/llm/decision-handlers/tests/{stall-names-last-refusal,stall-keeps-schedules}.test.ts`, `R/flow-bootstrap/unfinished-build/not-done.ts`, `R/flow-bootstrap/unfinished-build/tests/not-done.test.ts`, `R/service/project-build-ending/reason-checked.ts`, `R/service/project-build-ending/tests/reason-explains.test.ts` (item 5: the stall names the refusal it followed; the ending keeps a failure that says why)

UNIT READY: Core `R/flow-bootstrap/site-reset/{undo-reach.ts (new),ledger.ts,ledger-act.ts,undo-claims.ts,undo-admission.ts}`, `R/flow-bootstrap/site-reset/tests/{settlement-unmeetable.test.ts (new),ledger-subject.test.ts,undo-admission.test.ts}`, `R/flow-bootstrap/reset-settlement/judge.ts`, `R/flow-bootstrap/reset-answers/{failed,condition-words}.ts` (item 2: `no_admissible_undo`)

Held until the browser run on a rebuilt Core: item 3 (Core `R/service/candidate-trial/**`, `R/llm/model-facing/**`,
downstream `office-read-after-change.spec.ts`, `office-address-confirm.spec.ts`) and item 1 (domain, revised by u1b).
- 2026-10-20: wave 2 dispatched: u1b (explicit preceding steps, Core + domain), u5 (office C5/C6 and the reset-witness
  rule), u7 (a looped trial act's pass in `trialRan`).
- 2026-10-20, wave 2 back, verified by the lead:
  - u1b (Done): `binding.ts` `precedingSteps` (sent with `handleReach: "view_history"` only; inherited and refused nodes
    included; none past 200), built in `plan-parameter-resolution.ts`; the domain folds the steps per call and keeps no
    cursor. Reviewed: the position is counted before the refused-handler skip and the snapshot is taken before page facts
    are resolved into the plan.
  - u5 (Done): C5 has no sound generic rule (a related-items list on the subject's page has the same shape as a list a
    creation there does join), so only the words changed: the refusal splits issued refs into this page and elsewhere
    and says which list to name. C6: `retryRefused` on a later read's answer. t738: the unidentified lone `create_new`
    gap was real and is closed; unscoped presses and the stated-state witness are not gaps.
  - u7 (Done): `trial step N, pass K of M "<label>"` for a step that ran in more than one pass; ids were already distinct.
    Only `photo-toggle.spec.ts` matches act words (`^trial step 3 `, a single-pass step).
  - Core `pnpm exec tsc --noEmit -p .` -> `tsc exit=0`. Core vitest over every touched folder and the callers
    (site-reset, reset-answers, reset-settlement, llm/decision-handlers, llm/harness*, llm/deepseek, llm/model-facing,
    tests/deepseek-bootstrap, service/candidate-trial, service/project-build-ending, service/project-build,
    service/subflow-trial, project-agents, flow-bootstrap/unfinished-build, recovery/annotation, recovery/refuted-result,
    executor/step-skip, flow-bootstrap/instructed-acts, flow-bootstrap/script-statements, the prompt contract tests) ->
    `Test Files 325 passed (325)`, `Tests 2877 passed (2877)`.
  - Audits: Core `structure-audit: passed (436 warning(s), 1152 baselined)`; downstream `passed (218 warning(s), 618
    baselined)`. Core's "1 baseline entry can be lowered" is `runtime/service.ts`, which t748 does not touch; left alone.
  - Core rebuilt in the t748 Core worktree: `pnpm build` -> `build exit=0`. Then downstream `domain` `pnpm check` ->
    `exit=0`, `apps/extension` `pnpm check` -> `exit=0` (both print "core-build: ... is current with its source").
    Domain `test-domain.mjs plan-resolution/tests node-run/tests llm-evidence/tests` -> `# tests 662`, `# pass 662`.
  - Headed `pnpm test:e2e e2e/site-reset --reporter=list` in `apps/extension` -> `11 passed (5.8m)`, `e2e exit=0`
    (installed-project 2, job-failed-save, office-address-confirm, office-buy-now 2, office-cross-brief,
    office-read-after-change, photo-dialog-destination, photo-toggle, repair-first). office-address-confirm now asserts
    the confirm press keeps "Deliver to this address" in the step and the act words; office-read-after-change asserts the
    read step is named by the value it read.
  - Docs (lead): Core `docs/architecture/automation-studio/llm-flow-bootstrap.md` (no_admissible_undo and its pin; which
    list a creation names and `retryRefused`; what a trial calls each step's control, the pass words and the
    `readsWords` contract; `precedingSteps`; the stall's last refusal; the window), `docs/architecture/automation-studio.md`
    (the window), `docs/architecture/package-boundaries.md` (migration note: `precedingSteps`, the window); downstream
    `docs/architecture/extension-client.md` (the `readsWords` contract). Core `pnpm docs:check` -> `Deterministic
    framework reference is current.`
UNIT READY: Core `R/service/candidate-trial/{step-control.ts (new),feedback.ts,landed-acts.ts,index.ts}`, `R/service/candidate-trial/tests/{feedback,landed-acts}.test.ts`, `R/llm/model-facing/{control-text.ts (new),sayable-text.ts,control-words.ts,index.ts}`, `R/llm/model-facing/tests/control-words.test.ts`, `R/flow-bootstrap/site-reset/{contracts.ts,ledger.ts}`, `R/flow-bootstrap/site-reset/tests/ledger.test.ts`, `R/service/project-build/tests/project-build-acts-record.test.ts`; downstream `apps/extension/e2e/site-reset/tests/{office-read-after-change,office-address-confirm}.spec.ts`, `docs/architecture/extension-client.md` (item 3: a read named by what it read, a control's own words keep "address"; item 5: a looped act's pass. `landed-acts.ts` carries both; `ledger.ts` also carries item 2's lines if that unit is not yet committed)

UNIT READY: Core `R/flow-bootstrap/site-reset/{create-baselines,reset-witness,words}.ts`, `R/flow-bootstrap/site-reset/tests/{create-baselines,reset-witness,words}.test.ts`, `R/service/project-build/brief-ports.ts`, `R/service/project-build/tests/project-build-brief-ports.test.ts` (item 5: office C5 words, C6 `retryRefused`, an unidentified creation needs a witness)

Held for u8's browser proof: item 1 (Core `R/llm/harness-options/{binding,plan-parameter-resolution}.ts`,
`R/llm/harness-options/tests/plan-handle-reach.test.ts`; domain `plan-resolution/**`; downstream
`docs/architecture/build-loop.md`) and the Core docs, which also describe it.
- 2026-10-20: item 1 has no browser proof yet (neither photo spec writes the open-the-dialog-then-press Flow);
  u8 dispatched for a provider-free headed photo-social spec.
- 2026-10-20, u8 back (Done): new `apps/extension/e2e/site-reset/tests/photo-dialog-step.spec.ts` on photo-social. The
  scripted builder shows one handle in a post's dialog and on its own page (own page last), then submits grid -> cell
  -> that handle. u8: passed twice; with HEAD's plan-resolution files swapped in -> `1 failed` at
  `expect(likeStep?.inDialog).toBe(true)`, the trial's third step `web.target.ambiguous`; files restored (sha256,
  `git diff --stat`). Lead re-ran it headed: `pnpm test:e2e e2e/site-reset/tests/photo-dialog-step.spec.ts` ->
  `core-build: ... is current with its source.`, `ok 1 ... (46.0s)`, `1 passed (1.1m)`. Its assertions cover the
  dialog context, no ambiguity, three succeeded trial steps, the dialog's Like pressed once, the reset back to start and
  a proposed ending.
- 2026-10-20, final checks by the lead: both audits `passed` (downstream 218 warnings / 618 baselined, Core 436 / 1152);
  Core harness-options vitest -> `Test Files 25 passed (25)`, `Tests 226 passed (226)`. Earlier on the same source:
  Core tsc `exit=0`; the 325-file Core vitest run; Core `pnpm build` and `pnpm docs:check`; domain and extension `pnpm
  check` `exit=0`; domain tests 662/662; headed `e2e/site-reset` `11 passed (5.8m)`.

UNIT READY: Core `R/llm/harness-options/{binding,plan-parameter-resolution}.ts`, `R/llm/harness-options/tests/plan-handle-reach.test.ts`, `docs/architecture/automation-studio/llm-flow-bootstrap.md`, `docs/architecture/automation-studio.md`, `docs/architecture/package-boundaries.md`; downstream `domain/src/runtime/llm-evidence/plan-resolution/{target-packets,resolve-plan-node,view-history,next-page-slot}.ts`, `plan-resolution/step-views/` (new: `index.ts`, `views.ts`, `move.ts`), `plan-resolution/tests/dialog-identity.test.ts`, `apps/extension/e2e/site-reset/tests/photo-dialog-step.spec.ts` (new), `docs/architecture/build-loop.md`, `docs/working/trace-offline-trials-plan/reports/t748-*.md` (item 1: a candidate's step stands where the steps before it left the page; Core and downstream push together; the Core docs also cover items 2-5)

## Not verified

- No live or paid run (lane rule). Round 5 is the first live test of every item.
- No full suites (`pnpm check`, `pnpm test`, `pnpm build`, Core's whole vitest), per the twice-daily sweep rule.
- C5 is words only: whether a builder now picks the list the creation joins is unproven until round 5's office run.
- No browser spec covers `no_admissible_undo`, `retryRefused` or the pass words; each is covered by unit tests,
  `retryRefused` through the real project-build service.

## Open items for the supervisor

1. **C5 has no generic rule (u5).** A related-items list on the subject's own page has the same shape to Core as a list
   a creation there does join (replies, a collection panel). Watch round 5's office Buy Now.
2. **A press whose control names nothing seals the baselines (u5).** A press with no subject, page or scope lands under
   the legacy policy but still seals them. If nothing was read before it, later identified creations are refused
   `no_call`. After the seal, a witnessless strict press is admitted and lands unsettleable. Both are policy questions
   on a rare path and touch `ledger.ts`.
3. **Plan order is used as run order (u1b).** In a Flow whose nodes branch, the node listed before a press may not run
   before it. A handler or any non-web node counts as moving the page, so a press after one resolves as before.
4. **Copied admission paths (u2).** `undo-reach.ts` copies `undo-admission.ts`'s admission paths and a test pins the
   admitting lines. The round-4 job acts themselves would not be caught: their own-item path stays open. t743's c5
   already covers that case.
5. **Pass numbering (u7).** K counts the passes a step ran in, not the loop's index. A step repeated outside a loop is
   also numbered.
6. **Two new cross-repository contracts, both documented.** Core reads the domain mark `readsWords`. The domain reads
   Core's `precedingSteps`.
