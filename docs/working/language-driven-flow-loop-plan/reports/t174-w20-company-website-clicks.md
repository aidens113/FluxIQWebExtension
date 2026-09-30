# t174-w20: live run 22 debug and the root cause of its not-found clicks

Worker t174-w20, 2026-09-30. Run `run-munu4b4y-4e15662e` (company-website-quote-request), t174 tree,
round-1 merged build.

## Outcome

Done. The full debug is at `debugs/run-munu4b4y-4e15662e.md`. The root cause was found and read from
source, and a fix is proposed but not implemented.

## What changed and why

- **New:** `docs/working/language-driven-flow-loop-plan/debugs/run-munu4b4y-4e15662e.md`. It follows
  run 20's format: header, timeline, stages 1–6, the root-cause section, harness interventions, an
  11-row Causes table, instrumentation gaps, the UI review (16 pictures opened, overlay table, U1–U17)
  and the t185 checklist.
- **New:** this report.
- No source, git, Lab or build command was run.

**Corrections to the brief.**
- The three failed clicks are **one node, `main.s2`, three times** (node attempts 1–3, the last two
  on `retry_node`, `maxAttempts: 3`).
- The Flow has **9 nodes** (8 actions plus a `builtin.control.merge`, s3).

**Root cause.**
- s2 clicks the newsletter offer's decline control. The scenario opens that offer only 4 s after
  consent is answered, once per visitor (`client/shell-script.ts:11,46,50-53,141`, `state.ts:8-9`).
- In the build, consent was answered during d4. d4 was reported
  `web.action.rejected.target_not_found` (5133 ms), yet Core logged `pageState: changed`, and d5
  pressed the offer 1.2 s later, which proves consent was answered.
- The domain reports every refusal `effectApplied: false`, `replay: undefined`
  (`domain/src/runtime/llm-evidence/node-run/run.ts:485`, in `refusal()` `:465-500`). Core admits no
  such step (`runtime/flow-draft/step.ts:186`). So the Flow contains the offer's decline and not the
  consent answer it depends on.
- Playback starts as a fresh visitor with the consent wall up (pictures 09–11). s2's target is absent,
  and the in-page defence never clears a wall on `target_absent` (extension
  `recovery/fault.ts:176-178`). The offer never opens, and s2 finds 0 candidates 15 times.

**Did the dry run pass these clicks?** No.
- d5 was `core.replay.unreproducible` in both dry runs (6156 and 6148 ms). Dry run 2 accepted it because
  a step already put to the model, or a conditional one, no longer blocks (`dry-run.ts:164-165,181-182`).
- The dry-run reset kept the build's state: consent answered and the offer dismissed (picture 05).
  Playback reset to a fresh visitor.

**Why s2's failed route was not taken** (from source, if s2 was `optional`, which is not recorded).
Core's `recovery-budget.ts:12` counts the node's own retries, each stamped with a `recoveryDecision`
at `graph-run.ts:580`, against `maxRecoveryAttemptsPerSubflow: 2` (`model/flows.ts:258`). So attempt
3 lost `deterministic_path` (`recovery-ladder.ts:82`), and the continuation rule stopped a mutating
click (`continuation.ts:109`).

**Proposed fix, not implemented:**
- **A (domain, owner).** Return a layer cleared or a page changed by a refused attempt as its own
  optional, replayable draft step.
- **B (extension).** Let the defence press an allow-listed way out on `target_absent` when a blocking
  layer covers the probes.
- **C (Core).** Exclude retried attempts in `recovery-budget.ts:12` and stamp `optional` on the node
  in `draft-routing.ts:113`.
- **D (Core).** Make the dry-run reset start from a fresh visitor.

Even with A–D this Flow cannot meet the goal. The next-step button is covered by the chat greeting
card (the defence's probes miss that corner; run 20 cause 1). Steps 2–3, the send and the human check
are missing. s9, declared `send_or_publish`, sends nothing.

## Commands run and observed results

- Read the bundle files with `node -e` extracts: `summary.json`, `evaluation.json`, `run.json`,
  `events.ndjson`, `logs/core.log`, `snapshots/{flow-lane,live-llm,decision-trace,live-panel,redaction-attestation}.json`.
  I also read the UI review JSON (13 moments, overlay samples) and the full Lab log (40 lines).
- Opened with Read: 11 scenario PNGs (01, 03, 04, 05, 07, 08, 09, 10, 11, 12, 13), 4 panel PNGs (04,
  09, 11, 13), and 1 whole-window JPG (`00013`).
- Grep searches:
  - F10's sentence under the t174 Core `src/`: 0 files. Under the t195 Core: `action-permissions/request.ts` and 2 tests.
  - `runtime/recovery/context-budget` in the t174 Core: absent.
- `core.log`: 156 lines, 148 build-trace, and 0 matching `error|warn|server.activity|outbound`.
- Validation: an `ls -d` loop over every path cited in the debug printed `checked=61 missing=0`. The
  path cited as NOT READ, `domain/src/runtime/llm-evidence/node-run/replay.ts`, also exists.

## Not verified

- **Which mechanism answered consent inside d4 and inside the recovery's first press.** It was either
  the click itself or t195's decline-first defence after a blocked click. The extension's recovery
  account for build calls is not exported.
- **Whether d5's routing was `optional` or `only_if`.** The edges and amendment detail are not in the
  bundle. Cause 3 holds only for `optional`.
- **Cause 3's budget withdrawal.** It was read from source and not traced; no `recoveryDecision` is
  exported.
- **The next-step button being covered by the greeting card.** This was inferred from the scenario
  comment `pages/quote-drawer.ts:30`, pictures 04, 08 and 12, and the codes `target_not_actionable`.
  The probe geometry was computed, not traced.
- **Where the Lab resets the scenario before playback.** Not read.
- **`domain/.../node-run/replay.ts`.** Not read.

## Open questions or contradictions found

- The brief's "3 clicks failed" and "8-node Flow" are corrected above.
- Privacy (cause 9):
  - The bundle's `flow-lane.json` and `live-llm.json` carry an instruction excerpt verbatim
    (`build.instructedConsequences[].quote`) and page strings (`authoredNodes[].parameters.element`
    visible text and accessible names).
  - `failure.expected` carries the selector that `authoredNodes` withholds.
  - The redaction attestation passed, because it screens secrets, not instruction or page text.
- t195's F10 (ask before every send) and t194's F4 (context trims) are both absent from the t174 Core
  this run used. The round-1 merge should be checked for both.
