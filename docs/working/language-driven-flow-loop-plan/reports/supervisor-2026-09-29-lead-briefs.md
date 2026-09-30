# Lead briefs dispatched 2026-09-29, after the restart

Supervisor record. The full brief text went to each lead; this file keeps what a
later session needs: each lane's tree, what it owns, and what it must not touch.
The machine rules every lead follows are in the plan's `## Current State`.

Every lead reports `Ready to commit` with files and validation. Only the
supervisor commits, merges and pushes. Worker hooks refuse `git merge`, so a
lead resolves conflicts in a merge the supervisor started and stages them.

## t174 live lane (`lead-xhigh`), `fxwork/t174`

- Step 1 done: Core merge resolved (`92d4d49`), both trees on current dev.
- Step 2: make the unrecognised throw after a tool call (runs 6, 7, 10) name its
  frame under Next's bundle, then fix it at its owning line. Run the outstanding
  validation (full Core fluxiq vitest, full domain suite, downstream `pnpm check`).
  Then live runs one at a time in `lab-slots/slot-1`, headed, on the ten
  scenarios, starting with `crossborder-marketplace-hub-to-cart`, each with a full
  debug file.
- Keeps its grant-refusal naming until t186 lands; it is dropped then.

## t186 remove call grants (`lead`), `fxwork/t186`

- Merged dev twice (`cb162a4`/`b2bbd3e0`, then a second merge with t176 whose
  conflicts are the lane's "t176 follow-ups": Core `runtime/service.ts`, downstream
  `flow-lane/creation/instruction-task.ts` and `flow-lane/persisted-flow-run.ts`).
- Then B2 test fixes, and removal of leftover grant references (the program-route
  denylist `llmExecutionGrantId`, `runtime-execution.ts:54`,
  `simple-panel-control.test.ts`). Full Core and downstream validation.

## t185 live activity + chat (`lead`), `fxwork/t185`

- Merged dev (`860beb32`, then t176 cleanly). Continues
  `docs/working/live-activity-chat-plan.md`. Browser validation only in slot-2.
- Must not touch `runtime/llm/**` or `runtime/flow-bootstrap/**`; service.ts edits
  only as caller-side wrapping.

## t187 build and Lab startup speed (`lead`), `fxwork/t187`

- The user's question: why building takes so long, and cut it. Measure the Lab
  prelude, `pnpm task start`/`finish`, and `pnpm check`/`build`/`test` in both
  repositories. Find when each costly step was added. Implement the stamp-and-skip
  design and the report's findings 1-3, then the largest remaining costs, with no
  weakening of any check.
- Owns build tooling only (`scripts/lab/**`, `scripts/task/**`, `scripts/worktree/**`,
  package scripts, tsconfig build settings). Core causes are proposed, not edited.
- Supervisor data: `task start --worktree --core` 151 s and 156 s; Core
  `pnpm check` 110 s; Core fluxiq tsc 39 s; Core structure audit 43 s against 8 s
  downstream.

## t188 node limits (`lead`), `fxwork/t188`

- No fixed 16-node or other unchangeable cap. One setting, default 100 nodes per
  Subflow, set in the Core web panel; everything in `reports/t188-node-limits.md`
  reads it; edges, depth and bytes derived so a 100-node chain fits.
- Owns `runtime/flow-bootstrap/**` except `reachability/**` and
  `instructed-acts/**` (moved to t190), plus `model/validation/adaptation.ts`,
  the settings model and UI.

## t189 decision context (`lead-xhigh`), `fxwork/t189`

- Phase 1: what one decision is sent, and why the model repeats itself, proven
  from t174's recorded decisions. Phase 2: every piece of Core feedback leaves a
  durable trace the model sees, and distinct refusals are not collapsed.
- Added: bigbox run 6 cause 6 (11 answered-from-memory decisions) and cause 1's
  Core half (a reload-causing click never kept as a draft step).
- Owns `runtime/llm/evidence-loop.ts` (split it; it is at 800 lines),
  `llm/context-window.ts`, `llm/evidence-loop/**` except `progress-trace.ts`,
  `runtime/flow-draft/**`.

## t190 instructed acts (`lead`), `fxwork/t190`

- Bigbox run 6 causes 1 (domain half: a reload-causing click reported as applied
  with the new page state), 3 (an arrival step when the build begins on its start
  location), 4 (a claim must name its act), 5 (one act per coordinated object).
  Evidence: `reports/t174-w3-bigbox-refusals.md` in `fxwork/t174`.
- Owns Core `runtime/flow-bootstrap/reachability/**` and
  `runtime/flow-bootstrap/instructed-acts/**`, and the domain click post-condition.

## Four live lanes (user: "4 live lab slots, no locks", later that evening)

Each lane owns one Lab slot for all its runs and tests an equally important part
of the loop. Each copies t174's `live-run.sh` with its own slot and instance
(`t1NN-slot-N`), stays headed with the $0.25 cap on `deepseek-flash`, runs the
full debug including the screenshot UI review, and hands back `Ready to commit`
per validated fix set. Before fixing a cause it reads the other three lanes'
reports; the first to record a cause owns its fix.

- **A create & run, t174, slot-1:** crossborder hub-to-cart, bigbox pickup-cart,
  everything-store kettle-to-cart, company-website quote-request.
- **B self-repair, t193, slot-2:** the `variantArmedAfterBuild` tasks (bigbox
  cart redesigned, company-website quote redesigned, job-board Halvard
  redesigned, social-feed group-post regrouped). Judged on the repaired,
  persisted, zero-provider replay.
- **C judge its own answer, t194, slot-3:** the expected-dataset tasks from
  `everything-store-plus-earbuds-under-50` (rung 1), then local-classifieds bike
  search, auction kestrel, crossborder spain-hubs, professional-network data
  engineers.
- **D control flow and consequential acts, t195, slot-4:** social-feed
  confirm-requests, professional-network withdraw-stale-requests, bigbox
  pickup-order, job-board apply-quillmark, photo-social moon-jar.

Also: **t191** (t185's lead) rebuilds the extension chat to ChatGPT quality and
fixes the overlay's visibility and flicker, with provider-free UI runs in
`lab-slots/ui-1`. **t192** (t187's lead) cuts Core's own build and check.
