# t743-c4-core-moves: report

## Outcome

Partial. Steps 1, 2, 3 and 5 are done and tested on the real registry path. For step 4, `places`
works on every brief's opening call (build, repair, reset) and is tested. But today no public read
gives it any locations, so production sends no `places` key until the brief ports supply them. See
"Open questions".

## Interface for the next wave's domain worker

- **Frame field.** `automationStudioEvidenceBuildScope().move === "core"`. It is on a call that is a
  move Core makes itself: the site reset's `compare`, `compareAt` and `lookAt` arrivals. Their call ids
  are `site-reset.N.arrival`, `site-reset.place.N.arrival` and `site-reset.look.N.arrival`, but the
  field never comes from the id. The key is absent on every call the model wrote. A model call whose
  id has the same shape as Core's (`site-reset.look.9.arrival`) carries no `move`, and a test proves
  this. The type is `readonly move?: "core"` on `AutomationStudioEvidenceBuildScope`.
- **Marker (Core side).** `runAsAutomationStudioCoreMove(fn)` and `automationStudioCoreMoveRunning()`.
  Both are exported from `fluxiq/automation-studio` through runtime -> llm -> harness-options
  `index.ts`. There is one store per process, under `Symbol.for("fluxiq.automation-studio.core-move")`,
  so a second copy of Core (the panel bundle beside the domain's `dist`) reads the same marker. A test
  covers this.
- **`places` key.** It goes on the opening call's `value` (the call, not its answer; only on the
  opening call, ids `initial.*`), as `places: string[]`. Each entry is a location string, taken from
  the build's issued destination refs in the order they were issued. Duplicates, `"[withheld]"`
  (`AUTOMATION_STUDIO_WITHHELD_VALUE`) and empty or non-string values are left out. When there are
  none, the key is absent. When repairs exist, it sits beside `repairs` on the same opening value.
  The domain must accept `places` on an opening call and count each entry as a shown address. Until it
  does, a brief that carries the key would hit the domain's unexpected-key check. Today none carries
  it in production (see below).

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`.

- `llm/harness-options/core-move.ts` (new). An async-context marker for Core's own moves, kept once
  per process under a registered symbol, using the same pattern as the frame store (t738).
- `llm/harness-options/evidence-build-scope.ts`. Adds the `move?: "core"` field, its header bullet,
  and its copy in `runWithAutomationStudioEvidenceBuildScope`.
- `llm/harness-options/registry.ts`. `evidenceBuildScopes` writes `move: "core"` when
  `automationStudioCoreMoveRunning()` is true at the moment the binding frames the call.
- `llm/harness-options/index.ts`. Exports both marker functions.
- `flow-bootstrap/site-reset/start-check.ts`. The arrival of `compare`, `compareAt` and `lookAt`
  goes through a private `arrive()`, which runs `executeTool` inside `runAsAutomationStudioCoreMove`.
  The reads (`startState`) are not wrapped, because they never go through a registry call. The header
  paragraph gives the reason (t743).
- `project-agents/dispatch/run-brief.ts`. Adds `PLACES_KEY = "places"`, `issuedRefsOf(ports)`,
  `placesOf(issued)` and `carryingPlaces(loop, issued)`, and applies them in two places:
  - to the builder loop, under `shownAtOpening`, so a repair's opening carries both `repairs` and
    `places`;
  - to the reset ports' loop before `runAutomationStudioProjectResetLoop`. The spread keeps
    `issuedRefs` for the reset's refusal.

  Refs are read when the opening call is made, so refs from earlier briefs are included. There is a
  header paragraph. `reset-loop.ts` is not changed: the reset loop's opening goes through the wrapped
  ports.

New and changed tests:

- `flow-bootstrap/site-reset/tests/start-check-core-move.test.ts` (new), on the real path. A
  `StartCheck` takes its `tools` and `executeTool` from a real
  `AutomationStudioHarnessOptionRegistry.evidenceLoopBinding`, and the domain implementation reads
  `automationStudioEvidenceBuildScope()` after an await. The test checks four things:
  - look, place and start arrivals are each framed `move: "core"`;
  - a model call through the same binding is not framed, including one with the same id shape;
  - a model call made after a look is not framed;
  - a model call running at the same time as a look is not framed.
- `llm/harness-options/tests/evidence-build-scope.test.ts`. Adds three tests:
  - registry calls made inside the marker, however deep, are framed (alongside `opening: "fresh"`),
    and the same ids made outside it are not;
  - the frame setter copies `move`;
  - a second copy of the module shares the marker.

  These went into the existing file because that test folder already holds 25 files.
- `project-agents/dispatch/tests/brief-places.test.ts` (new). It checks five things:
  - a build brief's opening carries the deduplicated, non-withheld locations, and its later call does
    not;
  - the refs are read when the opening call is made;
  - there is no key when the refs are empty, all withheld, or the ports give none;
  - a reset brief's opening carries `places`;
  - (from the existing `reset-loop.test.ts`) the reset refusal still lists its refs.

## Commands run and observed results

All commands were run from `C:/Users/osrs_/FluxStuff/fxwork/t743/!FluxIQ/packages/fluxiq`.

- `pnpm exec vitest run .../harness-options/tests/evidence-build-scope.test.ts .../site-reset/tests/start-check-core-move.test.ts`
  -> 2 files passed, 16 tests passed.
- Mutation check: I temporarily changed `arrive()` to call `executeTool` directly. It restored itself
  from a scratch backup, and grep confirmed the marker line is back. Running
  `start-check-core-move.test.ts` in that state -> 3 failed (3). So the test depends on the marker.
- `pnpm exec vitest run .../dispatch/tests/brief-places.test.ts` -> 4 passed. Two earlier runs failed
  because of my own test scaffolding: the wrong decision shape, then a repeat look answered
  `already_observed`. Both were fixed in the test.
- `pnpm exec vitest run <R>/llm/harness-options/tests <R>/flow-bootstrap/site-reset/tests/start-check.test.ts <R>/flow-bootstrap/site-reset/tests/start-check-moves.test.ts <R>/flow-bootstrap/site-reset/tests/start-check-core-move.test.ts <R>/project-agents/dispatch/tests`
  -> Test Files 51 passed (51), Tests 368 passed (368), 76.85s. This includes another worker's
  `terminal-reason.test.ts` in the dispatch folder.

## Not verified

- Typecheck, build, structure audit and whole-package vitest. The brief reserves these for the lead.
- That async context survives the real production chain. Production goes
  `brief-ports` `built.loop.executeTool` -> `routing.recording` -> person-needed -> permissions ->
  `cancellation.tool` -> registry. I only proved it through a registry binding. All of those
  wrappers are promise wrappers, and t728's build frame (`automationStudioEvidenceBuildId`) already
  relies on async context crossing the same chain. The host lease is per brief, not per call.
- No live run, and nothing on the domain side: `node-run/run.ts` does not read `move` yet.
- Whether `places` reaches the domain in production. Today it never will (below).

## Open questions or contradictions found

1. **No public read gives the issued refs' locations (step 4 source).**
   - `destinationReceipts()` gives only `{ref, ordinal, count}`.
   - The create-baselines `issuedRefs()` does carry `location`, but it is private behind
     `AutomationStudioSiteResetLedger` and `ProjectLedger` (`private createBaselines`).
   - `service/project-build/brief-ports.ts` builds the reset ports' `issuedRefs` from
     `destinationReceipts()` with no `location` (around line 356). It gives builder ports no
     `issuedRefs` at all.

   `run-brief.ts` reads `issuedRefs` off both ports, typed as optional the same way `reset-loop.ts`
   already does, so it is ready. But production `places` stays empty until one of these happens:
   - (a) `brief-ports.ts` fills `location` on the `issued` entries (for example from a new one-line
     `issuedRefs()` on `AutomationStudioSiteResetLedger` delegating to `createBaselines.issuedRefs()`)
     and returns `issuedRefs: () => [...issued.values()]` on the builder ports too; or
   - (b) the ledger gets that one-line public `issuedRefs()`, and run-brief is changed to read
     `request.ledger.issuedRefs()`.

   Both need files I do not own (site-reset `ledger.ts`, which another worker is editing now, and/or
   `brief-ports.ts`). I did not touch them.
2. The debug's fix 3 also lists "act pages and proposal navigations" as places. The brief asked only
   for issued lists' locations, so that is all I did. Proposal navigations already travel as
   `repairs`.
3. The marker is not cleared inside the registry frame. A nested registry call made by a domain
   implementation during Core's move would also be framed `core`. No such nesting exists today. The
   model's calls are never nested inside a Core move: `lookAt` and `compareAt` run before the
   placed model call, not around it.
