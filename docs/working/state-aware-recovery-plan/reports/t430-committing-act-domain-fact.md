# t430: which acts commit is the domain's fact (worker report)

Trees: `fxwork/t430/!FluxIQWebExtension` and its Core `fxwork/t430/!FluxIQ`, branch
`task/t430-committing-act-domain-fact`. Nothing is committed.

## Outcome

Done.

- Gate 3 no longer lets a step's `consequences: none` override the domain's `effect: "ambiguous"`. The helper is deleted.
- A committing act whose answer was lost is now settled by the page through the effect check. This also covers a step
  with no `done when:`.
- Row 9 and case 1 both pass provider-free.

## What changed and why

### 1. The declared-none override is gone (Core)

- `runtime/executor/defensive/assess.ts`:
  - Gate 3 is back to `producerSaysActed = failure.effect === "ambiguous" && !repeatIsSafe(node)`.
  - The comment now says why: the producer's statement outranks the declaration, because a model under-declares.
- `defensive/declared-no-lasting-act.ts`: deleted, along with its barrel line. Nothing else used it.
- `defensive/tests/assess.test.ts`: the 61f6adbf test is replaced by three tests.
  - A committing act whose answer was lost is refused with `actUncertain` whatever the step declared: `[]`, a lasting
    class, nothing, or `destructive`.
  - An act the producer states nothing about still retries when declared none or undeclared. It is held back when it
    declares a lasting class. This is the user's rule that every node retries.
  - An effect check that answers `not_landed` makes a committing act retry as `unacted`.

### 2. Why row 9's effect check could not decide, and the fix at its cause

Round 1's first row-9 launch (`rmx-...06-45-59-651Z-322a4c`, Core e396d489) failed like this:

