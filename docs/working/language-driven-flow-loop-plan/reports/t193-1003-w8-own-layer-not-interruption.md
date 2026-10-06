# t193-1003-w8: a layer the build opened is not an interruption (C17)

## Outcome

Done. A press inside a layer that a press of the same build opened is no
longer drafted `interruption: true`. A consent wall present from the first
look, or a chat card that appeared on its own, is still an interruption.

## What changed and why

- `domain/src/runtime/llm-evidence/node-run/own-layers/memory.ts` (new), with
  barrel `own-layers/index.ts`: `createWebNodeOwnLayers()`, a per-build memory
  keyed by (session, project, flow), the same way `arrival.ts` keys builds and
  bounded to 16 builds like it. It has three methods. `pressed(build, before, after)`
  records every layer handle on `after` that was not a layer on `before`, and
  only when both looks are present and on the same location. A layer is an
  element `webIsLayer` accepts, or a dialog handle an element names as
  `inDialog`, which is how `answered-layer.ts` reads one. `owns(build, layer)`
  answers whether the build opened that layer. `opening(build, callId)` forgets
  the memory on the build's `initial.*` opening call. A round that continues a
  Flow forgets nothing.
  The module sits in a subdirectory and not beside `arrival.ts` because
  `node-run/tests/` was already at the structure audit's 25-file limit, and
  `node-run/` itself is near it.
- `press-effect/answered-layer.ts`: `webAnsweredLayer` takes a fourth,
  optional `own: (layer) => boolean`, which defaults to none. Layers it names are
  removed from the layers that held the control. Nothing else changed.
- `run.ts`: the opening call also calls `run.layers.opening`. After the
  look that follows the press, an on-page mutate (`effect === "mutate"` and not
  a navigation) does two things in order. First it computes `interruption`,
  passing `run.layers.owns(buildOf(run), ·)`. Then it records
  `run.layers.pressed(...)`. The draft's `interruption` line now reads that
  value. Looks, navigations, reads, written steps and replays do not record
  anything.
- `context.ts`: `WebNodeRun.layers: WebNodeOwnLayers`. `node-run/index.ts`
  exports it. `tools.ts` builds one `layers` memory beside `arrivals` and
  `addresses` and passes it into `runWebOutputNode`.

**Handle durability (asked by the brief).** A handle is a sound key. Handles
are issued per (project, flow) by `stable-handles.ts`, keyed by location,
frame, selector and record, and rebound by loose address when positions shift.
A reload at the same location therefore gives the same element the same handle.
I checked this in two places:
- In the run's own decision dump (`build-2026-10-03T04-37-26-973Z-3788.jsonl`),
  the chooser rows t338-t348 "appeared" on the opener press and the same
  t338-t348 were "gone" on the "Set as my store" press.
- A new run test reopens the chooser after the reload. Its "Set as my store"
  control has the same handle as before. The layer div prints no view line, so
  its control, numbered by the same rule, stands in for it.

## Tests (written to fail first; verified failing with the fix disabled)

- `press-effect/tests/answered-layer.test.ts`: two new cases. A press inside a
  chooser that `own` names answers no layer, and is still true without `own`.
  A consent wall answered while `own` names another layer is still an
  interruption.
- `own-layers/tests/memory.test.ts` (new) covers:
  - an opened layer is remembered and a pre-existing one is not;
  - builds are kept separate;
  - nothing is recorded for another location or a missing look;
  - the opening call forgets the memory and any other call keeps it.
- `tests/draft-control.test.ts`: three run-level cases.
  - Opener press, then "Set as my store" inside the chooser it opened, with
    the chooser gone and the location unchanged: neither draft carries
    `interruption`, and the handle survives the reload.
  - A consent wall from the first look, answered: `interruption: true`.
  - A chat card that appeared after the look following the build's press,
    closed: `interruption: true`.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193 w8 test" sh -c "npx tsc -p tsconfig.json --noEmit; ...; npx tsc -p tsconfig.test.json --noEmit; ...; node .t193-w8-run-tests.mjs"`
  in `domain/`: `src-exit=0`, `test-exit=0`, `entries: 31`, `# tests 215`,
  `# pass 215`, `# fail 0`, `node-run-tests-exit=0`.
  - The runner was a temporary script that bundled only the `node-run/**/tests`
    entries with the same esbuild options as `scripts/test-domain.mjs`, into
    `domain/.test-build-scratch/t193-w8`. Script and output were deleted
    afterwards.
  - I did not run `test-domain.mjs` itself, because it has no directory filter
    and runs the whole domain suite.
- Negative check: I replaced the `own` filter in `answered-layer.ts` with a
  no-op, ran the same runner, then restored the file. Result: `# fail 2`,
  `not ok 6 - a press inside a layer this build opened, which closed it, answered no layer`
  and `not ok 75 - a press inside the store chooser this build's own press opened is a step of the Flow, not an interruption`.
- `node scripts/structure-audit.mjs`: no FAIL lines, exit 0, advisory warnings
  only. The first attempt failed with `node-run/tests/: 27 source files exceeds
  the 25-file limit`, which is why the memory and its test moved to
  `own-layers/` and the run tests were merged into `draft-control.test.ts`.

## Not verified

- No live run (forbidden by the brief), so the lane B bigbox store switch is
  not exercised against the real page.
- The whole domain suite and `pnpm check` were not run.
- I have not confirmed that the real chooser's layer element itself, as
  opposed to its rows, keeps its handle across the reload in the live capture.
  Only the rows are visible in the dump's change list ("and 6 more changes"
  hides the rest).

## Open questions or contradictions found

- A layer that opens on a timer in the instant between a press and the look
  after it, such as an email offer (C9 shows these exist), is recorded as the
  build's own. Closing it would then be a required step, not an optional one.
  This follows the brief's definition. One guard would be to never treat a
  layer the capture gave an interruption `kind` (consent, promotion, robot
  check, rate limit, assistant) as own-opened. I did not add it because it was
  not asked for.
- A new process continuing a Flow starts with an empty memory, so a layer a
  held step opened reads as an interruption again. Replays do not record
  opened layers either.
- The decision dump also shows two "×" presses drafted `interruption: true`.
  If either closed the chooser the build opened, this fix also makes them
  non-optional, which is consistent with the new rule.
