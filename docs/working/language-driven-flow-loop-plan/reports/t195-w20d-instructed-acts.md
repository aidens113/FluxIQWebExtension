# t195-w20d: instructed acts — a span that stops short, an undeclared consequence, check out

Worker t195-w20d, 2026-10-01. Core `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, branch
`task/t195-live-control-flow`. R = `packages/fluxiq/src/programs/automation-studio/runtime/`. Nothing committed.

**Ownership note:** `check.ts` was claimed by lane A (t174). The lead took it for these blockers, and this brief
edited it.

## Outcome

Done. All three rules are in place and pinned by tests:

1. `span_stops_short` (withdraw audit B2).
2. `act_consequence_undeclared` (withdraw audit R2).
3. A check-out is the same transaction as an earlier order (pickup audit #5).

The new refusing cases fail with the source changes reverted. That was checked once, and the source was then restored.

## What changed and why

### `R/flow-bootstrap/instructed-acts/`

**`span.ts` (new)**

- `automationStudioInstructedActRepeatSpans(step, steps)` returns every kept repeat whose span holds the step. It
  replaces `check.ts`'s private `repeated()` and keeps the same rules:
  - a step that carries `repeat` is its own carrier;
  - a withdrawn carrier counts for nothing.
- `automationStudioInstructedActSpanStopsShort(step, steps, claimed)` applies the B2 rule. Take N, the next proposed
  step after the span's `through`. The span stops short when:
  - N is in `verify` replay mode, which is `effect: "mutate"` plus `declaresLasting` on
    `ranWith.consequences ?? input.consequences`, read by calling the exported
    `automationStudioFlowDraftStepReplayMode`. `verify-only.ts` itself was not edited;
  - N is not repeated;
  - N is not claimed for any act.

  The function returns the span and N.
- `span.ts` is published from the barrel, because the repeat suggestion needs the same span lookup.

**`act-consequence.ts` (new)**

- A closed list on the act's verb:
  - withdraw, delete, remove -> `delete`;
  - order, buy, purchase, pay -> `move_money`;
  - send, post, publish, submit, apply -> `send_or_publish`.
- `automationStudioDraftStepDeclaresConsequence` reads `ranWith.consequences` before `input.consequences`, as a list or
  a comma string.
- This file is not in the barrel; the class travels on the act.

**`contracts.ts`**

- The act gains an optional `consequence`.
- The reason union gains `span_stops_short` and `act_consequence_undeclared`.
- A missing entry gains an optional `after: number`.

**`check.ts`**

- `automationStudioInstructedActStepFault` takes a fifth argument, `claimed: (step) => boolean`. Its order of checks is:
  1. `whyNot`;
  2. `act_needs_repeat`;
  3. `span_stops_short` (plural acts only);
  4. `act_consequence_undeclared`, for an act with a `consequence`. It looks at the claimed step alone when that step
     is not repeated, and at every proposed step of the spans that repeat it when it is.
- The check builds `claimed` from every step that an assigned act or choice claim names, including the draft's own
  `acts` annotations.
- A `span_stops_short` missing entry carries `after`. In `missingActs`, an `act_consequence_undeclared` entry carries
  `consequence`.
- Two new `REASON_INSTRUCTIONS` sentences:
  - span: "... runs once after the loop: repeat through it -- amend_draft repeat on the repeat's first step with through
    set to after."
  - consequence: "... rerun the step that does it declaring that class in its consequences, and keep it; the person will
    be asked before it happens."
- The file is 400 lines, at the advisory threshold. I compacted my own comments to stay there.

**`checklist.ts`**

- The todo union gains both new reasons.
- `claimed` is "a kept step with non-empty `acts`". It is passed to the shared fault rule, so the checklist and the
  check still agree.

**`instruction-acts.ts`**

- A `check out`/`checkout` submit act is dropped when an earlier submit act in the same instruction has the verb order,
  buy or purchase.
- Every act now carries the implied `consequence`.

### Other files

- **`R/flow-bootstrap/unfinished-build/not-done.ts`.** `TODO_WORDS` gains the two clauses. It is a complete `Record`,
  so the compiler requires them.
- **`R/llm/harness-options/repeat-suggestion.ts`.** It now answers the first act refused `act_needs_repeat`, or
  `span_stops_short` with a numeric `after`. For the latter it suggests
  `{step: <carrier>, change: "repeat", over: <carrier's over>, through: <after>}`. It finds the carrier with
  `automationStudioInstructedActRepeatSpans`, and keeps the span whose end is before `after`.
- **`R/flow-draft/amendment.ts:142`.** The `through` description gains: "A press that opens a confirmation repeats with
  it: name the confirmation as through."

### Tests

**`instructed-acts/tests/check.test.ts`**, a new describe block plus one pickup case. A fixed draft is used throughout:
listing d1, row press d2 declaring `[]`, confirm d3.

- **Run-3 shape.** The repeat runs over d1 through d2, d3 declares `["delete"]`, and a1 is claimed on d2.
  - Refused `span_stops_short` with `after: 3`.
  - `missingActs` holds `"after":3`.
  - The instruction says "repeat through it".
- **The same draft with `through: d3`.** Accepted.
- **Adds, then the order.** A plural add loop is claimed a1, then Place order is claimed a2 and declares `move_money`.
  Accepted.
- **The step after the span.** For the confirm instruction:
  - declaring `[]`, the draft is accepted;
  - declaring `["modify_existing"]`, it is refused `span_stops_short`.
- **The withdrawal's declaration.** Withdraw over a span through d3:
  - with d3 declaring `["modify_existing"]`, it is refused `act_consequence_undeclared`, and `missingActs` holds
    `"consequence":"delete"`;
  - with d3 declaring `["delete"]`, it is accepted.
- **`ranWith` beats `input`.** `ranWith.consequences: "delete"` wins over `input` `["modify_existing"]`.
- **A single offer step.**
  - With `send_or_publish` it is accepted; with `[]` it is refused.
  - A confirm loop, whose verb names no class, is held to nothing.
- **Pickup order.** Place order claimed for a1 alone, with a1.size on its own step, is accepted.

**`instructed-acts/tests/instruction-acts.test.ts`**

- The corpus gains two current realistic tasks: "bigbox pickup order", which reads `[["submit","order"]]` only, and
  "everything store buy kettle".
- A table test pins each corpus task's `consequence` list exactly.
- The withdrawal reads `delete`.
- The pickup order reads one submit act that carries `a1.size` = "6 Double Rolls".
- "Buy ..., then checkout ..." reads one act. A check-out asked alone, or one before the order, is still an act.

**`llm/harness-options/tests/repeat-suggestion.test.ts`**

- For `span_stops_short` (carrier d2 over d1 through d2, after 3), the suggestion is
  `{step: 2, change: "repeat", over: 1, through: 3}`.

### Sweep of the ten realistic scenarios' tasks

I ran the sweep before and after the change. It is a scratch esbuild bundle of each scenario's `live-tasks.ts` export
plus Core's `instruction-acts.ts`, one line per distinct instruction.

Only these acts changed, all as intended:

| Task | Change |
| --- | --- |
| `bigbox-retail-pickup-order` | The `a2` check-out act is gone. `a1` order keeps `a1.size` and gains `move_money`. |
| `everything-store-buy-kettle` | `a1` buy gains `move_money`. |
| `crossborder-marketplace-buy-hub` | `a1` buy gains `move_money`. `a2` collect is unchanged. |
| `job-board-apply-quillmark` | `a1` apply gains `send_or_publish`. |
| `local-classifieds-make-offer` | `a1` send gains `send_or_publish`. |
| `social-network-feed-group-post` | `a1` post gains `send_or_publish`. |
| `professional-network-withdraw-stale-requests` | `a1` withdraw gains `delete`. |

Every class matches that task's own `permissionPoint.consequence`.

Every other task's acts are unchanged, among them:

- book-service ("book") and place-bid ("place"): their verbs are outside the closed list, so they carry no class even
  though their points are `move_money`;
- the quote request ("ask") and confirm-requests;
- the glaze collection ("create").

## Commands run and observed results

1. `npx esbuild <scratch>/sweep.ts --bundle --platform=node --format=esm` then `node sweep.mjs`, before and after. The
   `diff` showed exactly the seven lines in the table above.
2. `npx vitest run src/.../flow-bootstrap/instructed-acts src/.../flow-bootstrap/unfinished-build
   src/.../llm/harness-options src/.../flow-draft` (from `packages/fluxiq`) gave `Test Files 23 passed (23)`,
   `Tests 358 passed (358)`.
3. **Revert check.** I copied `check.ts`, `checklist.ts`, `instruction-acts.ts` and `repeat-suggestion.ts` aside and
   wrote their `HEAD` versions. The three test files then gave `17 failed | 118 passed`, and every refusing new case and
   every new pin was among the failures. Restoring the copies left `git diff --stat` showing my changes again, and a
   rerun passed `167 passed`.
   - The two acceptance-only cases, `through: d3` and `ranWith` beats `input`, pass on `HEAD` by nature.
4. `bash .../heavy.sh "t195-w20d tsc" npx tsc --noEmit -p tsconfig.json` in `packages/fluxiq`: no output, exit 0. It
   ran twice; the second run followed the last test edit.
5. `node scripts/structure-audit.mjs` in Core gave `structure-audit: passed (206 warning(s), 353 baselined)`. None of the
   warnings is in a file I touched. `check.ts` is at 400 lines and `check.test.ts` at 398.
6. **Outside the brief's list, for safety.** I ran eight other test files that use the affected instructions:
   answerability check, flow-bootstrap action-permissions, context-packet, deepseek-evidence-preflight,
   opaque-target-override, deepseek-recovery-requests, unattended-repair-authority, and ask resolved. They gave
   `Test Files 8 passed`, `Tests 67 passed`. These are named files, not a suite.
7. `node scripts/structure-audit.mjs` downstream, after this report was written, gave `structure-audit: passed (140
   warning(s), 118 baselined)`. None of the warnings concerns this report.

## Not verified

- No Lab, browser or model run, by order. Whether a live model answers the two new sentences and `repeatWith` as
  intended is unmeasured.
- The full Core suite was not run (user rule). Callers of the checklist outside the directories above (evidence-loop,
  incomplete-draft) were not run, except the eight files in command 6.
- **The dry run.** I did not test the dry run's handling of a confirm repeated inside a span; that belongs to w20b.
- **`test-runner`.** `publishable-step-value.ts` lists only amendment-refusal reasons, never instructed-act reasons, so
  I left it untouched. A grep of `packages`, `domain/src` and `apps` found no copy of the instructed-act reasons.

## Open questions or contradictions found

1. **The budget test does not exist.** `R/flow-draft/tests/entry-budget.test.ts` is not in the tree; commit `711eab8c`
   ("no byte budgets") removed it. No description-length bound exists to stay within, so the wording was kept to one
   sentence.
2. **The brief narrows the audit's verb list.** The audit's R2 list also had cancel, unsubscribe, check out and request,
   and none of them carries a class here. The brief's list also leaves out "place" (place a bid or order) and "book",
   whose points are `move_money` (`auction-marketplace-place-bid`, `company-website-book-service`). Those acts are not
   held to declaring a class. Widening the list is a supervisor decision.
3. **One sentence fits a single step badly.** The consequence sentence says "rerun the step that does it declaring that
   class". That is right when the claimed step is the deleting press. For a single act claimed on a press that only
   opens a confirmation, which is not a span, the better answer is to name the confirmation for the act. The refusal
   does not distinguish the two cases.
4. **Other workers' files.** While I worked, other workers had uncommitted edits in `action-permissions/gate.ts`,
   `authoring/draft-routing.ts`, `flow-draft/{dry-run,verify-only,index}.ts` and `llm/node-tools/*`. tsc and the tests
   over `flow-draft` passed with them present. I touched none of them.
