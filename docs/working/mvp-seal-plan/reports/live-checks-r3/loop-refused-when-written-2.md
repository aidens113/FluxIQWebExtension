# Loop refused when written (2): code complete, validation not yet run

Core paths are relative to `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src`.

## Outcome

**Partial.** All three items are implemented and the tests are written. **No test, tsc or structure check has run yet.** My vitest run is still queued behind other lanes in `heavy-slot` (queue at hand-back: `t900 -> t885 -> ...`, both slots held by t902 and t903). I was told to hand back before it ran.

## What changed and why

**Item 1: an endless repeat-while is refused when the model writes it.**

- **One rule, asked of assembly rather than restated.** `runtime/llm/harness-options/draft-acts.ts` adds a `loopNeverEnds` callback, built where the registry is, as `claimRefused` is. It assembles the draft's proposed steps with `assembleAutomationStudioFlowDraftPlan`, using the same `write` (`automationStudioFlowBootstrapDraftNodeStep`) the completion uses. It returns the message of the `flow_draft.repeat_while_never_ends` issue at `draft.steps.<position>`.
  - Effect: the refusal comes exactly when assembly's would (no ending and no `most`, interruption steps included).
  - The sentence is Core's own assembly sentence. It already names the library's ending nodes through `loop-ending/nodes-said.ts`.
  - With no registry, the callback returns nothing.
- `draft/amendment/types.ts`:
  - adds the new reason `repeat_never_ends`;
  - documents that `said` also carries the assembly sentence;
  - adds the type `AutomationStudioFlowDraftLoopNeverEnds`;
  - rewrites the `most` comment ("only a count the person's own instruction gives").
- `draft/amendment/apply.ts`: after a routing change writes a repeat-while, it asks `options.loopNeverEnds`.
  - On a refusal, it puts back the step's previous routing and settings and does not count the change as applied.
  - It pushes `{ reason: "repeat_never_ends", said }`, with the sentence renumbered into the numbers the model wrote (`said-numbers`).
  - The claim code's inner `written` closure, which shadowed the `written` array, became a shared `shownAt`.
- Plumbing:
  - `loop-configuration.ts` adds `draft.loopNeverEnds`.
  - `decision-handlers/amendment.ts` adds an `amendmentChecks(context)` helper, used at both apply sites.
  - `evidence-loop/held-amendments.ts` adds the option on `settle`, and renumbers `said` for the new reason as it does for `act_not_done_there`.
  - `answer-first/attempt/round.ts` adds `loopNeverEnds: acts.loopNeverEnds`. I checked that the file was clean first: the lead's commit a79248cb5 had landed.
  - `service.ts` is **not edited**. It spreads `...automationStudioFlowBootstrapDraftActs(...)` into `draft`, so it carries the new key without a change.
- Exhaustive sets now hold the new reason:
  - `refusal-reasons.ts`: a sentence for it, with no count.
  - `fallback.ts`: its way out is the assembly sentence when there is one. Otherwise it is a generic "run the step that answers ended ... repeat while: <that step>; or leave it to run once".
  - `feedback.ts`: carries `said` onto the refused entry.
  - `evidence-loop-steps.ts`: the allow map.
  - `ui/activity-action/refusal-words.ts`: the chat words.

**Item 2: no cap is taught as the remedy.**

- `flow-script-format.ts`, loop format lines.
  - **`repeat while` line:** the loop ends when the last step answers ended because there is nothing more. A step that cannot, such as a plain press, would end it only by failing, and that repeat is refused.
  - **`repeat most` line:** "only for a count the person's own instruction gives, never the way a loop ends". The `repeat while: next` then `repeat most: 20` example is removed.
  - A header paragraph records the cause.
- `draft-bindings.ts:236` (`loop_unbounded`): now reads "`repeat while:` naming a last step that answers ended when there is nothing more". It no longer offers "or a `repeat most:`".

**Item 3: a refused model sees the sentence.**