- The fault counted presses and dropped the acknowledgement of an opening dismiss press (s3).
- That press failed with `timeout/web.action.timeout`, stated `ambiguous`.
- The effect check had nothing to read:
  - At that time Core did not reconcile lost commands by id. t409 added that since.
  - The step had no expected state. Only `expectedState` was read (t404's C7), and `done when:` did not exist until t413.
- So it answered `unknown`, and Core refused.

61f6adbf patched the symptom by trusting the declaration.

Today a dropped acknowledgement is reconciled by command id first (t409). What was still missing is a press whose
failure is genuinely ambiguous, on a step with no `done when:`. The effect check still had nothing to read there, so
I gave it the page:

- **Core** `runtime/host-runtime.ts`:
  - New optional `actLanded(input)` on `AutomationStudioHostRuntimeBoundary`.
  - The input is `{ node, attemptId, timeoutMs, signal? }`; the answer is `landed`, `not_landed` or `unknown`.
  - Two exported types: `AutomationStudioHostActLandedInput` and `AutomationStudioHostActLanding`.
- **Core** `defensive/host-act-landed.ts` (new): `automationStudioHostActLanded`. A missing method, a throw, or any other
  answer becomes `unknown`.
- **Core** `executor/transition-comparison.ts` `automationStudioHostEffectCheck`:
  - A node with no expected state now asks that hook, with the node's readiness ceiling as the window.
  - A node with an expected state is judged exactly as before.
  - `defensive/effect-check.ts` documentation is updated to match.
- **Domain** `runtime/act-landing/` (new; barrel plus three files):
  - `pressed-control.ts`: the press's target as a fact target. It covers `web.output.dom-click`, or
    `builtin.policy.action` with `outputId: web.dom.click` and `parameters`. It carries the selector, element, shadow
    hosts and frame.
  - `landing.ts`, `webAutomationActLanded`: one `visible` fact about the pressed control, asked again every 500 ms
    until the window ends:
    - The control is no longer shown → `landed`. Its layer or page went with it.
    - It is still shown at the end and its accessible name is only a way out → `not_landed`, so it retries. The look
      waits out the window first, so a layer still animating out is not pressed twice.
    - Anything else → `unknown`: a "Confirm" or "Get coupons" still shown, a page that cannot say, a non-press.
    - The step's declared consequences are never read.
  - `way-out-label.ts`: what counts as a way out.
    - Admitted: close, dismiss, minimise, not now, no thanks, maybe later, remind me later, got it, and a close glyph.
    - Refused if the label has a consequential word anywhere, e.g. "Close account".
    - Deliberately excludes Decline, Reject, OK, Hide, Not interested and Skip.
- **Domain** `runtime/host-runtime.ts`: `actLanded: (input) => webAutomationActLanded(input, factEvaluator)`.

### 3. Domain tests restored, and docs

- `node-run/retries/tests/dispatch.test.ts`:
  - 1ea9b038's pair is now one test. A press whose confirmation was lost after it acted is not pressed again, whether
    it declared `["modify_existing"]` or `[]`.
  - 1ea9b038's `dispatch.ts` behaviour is kept: a call that declared nothing writes no key. Only its comment changed,
    because it cited the deleted helper.
- Docs: Core `docs/architecture/automation-studio.md` and downstream `docs/architecture/web-capabilities.md` each gained
  a paragraph on `actLanded` and on the withdrawn override.

## Commands run and observed results

All in the t430 trees.

**Baseline**

- `DOMAIN_TEST_BUILD_LABEL=t430 node scripts/test-domain.mjs src/runtime/tests/lasting-act-statement.test.ts src/runtime/llm-evidence/node-run/retries` (domain, before the change) → 42 pass, 2 fail. The failures were "a click whose confirmation failed…" and "typing that sends its form…", reproducing the sweep.

**Core vitest** (`packages/fluxiq`)

- `npx vitest run …/executor/defensive …/executor/step-loop …/executor/tests/effect-check …/executor/tests/transition-comparison.test.ts` → 17 files, 146 tests passed.
- `npx vitest run src/programs/automation-studio/runtime/executor` → 91 files, 785 tests passed.
- Other Core tests that use `declaredConsequences: []` → 11 files, 90 passed:
  - `flow-draft/carried-step`
  - `llm/node-tools/tests/draft-from-flow.test.ts`
  - `llm/tests/evidence-loop-seeded-draft.test.ts`
  - `runtime/tests/refuted-result`

**Core check and audit**

- `pnpm run check` in `packages/fluxiq`:
  - The first run failed on the new test: `Promise<string>` was not assignable. I fixed the stub's return type.
  - The rerun exited 0 (`fluxiq:check … stored`).
- `node scripts/structure-audit.mjs` (Core):
  - The first run flagged one `as never` in the new test, which I replaced with `Reflect.set`.
  - The rerun: `passed (322 warning(s), 1160 baselined)`.
- `pnpm --filter fluxiq build` (Core) → exit 0, twice; the second build came after the barrel reorder.

**Domain**

- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` → no output, no errors.
- `DOMAIN_TEST_BUILD_LABEL=t430 node scripts/test-domain.mjs src/runtime/tests src/runtime/llm-evidence/node-run src/runtime/act-landing` → 417 tests, 417 pass, 0 fail. This includes:
  - both sweep failures, now ok #402 and #403;
  - the restored dispatch test, #57;
  - the new act-landing tests and the host-runtime `actLanded` test, #395.
- Downstream `node scripts/structure-audit.mjs` → `passed (184 warning(s), 651 baselined)`.

**Recovery matrix (headed, provider-free)**

The Lab rebuilt domain, extension and test-runner first.

- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --row 9` → `rmx-2026-10-10T20-40-19-091Z-3b29da`, case 9 **passed**.
  - Run `succeeded`, 13 attempts.
  - The fault fired on Jonas's confirm (s10). s10 settled `succeeded` after about 30 s, and no second Jonas press
    appears in the relay log.
  - Site: 4 confirmed, `confirmations: 4`, `duplicatedActs: 0`, 0 model calls.
- `FLUXIQ_TEST_ENV_FILES=none pnpm lab recovery-matrix --case 1` → `rmx-2026-10-10T20-44-13-557Z-5ac1ed`, **passed**.
  - Run `succeeded`, 16 attempts.
  - Site: 3 pieces, 1 add, coupon held.
  - 0 calls, 0 duplicated acts, 1 retry.

## Not verified

- **The new `actLanded` path is not exercised by any live run.** Today's row 9 strikes Jonas's confirm, a committing
  act declared `modify_existing`, chosen by t404 after the press-count fault. Its lost acknowledgement is settled by
  t409's reconcile by command id before the effect check is reached. No matrix row times out a dismiss press with the
  reconcile unable to answer. The path is proven by unit and graph tests only:
  - Core `executor/tests/effect-check/tests/host-act-landed.test.ts`, with landed, not_landed, unknown, no hook, a
    throw, and a node with an expected state;
  - domain `act-landing/tests/*`.
- Whether the extension's fact check reports the expected `accessibleName` for a `[role="button"]` "Not now" div.
  Code reading says it does (`content/identity` `accessibleNameFor`), but no browser test asked it.
- No full suites were run, per the twice-a-day rule.

## Open questions or contradictions found

1. **The brief and the current row 9 disagree.** The brief describes row 9 as a timed-out dismiss press. Since t404
   the row's fault strikes Jonas's Confirm by selector, and its fault-target test requires a step with a lasting
   consequence. If the supervisor wants the dismiss case proven live, it needs a new case, with two parts:
   - a perturbation that makes a dismiss press answer an ambiguous failure the reconcile cannot settle;
   - a relay change, because the relay strikes only committing acts, which includes a click.
2. **The word list is duplicated.** `way-out-label.ts` repeats the extension's consequential-word deny-list
   (`apps/extension/.../interference/consequential-word.ts`), because the extension's copy sits in content-script
   code. The right home for one shared list is the domain, imported by the extension. That is a follow-up refactor I
   did not touch.
3. **t413's fact rule still reads the node's declaration.** A `done when:` fact that is `false` maps to `not_landed`
   when `automationStudioNodeActLasts(node)` is false, so it still reads the declaration. In that case the page fact
   (false) is what proves the act did not land. I left it unchanged, but the supervisor may want it to also consult
   the producer's `ambiguous` statement.
