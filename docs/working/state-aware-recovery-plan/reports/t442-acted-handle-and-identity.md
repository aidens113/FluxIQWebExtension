# t442: a control exploration acted on keeps its handle and its identity at the act

Worker report. Branch `task/t442-acted-handle-and-decision-shape` in both worktrees. Nothing is committed.

## Outcome

**Partial.** Items 1, 2, 3 (F1) and 5 (F5) are done and validated. Item 4 (F2) is **blocked**: the only channel
that could carry an effect onto a candidate's saved node runs through a Core file this brief does not give me.
Details are under F2 below.

## What changed and why

### 1. A step's result names the control it acted on by handle (domain)

- `node-run/outcome.ts`: new `controlHandle?: string` field beside `control`. It is the model's own `tN`, never a
  locator. It is absent for a look, a navigation, or a step that was only written.
- `node-run/run.ts`: `named` is the first target handle of a call that is not a navigation. The success outcome
  writes `controlHandle: named`. The look path writes `undefined`.
- `controlHandle` is not one of the domain's view keys (`WEB_LLM_VIEW_KEYS`), so Core's context window keeps it
  after it replaces the view.
- It also counts as a printed handle (`printed-handles.ts`, `line_start`).
- `node-run/written-step.ts` is not a named file, but it needed a one-token edit (`controlHandle: undefined`).
  `present<WebNodeOutcome>` requires every key, so the field could not be added without it.
- Line budget: `run.ts` is still 798 lines. I folded the old pressed-handle lines into the new block and removed an
  orphan duplicate doc comment above `shownWords`.

### 2. Core refusal advice and refusal key (`flow-bootstrap/candidate/submission-refusal.ts`)

- **Advice.** When any issue's reason is `unknown` or `not_a_control`, the advice now adds one sentence, said once
  per refusal:
  - a control the build already acted on is named by handle in that call's result, and stays there after its view
    is replaced: copy that handle, never a line of text the act removed;
  - `core.recall_result` with the callId of the result that showed a replaced view gives that view back whole.
- The wording is generic: it names no site and no scenario. Core cannot know which control was pressed, so the
  advice points at where the handle is, and item 1 makes that true.
- **Refusal key.** `refusalCode` now keys each issue as `code@line#handles`. The handles come from the issue's
  `handles` (with `@location` when one was written), sorted.
  - A resubmission that changes the refused handles is a new refusal.
  - A byte-identical one keys the same as before.
- The header records both changes.

### 3. F1: a handle exploration acted on saves its identity from before the act (domain)

- **`plan-resolution/target-packets.ts`:**
  - `FlowPages.acted` is a map from handle to `PageTarget`, holding 4096 handles per Flow; the oldest goes first.
  - New store method `acted(scope, handle, before)` records the handle's target from the pre-act binding
    (`targetsOf(before)`).
    - It keeps the **first** act's view, because a Flow meets the control as exploration first did.
    - It records nothing when the pre-act look lacks the handle or shares its address.
  - `resolve` under `view_history` applies `actedAs`. It replaces the element identity and words with the acted-on
    ones, but only while the resolution still names the same address (frame, shadow hosts, selector).
  - `addressOf` now takes `Pick<PageTarget, "selector"|"frameId"|"element">`, so it serves resolutions too.
  - **Exploration (no `reach`) is unchanged.** It keeps t356's agreed identity, so the veto concern still holds.
- **`node-run/run.ts`:** after a successful act on any element (`effect === "mutate"`, not a navigation, with a
  handle), it calls `run.stores.targets.acted(buildOf(run), named, current)`, where `current` is the binding from
  before the act. The press-only `pressed` call is unchanged, apart from now using `named`.
- **Header comments** were updated in `target-packets.ts`, `element-identity.ts` (on
  `webPlanElementIdentityAcrossViews`) and `resolve-plan-node.ts` (the t358 paragraph, written to keep the file at
  exactly 800 lines).

### 4. F2: the act's after-state as the step's effect — blocked, nothing written

Why it cannot be done inside this brief's files:

- A candidate node gets `metadata.routeSignatures` only from a plan node's `routeSignatures`
  (`flow-bootstrap/adaptation.ts:244`). Nothing on the candidate path sets one:
  - `submission.ts:15` omits `routeSignaturesOf`;
  - `bootstrap-completion.ts:486-491` strips any `routeSignatures` the model writes.
- The only domain→Core channel during a submission is the resolution answer. Core reads it strictly in
  `llm/harness-options/plan-parameter-resolution.ts:295-313` (`exactKeys`): `{status, parameters}`, plus
  `handleViews` under `handleReach`.
