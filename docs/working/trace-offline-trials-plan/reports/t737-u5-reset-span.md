# Report: t737 unit 5, a reset span inside trial runs, read by the build-time baseline

## Outcome

Done. Core now writes a reset step around the reset work of both trial tools (`core.test_subflow` and
`core.test_candidate`). The Lab's build-time classifier counts that step as reset time and takes it out of the
trial's time, counting it only once. Tests were written first and failed before the change; afterwards both repos
pass their checks. No live, browser or paid run was made.

## What changed and why

**There is no span system in Core.** I found no span or trace-event helper on the trial path. The only timing record
the classifier reads is Core's step log: `steps/NNNN-<kind>/meta.json`, written when `FLUXIQ_LLM_STEP_LOG_DIR` is
set. The P0 baseline report (`lane-t-u1-baseline.md`, items 191-203) asked for exactly this: "emit a step, or a
build-trace reset start/end line". So the "reset span" is a new step kind, `reset`, written in a folder
`NNNN-reset` with the same `startedAt`/`finishedAt` fields as every other step. That makes it consistent with the
existing kind names (`decide`, `judge`, `tool-*`, `test-*`, `answer-*`).

### Where the reset happens inside a trial

There are two pieces, both inside the trial tool's step window:
1. **The start hook** (the deployment's fixture reset). Every path to it goes through one function,
   `automationStudioCandidateTrialStart` (`service/candidate-trial/run.ts`): both gates' `prepareStart` (through
   the candidate and subflow ports), both runners when nothing was prepared, and the start of the judged whole run.
2. **The site check**: `reset.beforeTrial(...)` in each gate (`flow-bootstrap/candidate/trial-gate.ts`,
   `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts`).

Each piece is wrapped once, at its single chokepoint, so the steps never nest. A trial with both pieces writes two
steps in a row: `start_hook`, then `site_check`.

### Core (`C:/Users/osrs_/FluxStuff/fxwork/t737/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`)

- `llm/step-log/reset-step.ts` (new): `automationStudioLlmStepLogReset(span, run, describe, env)`.
  - When the step log is off, it just runs `run` and writes nothing.
  - Otherwise it writes `NNNN-reset/meta.json` and nothing else, with these fields: `kind: "reset"`,
    `stage` (`start_hook` | `site_check`), `trialToolId` (`null` for a start hook), `callId: null`,
    `toolId: null`, `startedAt`, `finishedAt`, `ms`, the scope's `part`/`round`/`phase`/`role`/`briefId`,
    `status` (`ok` | `threw`), `outcome` (a Core code: `admit`/`refuse` or `reset`/`failed`) and a one-line
    `summary`.
  - It never writes the reset's evidence, which can quote the page. A throw is recorded as `threw` and its code,
    never its message, and is then rethrown.
  - It adds an `index.md` row. As with every step-log write, failures are swallowed and never fail the reset.
- `llm/step-log/index.ts`: one barrel line, plus the folder contract in the header now documents `NNNN-reset`.
- `flow-bootstrap/candidate/trial-gate.ts` and `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts`: the
  `beforeTrial` call is wrapped as `site_check` with that gate's tool id, and the header comment says so.
  - Not written when no reset happens: an offline trial, or a gate with no `reset` input.
  - Line counts are now 787 and 777, under the 800 limit.
- `service/candidate-trial/run.ts`: inside `automationStudioCandidateTrialStart`, the hook's try/catch is wrapped as
  `start_hook`, with the outcome taken from the start status.
  - Only a hook actually called gets a step: no hook, an offline environment, or a stale lease means no step.
  - Behaviour and return values are unchanged.
- Tests, appended to existing files because `candidate/tests` and `candidate-trial/tests` already hold 25 files
  each:
  - `llm/step-log/tests/reset-step.test.ts` (new, 4 tests): the fields, no page data, the start hook's phase,
    a throw, and writing nothing when the log is off.
  - `flow-bootstrap/candidate/tests/trial-gate-reset.test.ts` (+3 tests) and
    `flow-bootstrap/subflow-candidate/tests/subflow-trial-gate.test.ts` (+3 tests), the same three for each gate:
    - one `site_check` step whose window contains the check and ends before the trial runs;
    - a refused check is written as `refuse`, and no trial runs;
    - no step for an offline trial or a gate with no reset.
  - `service/candidate-trial/tests/start-lease.test.ts` (+2 tests): a `start_hook` step around the hook, a failed
    hook written as `failed`, and no step with no hook or offline.

### Downstream (`packages/test-runner/src/build-time/`)

- `category-rules.ts`: a new rule `trial-reset` (`kind === "reset"` → `reset`). The comment that said "a reset
  Core runs inside a trial is not a step" is updated: runs from before t737 have no reset steps and still count
  those resets as trial.
