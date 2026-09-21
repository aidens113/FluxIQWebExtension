# w2x-dismissible-dialogs: a pop-up anyone can close is not a person's job (P9, t062)

Worker report for `### Brief: w2x-dismissible-dialogs`. Worktrees: `F:\fxwork\t062\!FluxIQWebExtension` (branch `task/t062-dismissible-dialogs`, at `770e695` after the supervisor merged `dev` in) and `F:\fxwork\t062\!FluxIQ` (at `2e4f6c2`, unchanged). Everything is uncommitted.

## Outcome

**Partial.** The line is drawn and the promotion is fixed live. The robot-check live proof could not run.

- **Auction promotion, live.** The promotion no longer ends as `web.intervention.required`. It now ends as `web.action.blocked_by_dialog` (Core category `unexpected_state`).
  - On the auction repair task, Core called the model: 1 call, $0.0023. Before this change, the same task made 0 calls (lane C #19, `llm.gate.manual_intervention`).
  - The run then stopped at the model's diagnosis. The diagnosis said the step can no longer be achieved, so no exploration and no patch followed.
- **Robot check, live: not run.** The everything-store repair task never reaches the robot check on this Lab. The recording lane's own first step (`accept-cookies`) is covered by the store's notifications prompt. That is lane C's probe race, **L1**, and it happened 2 of 2 times: once before the change and once after.
  - So there was no Flow, no replay and no provider call.
  - The rule was instead proved in a real Chromium against the real robot-check page, through the content harness. The replayed first press there ends as `web.intervention.required`, and nothing is typed into the challenge.

## What changed and why

### Where the decision was

The extension alone decided "needs a person". In `apps/extension/src/content/action-runtime/results.ts`, `blockedByModal` turned *every* covered or inert target into `USER_INTERVENTION_REQUIRED` whenever any `aria-modal` or `dialog:modal` was painted.

Core then maps `user_intervention_required` to `manual_intervention` (`recovery/deterministic-diagnosis.ts`). That mapping is right for the category, so it needed no change. What was wrong was the category being reported.

### The line, drawn on what the page declares

The rule is in `blocking-dialog.ts` and `challenge-evidence.ts`, both new.

1. **Which dialog is in the way.** There are two cases:
   - Any painted modal (`aria-modal="true"` or `dialog:modal`). Every one is read.
   - For a `covered` refusal, the layer at the hit point also counts, in either of two forms:
     - an element with a dialog role (`role=dialog`, `role=alertdialog`, or `dialog[open]`);
     - a fixed overlay that carries its own way out: a close glyph, or a control labelled "Not now", "No thanks", "Close", "Dismiss", "Skip", "Maybe later" and similar.

   To get the hit point, the five actionability verbs (click, clear, keypress, select, type) now pass the point where the hit test landed as `blockedAt`. It never leaves the page.

   A cookie banner is not a dialog here. Its only ways out are choices about the person's data, so it stays `web.action.rejected`.
2. **Which side of the line.** A dialog is the person's (`USER_INTERVENTION_REQUIRED`) only when it asks for one of three things:
   - **A robot check.** Detected from:
     - a vendor captcha frame or container, but not an invisible reCAPTCHA v3 badge;
     - an image named "captcha" or "security image";
     - words such as "not a robot" or "characters you see".
   - **A credential or second-factor code.** Detected from a password field, `autocomplete="one-time-code"`, or code wording.
   - **A payment confirmation.** Detected from `autocomplete="cc-*"` fields, or wording such as "confirm your payment", "authorize payment" or "3-D Secure".

   Every other dialog is `BLOCKED_BY_DIALOG`, even when no dismiss control is recognised. This follows the brief: "needs a person" means only those three.
3. **A page that is itself a challenge.** This is `challengeGateFailure`, the sign-in rule's twin. The target must be missing, which means one of:
   - the resolver reported `web.target.not_found`;
   - the target's selector matches nothing;
   - a URL claim failed.

   If the page's own declarations or headings also show a robot check or a code prompt, the result is `USER_INTERVENTION_REQUIRED`. Before this change, the robot page's missing "Accept" was `web.target.not_found`, which Core hands to the model.

   The page scope is deliberately narrower than the dialog scope: headings and declared markers only, and no card or password rule. That keeps an ordinary checkout page or sign-in page out of it. `AUTH_REQUIRED` still runs first.

### Files

**Domain**
- `domain/src/runtime/failure/codes.ts`: new closed code `BLOCKED_BY_DIALOG: "web.action.blocked_by_dialog"` → `unexpected_state`, not retryable, stage `execution`.
  - `unexpected_state` rather than `blocked_by_capability_or_policy`, which Core also treats as manual.
  - The `USER_INTERVENTION_REQUIRED` gloss is narrowed to what only a person can answer.
- `domain/src/runtime/llm-evidence/action-failure.ts` and `tool-rejection.ts`: the model-facing mapping.
  - `BLOCKED_BY_DIALOG` → `blocked_by_dialog`.
  - `USER_INTERVENTION_REQUIRED` and `AUTH_REQUIRED` → a new rejection code, `needs_person`. `AUTH_REQUIRED` was `action_failed`.
  - A robot check is therefore never offered to an exploring model as a dialog to close. `WEB_LLM_EVIDENCE_RESULT_CODES` derives `web.action.rejected.needs_person` automatically.

**Extension**
- `apps/extension/src/content/action-runtime/blocking-dialog.ts` (new) and `challenge-evidence.ts` (new).
- `results.ts`: uses them. The modal helpers moved out, and the file went from 432 to about 411 lines.
- `actions/{click,clear,keypress,select,type}.ts`: pass `blockedAt: report.point`.
- `actions/page-identity.ts`: `BLOCKED_BY_DIALOG` joins the codes that `PAGE_CHANGED` never supersedes.

**Tests**
- `domain/src/runtime/failure/tests/codes.test.ts`:
  - a new table row;
  - a new test that runs both codes through Core's real `buildAutomationStudioRuntimeDeterministicDiagnosis`. A dialog gives `model_required`; a challenge gives `manual_intervention` with `stillAchievable: "no"`.
- `domain/src/runtime/llm-evidence/tests/page-refusal.test.ts`: the modal fake now reports `BLOCKED_BY_DIALOG`, and there are mapping rows for `needs_person`.
- `apps/extension/e2e/content/tests/dialog-refusal.spec.ts` (new) replaces the deleted `modal-intervention.spec.ts`. It has 14 rows against real fixtures:

  | Fixture | What stands over the target | Expected result |
  | --- | --- | --- |
  | auction-marketplace | App promotion | `blocked_by_dialog` |
  | everything-store | Notifications prompt | `blocked_by_dialog` |
  | everything-store | Robot check | `intervention.required`, nothing typed, no `robot-check-error` |
  | crossborder-marketplace | Role-less welcome popup | `blocked_by_dialog` |
  | modal-flows | Page-opened invite dialog (inert shape) | `blocked_by_dialog` |
  | modal-flows | W14 interstitial | `blocked_by_dialog`, still not clicked through |
  | modal-flows | Consent banner | Still `web.action.rejected` |
  | Injected aria-modal dialogs (6 rows) | Robot check, captcha frame, password, one-time code, card form, payment confirmation | `intervention.required` |
  | Injected aria-modal dialog | Plain "Not now" promotion | `blocked_by_dialog` |

Core: no change. The mapping did not need one.

## Commands run and observed results

Every Lab run used `FLUXIQ_TEST_ENV_FILES=none` and `--target persistent-isolated`, one at a time. `FLUXIQ_LAB_ALLOW_BEHIND_CORE` was never used. Bundles are under `F:\fxwork\t062\!FluxIQWebExtension\test-runs\`.

### Setup

- The first robot baseline was refused as a stale Core build (campaign `2026-09-21T22-08-13-824Z`, 0 calls): `evidence-loop.ts` was newer than dist.
- I rebuilt Core's generated output with `pnpm --filter fluxiq build` in `F:\fxwork\t062\!FluxIQ` → exit 0. No source changed.

### Live runs

| # | When | Command | Run | Observed |
|---|---|---|---|---|
| 1 | before | `node scripts/lab/live-campaign.mjs everything-store-refuse-robot-check -- --target persistent-isolated --workspace t062-store --replays 1` | `run-mubstn67-603e02a8` | `failed` at `scenario.execute` (unclassified), `flowCreated: false`, 0 calls, 125 s. See note 1. |
| 2 | after | `node scripts/lab/run-lab.mjs run auction-marketplace --workflow watch-endings --target persistent-isolated --workspace t062-auction --flow` | `run-mubtbubd-c85bc65d` | Flow built (`flow.7f5b301e-…`, 9 candidates). See note 2. |
| 3 | after | `node scripts/lab/live-campaign.mjs auction-marketplace-repair-watch-redesign -- --target persistent-isolated --workspace t062-auction --replays 1` | `run-mubterkd-77a5c4f0` | Flow recorded and built. The first node failed the same way. `harnessRecovery.refusalCode: null`. See note 3. |
| 4 | after | same as #1 | `run-mubtl7s1-c384d1f9` | Identical to #1: the recording's `accept-cookies` step was intercepted. `flowCreated: false`, 0 calls, 53 s. |

1. **Run 1.** The recording's own `accept-cookies` Playwright click timed out: "`<div id=":r13b8o:">` intercepts pointer events". The screenshot shows the "Never miss a deal" prompt up. The Core action probe had run first. This is L1.
2. **Run 2.**
   - The replay's first node, Accept all at (76,683), failed with `{"category":"unexpected_state","code":"web.action.blocked_by_dialog"}`. The record's `actual` is "covered: the point 76,683 landed on div.css-0qro67x, which covers the target; a dialog is open over the page and asks for nothing only a person can give, …".
   - `harnessRecovery.refusalCode` was `llm.gate.training_mode`, because this lane has no provider.
   - Lane C #2 ended `user_intervention_required` on the same node.
3. **Run 3.**
   - **Provider calls.** `observed.calls` 1, `runtime_diagnosis` at stage `gather`: 3,985 in and 390 out = 4,375 tokens, $0.0022682. `gate.invoked: true`, `patchSkippedCode: llm.runtime_patch_not_requested`.
   - **Core's stage record** (project database, read-only). The diagnosis stage shows `failureClass unexpected_state`, `resolution model_required`, `candidateKind action_target_override`. The model then returned `stillAchievable: "no"` and `deterministicRecoveryPossible: "no"`, with confidence 0.55.
   - **Plan.** `steps ["stop"]`, `allowedPatchKinds ["temporary_target_override","temporary_wait_retry"]`, `explorationRequested false`, `patchRequested false`. So there was no exploration, no patch and no adaptation. The oracle failed, with 0 of 5 records matched.
   - **Bundle build time.** The extension bundle for this run was built at 15:26:13. After that I changed `blocking-dialog.ts` in two ways: a `try/catch` became a `CSS.supports` check (required by the structure audit), and I edited comments. Behaviour in Chromium is the same, and the content specs below ran on the final code.

Total live spend: **$0.0022682, over 1 provider call**.

### Focused tests and checks

- **Content spec.** `pnpm test:content -- e2e/content/tests/dialog-refusal.spec.ts --workers=2` (in `apps/extension`) → 14 passed (23.4 s).
- **Content specs, final code.** Rerun with `failures.spec.ts`, `click.spec.ts` and `actions.spec.ts` (`--workers=3`) → 62 passed (28.1 s).
- **Domain.** `codes.test.ts`, `page-refusal.test.ts`, `vocabulary.test.ts` and `client/tests/gateway-mapping.test.ts`, bundled as `scripts/test-domain.mjs` does, then `node --test` → exit 0; 20 pass, 0 fail. That includes the new Core-routing test.
- **Extension units.** `actions/tests/{click,execute,page-identity}.test.ts` and `action-runtime/tests/validation-outcome.test.ts`, bundled as `scripts/test-extension.mjs` does → exit 0; 24 pass, 0 fail.
- **Test-runner.** `node --test dist/demo-llm-create-ui/tests/failure-sanitizer.test.js` (it reads the published result codes) → 4 pass, 0 fail.
- **Core recovery.** `npx vitest run` on `recovery/tests/{deterministic-diagnosis,plan,stages}.test.ts` (in `packages/fluxiq`) → 3 files, 57 tests passed.
- **Structure audit.** `node scripts/structure-audit.mjs` in the downstream worktree first failed twice on my new file:
  - `swallowed-failure`, then `failure-as-empty`, both on the `:modal` `try/catch`.
  - Fixed with a `CSS.supports("selector(dialog:modal)")` check → "passed (84 warning(s), 122 baselined)".
- **Downstream check.** `pnpm check` → exit 0. Structure audit passed, and each package's check printed "Done".
- **Core check.** `pnpm check` in `F:\fxwork\t062\!FluxIQ` → exit 0. Structure audit "passed (170 warning(s), 361 baselined)", and `packages/fluxiq`, `client-gateway-websocket` and `apps/web` checks printed "Done".

## Not verified

- **The robot check, live.** No Flow could be recorded on everything-store (L1, 2 of 2), so these are unproven end to end:
  - the Lab replay reporting `user_intervention_required`;
  - the repair judgement ("expect refusal").

  The real-page content-harness row stands in for the extension half. Core's half is covered by the domain test through Core's own diagnosis, and by lane C's live evidence that this category gets `llm.gate.manual_intervention` and 0 calls.
- **What the model does with the new `needs_person` rejection during exploration.** No live exploration met one.
- **The dialog's controls ranked first.** For the auction promotion (aria-modal), P2's `front-layer.ts` applies unchanged. For a role-less popup (crossborder), the capture's dialog evidence does not list it, so its controls are probably *not* ranked first. That was not measured.
- **Firefox and the Chromium-baseline content configurations.** Only the default Chromium content configuration ran.
- **Full suites.** None ran, as the brief asked.
- **The deal-wheel variant.** Not run; it is the same aria-modal shape as the notifications prompt.

## Open questions or contradictions found

1. **W14 now contradicts the manifest.** `apps/scenario-lab/src/scenarios/modal-flows/manifest.ts`, variant `interstitial/armed`, expects `failure: { category: "user_intervention_required" }` and says "the run must stop for the user rather than click through or dismiss it". Under this brief's line, that offer ("No thanks") is a dialog recovery may deal with, and it now reports `unexpected_state`. So the W14 Lab row will report a category mismatch.
   - The fix belongs in scenario-lab, which I must not touch: change the expectation, or better, expect recovery to close the offer.
   - `packages/test-runner/src/bench/tests/week1-corpus.test.ts` pins W14 to `user_intervention_required` and must move with it.
2. **Next blocker for the auction repair: Core recovery, not classification.**
   - The model was asked, and answered "not achievable". The only patch kinds offered were target override and wait/retry. Neither can express "close the dialog, then press".
   - Nothing requested recovery exploration, which could press "Not now". Per `w2x-exit-loop-gap-audit`, recovery exploration cannot press under the default policy anyway.
   - Separately, the Flow meets the promotion at all only because Core's replay is slower than the recording (lane C open question 2).
3. **Covered targets are still classed as a policy refusal.** A covered target that is *not* a dialog (a cookie banner) is still `web.action.rejected` → `blocked_by_capability_or_policy`, which Core also treats as manual. By the capability rule, a covering banner is not a policy refusal either. This brief's line leaves it alone, and the e2e row keeps it pinned.
4. **Nothing refuses an action aimed *inside* a challenge.** The rule explains refusals; it does not make them. An exploring model could still type into a robot check's own field. I did not add a pre-action guard, because a page-wide captcha test would also block ordinary forms that carry a reCAPTCHA v2 checkbox. Decide whether a narrower guard is wanted.
5. **Documentation (not mine to edit).** `docs/architecture/failure-taxonomy.md` needs three changes:
   - a `BLOCKED_BY_DIALOG` row;
   - its modal paragraph rewritten;
   - its reference to `modal-intervention.spec.ts` changed to `dialog-refusal.spec.ts`.
6. **L1 still blocks the everything-store recording lane.** It blocks the robot-check refusal task (seen 2 of 2). It very likely also blocks the redesigned-search repair task: `add-to-cart` starts with the same `openStore` steps, but I did not run it. Until t061 lands, the robot-check live proof cannot be taken.