- So a domain that emitted an effect today would get every resolved node of every plan refused as
  `bootstrap.parameter_resolution_invalid`.

What F2 needs, as a follow-up brief:

1. **Core `llm/harness-options/plan-parameter-resolution.ts`.** Under `handleReach`, accept a resolved answer that
   carries a bounded `effect` (read with `automationStudioReadRouteSignature`), and write it onto the plan node as
   `routeSignatures: { effect }`. `adaptation.ts` already carries that onto the node's metadata, and
   `state-routing/decision.ts` `ownEffect` already reads it.
2. **Domain `run.ts` and `target-packets.ts`.** At the act, keep `webAutomationRouteEffect(routeState(current),
   routeState(after))` beside the acted identity. This needs the domain's projection of page evidence to a route
   state, which I did not trace. Then `resolve-plan-node.ts` emits it under `view_history`.

I wrote no half of this, so no unused machinery is left behind.

**`flow-draft/verify-only.ts` needs no change.** Its `present` answer is decided by the host when a target is gone
from the page the step acted on (`node-run/verify.ts` → `webNodeReplayMissingTarget`). With F1, the saved identity
names "Get coupons", so on a page that already reads "Collected" the check should answer `present` without F2.
That depends on the extension's identity veto refusing the "Collected" div, which I did not exercise (see Not
verified).

### 5. F5: the save floor (`element-fingerprint/signals.ts`)

- **The rule.** A single unquoted class token is not counted as a signal when nothing but the tag's kind is said and
  there is no explicit `role`.
- Implied role and input type count as part of the tag's kind.
- A second class token, an explicit role, or any other signal (words, label, name, id, test id) makes the class
  count again.
- The header explains the rule with the coupon case.

**Measured against the existing populations.** I ran these directories with the rule on, 540 tests:

- element-fingerprint, plan-resolution, node-run, target, packet-fingerprint;
- client gateway-mapping, output-nodes/targets, recording/web-state;
- recorded-identity-shortfall, recovery-selector-hints, renamed-save-override, press.

It flipped exactly 3:

1. `shortfall.test.ts`, "the same box with its label, or its class, is saved": `{input, selector #id,
   classNames [qty-input]}` is now refused. Updated to a two-class box being saved and the one-class box refused.
2. `shortfall.test.ts`, "a class token the selector does not quote still counts": `{div, div.card > div.thumb,
   [thumb, lazy]}` (one unquoted token) is now `["kind"]`. Updated, with a three-token row kept for the counting
   case.
3. `identity-stable-facts.test.ts`, "a label a newer view of the same handle changed is dropped": a quantity box
   that nothing acted on, whose label two looks disagree on, falls to `{input, class q7k2-qty}`. A step naming it
   is now refused `web.handle.unidentifiable`.
   - **This is the real cost of F5.** A control nothing acted on, whose words changed between looks and which
     carries one class, can no longer be saved. The model can only drop the step or name another control.
   - The label-drop row now uses a two-class box, and a new row pins the refusal.

The wider final run, which added all of `llm-evidence/tests` and `src/tests` (745 tests), flipped nothing else.
Shapes the rule now refuses, pinned in `shortfall.test.ts`:

- the coupon `{div, class b}`;
- `{button, implicitRole button, class b}`;
- `{input, inputType checkbox, class b}`.

### Tests added or changed

- **Domain `plan-resolution/tests/acted-identity.test.ts` (new):**
  - the press result carries `controlHandle`, a look's does not, and `controlHandle` is not a view key;
  - through the node runner, a candidate's (`view_history`) step on a coupon that exploration collected saves
    `visibleText "Get coupons"`, `classNames ["b"]` and no "Collected";
  - exploration's resolution (`gatedByCaller`) keeps no words.
  - It lives here because `node-run/tests` is at the 25-file directory cap; `pressed-with-effect.test.ts` set the
    precedent.
- **Domain `plan-resolution/tests/target-packets.test.ts`, two store rows:**
  - the acted-on identity under `view_history`, with the first act kept and no-reach still agreed;
  - no acted identity lent to another address, and a handle nothing acted on keeps t356's behaviour.
- **Domain `element-fingerprint/tests/shortfall.test.ts` and `plan-resolution/tests/identity-stable-facts.test.ts`:**
  as described under 5.
- **Core `candidate/tests/submission-refusal.test.ts`, three rows:**
  - a loop where three resubmissions change the refused handle never warns or ends the round;
  - the acted-control advice is given for `unknown` and `not_a_control`, once in a mixed refusal, and not for
    `stale`;
  - `resultCode` differs by refused handle and is equal for the same handle.

