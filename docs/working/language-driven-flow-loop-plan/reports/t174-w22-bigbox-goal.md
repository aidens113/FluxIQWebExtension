# t174-w22: live run 28 (`run-munvvc3z-3eadc185`), why a Flow that ran every step missed the goal

## Outcome

Done. Full debug written to `docs/working/language-driven-flow-loop-plan/debugs/run-munvvc3z-3eadc185.md`
(stages 1-6, Causes with owners, proposed fixes, instrumentation gaps, UI review with 15 pictures opened
and the overlay table, U1-U15, t185 checklist). No source changed, no git, no Lab or build commands.

Names: P1 = the first instructed product (item id `418830127`), P2 = the second (`418831402`).

- **Facts:** 3 of 5 failed: `towels-added`, `napkins-added`, `nothing-else`. `store-switched` and
  `soap-kept` hold. The final page shows P2 in its first size, the instructed store, and cart count 1
  (the seeded line), with no "added" panel.
- **Owning cause:** acts never done, plus one done on the wrong target. Nothing was undone by a later
  navigate, but every navigate reloads the page, and the site swallows the first add-to-cart press after
  a load.
  1. **Wrong target.** s9 and s14 navigate to an address the model composed: P1's slug with P2's item id.
     The site routes by id (`route.ts:14`), so both "product" visits open P2. The domain runs a
     same-origin navigate as written and checks only the origin
     (`domain/src/runtime/llm-evidence/node-run/run.ts:313-319`, `:669-676`). The build never opened P1's
     page: search never reached results, and P1 is on no home rail.
  2. **No size step and no quantity step.** Core's act reader extracts the acts correctly (verified:
     `a1 set`, `a2 add_to`, `a3 add_to`). It keeps "two packs" and "<size> size" only as quote text
     (`instructed-acts/instruction-acts.ts:139-144`, `:168-183`). The check needs one kept mutating step
     per act (`check.ts:117-133`, effect test at `:127`), so this Flow passed.
  3. **One press per load.** The site takes the first add-to-cart press after a load as a wake-up
     (`client/shell-script.ts:45`). The build added only on its second press, and the Flow kept one press
     per visit. t195's F17 and F19 address this and are not in the t174 tree.
  4. **The dry run could not see it.** A mutating replay that runs is `replayed` whatever it changed
     (`node-run/replay.ts:225-238`). The cart was unchanged across both dry runs, while 9 of 13 steps
     answered `replayed`.
  5. **The result check was refused before it was sent** (`llm.provider_result_summary_invalid`,
     `runtime/llm/harness/request-evidence-check.ts:115-122`). `verdict.ts:101-102` then refuted it as
     `unsure`/`model_unavailable`. So the refutation was a default, not a judgement of the cart. This is
     t194's area.
- **Proposed fixes (not implemented):**
  - A: only observed addresses may be navigated during a build (`run.ts:313-319`, new
    `node-run/observed-addresses.ts`).
  - B: the act reader records quantity (count of two or more) and option ("in the … size") needs, each
    claimed by its own step (`instruction-acts.ts:139-144`, `check.ts:117-133`).
  - C: a replayed mutation that changed the state digest originally but changes nothing on replay
    answers `core.replay.changed` (`replay.ts:225-238`).
  - D (t194): record why the summary was unsendable, and make a record-less task's summary sendable.
  - Merge t195's F17, F18 and F19.

## What changed and why

- Added `docs/working/language-driven-flow-loop-plan/debugs/run-munvvc3z-3eadc185.md`, the run debug the
  brief asked for, in the format of `debugs/run-muntmwvx-0d53884a.md`.
- Added this report.
- Wrote a scratch script `t174-w22-acts.mjs` in the supervisor's scratchpad. It ran Core's act reader
  read-only on the task's instruction. It is not in the repository.

## Commands run and observed results

- Read the bundle's JSON files (`summary`, `evaluation`, `run`, `events.ndjson`, `snapshots/flow-lane`,
  `decision-trace`, `live-llm`, `live-panel`, `redaction-attestation`), `logs/core.log` (174 lines, 166
  build-trace, 0 error or warn), the full Lab log (41 lines) and the UI review JSON (14 moments). I used
  small `node -e` projections to read them.
- Opened 13 UI-review PNGs and 2 whole-window JPGs with Read. They are listed in the debug's
  "Screenshots opened" table.
- `node --experimental-strip-types --no-warnings t174-w22-acts.mjs` printed three acts: `a1 set switch`,
  `a2 add_to add` (quote has the count "two", the size and "pickup"), and `a3 add_to add` (size and
  "pickup"). None is plural.
- Grep of the t174 tree:
  - `unchangedPress` and "click it again" are absent from `domain/.../node-run/run.ts` and
    `domain/src/actions/schemas.ts` (t195 F17 and F19 are not in the tree).
  - `acts=`, `missing=` and `amend=` are absent from Core `progress-trace.ts` (t195 F13 is not in the
    tree).
  - `runtime/recovery/context-budget` does not exist (t194 F4 is not in the tree).
- Validation: `ls` of every path cited in the debug and this report. Results are in the final message.

## Not verified

- Which amendment removed the second add press, and which re-pointed s9 and s14. The trace has no
  `amend=`, `acts=` or `missing=` fields.
- Which steps completion #3 claimed for a1-a3. a2 → s12 and a3 → s15 is inferred.
- The oracle's per-fact results, which are not exported. The failed facts are read from pictures and
  source.
- Why the search press at iteration 9 did not reach a results page.
- Which of the four conditions refused the result summary.
- That s10 waited for the support card before closing it. This is inferred from the timing and from the
  pill showing afterwards.
- Whether the replay request carries the original state digests (a precondition of fix C).
- The mapping of dry-run replay positions to Flow nodes.

## Open questions or contradictions found

- The Lab reports that Core's verification "refuted" the result. In fact the check was never sent
  (`basis: model_unavailable`, verdict `unsure`), so "Core's own result verification refuted it" in the
  brief is true in code but not in substance.
- The brief says "12 action nodes (… plus merges)". The Flow has 15 nodes: 12 action nodes and 3 merges.
- Run 20's cause 10 (model-authored call ids in the trace) looks fixed in this build: 44 `callId=-`.
- Core was `dirty` in this run (`run.json`), and clean in run 20.
