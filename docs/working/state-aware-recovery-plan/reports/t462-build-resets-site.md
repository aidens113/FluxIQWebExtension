# t462: a build resets the site before it re-runs its Flow (lane report)

Trees: downstream `C:/Users/osrs_/FluxStuff/fxwork/t462/!FluxIQWebExtension` and Core
`C:/Users/osrs_/FluxStuff/fxwork/t462/!FluxIQ`, both on `task/t462-build-resets-site-before-rerun`.
Lead: the t462 lane lead. Nothing is committed by the lane; the supervisor integrates.

The user's rule (2026-10-12, AGENTS.md): before every trial and the judged whole run, the model returns
the site to the state the build started from through the site's own controls, undoing exactly the lasting
acts this build made and never touching what existed before the build began. Reversing the build's own
acts is not a new permission question and does not repeat a lasting act.

## Audit findings

- **Candidate mode (the default) has no record of the build's own lasting acts.** The t411 completed-act
  ledger (`executor/lifecycle-run/completed-act.ts`) is per run and executor-only; the draft steps that
  carry `ranWith`/`effectApplied` exist only in legacy mode (`draftRecord` returns early when
  `discoveryOnly`). What a candidate build has per call: the permission gate's declaration records
  (`action-permissions/declared.ts`, `action.ref` = callId) and the call's `effectApplied`.
- **Trial start today.** `runAutomationStudioCandidateTrial` (`service/candidate-trial/run.ts`) calls the
  deployment's start hook when one is set, else runs on the site as it stands (`start: "not_reset"`). The
  hook exists only in the Lab (`FLUXIQ_CANDIDATE_START_URL` = the scenario's `/__control/reset`, a
  server-side fixture reset, not a navigation). Core's contract says it is false in every product
  deployment. So in the product a trial runs on exploration's and earlier trials' leftovers.
- **Correction to the brief's evidence reading** (`run-mv5jnc62-01c3609a`). Every trial in that run started
  `"start": "reset"` from the Lab's fixture reset, and the judge's start view (0065) shows the seed: Carden
  Falls store, badge `1 $3.97`. The pre-existing cart line is dish soap **x1** (seed,
  `apps/scenario-lab/src/scenarios/bigbox-retail/state/initial-state.ts:17`), not x2. The "soap x2" the
  judges saw was made by trial 0064's own step 26: a `select "Qty"` target with no row binding set the soap
  row's quantity. The leftover problem the rule addresses is real for the product (no hook) and for
  exploration after a trial (0056 shows trial 0052's cart; 0078-0112 show trial 0084's), but the Lab's
  hook hid it from the trials themselves.
- **D1 stays as it is.** Legacy (draft) mode's dry-run test verifies lasting steps rather than redoing them
  (`flow-draft/verify-only.ts`), so it must find exploration's effects still in place; undoing them there
  would break it. The reset is therefore candidate mode only, where a trial runs the whole Flow live.
- **Permission gate.** Classifies only from the domain's declaration; gated classes are `move_money`,
  `delete`, `send_or_publish`. Setting a value back is `modify_existing` (ungated); removing something the
  build added is `delete` (gated, would ask the person today).
- **Domain.** `observeResult` (`observeWebLlmResult`) already gives a passive, handle-free page view
  including non-rendered state, and `webAutomationStateDiff` already diffs two such views as line
  multisets. Nothing records the page as it stood when a build began.
- **Loop mechanics that shape the gate.** A refused `core.test_candidate` with `effectApplied: false`
  makes an identical retest "already answered" until something mutates; the candidate wrap-up (5
  decisions left) offers only submit and test, so a reset demanded there could never be done. The gate
  must therefore never deadlock: it refuses while the reset makes progress and admits the trial,
  saying what was left, once it does not.

## Design

All of it is generic: Core never reads a page, a control or a cart; the domain reports page state as its
own lines; no guidance names a scenario's site, products or task.

1. **Start state (Core + domain).** As a candidate build begins (right after the loop's opening arrival
   call), Core asks the domain's new optional binding method `startState({ ... })` with no `start` and
   keeps the opaque `state` it returns (`llm/harness-options/binding.ts`). The web domain answers with its
   passive view of the start page.
2. **Ledger of this build's lasting acts (Core, `flow-bootstrap/site-reset/`).** Every exploration call
   that the gate permitted, that declared a lasting class (`create_new`, `modify_existing`, `delete`) and
   that landed is an act `act-N`, described by the gate's verb and control words and its callId. After
   every trial, the trial's own lasting steps that landed (`AutomationStudioCandidateTrialAct`, read off
   the trial's trace) become acts too. Acts with `move_money` or `send_or_publish` cannot be undone and are
   never asked for.