- `measure-build-time.ts`: the precedence changes from trial > reset > … to **reset > trial > model >
  exploration**.
  - The existing exclusive pass (`IntervalSet.subtract` over the remaining wall time) then takes every reset
    interval out of the trial windows. Two overlapping reset steps count once, because each category is an
    interval union.
  - The `union.*` figures keep their documented meaning (each category's own union, overlaps not removed).
  - I chose this over a special carve-out for one rule: it is less code and states one rule, "a reset is reset
    wherever it falls".
  - Side effect: a model-labelled reset inside a trial window would now also count as reset. The P0 data had none
    (0.0 min).
- `types.ts`: precedence doc. `resetInTrialMs` is now "reset time inside trial windows, counted as reset, not
  trial". `longestTrialMs` is documented as the whole tool window, resets included.
- `render-build-time-table.ts`: the report line now reads "Reset time inside trials (counted as reset, not
  trial)", and the precedence line reads reset > trial > ….
- `tests/trial-reset.test.ts` (new, 4 tests): reset folders written exactly as Core writes them.
  - Two trials, each with a start hook and a site check, one pair overlapping by 1 s, plus one start hook outside
    any trial.
  - Exact figures asserted: trial 23 s, reset 16 s, reset in trials 14 s, model in trials 3 s, model 4 s, other
    and idle 2 s, the shares sum to wall time, `union.trial` is still 37 s, `trialCount` 2, longest trial 28 s,
    the rule count, no unknowns.
  - Also covered: a reset step that runs past its trial's window, and the report text plus its rule row.
- `tests/measure-build-time.test.ts`: only the test title changed, to the new precedence. Its figures are
  unchanged, because no reset there overlaps a trial.

### Docs

- `docs/architecture/testing-facility.md` (downstream): the run-folder listing now has `NNNN-reset/`, followed by a
  paragraph on its fields and how the baseline counts it.
- No Core architecture doc lists step-folder kinds. The contract lives in the step-log barrel header, which is
  updated.

## Commands run and observed results

Core (`fxwork/t737/!FluxIQ/packages/fluxiq`):
- `pnpm exec vitest run .../llm/step-log/tests/reset-step.test.ts` before the gate edits → `Test Files 1 passed (1)
  Tests 4 passed (4)`.
- The two gate test files before the gate edits → `Tests 4 failed | 29 passed (33)`. The 4 failures were the new
  "writes one reset step" and "refused" tests in each gate.
- After the edits, vitest on the 7 files (the 4 touched, plus the offline-gate tests and `prepared-start.test.ts`
  next to them) → `Test Files 7 passed (7)  Tests 54 passed (54)`.
- `pnpm exec tsc --noEmit -p tsconfig.json` → `tsc exit: 0` (3m29s).
- `node scripts/structure-audit.mjs` (Core root) → `structure-audit: passed (421 warning(s), 1152 baselined).`,
  exit 0.
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` → exit 0.
  `fluxiq:build` was rebuilt ("inputs changed: packages/fluxiq"). This was needed because downstream's
  `core-build.mjs` refused the stale Core dist.

Downstream (`fxwork/t737/!FluxIQWebExtension/packages/test-runner`):
- `node ../../scripts/check/core-build.mjs && node scripts/domain-dist.mjs && node ../../scripts/build-cache/cli.mjs
  test-runner:build`, then `node --test dist/build-time/tests/*.test.js`, before the classifier edit →
  `# tests 12 # pass 8 # fail 4`. The 4 failures were the new trial-reset tests.
- The same commands after the edit → `# tests 12 # pass 12 # fail 0`.
- `npx tsc -p tsconfig.json --noEmit` → `tsc exit: 0`.
- `node scripts/structure-audit.mjs` (repo root) → `structure-audit: passed (212 warning(s), 618 baselined).`,
  exit 0.

## Not verified

- No live or Lab run, so no real `NNNN-reset` folder has been seen from a running Core. The Core tests write them
  through the real writer with the env var stubbed, but not through a full build with a real
  `AutomationStudioSiteResetLedger` and a real start hook.
- I did not re-run the build-time CLI over the existing `lab-runs`. Those runs have no reset steps, so their
  figures change only if a model-labelled reset overlaps a trial (0.0 min in the P0 data).
- Playback windows: if a start hook were ever written between the Lab's playback steps, it would split a playback
  group (`playbackWindows` closes a group on any non-playback step). Today the playback replay does not go through
  `automationStudioCandidateTrialStart` as far as I read, but I did not trace the Lab's playback path.
- Full suites were not run, per the brief.

## Open questions or contradictions found

- The brief speaks of "trace spans" and a "span helper the trial path already uses". There is none on the trial
  path. The build-time module reads only step `meta.json` files, so the span is a step-log step. If the supervisor
  wants a P1 trace-contract event as well, that is a separate unit.
- The precedence change (reset ahead of trial) is a deliberate change to the baseline's stated rule. The P0 report
  `lane-t-u1-baseline.md` still says trial > reset; it is a dated report, so I did not edit it.
- Core and downstream both need committing. The Core worktree's dist was rebuilt in place (it is untracked build
  output).
