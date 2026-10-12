# W13: domain handle follow-up (t378)

## Brief

### Brief: t378-w13-domain-handle-followup (worker-high)
- Repository: downstream domain. Tree T = `C:/Users/osrs_/FluxStuff/fxwork/t378/!FluxIQWebExtension` (on `task/t378-candidate-feedback`). L = `T/domain/src/runtime/llm-evidence`.
- Context: W6 made a candidate step naming a handle no evidence printed refused `web.handle.unknown` (store code `not_shown`), and a candidate press on a target with no control role refused `web.handle.not_a_control` (report `T/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w6-domain-handles.md`, read it first, especially "Not verified" and its residual risks 3 and 4). User rule: the model may do anything a person could; a refusal must never block a step that is right.
- Task:
  1. `L/tool-rejection.ts` `HANDLE_ISSUE_REASONS` lacks a reason for `web.handle.not_a_control`, so `tool-rejection-detail.test.ts` fails: add `["web.handle.not_a_control", "handle_wrong_kind_of_control"]` (or the reason the closure test expects).
  2. Remove the false refusals W6 left: (a) a detection field's `at` handle and handles named in node-run answers (covered target, press effects) count as printed when a tool result printed them, even when the page view did not; W6 suggests `L/tools.ts` pass each tool result's printed handles to the store directly instead of the WeakMap mark; take the cleanest seam. (b) A control the page draws without a role (a listener the capture cannot see) that exploration pressed with an observed effect is not refused `not_a_control` for a candidate. Fail-first tests for each.
  3. Keep both of W6's fixes passing (lane B's t551/t560/t570 refused; lane D's t860 text line refused, `t857 button "Close chat"` accepted).
- Owns: `L/plan-resolution/**`, `L/page-view/**`, `L/page-find/**`, `L/stable-handles.ts`, `L/tools.ts`, `L/tool-rejection.ts`, `L/node-run/**`, `L/structure/**` (only if the seam needs it), and the tests beside them.
- Must not touch: Core, the extension, other domain files, any other tree, lab slots or processes.
- Definition of done: run only the tests beside your change: bundle them as `domain/scripts/test-domain.mjs` does (esbuild, `fluxiq` external) into your own scratch directory and run with node (W6's scratch runner is described in its report), including `L/tests/tool-rejection-detail.test.ts`, `L/plan-resolution/tests`, `L/node-run/tests`, `L/page-find/tests`, `L/page-view/tests`; then once `DOMAIN_TEST_BUILD_LABEL=t378-w13 node scripts/test-domain.mjs` from `T/domain` and report its counts (the package scripts refuse while Core's source is newer than its build; expected). `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` from `T/domain`; `node scripts/structure-audit.mjs` from `T` shows no violation in your files. Never commit; no `pnpm build`; no Lab run or provider call.
- Report to: `T/docs/working/mvp-final-month-plan/reports/t378-candidate-feedback/w13-domain-handle-followup.md` (paste this brief at its top; protocol report format; return at most 12 lines).

## Outcome

Done. Both false refusals were reproduced in fail-first tests (2 failing) and
both are fixed. The closure test passes. W6's two fixes still hold. The
scoped tests, the whole domain suite, both typechecks and the structure audit
all pass.

## What changed and why

### 1. Closure reason (`L/tool-rejection.ts`)

- Added `["web.handle.not_a_control", "handle_wrong_kind_of_control"]` to
  `HANDLE_ISSUE_REASONS`, with a comment.
- The closure test, "every code the plan resolver can refuse with names a
  reason", now passes.

### 2a. Handles a tool result printed count as printed (the seam)

- **Seam.** `L/tools.ts` `executeTool`'s `answered` is the single exit for
  every tool answer, whether it succeeded or was refused. It now calls a new
  store method, `targetPackets.printed(scope, answer.evidence, echoed)`. The
  model reads `evidence`, so whatever that evidence printed is what a
  candidate may name. This covers:
  - a search's matches;
  - a description;
  - a detection's column `at`;
  - a node run's answer: the covered target, `closeWith`, and the press-effect
    lines.
- **Store** (`L/plan-resolution/target-packets.ts`), new `printed(scope, result, echoed?)`:
  - It reads handles only where they begin a line (`printed-handles.ts`,
    `line_start`). A JSON value that is exactly `"t42"` counts. A query echoed
    in `0 matches for "t42"` does not.
  - It keeps only handles that this Flow's view history holds.
  - Handles named in `echoed` are excluded. `tools.ts` passes the call's own
    input as `echoed` only when the answer is a refusal (`resultReason` set).
    Without this, a refused `describe_element` on a guessed gap handle would
    echo `detail.target: "t551"` back and, through that echo, mark lane B's
    handle as printed.
- **Removed W6's WeakMap mark.** I deleted `L/plan-resolution/printed-marks.ts`
  and restored `page-find/run.ts` and `page-find/run-description.ts` to HEAD,
  so they are no longer modified. The tool-result seam now covers what the
  mark covered.
- **Kept the per-capture feed.** `printedBy` still reads the page-view lines
  and repair candidates of every capture: a shown capture, a look, and a
  refusal's page. Its `keepNewest` bound logic now lives in a small helper.
- Headers updated in `target-packets.ts` and `resolve-plan-node.ts`.

