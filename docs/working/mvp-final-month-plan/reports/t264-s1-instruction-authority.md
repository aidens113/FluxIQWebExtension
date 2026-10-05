# t264-s1 instruction authority: report

## Outcome

Done. A4 (t174-w107, per-act instruction read) and lane B's F1 (kind fallback) are ported onto the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t264/!FluxIQ`, which is on branch `task/t264-core-integration-chain`. They are merged with t262's source-grounded split acts. Split acts are now grounded by their clause in the read. Sets A and B pass, apart from failures already in the baseline. `fluxiq:check`, the structure audit, the Core build and the downstream domain check all exit 0. One set-B test changed result because the kind rule makes its expectation stale. I updated it inside an owned file, and the supervisor should read the explanation in "Open questions".

## What changed and why

Ported units:
- **A4 (t174-w107), all its owned hunks.** These are:
  - `action-permissions/instructed.ts`: the per-act schema, the read, `automationStudioInstructedReadUnanswered`, `automationStudioInstructedActReads`, the non-enumerable `acts`, and the header.
  - `service/instruction-authority.ts`: the per-act question, the read-decision wording, and the header.
  - `flow-bootstrap/action-permissions.ts`: the read is made in `executeTool` before a call declaring something lasting reaches the domain; the shared `read()`; one thread line for unanswered acts (`saidUnanswered`); the header.
  - `flow-draft/verify-only.ts`: `automationStudioFlowDraftDeclaresLasting` is exported and reached through the existing `export *` barrel.
  - Comment-only hunks in `dry-run-gate.ts` and `permission-outcome.ts`.
  - The confirm-requests fixture reply `acts: { a1: ["none"] }`.
  - The `instructed.test.ts` cases and the new `service/tests/instruction-authority.test.ts`.
  - The two doc hunks.
  
  `instructed.ts`, `instruction-authority.ts`, `instructed.test.ts`, `permission-outcome.ts` and the fixture had not changed on dev since the lane base `6beae684`, so `git apply` of the lane diff applied cleanly. `verify-only.ts` applied with an offset of 2. The gate, `dry-run-gate.ts`, the tests and the docs were merged by hand.
- **B F1:** `LASTING_KINDS` with the `kind?` parameter; the B comment hunks in `verify-only.ts` (header) and `dry-run-gate.ts`, merged with A's text; the three F1 tests; the rename to "names nothing by quote when the read fails, ...".

Composed rule as implemented (`R/flow-bootstrap/action-permissions.ts`):
- The act type is `{ id; quote; kind?: AutomationStudioInstructedActKind; source?: { clause; object } }` (`:136` area, in the `instructedLastingActs` signature).
- `instructedLastingActs` is at `:306`. The read is always forced first (`:310`), through `read()` (`:273`).
- (a) Kind: `:315`, with `LASTING_KINDS` at `:343`.
- (b) t262 grounding, unchanged, moved into `quotedLasting`: called at `:318`, defined at `:351`.
- (c) Per-act answer: `:320-322`. It applies only when the read carries `acts`. An act is lasting when its answer (same id and folded quote) is missing, `null`, or names a class.
- Any other act is not lasting. A thrown read leaves the gate's plain `NOTHING_INSTRUCTED`, which has no quotes and no `acts`, so only (a) applies.
- Read before the press: `:285`. The unanswered-act thread line is at `:370`.

Split acts in the read:
- `AutomationStudioInstructedActText` now carries an optional `source`.
- `instruction-authority.ts:84` passes `source` through.
- In `readAutomationStudioInstructedRead` (`instructed.ts:189`, grounding at `:200`, helper `groundedWords` at `:214`), an act's class entries quote its own words when those words are found in an instruction. Otherwise they quote `source.clause` when the clause is found.
- The existing overlap rule is kept, so sibling splits give one entry per class per clause.
- The per-act answer stays under the act's own display quote. That is the quote rule (c) compares against.

Tests:
- The t262 "grounds split objects..." assertions now run on kind-less copies of the acts. One added assertion checks that the same acts with kinds are both lasting even when the read quotes only "add".
- A4's gate-level answer tests in `instruction-authority.test.ts` now run on `UNKINDED` copies. Otherwise the cart (`add_to`) and coupon (`claim`) last by kind and the tests would not exercise (c). "Leaves out an act the read answered none" would also fail under (a).
- One test was added: both acts are lasting by kind even when every answer is "none".
- One new `instructed.test.ts` case covers split-act clause grounding: siblings give one entry per class, answers stay under the acts' own quotes, and a clause that is not found claims nothing.

Docs:
- `llm-flow-bootstrap.md`: the A4 paragraph is placed after the permission-request sentence, about line 131. It is rewritten to state clause grounding and the composed (a)/(b)/(c) rule.
- `flow-authoring.md`: the A4 sentence is placed in "Lasting Acts And Excusal", about line 246, and states the composed rule.

