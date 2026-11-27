# run-mwyfc9uf-215bbd84: bigbox new-store cheapest towels, 4 of 4 right, but no later attempt just ran the saved Flow

Lane: t1015 `paid-bigbox`. Task: `bigbox-retail/bigbox-retail-new-store-cheapest-towels`, answer-first, `--attempts 4`,
no reseed between attempts, visible Chrome, run watcher on. fluxiq 0.54.32.
Provider: Anthropic `claude-sonnet-5-5` for build and judge. Cost: $1.15 billed over 34 calls.
Step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-26/run-mwyfc9uf-215bbd84/steps/`. Debugged offline from the
step files, the Lab log (`bigbox2.log`), the attempt bundle and the code at 0.54.32 (shared Core `fxwork/!FluxIQ`,
lane `fxwork/t1015-paid-bigbox`). No live or paid run was used. Full report:
`docs/working/page-diff-delivery-plan/reports/run-mwyfc9uf-later-attempts.md`.

## What happened

| Attempt | Path | Calls | What it did |
| --- | --- | --- | --- |
| 1 | explore | 15 | Set the store, filtered, sorted, added the $1.28 roll (0018), clicked the cart link t380 `"🛒 1 $3.97"` (0020), read 2 cart rows. Saved Flow `flow.ed7f1cd4…`, 13 plan nodes. |
| 2 | run_flow_then_repair | 8 | Ran the saved Flow (0029-0043). It stopped at step 10. The model clicked t380 itself (0047), read the cart, dropped step 10. Draft refused at assembly, so nothing saved (0062). |
| 3 | run_flow_then_explore | 5 | Ran attempt 1's Flow again (attempt 2 saved nothing). It stopped at step 10 again (0074-0078). Same repair by hand, same refusal (0088). |
| 4 | run_flow_then_explore | 6 | The same as attempt 3 (0100-0104, refusal 0115). Two judge calls, both yes (0113, 0114). |

In attempts 2-4 the saved Flow's steps 1-9 behaved as the rules ask:
- the cookie wall (step 2) and "Set as my store" (step 4) were absent and passed over as optional (0030, 0033);
- the "+ Add" (step 9) was **not pressed again**: the act record's gate answered it already done, with nothing sent
  (0039 has no `dispatch` span; the attempt note says "This was already done earlier in the task").

## Why

1. **Step 10 is a click on the header cart link, saved by its words, and its words are the cart's state** (stopped
   attempts 2, 3 and 4).
   - The link is `<a href="/cart"><span aria-hidden>🛒</span><span>count</span><span>total</span></a>`
     (`apps/scenario-lab/src/scenarios/bigbox-retail/shell/shell.ts:52`).
   - Attempt 1 recorded it as `"🛒 1 $3.97"` (`steps/0018-tool-core.run_node/page.txt:16`). The header had not
     yet counted the added roll.
   - In attempt 2 the same element, same handle t380, same `href`, reads `"🛒 2 $5.25"`
     (`steps/0045-tool-core.run_node/page.txt:15`).
   - Playback found nothing 4 times (0040-0043, `web.target.not_found`): the first try and 3 retries.
     - The veto and Level 2 act only when a distinguishing signal agrees exactly (`apps/extension/src/content/identity/corroboration.ts:60`).
       Neither the text nor the name agrees, and `href` is not a distinguishing signal.
     - The stable-name reading allows exactly one changed run, and the part it keeps must hold 3 letters
       (`identity/stable-name.ts:28-29`, `:75`, `:136-146`). Here two runs changed and the kept part is "🛒".
   - The model clicked the same handle t380 at 0047 and it worked. The live path resolves the handle, while
     playback resolves the saved words.
2. **State routing could not pass step 10, by design and by a latent defect.**
   - The rule for a step whose page never arose after an act already done (`engine/automation/state-routing/not-arisen.ts`)
     never passes over a step that "does a lasting act" (`state-routing/decision.ts:112-113`).
   - Every web click is floored as `commit` (`domain/src/actions/action-effect/table.ts:20`). So every click counts
     as a lasting act (`engine/automation/step-skip/act-not-done.ts:31`), and the rule can never pass over a click.
     It was written for exactly that case ("View cart" in the drawer an Add opens).
   - Here passing over would not have been right anyway. The cart page is needed for the read, so the step has to
     run. Cause 1 is what must be fixed.
3. **The repair could not be saved: `web.handle.ambiguous` at `plan.subflows.0.nodes.11.parameters`** (0062, 0088,
   0115).
   - Node 11, counting the two optional-step joins, is the cart-link click. In attempt 2 that is draft step 14,
     the model's own click on t380.
   - The path `parameters` is the absolute-target check (`domain/.../plan-resolution/resolve-plan-node.ts:605-608`
     into `control-intents/absolute.ts:21-79`).
   - In attempt 2 the link read `"🛒 2 $5.25"` on both the search page and the cart page. So it matched captures
     on two pages, and a witness of the act is needed (`absolute.ts:56-74`).
   - The domain's target store is keyed by project and Flow (`target-packets.ts:797-799`), and every attempt runs
     under `flow.ed7f1cd4…`. So it outlives the attempt.
     - The same elements keep their handles across attempts: t380, t1295 "+ Add", t1586 on the cart page.
     - It keeps only the first act per handle (`target-packets.ts:396`). t380's first act is attempt 1's, as
       `"🛒 1 $3.97"`, so attempt 2's act on it left no witness for its words.
   - Attempt 1 escaped this only because the label changed between the two pages it saw it on.
   - Which line returns `ambiguous` (`absolute.ts:53`, `:69` or `:73-74`) is reasoned from the code and not proven.
4. **The continuation refusals all follow from cause 3.**
   - Attempt 2 saved `notes_only`, `why: not_assembled`, with no `flowId` (`attempt.json:447-452`).
   - So attempt 3 correctly started from attempt 1's digest `761eb715…`.
   - In `packages/test-runner/src/attempt-lane/continuation.ts`, that gives `first_saved_nothing` at `:20`,
     `second_found_something_else` at `:22`, and `second_ran_another_flow` at `:24`. The last is attempt 3's
     `flowId` against attempt 2's missing one.
5. **Path labels.**
   - Attempt 2 is `run_flow_then_repair` because the model dropped the broken step 10 and step 12.
   - Attempts 3 and 4 left them standing, so they read as `run_flow_then_explore`
     (`answer-first/attempt/path.ts:37`, `:48-60`).
6. **Smaller waste in attempt 2** (3 calls, 0054, 0056, 0059).
   - The checklist showed act a1 as `no_step_added`, because step 9 claims only the choice `a1.fulfilment`
     (`runtime/flow-authoring/bootstrap/instructed-acts/checklist.ts:251-270`).
   - The model re-sent "step 16 result" twice (`already_so`), was steered for `same_fix`, and finished with best.

## Next

- Fix cause 1 at the root: a saved control must be matched on what stays the same, not on state in its words.
  The report gives the options.
- Fix cause 3 so that a repair made on a later attempt can be saved.
- Prove both offline on this recording before any live run:
  - a saved step 10 built from 0018's capture resolves against 0045's page;
  - the draft of attempt 2, steps 1-9, 14 and 16, assembles with the target store as attempt 1 left it.
- Then rerun this task, `--attempts 4`. Accept it only if attempts 2-4 run the saved Flow with no decision calls.
