# t195-w15 — full debug of `run-muog33va-96469cb2` (confirm-requests, run 17)

## Outcome

Done. The debug file is written, with every template field filled or marked `NO EVIDENCE:`:
`docs/working/language-driven-flow-loop-plan/debugs/run-muog33va-96469cb2.md`.

The build reached stage 2. It ran 39 of its 64 calls, took 141.7 s and cost $0.061, and produced no Flow.

## What changed and why

Two files were added and nothing else was edited: the debug file above and this report. The Lab refuses the next run
until the debug file exists.

## Causes (file:line in the t195 trees; `R/` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`)

1. **The cause that ended the build: a rerun orphans the loop's `over`.**
   - **What happened.** At iteration 22, `16:repeat(over=15,through=16)` was applied to the Confirm. At iteration 23
     the model sent `15:rerun` together with `16:repeat(over=15)`:
     - The routing half was applied first and refused `already_so` (`R/llm/decision-handlers/amendment.ts:52`).
     - The rerun then appended the new listing `d17` at the end of the draft and dropped `d15`
       (`R/llm/evidence-loop.ts:700` → `R/llm/evidence-loop/rerun-replacement.ts:22-24`).
     - `d16` still said `over: d15`.
   - **Why the completion was refused.** Completion assembles only the proposed steps
     (`R/llm/harness-options/bootstrap-completion.ts:366`). So `byId.get("d15")` was undefined, and
     `R/flow-bootstrap/authoring/draft-routing.ts:178-182` returned `flow_draft.repeat_span_unknown`.
   - **The same trap earlier.** The model had already hit it at iterations 15-16.
   - **Fix:** in `rerun-replacement.ts`, in the branch after the proposable check (`:23`, before the drop at `:24`):
     - put the rerun at the replaced step's position;
     - rewrite every routing reference to the replaced id (`R/flow-draft/routing.ts:86`) so it names the rerun's id;
     - tell the model about both in the draft change.
   - Owner: t195 (first recorded here).
2. **The refusal named the wrong field.**
   - The message said "repeats through a step that is not in the Flow after it". `through` was the Confirm itself
     and was present; `over` was the one missing.
   - `DRAFT_SCRIPT_NOTE` (`bootstrap-completion.ts:385`) lists no routing change.
   - The draft line still said "over step 15" (`R/flow-draft/entry.ts:316-324`).
   - **Fix:** split `draft-routing.ts:182` into three branches: `over` missing, `through` missing, `through` behind.
     Each branch names the step, says why it is out, and gives the amendment to send, with `reorder` included. Also
     add the routing words to the note. Owner: t195.
3. **Why the refusal became terminal.**
   - It was fed back nine times. The model then sent the same completion at 32, 33 and 35-39.
   - The no-progress guard (8; `R/loop-limits/flow-bootstrap-evidence-loop.ts:145`) was reached at iteration 39
     (`R/llm/evidence-loop.ts:353-367`). The step count is inferred from the rules; the loop does not publish it.
   - `R/service.ts:1558` (`keeper.stalled`) then built `flow_bootstrap.evidence_unusable_decision`
     (`R/flow-bootstrap/generation-failure/evidence-failure.ts:78-93`, `retryable: false`).
   - The API returns `ok: false`, which is the HTTP 400 (`api/handlers/llm-generation.ts:101-108`).
   - The guard itself is correct. Causes 1 and 2 are the fix.
4. **`not_a_kept_step` does not name the reference.** Feedback at `R/llm/draft-amendment-feedback.ts:56` (iterations
   17 and 19). This is run 8's cause 3, owned by t195 and still open.
5. **`over_not_before` never suggests `reorder`** (`draft-amendment-feedback.ts:55`). The model reran the Confirm
   click and pressed Confirm for real a second time (Amara Osei). Fix: point to `reorder` in that feedback. Owner:
   t195.
6. **Wrong exploration press.** Iteration 14 confirmed Tom Becker, who has 1 mutual friend. F14's wording is guidance
   only. This is the open t195 cause from runs 7-9; a guard is proposed.
7. **Mid-build replay.** Two dry runs replayed the draft from its first step after a reset to the start location
   (18.6 s and 18.4 s). The page jumped to the home feed (screenshots 00008-00009). Owned by t196.
8. **The draft shown to the model is capped at 4,000 bytes** (`R/llm/loop-configuration.ts:355`,
   `R/flow-draft/entry.ts:80`, `:114-183`):
   - the instruction in the draft was cut from 1,051 to 177 bytes;
   - up to 9 step inputs were withheld;
   - one input was shown only as `inputTooLarge`.

   Owned by t200.
9. **The build gave up while a way remained.** It had 25 calls, $0.19 and 398 s left. Nothing leads from
   `evidence_unusable_decision` to a deterministic fix of the draft, a continuation, or the repair ladder
   (`R/service.ts:1558`). Owner: t195 (first recorded here). If a build-stage entry to the repair ladder is wanted,
   that is t193's area.
10. **Q2: the start-location refusal is not a defect.** It is by design (t190-w4) and cost no provider call. The
    rule is in the domain: `node-run/run.ts:224-226`, `:251`, `:274`, `:782`, `:791`; `node-run/arrival.ts:63`;
    `node-run/start-location.ts:66`. The Lab also blanks the tab (`packages/test-runner/src/run-scenario.ts:304`).
11. **UI defects, owned by t191.** Most are t191 defects 1-9 seen again (the t195 tree predates t191 round 2):
    - raw tool ids and result codes in the chat and the overlay;
    - the Simple/Advanced toggle, and setup cards above the chat;
    - "Add an AI model key: To do" while building;
    - contradictory status;
    - the overlay is absent for the first 23 s and flickers at moment 8;
    - "Build failed / Build failed";
    - "Worked for 51s · 24 steps · 9 failed" for a 142 s build of 39 decisions;
    - the person's instruction is never shown as a user turn.

    New in this run: the chat says nothing when FluxIQ confirms someone during the build, and the failure gives no
    reason and no next step.

## Commands run and observed results

All commands only read files:
- `node -e` over `snapshots/flow-lane.json`, `snapshots/live-llm.json`, `provider-failures.local.json` and the UI
  review JSON, to print the loop's 49 rows, the diagnostic and the overlay samples;
- `sed`, `grep` and `cut` over `logs/core.log` (the build-trace lines), the Lab log, and the Core and domain sources;
- the Read tool on all 13 bundle screenshots and on two UI-review panel PNGs.

No Lab, browser or build command was run, and nothing was committed.

## Not verified

- **Mapping of the dry-run outcomes.** Positions and node ids are not published. The mapping to `d3` and `d16` is
  inferred from the call count and order.
- **The no-progress count sequence.** Inferred from the rules in `no-progress.ts`.
- **Step arguments.** The arguments of the reruns and clicks, the Confirm's target, and the `handle_not_in_packet`
  handles are not in the bundle.
- **The proposed fixes.** None is implemented or tested.

## Open questions or contradictions found

- **Rewriting references on rerun is ambiguous.** This model reran the loop's listing apparently to make the final
  read. Rewriting the references (cause 1) would make the loop walk that new read. The draft-change message must say
  so, or the rerun should be refused while a routing statement names the step. The lead should pick one.
- **Ownership of cause 9.** It is t195's under first-to-record, but the repair ladder belongs to t193.
