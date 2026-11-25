# Brief t1047: the dev-ancestry guard's test fallout from the 2026-11-25 sweep

**Goal.** The full sweep on `dev` (2026-11-25) failed 16 downstream tests, every one caused by t1040, which put
the dev-ancestry guard (`scripts/lab/live-guards/cli/behind-dev.mjs`, `admitDevAncestry` in
`scripts/lab/run-lab.mjs:103`) in front of the Lab entry and of the launcher scripts. The guard and its order are
right and stay: it is asked before anything else, because "merge `dev`" comes before "rebuild". Fix the tests so
they test what they were written to test under that order. Do not remove, reorder or weaken the guard, and add
no flag or environment variable past it (overrides are files only the user creates).

**Failures (logs in `C:/Users/osrs_/FluxStuff/fxwork/t1046/!FluxIQWebExtension/test-runs/t1046/`).**
1. `scripts/check/core-build/tests/package-gates.test.mjs:39` requires every gated script of a Core-linking
   package to start with the core-build gate. `apps/extension` `test:e2e` now starts with the dev-ancestry guard,
   then the gate. Accept exactly that guard (its relative path from the package) as an optional prefix before the
   gate, and keep refusing anything else in front of it. Add a case proving a script with some other prefix
   is still refused.
2. `scripts/lab/core/build/tests/unbuilt.test.mjs:154`: its temporary Core is `git init`-ed with no commit, so
   the guard refuses ("could not be read ... Needed a single revision") before the unbuilt-Core check. Give the
   fixture Core a readable history that contains its own local `dev`: an initial commit, with `dev` pointing at
   it. Then the only thing that can stop the run is still the check under test. Keep asserting that pnpm is never
   reached, and that the refusal is the `core-build` `unbuilt` setup line.
3. In `packages/test-runner`, 14 tests pin a root `package.json` launcher's exact text, which is now
   `node scripts/lab/live-guards/cli/behind-dev.mjs && <old command>`. Update each so it expects the guarded
   command. Find them with `grep -rn "run-demo-llm\|demo:llm" packages/test-runner/src --include=*.test.ts`.
   The failing names are in `ext-test.log` (`grep -n "not ok"`): 459, 471, 473, 2592, 2625, 2634, 2635,
   2645, 2649, 2652, 2661, 2667, 2672, 2678. Where a test asserts the launcher is provider-free or
   secret-stripped, keep that assertion; only the expected text changes.

**Owned paths.** The three test locations above and their test files only; `apps/extension/package.json` only if
item 1 shows the script itself is malformed (it should not be).
**Must not touch.** `scripts/lab/run-lab.mjs`, `scripts/lab/live-guards/**` source, any non-test source,
root `package.json`, Core. No git, no paid or Lab runs, no `node -e`.

**Checks (run each and quote the result).**
- `node --test scripts/check/core-build/tests/package-gates.test.mjs` -> all pass.
- `node --test scripts/lab/core/build/tests/unbuilt.test.mjs` -> all pass.
- `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run t1047-runner -- pnpm --filter @fluxiq-web-extension/test-runner test` -> 0 failures.
- `pnpm --filter @fluxiq-web-extension/test-runner check` -> exit 0.
- `node scripts/structure-audit.mjs` -> passed.

Work in `C:/Users/osrs_/FluxStuff/fxwork/t1047-sweep-guard-test-fallout` (branch `task/t1047-sweep-guard-test-fallout`).
**Report.** `docs/working/data-first-simplification-plan/reports/t1047.md`, ending with the return contract.