- `completion-issue-feedback.ts` adds `flow_draft.repeat_while_never_ends` to `DRAFT_ROUTING_CODES`.
- Its header says the sentence also names library node ids and labels, which are the library's words, never the model's or the page's.

**Tests, written but not run:**

- `runtime/llm/harness-options/tests/draft-acts-loop-ends.test.ts` (new). It uses the real web fixture registry plus a next-page node with an `ended` branch. It checks:
  - a repeat-while on `web.output.dom-click` is refused `repeat_never_ends`, with routing put back and `applied` 0;
  - `said` contains `(in this library: web.output.dom-next_page, "Next Page")` and equals the message assembly gives for the same draft;
  - the feedback entry carries `said`, its `next` names the nodes, and `reasons.repeat_never_ends` is present;
  - a loop on next-page is accepted;
  - `most: 3` is accepted, and assembly also does not refuse it;
  - with no library, nothing is refused;
  - the refusal JSON matches no `/\bmost\b|to bound it|passes it should take/`;
  - the completion feedback carries the sentence, and other codes carry none.
- `runtime/llm/decision-handlers/tests/loop-never-ends.test.ts` (new). It runs the whole evidence loop with a stub `draft.loopNeverEnds`. The model's next `core.amendment_check` shows `repeat_never_ends` with `said` and `next`, and the step keeps no routing. Without the check, the repeat is written as before.
- Updated tests:
  - `bootstrap/plan/tests/loop-format.test.ts`: the old pinned `repeat most: 20` sentence is replaced. A new test checks that the while line teaches ended and no count.
  - `bootstrap/authoring/tests/candidate-loops.test.ts`: the `loop_unbounded` message names the ending step and matches no `/repeat most|\bmost\b/`.

## Commands run and observed results

- `git -C .../!FluxIQ status --short -- round.ts service.ts`: round.ts showed `M` at first. Both were clean once the lead committed a79248cb5, and I edited round.ts after that.
- I ran a scan of every changed file for control characters (a heredoc had turned `\b` into backspace, which I fixed). The result was 0 in all files.
- `git diff --stat`: 17 files, +198 −38, with no line-ending churn.
- `node .../heavy-slot.mjs run t885 -- npx vitest run <new and updated test files>` was started in the background. At hand-back it had produced **no output**: it was still queued for a slot.
- **Not run:**
  - vitest over the changed directories, `answer-first/tests` and `runtime/llm/tests`;
  - `pnpm --filter fluxiq check`;
  - `pnpm structure:check`;
  - the fix-reverted check.

## Not verified

- **Everything executable.** Type errors are possible, for example in `amendmentChecks`'s `Pick<NonNullable<Parameters<...>[2]>>` return type, or in JsonValue `toContain` in the tests.
- **The regex in the "no most" test.** The assembly sentence says "after N passes" only when the Repeat node's `most` default is numeric. Otherwise it says "at its most passes", which would trip `\bmost\b`. If that happens, the right fix is in `draft-routing.ts` (not mine), or the test regex needs to be narrowed.
- **The fix-reverted check.** The plan was to stub `options.loopNeverEnds?.(...)` out of `apply.ts` and confirm both new test files fail. It was not done.
- **The structure audit.** `harness-options/tests` now has 25 files, at the limit; I merged the completion test into one file to stay there. The audit may still count the new import of `assembleAutomationStudioFlowDraftPlan` in `draft-acts.ts`, which goes through the `bootstrap/index.ts` barrel, as a cycle risk. `bootstrap-completion.ts` in the same directory already imports it that way.
- **Cost.** `loopNeverEnds` assembles the whole draft once per repeat-while amendment. Its cost was not measured.

## Open questions or contradictions found

- **Held amendments renumber `to`, `check`, `through` and `over`, but not `while`** (`held-amendments.ts`, the key list). This is an existing gap: a held repeat-while names its last step in the old numbering. Out of scope; not changed.
- **No new file in `loop-ending/`.** The previous report suggested a list form there. It is not needed, because the assembly sentence already names the nodes, so I added no file outside my grant.
