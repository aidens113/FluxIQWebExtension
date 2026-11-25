# Brief t1039: a picture of the saved Flow for every Lab attempt

**Goal.** The user asked (2026-11-25): "add logging that actually shows what the saved flow looked like
visually? like a flow chart type thing saved as a png for each run", then: "it should save it before the
very end of a run, the CURRENT draft/finalized flow that it created regardless of whether it works or not,
with each node shown". So every Lab attempt (live, scripted or provider-free, `lab attempt` and the other Lab
entries that build a Flow) writes `flow.png` of the Flow as it stands just before the attempt ends (the
finished Flow if one was saved, otherwise the current draft, failed or broken drafts included) into the
attempt's evidence directory (`test-runs/instances/<lane>/attempts/run-*/`), plus the same chart as
`flow.svg`. This happens on every ending: success, failure, a refused or stopped run, an error, a watcher
stop. Take the Flow from what survives the browser (the run's step files hold the draft as each amendment
and the save left it: find the newest one), so a dead extension still yields a chart. `attempt-report.txt`
names the file on its own line and says whether it is the saved Flow or the draft. Only an attempt that never
got a draft writes no image, and its report says so. Also add a Lab command that charts any existing run
directory after the fact (e.g. `pnpm lab flow-chart <run dir>`).

**What the chart shows.** Every node, none dropped or merged. Top to bottom, one box per step in Flow order: step number, the node's kind
(act, read, wait, navigate, ...), its target in plain words (label or text, never a raw selector), a typed
value or parameter name, and the result read marked as the result. Loops are a bracket around the steps they
repeat, labelled with what they repeat over; branches and state routes are side arrows labelled with the
condition; the start and the end are marked. Long texts wrap or truncate with an ellipsis. Readable at
1x on a laptop screen; tall Flows grow the image, they are never cut.

**How.** Find where the attempt's saved Flow is available (Core's Flow definition as the Lab receives or
reads it after the attempt) and the code that writes the attempt evidence (start at
`packages/test-runner/src/attempt-lane/report.ts`, `live/run-attempt-command.ts`,
`live/unscored-attempt-evidence.ts`). Build the chart as a pure function Flow -> SVG string in a new focused
directory (e.g. `packages/test-runner/src/flow-chart/`): own layout, no network, deterministic. Rasterise
SVG -> PNG without opening a browser window: use a rasteriser already in `node_modules` if one exists,
otherwise add `@resvg/resvg-wasm` (pure wasm, no native build) to the owning package. Writing the image must
never fail or slow an attempt: an error writes `flow-chart-error.txt` and the attempt carries on.

**Owned paths.** The new chart directory; the attempt evidence/report writer files above (the hook only);
the Lab command entry for the new `flow-chart` command (`scripts/lab/**` dispatch only);
the owning package's `package.json` and `pnpm-lock.yaml` if a dependency is added;
`docs/architecture/testing-facility.md` (one short paragraph on the new evidence file).

**Must not touch.** `packages/test-runner/src/attempt-lane/scripted-model/**`,
`packages/test-runner/src/lab-runs/write-playback-steps.ts`, `packages/test-runner/src/loop-replay/**`
(other lanes are editing them), anything under `domain/`, `apps/`, or FluxIQ Core. No git commands.

**Rules.** Code structure per `AGENTS.md` "Engineering Structure And Modularity" (one exported thing per
file, a barrel in every directory, tests in a `tests/` folder beside their subject). No paid or live runs and
no Lab runs that open a browser. No `node -e`.

**Acceptance (run them, quote the output in your report).**
- Unit tests for the SVG builder (steps, a loop, a branch, the result mark, long-text wrapping) and for the
  writer (writes both files; a broken Flow writes the error file and does not throw), run with the package's
  test command limited to the new tests.
- Run the new `flow-chart` command on real recorded runs and look at the images yourself (Read them):
  the recordings in `C:/Users/osrs_/FluxStuff/fxwork/recorded-evidence/t1015-bigbox/run-*` (failed runs:
  they must still chart their draft) and the scripted run
  `C:/Users/osrs_/FluxStuff/fxwork/t1036/!FluxIQWebExtension/test-runs/instances/t1036-lab/attempts/run-mwvs5bch-26cd6b81`
  (read-only; write its images under `test-runs/t1039/` in your worktree). List the image paths.
- `pnpm --filter @fluxiq-web-extension/test-runner typecheck` (or the package's equivalent) and
  `node scripts/structure-audit.mjs` pass.

**Report.** `docs/working/data-first-simplification-plan/reports/t1039.md`, ending with the return contract.
Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t1039-flow-chart-png` (work only there).
