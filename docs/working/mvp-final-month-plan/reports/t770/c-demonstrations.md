# t770-C: scripted demonstrations (test contracts + Scenario Lab)

## Outcome

Done. Contract, validator, three sites' demonstrations (plus one conflicting), gatherer, and provider-free browser proofs are in and pass. One caveat: the packages' `test` and `check` scripts for test-contracts cannot run in this tree (see Commands), so I ran their steps directly.

## What changed and why

Contract (`packages/test-contracts`), exported through `src/index.ts` via `src/demonstration/index.ts`:
- `src/demonstration/types.ts`: `DemonstrationDetourAct`, `ScenarioDemonstrationDetour`, `ScenarioDemonstration` (shape exactly as briefed; detour = `{ stepIds, why, acts }`).
- `src/demonstration/validate.ts`: `validateScenarioDemonstration(demonstration, context)`, `ScenarioDemonstrationContext` (`{ instruction, expectedDatasetId, recordValues }`), `SCENARIO_DEMONSTRATION_DESCRIPTION_MAX` (4000). Checks: nonblank description <= 4000, not equal to the instruction (whitespace/case folded), names no record value (values >= 3 chars, substring); unique step ids; detour step ids exist in steps and all come before the first extract step; each detour has >= 2 step ids (apply and undo), a `why` and >= 1 act; at least one detour; a non-conflicting demonstration has an extract step whose id equals `expectedDatasetId`. (The files sit in a `demonstration/` directory because the structure audit rejected four `scenario-` prefixed files.)
- `tests/scenario-demonstration.test.mjs`: 4 tests of the validator.

Lab (`apps/scenario-lab/src/scenarios`):
- `insert-after-step.ts`: `insertAfterStep(script, afterId, steps)`, fails loudly on a missing anchor.
- `everything-store/demonstrations.ts`: `EVERYTHING_STORE_DEMONSTRATIONS`.
- `crossborder-marketplace/demonstrations.ts`: `CROSSBORDER_MARKETPLACE_DEMONSTRATIONS`.
- `job-board/demonstrations.ts`: `JOB_BOARD_DEMONSTRATIONS`.
- Each site `index.ts` gained one export line.
- `realistic-site-demonstrations.ts`: `REALISTIC_SITE_DEMONSTRATIONS` gatherer, beside `realistic-site-live-tasks.ts`.
- `tests/realistic-site-demonstrations.test.ts`: validates all four demonstrations against their task (instruction, expectedDatasetId, every expected record value) and checks coverage.
- Browser proofs: `crossborder-marketplace/tests/demonstrations.test.ts`, `everything-store/tests/demonstrations.test.ts`, `job-board/tests/demonstrations.test.ts`.

All steps are built by splicing detour steps into the site's existing honest workflow script (read only); the extract step ids are unchanged (`extract-free-hubs-under-ten`, `extract-coupon-earbuds`, `extract-remote-easy-apply`).

### Demonstrations and detours

1. `crossborder-marketplace-free-hubs-under-ten-demo` (task `crossborder-marketplace-free-hubs-under-ten`)
   - Detour A: ticks "Ships from: Spain" in the sidebar, then clears the "Spain ×" chip (answers the traffic check the clear load meets). Acts: click "Spain". Placed before the price ceiling, because a filter change drops the typed ceiling.
   - Detour B: Orders sort, then Best Match back (answers the traffic check again). Acts: click "Orders".
   - Description: "I search for the hubs, tick Ships from Spain just to see what it changes and clear it again, then narrow to free shipping and a maximum price of 10, try sorting by Orders and switch back to Best Match, sort by price from low to high, and read the cards that are not ads."
2. `crossborder-marketplace-free-hubs-higher-limit-demo` (same task, `conflictsWithInstruction: true`): same two detours; the ceiling typed is 20, not 10.
3. `everything-store-coupon-earbuds-demo` (task `everything-store-coupon-earbuds-rated-four`)
   - Detour: ticks the "Brightaisle Plus" delivery filter, then unticks it. Acts: click "Brightaisle Plus".
   - Only one detour, deliberately: the store refuses a sixth results page within eight seconds (`STORE_THROTTLE`), and the search, its browser check and two detour loads are already four. A sort detour (tried first: Price low to high, then Featured) made six loads and was refused, so I dropped it rather than make the demonstration timing-dependent.