3. **Undo through the normal tool.** In candidate mode `core.run_node` takes an optional `undoes: "act-N"`.
   Core strips it before the domain sees the call. The ledger accepts a claim only for an act of this build
   in the current reset phase; otherwise the call is answered with a refusal naming the acts that may be
   undone. An accepted undo of an act that created something may `delete` without asking, once (the gate's
   action carries `undoes.allowed`); everything else is gated exactly as today, so an act on anything that
   pre-existed still asks. A landed undo marks the act undone. Undo records are excluded from the
   cross-check against the instruction, so a reset never raises a permission question after the build.
4. **The reset gate before each trial (`core.test_candidate`).** A reset is due when the ledger recorded
   any act since the build began or since the last trial, or one is still in place. Then, before running the
   trial:
   - Core takes the site back to the build's start (the run-node tool's arrival call) and asks
     `startState({ start })`; an empty `differs` means the site is back: every act is marked undone and
     the trial runs.
   - Otherwise it refuses with `candidate.trial_reset_required` (acts still in place, plus `differs`) or,
     when every act is undone but the start page still differs, `candidate.trial_start_differs`, once per
     phase. The instruction says: undo each act through the site's own controls with core.run_node and
     `undoes`, touch nothing that was there before, then test again.
   - It never deadlocks: the same acts and differences as the last refusal (no progress), or three
     refusals in one phase, admit the trial, and its answer says under `startedWith` what was still
     different. The refusal carries `resultReason: "retry_allowed"` and reports the arrival's movement, so
     an identical retest reaches the gate instead of the loop's memory or repeat guard.
   - After the trial, the ledger keeps what was still in place and adds the trial's own landed acts, and
     the answer lists them under `leftOnSite`.
5. **D1 holds.** Undoing is never a repeat of a lasting act; legacy mode is unchanged.

The Lab's start hook stays: it still resets the fixture before each trial, after the model's reset and
Core's check. Recommendation for the supervisor: consider running candidate trials in the Lab without the
fixture reset so a live run measures the model's reset itself (the readiness gate `startReset` would need
to accept that).

## Work partition

| Worker | Owns | Status |
| --- | --- | --- |
| Lead | `flow-bootstrap/candidate/contracts.ts` (trial act type), `llm/harness-options/binding.ts` (`startState`), `flow-bootstrap/site-reset/contracts.ts` + `index.ts`, `service.ts` wiring, docs | done |
| A (`t462-a-site-reset-gate.md`) | `flow-bootstrap/site-reset/*` (ledger, gate policy, start check, undo schema, words), `candidate/trial-gate.ts`, `candidate/authoring-loop.ts`, `service/flow-bootstrap-commands/candidate-generation.ts`, their tests | done, verified |
| B (`t462-b-undo-permission.md`) | `action-permissions/{gate.ts,request.ts,declared.ts,cross-check.ts}`, `flow-bootstrap/action-permissions.ts`, their tests | done, verified |
| C (`t462-c-trial-acts.md`) | `service/candidate-trial/*` (trial acts), `activity/candidate/trial-words.ts`, their tests | done, verified |
| D (`t462-d-domain-start-state.md`) | downstream `domain/src/runtime/llm-evidence/start-state/`, `tools.ts` binding, tests | done, verified |
| E (`t462-e-reset-integration-test.md`) | `flow-bootstrap/tests/site-reset-build.test.ts`: real ledger + real permission wrapper + real authoring loop | done, verified |

## Fix log

Core (`packages/fluxiq/src/programs/automation-studio/runtime/`):

- `flow-bootstrap/site-reset/` (new). These modules are not re-exported from `flow-bootstrap/index.ts`, for
  the reason `candidate/` is not; the permission wrapper imports `./site-reset/contracts.ts` directly to avoid
  an import cycle. The modules:
  - `AutomationStudioSiteResetLedger` (`ledger.ts`);
  - the pure gate policy (`trial-policy.ts`);
  - `AutomationStudioSiteResetStartCheck` (`start-check.ts`): reads the start after the opening arrival;
    compare = arrival, then `startState({ start })`; any failure gives no `differs`;
  - the `undoes` property on `core.run_node` (`undoes-tool.ts`);
  - the model words (`words.ts`).
- `flow-bootstrap/candidate/trial-gate.ts`:
  - the reset runs before a trial is counted;
  - a refusal answers `retry_allowed` with `effectApplied` = the arrival moved;
  - `ask()` copies well-formed `acts`;
  - the answer adds `startedWith` and `leftOnSite`;
  - the tool description says to reset first.
- `flow-bootstrap/candidate/authoring-loop.ts`: builds the start check from `submission.binding.startState`,
  offers `undoes` only with a ledger and a trial port, reads the start after the `initial.*` call, and passes
  the reset to the gate.
- `service/flow-bootstrap-commands/candidate-generation.ts`: passes `siteReset` through.
- `action-permissions/`:
  - the action carries `undoes: { act, allowed }`. Allowed gated classes hold for that one check only and
    never join the run's permitted set, and a person's decline still wins;
  - the record carries `undoes`;
  - the cross-check leaves undo records out.