## Commands run and observed results

- **Baseline, before any edit:** `DOMAIN_TEST_BUILD_LABEL=t442-base node scripts/test-domain.mjs
  llm-evidence/node-run/tests llm-evidence/plan-resolution/tests element-fingerprint/tests llm-evidence/tests/press`
  → `# tests 370 # pass 370 # fail 0`.
- **First run with the rule on** (12 directories, `t442-a`) → `# tests 540 # pass 537 # fail 3`. The three are the
  F5 rows listed above.
- **Mutation check.** With `actedAs` removed from `resolve`, `acted-identity` and `target-packets.test` gave
  `# pass 10 # fail 2`: the two F1 rows. The file was restored, and `git diff` shows only the intended change.
- **Domain typecheck:** `npx tsc -p tsconfig.json --noEmit` → exit 0, and `npx tsc -p tsconfig.test.json --noEmit` →
  exit 0.
- **Domain final run:** `DOMAIN_TEST_BUILD_LABEL=t442-final node scripts/test-domain.mjs element-fingerprint/tests
  llm-evidence/plan-resolution/tests llm-evidence/node-run/tests llm-evidence/target/tests
  llm-evidence/packet-fingerprint client/tests/gateway-mapping output-nodes/targets/tests recording/web-state/tests
  src/tests llm-evidence/tests` → `# tests 745 # pass 745 # fail 0`.
- **Core vitest:** `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/candidate/tests` →
  `Test Files 9 passed (9)  Tests 80 passed (80)`.
- **Core vitest, other readers of refusals:** `candidate-repeat-told`, `refusals-of-one-kind`,
  `service/candidate-failure/tests` and `model-facing/tests/handle-only` → `Test Files 4 passed (4)  Tests 16 passed
  (16)`.
- **Core typecheck:** `npx tsc --noEmit` in `packages/fluxiq`.
  - The first run failed with `TS18047 'entry' is possibly 'null'`.
  - Fixed with an `entry !== null` guard; it then exited 0.
- **Core structure audit:** `node scripts/structure-audit.mjs` → `structure-audit: passed (327 warning(s), 1159
  baselined)`.
- **Extension structure audit:** `node scripts/structure-audit.mjs`.
  - The first run gave 2 failures: `resolve-plan-node.ts` at 801 lines, and a test import past the
    `observed-state` barrel.
  - After fixing both it printed `structure-audit: passed (184 warning(s), 651 baselined)`.
- **Core dist regenerated:** `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket
  build` in the t442 Core worktree, so the domain checks compile against the new Core. `core-build.mjs` then printed
  "is current with its source".
- No Lab run, no provider call, no browser.

## Not verified

- **Live behaviour.** Nothing ran in a browser or the Lab. Two questions stay open:
  - whether a model actually copies `controlHandle` from the step result;
  - whether the extension's identity veto refuses the "Collected" div for a saved "Get coupons" identity, which is
    what makes the build test's check answer `present` on a page that already holds the coupon. The R4b report's
    proposed headed e2e on crossborder was not run.
- **F2** was not implemented (see above). `state-routing/decision.ts` `effect_holds` therefore still cannot fire for a
  candidate-created step.
- **Effect of the new refusal key on a real build.** A model that keeps rewriting wrong handles is no longer stopped
  by the run of refusals; only the no-progress guard bounds it now. I verified this only in the scripted loop test.
- **Whole package suites** (`pnpm check`, `pnpm test`, Core's full vitest) were not run, per the twice-a-day rule.

## Open questions or contradictions found

1. **F2 needs a Core file this brief does not give me:** `llm/harness-options/plan-parameter-resolution.ts`, plus
   the domain's route-state projection. The brief named `verify-only.ts` as the possible Core file, but
   `verify-only` needs no change and cannot carry an effect anyway.
2. **The cost of F5** (item 5, row 3). A control nothing acted on, whose words differ between two looks and which
   has one class token, is now unsaveable. F1 removes the coupon case, because the coupon was acted on. The
   supervisor should confirm the rule is still wanted for controls that were never acted on.
3. **Keep-first acted identity.** If exploration acts on a handle twice, for example to toggle it back, the first
   act's view wins. I chose this because a Flow runs from the start state. Say if the newest act should win
   instead.
4. **Placement.** The item-1 test is in `plan-resolution/tests/acted-identity.test.ts`, not
   `node-run/tests/run.test.ts`, because `node-run/tests` already holds 25 files, the directory cap.