Dropped hunks:
- t174's A2/A3/A5 doc hunks: the `out`/reversal paragraph, the optional-only `step_is_optional`, the `notInFlow` note, the "A press that undoes another" section, and the choice-order/claim-doubt paragraph. They are out of scope.
- Every other t174 and t193 file is not part of A4 or F1.
- B's `llm-flow-bootstrap.md` and `flow-authoring.md` hunks: the brief said to port only A4's doc hunks.
- No t195 hunk was touched.

Fixture screening: the ported fixtures are lane text only (Farbazaar/Voltbay, ValueRidge/Millbrook product names). The new fixtures use generic Towels/Napkins text. There are no URLs, tokens, cookies or page data.

## Commands run and observed results

All `vitest` runs were made from `packages/fluxiq`.

- **Baseline set B, before editing:**
  - The first attempt was stopped and discarded because I applied edits while it was running. I then restored the HEAD contents (`git diff --ignore-cr-at-eol` was empty) and ran it again cleanly.
  - Result: exit 1. Test Files 5 failed / 30 passed (35); Tests 13 failed / 202 passed (215).
  - The failures were:
    - `accounting.test.ts`: 6, `totalProviderCallCount` mismatches.
    - `generation.test.ts`: 1, "returns the closed evidence-loop reason and content-free counts".
    - `judged-build.test.ts`: 2.
    - `adaptation.test.ts`: 3, all 15 s timeouts.
    - `incomplete-draft.test.ts`: 1, a 15 s timeout.
- **Set A after editing:** `npx vitest run R/action-permissions/tests/instructed.test.ts R/service/tests/instruction-authority.test.ts R/flow-bootstrap/tests/action-permissions.test.ts R/flow-draft/tests/verify-only.test.ts R/flow-bootstrap/instructed-acts/tests/` gave exit 0. Test Files 11 passed; Tests 316 passed. Per file: instructed 16, instruction-authority 11, action-permissions 18, verify-only 22.
- **Set B after editing:** exit 1. Test Files 4 failed / 31 passed; Tests 10 failed / 205 passed.
  - 9 of the failures are exactly baseline failures (accounting 6, generation 1, judged-build 2).
  - The 4 baseline timeouts (adaptation 3, incomplete-draft 1) passed this time. They are load timeouts.
  - 1 failure is new: `confirm-requests-build.test.ts` > "runs a Confirm that declares nothing lasting once per kept row ...". It expected `['step' x3]` and got `['verify' x3]`. "Confirm" is kind `submit` (`kind-words.ts:11`, `instruction-acts.ts:138`), so rule (a) makes it lasting. The test was updated as described below. Rerun of `npx vitest run R/tests/service-authoring/tests/confirm-requests-build.test.ts`: 4/4 passed.
- `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0.
- `node scripts/build-cache/cli.mjs structure-audit:check`: exit 0, "structure-audit: passed (245 warning(s), 349 baselined)".
- `pnpm.cmd build` at the Core root: exit 0.
- `pnpm.cmd --filter @fluxiq-web-extension/domain check` in the downstream tree: exit 0. It reported "Core's build ... is current with its source".
- `git -C <Core tree> status --short` shows only the 11 owned modified files plus the new `service/tests/instruction-authority.test.ts`. The edited files were written with LF line endings.

## Not verified

- I did not rerun the whole of set B after the confirm-test fix. Only that file was rerun, and it passed 4/4.
- No Lab, browser or provider call was made. No live check confirms that the read now happens before the press.
- I did not check the full Core suites or other tests that call `instructedLastingActs` or rely on `instruction-authority` outside sets A and B.

## Open questions or contradictions found

1. **Behaviour change in `confirm-requests-build.test.ts`, needs a supervisor decision.**
   - The test asserted that a Confirm declaring `[]` runs once per row. Under the composed rule a `submit` act is lasting whatever the read answers, so it is now checked per row (`verify`, judged `verified`). This is the press that run `run-murwcaj0-40e56557` R3 repeated on real requests.
   - I treated this as an expectation made stale by rule (a). I renamed the test to "checks a Confirm that declares nothing lasting once per kept row ... because confirming lasts by its kind", set it to verify/verified, and corrected the fixture comment.
   - Consequence: no Core test now covers a `[]`-declared changing step running per row while it claims an act. That needs an act whose kind does not last, such as `set` or `open`.
2. **Rule (a) overrides an explicit "none" from the read.** For example, `claim` "collect the coupon" answered "none" is still checked. A4's own test expected the opposite. I adapted it to kind-less acts and added a kind assertion. This follows the brief's composed rule, but it means the per-act answer can only add lasting acts, never remove one whose kind lasts.
3. **Stale doc section.** t262's "Lasting acts from counted-object instructions" section in `flow-authoring.md` (about line 349) still says "attributes a lasting act only when its grounded quote ...". Under rule (a) both split adds are lasting by kind. I left it unchanged because the brief allowed only A4's doc hunks, but it now reads incomplete.
4. **Shared worktree.** The downstream tree has an untracked `docs/working/mvp-final-month-plan/reports/t264-core-chain.md` that is not mine. I did not touch it.
