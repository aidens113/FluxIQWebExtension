# t195-w20g: the gate keeps the names it was shown; a declined press can be re-declared

## Outcome

Partial. Both fixes are written and tested:

- Fix 1 (pickup audit #7) is complete in Core.
- Fix 2 (pickup audit #6) is complete for `press.ts`, which is the repair path through `pressControl`.

The model-facing `run_node` refusal is in t223's `node-run/run.ts`, which I did not edit. The exact change t223 must make is below.

Every named check passes except `pnpm --filter @fluxiq-web-extension/domain check`. It fails on errors in two files this brief does not own, both under `node-run/`.

## What changed and why

### Core: `packages/fluxiq/src/programs/automation-studio/runtime/action-permissions/gate.ts`

- `shown` was a `string[]` that stopped recording once it reached `MAX_SHOWN_CHARACTERS` (4,000,000). It is now a `Set<string>` of normalised strings, kept oldest first.
  - When a string is shown again, it is moved to the newest end and counted once.
  - `observe` always records the whole execution. It then evicts the oldest strings until the total is within the budget.
  - The newest string is always kept, even when that one string alone is over the budget.
- `carriedName` now uses a new private `wasShown(name)`. It does an exact `Set.has` first, then a substring scan, which is the same match as before.
- Comments: the constant's doc, the `shown` field doc, and one sentence in the header's "Nothing past the evidence boundary" passage.
- The file is now 434 lines, up from 408. The structure audit warns past 400 (advisory) and does not fail.

### Core: `action-permissions/tests/gate.test.ts`

Three new cases:

- **"names a control shown after the budget was spent, by forgetting the oldest text instead".** It observes 40,001 distinct 100-character filler strings (4,000,100 characters, asserted to be over 4,000,000), then a packet holding "Place order". The test expects `request.control.name === "Place order"`.
- **"counts a string shown again once, so a header on every page does not spend the budget".** It shows a header of about 3,000,000 characters twice, in two orders:
  - header, header, then Place order. This fails at HEAD.
  - Place order, header, then header. This fails if a repeat is counted twice.
  - In both orders the name must be carried.
- **Pin: "lets a declined control through re-declared as nothing, and still asks about Place order".** The steps are:
  1. Decline "Continue to checkout" with `[move_money]`.
  2. The same control with `[]` is permitted.
  3. "Place order" with `[move_money]` raises `permission-request:2`, named "Place order".
  4. After a grant, it is permitted.

### Downstream: `domain/src/runtime/llm-evidence/press.ts`

- New export `WEB_DECLINED_PRESS_INSTEAD`, a frozen list: `["declare only what this press itself does", "[] for a press that only opens a page or a form"]`. Its doc comment explains why it exists.
- The `permission_required` refusal now sets `instead: permission.declined ? WEB_DECLINED_PRESS_INSTEAD : undefined`. It is set only for `consequences_declined`.
- It is exported so that `run.ts` can use the same text, and so the text cannot drift between the two refusal sites.

### Downstream: `domain/src/runtime/llm-evidence/tests/press.test.ts`

- The existing declined/still-asked test now expects the declined detail to carry that `instead`. The not-granted detail is unchanged and has no `instead`.

### What t223 must make in `node-run/run.ts` (not edited, per the brief)

At the `permission_required` refusal, around lines 321-325 at the time of reading:

```ts
// import beside the other llm-evidence imports:
import { WEB_DECLINED_PRESS_INSTEAD } from "../press";
// in the refusal:
-        target: undefined, instead: undefined, missing: permission.missing, requestId: permission.requestId ?? undefined
+        target: undefined, instead: permission.declined ? WEB_DECLINED_PRESS_INSTEAD : undefined, missing: permission.missing, requestId: permission.requestId ?? undefined
```

Check that `run.ts` importing `../press` creates no cycle. `press.ts` imports `./capture`, `./permission`, `./elements`, `./sanitize` and `./tool-rejection`, and none of them import `node-run/`.

In `tool-rejection.ts`, the `consequences_declined` doc line (around 299-302) should change. Today it says "do the task another way or finish without it". It should say something like: "the person declined this press as declared. Do not make it again with that declaration. `instead` says what to do: declare only what this press itself does, `[]` for a press that only opens a page or a form. A press that really does what was declined is not made."

The test for that path is `tests/tool-rejection-detail.test.ts`, the declined press through `run_node`. It should expect the same `instead`.

## Commands run and observed results

- **Core tests.** From `packages/fluxiq`: `npx vitest run src/programs/automation-studio/runtime/action-permissions`. Result: `Test Files 5 passed (5)`, `Tests 71 passed (71)`. The header case takes about 690 ms.
- **Core revert check.** I put `gate.ts` back to its HEAD version and ran `gate.test.ts`. Result: `Tests 2 failed | 22 passed (24)`. The two failures were the budget case and the repeated-string case; the pin case passed, as expected. I then restored the file and confirmed it with `cmp`.
- **Core mutation check.** I changed the code so a repeated string is counted twice: `if (this.shown.delete(text)) this.shownCharacters -= text.length;` became `this.shown.delete(text);`. Result: `1 failed | 23 passed`, the repeated-string case. I restored the file and confirmed it with `cmp`.
- **Core type check.** `bash .../heavy.sh "t195-w20g core tsc" npx tsc --noEmit -p tsconfig.json` printed no errors, exit 0.
- **Domain tests.** `node .../scratchpad/run-dir-tests.mjs domain w20g runtime/llm-evidence/tests/press.test.ts` printed `tests 12, pass 12, fail 0`.
- **Domain revert check.** With `press.ts` at HEAD, the same command printed `pass 11, fail 1`, the declined test. I restored the file and confirmed it with `cmp`.
- **Domain check (failed).** `bash .../heavy.sh "t195-w20g domain check" pnpm --filter @fluxiq-web-extension/domain check` exited 2. The cause is `src/runtime/llm-evidence/node-run/missing-target.ts(46,53): error TS2339: Property 'remembered' does not exist on type ...`. That file is untracked (`??`), so another worker is writing it.
  - I then ran `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json --noEmit` directly.
  - The src config gave the same `missing-target.ts` error.
  - The test config gave `node-run/verify.ts(150,..): Cannot find name 'JsonObject'` three times.
  - Neither config reported an error in `press.ts` or `press.test.ts`.
- **Structure audits.** `node scripts/structure-audit.mjs`:
  - Core: `passed (206 warning(s), 353 baselined)`.
  - Extension: `passed (138 warning(s), 118 baselined)`.

## Not verified

- The domain check could not finish green, because of other workers' files in `node-run/`.
- I did not check through a model whether the new `instead` changes what the model declares. There was no Lab, no browser and no model call.
- The `run_node` path, which is what the model actually sees during a build, still sends no `instead` until t223 applies the change above.
- How much of the 4,000,000 budget real packets after t223 actually use.
- How much eviction costs on large builds. Each `observe` normalises every string, as it did before. The substring scan in `carriedName` covers at most 4 MB of text per check.

## Open questions or contradictions found

- **One huge string.** If a single shown string is larger than the whole budget, it is kept alone and everything older is evicted. I chose this because it is what the model sees now. The alternative is to refuse it and keep the older text.
- **gate.ts length.** `gate.ts` is now 434 lines, above the 400-line advisory threshold. It was already above it at 408.