- `flow-bootstrap/action-permissions.ts`, with `siteReset` set:
  - strips `undoes` and asks the ledger;
  - answers a refused claim without running;
  - reports each call it ran through `explored()`, with the declaration as the gate read it and `landed`.

  Without `siteReset` the path is byte for byte as before.
- `service/candidate-trial/`:
  - `executed-steps.ts` (the folding moved out of `feedback.ts` unchanged);
  - `landed-acts.ts`;
  - `run.ts` answers `acts` for every trial that ran.
- `activity/candidate/trial-words.ts`: chat words for `candidate.trial_reset_required` and
  `candidate.trial_start_differs`.
- `service.ts`: one candidate-mode ledger, given to both the permission wrapper and the generation. The file
  went from 4356 to 4357 lines, under its baseline of 4360.
- `llm/harness-options/binding.ts`: optional `startState`. `flow-bootstrap/candidate/contracts.ts`:
  `AutomationStudioCandidateTrialAct`, and `acts?` on the trial result.
- Docs: `docs/architecture/automation-studio/llm-flow-bootstrap.md`, "The site is put back before each trial".

Downstream:

- `domain/src/runtime/llm-evidence/start-state/` (new) and the `startState` binding in `tools.ts`. It uses the
  same passive capture as `observeResult`. Dialogs, covering layers and modal content are left out.
  `differs` is a multiset line diff.
- The lead moved the handle-free view-line reader that D had copied (to dodge an import cycle) into
  `llm-evidence/page-view/handle-free-lines.ts`, with a test. `state-diff/summary-lines.ts` now uses it too,
  so there is one copy.
- Docs: `docs/architecture/page-evidence.md`, "Start state for a build's site reset"; and the D1 bullet in
  `docs/architecture/testing-facility.md`.

The lead's own changes after review:

- **Exploration acts show the model's call id** (`call`), so the model can find the act in its evidence. In
  round 8 the call ids were descriptive, e.g. `add-towels-1`.
- **A trial is due while any act is still in place,** not only after a new act: "before every trial". A's
  version let an admitted trial's leftovers go unasked at the next trial.
- **An undo may delete unasked once per created act.** A second try at the same act is gated as usual, so
  the build never removes more without asking than it created.

## Validation

All runs are provider-free; no Lab run and no model call. Final state of both trees:

- Core narrow tests, from `packages/fluxiq`:
  `pnpm exec vitest run <R>/flow-bootstrap/site-reset <R>/flow-bootstrap/candidate <R>/flow-bootstrap/tests <R>/action-permissions <R>/service/candidate-trial <R>/service/flow-bootstrap-commands <R>/activity/candidate src/programs/automation-studio/api/handlers/tests/llm-generation.test.ts <R>/conversations/commands/tests/build.test.ts <R>/conversations/commands/tests/extension-chat.test.ts`
  -> `Test Files 74 passed (74)`, `Tests 687 passed (687)`. This includes the end-to-end candidate chat
  tests, which go through `service.ts`, and E's integration test (6 tests).
- Core typecheck: `pnpm --filter fluxiq check` -> exit 0.
- Core structure audit: `node scripts/structure-audit.mjs` -> `structure-audit: passed (331 warning(s), 1159 baselined).`
- Core build, for downstream: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` -> exit 0.
- Domain narrow tests, from `domain/`:
  `DOMAIN_TEST_BUILD_LABEL=t462-lead pnpm test -- llm-evidence/start-state llm-evidence/page-view state-diff llm-evidence/result-observation`
  -> `# tests 88`, `# pass 88`, `# fail 0`.
- Domain typecheck: `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0.
- Downstream structure audit: `node scripts/structure-audit.mjs` -> `structure-audit: passed (184 warning(s), 646 baselined).`

Not verified:

- Live browser behaviour: how the model handles a reset refusal, whether the web `startState` diff of a real
  start page is quiet enough, and the chat card for a refused test.
- Full suites.

## Risks and notes for the supervisor

- **The undo claim is the model's word.** The gate cannot see which line an undo removes; Core knows no
  domain's targets. What bounds it:
  - an unasked delete only for an act this build created, once;
  - the start comparison afterwards, which shows any pre-existing line removed or changed.

  A wrong removal is caught after the fact, not prevented.
- **Noise in `differs`** on real start pages (rotating content) costs at most one refusal per phase for
  differences alone. With acts in place, it costs at most three refusals per phase.
- **The Lab's fixture reset stays on.** Lab trials therefore start from the seed whatever the model does,
  but the gate still makes the model reset first, and the comparison checks the reset. To measure the
  product path exactly, consider live trials without the fixture reset; `startReset` readiness would then
  need to accept that.
- **Round 8 evidence.** Soap x1 is the seed. The "soap x2" came from trial 0064's own `select "Qty"` step,
  whose target has no row binding. That step defect is separate from this lane and still open.