### 2b. A press exploration saw work is not refused `not_a_control`

- `L/node-run/run.ts`: after a press (`web.output.dom-click`) whose
  after-capture differs from the look before it (`changed === true`, the same
  value reported as `pageChanged`), it calls
  `run.stores.targets.pressed(scope, handle)`.
- Store, new `pressed(scope, handle)`:
  - It keeps a per-Flow `pressed` set, bounded at 4096. A handle the history
    does not hold is ignored.
  - `resolve` then drops `notAControl` for a handle in that set, both under
    `view_history` and against the current pages.
- A press that changed nothing proves nothing, so lane D's message pressed in
  that way stays refused. A test covers this.
- **Why `firstHandle` moved.** `run.ts` was at exactly 800 lines and
  `node-run/` at exactly 25 files. So I moved `run.ts`'s private `firstHandle`
  to `L/plan-resolution/first-target-handle.ts` as `webPlanFirstTargetHandle`,
  exported it from the plan-resolution barrel, and changed `run.ts` to call it
  at all 9 former call sites. Its logic is unchanged. `run.ts` is now 787
  lines.

### Tests (new, in `L/plan-resolution/tests/`)

`L/tests/` was at the 25-file limit, so the new tests sit beside the store,
following W6's `printed-handles.test.ts`.

- `printed-tool-results.test.ts`:
  - **Fail-first:** a detection's column `at` that the page view never printed (a
    wordless thumbnail) resolves for a candidate `web.dom.check`.
  - A held but unprinted handle that a search only echoed mid-line stays
    `web.handle.unknown`.
  - Store level: a refusal's echo of its own target does not print it,
    mid-line words do not, and an `at` field does.
- `pressed-with-effect.test.ts`:
  - **Fail-first:** words that print as text (`p` "View 3 more replies") are
    refused `not_a_control` before any press. After an exploration press that
    changed the page, a candidate press resolves to the same selector.
  - A press with `pageChanged: false` leaves the message refused `not_a_control`.

## Commands run and observed results

All runs were from `T/domain`. The scratch runner is
`<scratchpad>/w13-run-tests.mjs`, a copy of W6's that bundles into
`domain/.test-build-scratch/t378-w13`. I removed that directory afterwards.

- Fail-first, before any fix, with the 2 new files and `tool-rejection-detail.test.ts`
  (task 1 already applied): `tests 17, pass 15, fail 2`. The 2 failures were
  the targeted ones:
  - the detection `at` case: `{"status":"refused","issueCodes":["web.handle.unknown","web.handle.unknown:target"]}`;
  - the pressed-with-effect case: `{"status":"refused","issueCodes":["web.handle.not_a_control","web.handle.not_a_control:target"]}`.
- After the fix: new tests plus W6's `printed-handles` and `press-control`
  plus the closure test gave `tests 26, pass 26, fail 0`.
- Final scoped run: every `*.test.ts` under `L/tests`, `L/plan-resolution`,
  `L/node-run`, `L/page-find`, `L/page-view` and `L/structure`, 107 files.
  Result: `tests 742, pass 742, fail 0`. Separately, `L/harness-options` and
  `L/state-digest` with structure gave `tests 108, pass 108, fail 0`.
- `DOMAIN_TEST_BUILD_LABEL=t378-w13 node scripts/test-domain.mjs` ran, exit 0:
  `# tests 1652 # pass 1652 # fail 0 # cancelled 0 # skipped 0`, duration 106 s.
  It did not refuse for a stale Core build.
- `npx tsc -p tsconfig.json --noEmit` gave exit 0, and again after the last
  comment edit.
- `npx tsc -p tsconfig.test.json --noEmit` gave exit 0.
- `node scripts/structure-audit.mjs` (from T) gave
  `structure-audit: passed (184 warning(s), 257 baselined).`
  - Earlier runs flagged 3 violations of mine, all fixed:
    - a conditional spread in a test;
    - `L/tests/` at 27 files;
    - `run.ts` at 805 lines.
  - A later run flagged `node-run/` at 26 files, which the move to
    `plan-resolution` fixed.

## Not verified

- I made no Lab or live run and no provider call, as the brief requires. The live shapes are fixtures only.
- Lane B's guessed gap handles stay refused only while nothing prints them. If exploration's own node run acts on a gap handle successfully, its answer may print it, and a candidate may then name it. I think that is the right behaviour: exploration acted on it.
- `pressed` counts any page change after the press. It does not prove the press caused the change: a timer could change the page at the same moment, and the press would then count as having worked.
- Replayed presses (`replay.ts`) do not feed `pressed`. Only exploration's own node runs do.
- Recovery-harness tools (`harnessOptions`) never feed this store, as before.
- I did not run `pnpm check` or `pnpm test`.

## Open questions or contradictions found

1. The per-capture feed still treats every line of a look's page view as printed, even though the model never saw that look. W6 added that rule as a proxy for node-run answers. The tool-result seam now covers those answers exactly, so the look rule could be tightened. I kept it because the brief asks only to remove false refusals, and tightening it could add new ones. The supervisor may want to decide this.
2. `tools.ts` carries another worker's edit to the detect description, which I left untouched. My change there is the `answered` wrapper only.