4. `job-board-remote-easy-apply-demo` (task `job-board-remote-easy-apply`)
   - Detour A: Job type menu, Full-time, then Any job type.
   - Detour B: after the date sort, relevance tried, date chosen again. The board refuses every sixth results page, and this is the sixth, so the detour includes waiting for "Hang on a moment" and pressing "Try again" (`demo-rate-limited`, `demo-retry`).

## Commands run and observed results

- Core's build cache said the sibling Core was stale ("inputs changed: packages/fluxiq"), so `pnpm --filter @fluxiq-web-extension/test-contracts test` and `... check` refuse to run (script starts with `scripts/check/core-build.mjs`). I ran Core's suggested library build (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` in the Core worktree, build output only, no Core source touched); it kept reporting stale because another agent is editing `packages/fluxiq` in that worktree (git status there shows modified conversation command files). So I ran the guarded script's own steps directly:
  - `npx tsc -p tsconfig.json` then `node --test tests/*.test.mjs src/tests/*.test.mjs` in `packages/test-contracts` -> `# tests 174 / # pass 174 / # fail 0`. (This includes the 4 new tests; run alone: `# pass 4`.)
  - `npx tsc -p tsconfig.json --noEmit` in `packages/test-contracts` -> exit 0.
- `pnpm --filter @fluxiq-web-extension/scenario-lab check` -> `{"build-cache":"build","step":"scenario-lab:check",...,"ms":63596}` (ran both tsc projects, no errors).
- Builds: `node ../../scripts/build-cache/cli.mjs test-contracts:build` and `... scenario-lab:build` in `apps/scenario-lab` (the test script's prerequisites), both built.
- Browser tests, `node --test` on the built files (last full run, all four files together):
  - crossborder `dist/scenarios/crossborder-marketplace/tests/demonstrations.test.js`: 3/3 ok (detours change the results and undo restores them; positive extract equals the expected records exactly, `assert.deepEqual` plus record-by-record; the conflicting one does not equal them).
  - everything-store `.../everything-store/tests/demonstrations.test.js`: 2/2 ok.
  - job-board `.../job-board/tests/demonstrations.test.js`: 2/2 ok.
  - `dist/scenarios/tests/realistic-site-demonstrations.test.js`: 5/5 ok.
  - Two further runs of the three browser files together: `# pass 7 / # fail 0` both times.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (226 warning(s), 616 baselined).` (An earlier run failed on the `scenario-` filename prefix and a packed statement in my test; both fixed.)

Headed: none of the three suites has a headed switch (crossborder harness and everything-store kit launch `headless: true`; job-board's browser launch is headless too), so all ran headless. I did not add a switch.

## Not verified

- No headed run, no live Lab run, no model call, no full suites.
- `pnpm --filter ... test` / `check` for test-contracts as written (blocked by the Core-staleness guard for reasons above); the equivalent steps ran directly.
- One four-file run, after `scenario-lab check`, showed the job-board file failing both its tests; the error text was not captured, and the same file passed alone and in three later runs (alone, with two others twice, with all four once). My best guess is the dist was being rebuilt by `check`/build at that moment, but I did not prove it, so treat job-board as passing but once unexplained.
- What a Flow built from these demonstrations does (that is the later check); nothing here probes a built Flow.
- The "visible change" assertion compares sort tab / chips / first cards (crossborder), sort select / filtered flag / count / first names (everything-store), sort line / count / first titles (job-board); the Full-time filter's change on job-board relied on that snapshot differing, and it did.

## Open questions or contradictions found

- Everything-store's recorded extract step keeps every couponed organic card without reading the rating (the workflow's own comment says so); the expected five records need the person's rating and accessory judgement. My test applies that judgement the same way `breadth-paths.test.ts` does (rating >= 4, drop "Replacement"/"Charging Case"), so the demonstration's extract step is not by itself equal to the expected dataset. The later Flow check should compare the Flow's output, not that step's raw read.
- The everything-store demonstration has one detour, not two (throttle reasons above). If a sort detour is wanted there, the Lab would need a spacing mechanism in a demonstration; none exists.
- Not touched, per the brief: live-tasks, oracles, expected datasets, manifests/workflows, fixture site code, test-runner, extension, Core source. No missing detour control on any fixture.
