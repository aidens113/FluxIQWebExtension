# t600 guard-knows-authoring-mode: worker report

## Outcome

Done, with one deviation from the brief (the default mode; see Open questions).

## What changed and why

- `scripts/lab/live-guards/live-launch.mjs`: `describeLiveLaunch` now returns `authoringMode`, read from
  `--authoring-mode`, else the Lab's default. The mode is not part of `task`, so one task in two modes is told apart
  by the mode alone.
- `record-live-run.mjs`: the `start` entry carries `authoringMode`.
- `close-launch.mjs`: every `finish` (normal and reconciled) carries its start's `authoringMode`; a start without one
  (written before this change) gives its finishes none.
- `rules/unchanged.mjs`: compares only earlier finishes of the same instance, task and mode; an entry with no mode
  matches no launch (said in the header). The refusal text now names the mode.
- `rules/guard-state.mjs`, `admit-live-run.mjs`, `ledger.mjs`: typedefs and ledger header updated.
- No other rule changed; `debug` stays per instance (test added).
- Tests: `rules.test.mjs` (new mode test: other mode does not refuse, same mode does, a later other-mode run does not
  hide this mode's failure, mode-less entry matches nothing in any mode); `live-launch.test.mjs` (mode read and
  defaulted); `admit-live-run.test.mjs` (end to end: start and finish carry the mode, failed project run then admits
  candidate, refuses project; debug still refuses across modes); fixtures in `facility-failure-run.test.mjs`,
  `killed-run.test.mjs` given a mode so their existing assertions still exercise `unchanged`.
- `docs/architecture/testing-facility.md`: `unchanged` row and a new paragraph in "Live-run waste guards".

## Commands run and observed results

- `node --test scripts/lab/live-guards/tests/*.test.mjs` -> tests 47, pass 47, fail 0.
- `pnpm lab:test` -> tests 213, pass 212, fail 0, skipped 1 (pre-existing skip: "the probe finds the real FluxIQ Core
  checkout's build output", no Core build under the worktree's scripts path).
- `pnpm structure:check` -> `structure-audit: passed (194 warning(s), 639 baselined)`. The only live-guards warning is
  the pre-existing 16-file advisory on `scripts/lab/live-guards/` (no file added).

## Not verified

- No live Lab run (forbidden). `run-lab.mjs` was not touched; it passes the admission's launch through to
  `recordLiveRunStart`, so the mode flows without change there, but that path was exercised only by the unit tests.
- The real spend ledger was not read or written.

## Open questions or contradictions found

- The brief says the default is `candidate` "as the Lab already defaults it". The Lab's default is `legacy`:
  `packages/test-runner/src/live-llm/authoring-mode-env.ts` (`LAB_DEFAULT_AUTHORING_MODE = "legacy"`, with a comment
  that the Lab's default deliberately differs from Core's `candidate`) and `scripts/lab/live-campaign/arguments.mjs`
  (`DEFAULT_AUTHORING_MODE = "legacy"`). Recording `candidate` for a mode-less launch would label legacy runs as
  candidate runs and conflate the two experiments, which is the bug being fixed, so the guard defaults to `legacy`,
  restated as a module-private constant in `live-launch.mjs` with a pointer to the source. One-line change if the
  supervisor wants otherwise.
- Existing ledger history has no mode, so after this lands `unchanged` will not refuse any rerun until a fresh failed
  run in the same mode is recorded. That is the brief's stated behaviour.
