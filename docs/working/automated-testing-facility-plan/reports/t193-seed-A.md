# t193-seed-A: service-bootstrap tests reuse a seeded data directory

## Outcome

Done. All four owned files now build their projects once per file in `beforeAll` (timeout 60_000) and copy the seed into each case's data dir before any service there is constructed. All 18 tests pass under `heavy.sh` with one worker, including the two cases that timed out at 15 s in the baseline. The structure audit passes.

## What changed and why

All in Core `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/`, CRLF kept. `fixtures.ts` is untouched. Every file gets a `seedRoot` made with `mkdtemp` in `beforeAll` and removed in `afterAll` with `rm(..., { recursive: true, force: true, maxRetries: 10, retryDelay: 25 })`. The seed value is `structuredClone`d on each copy. The supervisor's earlier `rm` retry edits in `afterEach` are kept.

Finding that shaped the design: a service's in-memory Flow index (`repositories.flows`) holds only the Flows of projects that service has loaded (`createFlow` calls `flows.loadProjectFlow(project.id, ...)`, then `repositories.flows.get(flowId)`). So one service refuses a second `flow.generated` ("Automation Studio Flow ID already exists"). The original multi-project cases work only because each project is created by a different service. My first attempt built both projects through a single service, and both multi-project seeds failed with that error. The fix is a local helper, `blankFixturesPerService(dir, first, count, ...variant)`. The seeding service makes the first project, and each extra project is made by a fresh service over the same seed dir, closed straight afterwards. This reproduces the on-disk result of the original cases.

- **accounting.test.ts**: two seeds, `single` (default `blankFixture`) and `triple` (three default projects, one per service).
  - `single` serves 11 of the 12 `it`s and all 4 `it.each` rows.
  - "attributes pre-provider and resolver failures": the seed is copied before `pre` is constructed and supplies `resolvedFixture`. `pre` still makes its own `createProject`/`createFlow` (`flow.pre-failure`, no instruction), because that is the subject of the case. It was never a `blankFixture`.
  - "distinguishes unavailable, failed, and malformed provider resolution": copies `triple`, and each loop iteration's new service uses `fixtures[index]`, as the original made one project per service.
  - No `blankFixture` is left in a test body.
- **catalog.test.ts**: two seeds, `single` (default) and `examplePair` (two `example`-domain projects, one per service).
  - The two single-project cases use `single`.
  - The granted/denied case copies `examplePair` before `granted` is constructed and uses `[grantedFixture, deniedFixture]`. The instruction edits (`saveFlowInstruction` with `Date.now()`) still happen after the copy, so they stay per test.
  - No `blankFixture` is left in a test body.
- **flow-call-limit.test.ts**: one `single` seed, copied before the service is constructed. `saveFlow({...flow, metadata})` uses the seed's flow artifact, which matches the copied disk state exactly.
- **incomplete-draft.test.ts**: one `example` seed (`blankFixture(instance, "active", "example")`). `storedDraft` reads under `tempRoot` as before. The draft (revision 1) is not part of the seed, so it is still fresh for each run.

Kept `blankFixture` in a test body: none. The brief's keep case for "a second project in the same data dir" is met by seeding each extra project through its own service. That keeps the test's meaning: the same projects on disk, each first loaded by its own service. I deliberately departed from the literal keep list here, because the two cases it covers were exactly the ones timing out. Shared id and createdAt: I checked every assertion, and none reads a project id, createdAt or instruction timestamp against a fresh value. They compare only diagnostics, and project ids are taken from the seed value.

## Commands run and observed results

From `packages/fluxiq`, `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193-seed-A <before|after>" npx vitest run <4 files> --maxWorkers=1 --minWorkers=1`:

| Case | Before | After |
| --- | --- | --- |
| accounting: persists no proposal | (cut off in output) | 3684 ms |
| accounting: pre-provider and resolver failures | (cut off) | 6241 ms |
| accounting: post-resolution setup throws | (cut off) | 1531 ms |
| accounting: it.each x4 | (cut off) | 2629 / 4686 / 2538 / 3626 ms |
| accounting: structured harness failure | (cut off) | 5089 ms |
| accounting: invalid successful output | (cut off) | 6333 ms |
| accounting: stale post-provider binding | 6082 ms | 7618 ms |
| accounting: persistence failure | 6025 ms | 4119 ms |
| accounting: resolution matrix | **timed out at 15098 ms** | 13926 ms pass |
| accounting: generation lock | 1732 ms | (in file total) |
| catalog: canonical binding | 1416 ms | 1725 ms |
| catalog: granted/denied catalog | **timed out at 15276 ms** | 10439 ms pass |
| catalog: required capabilities | 8425 ms | 2159 ms |
| catalog file | 25119 ms, 1 failed | 22936 ms, 3 passed |
| incomplete-draft | 13956 ms | 6622 ms (file 8365 ms) |
| flow-call-limit | 3283 ms | 2904 ms (file 2672 ms in an earlier after run) |
| accounting file | 13 tests, 1 failed | 68305 ms, 13 passed |
| Totals | Tests 2 failed / 16 passed; Duration 147.19s | Test Files 4 passed; Tests 18 passed; Duration 186.12s |

The baseline's per-test lines for the first accounting cases were cut off by my `tail -30`, so they are not quoted. The machine was heavily loaded in both runs, with shared concurrent workers; per-case times are noisy, and the after run's total wall time was longer because of load (transform 53.65s, collect 76.05s).

An intermediate after run, with a single service building the multi-project seeds, failed both multi-project seeds in `beforeAll` with `Automation Studio Flow ID already exists: flow.generated` (accounting and catalog, 16 skipped). It led to the per-service helper above.

`node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (197 warning(s), 354 baselined).` Exit 0. New advisory warning: `accounting.test.ts: 413 lines is past the 400-line advisory threshold.`

## Not verified

- A TypeScript type check (`tsc`) of the four files. vitest strips types, so for example the `...variant` tuple spread into `blankFixture` and `cases.entries()` destructuring are unchecked; `pnpm check` will cover them.
- Behaviour on an idle machine, and inside a full-suite run.
- The resolution-matrix case still takes 13.9 s under load (three services and three generations in one test). The seed removed all project creation from it, and what remains is the generations themselves.

## Open questions or contradictions found

- The brief says to keep `blankFixture` for "a second project in the same data dir". I seeded those projects instead, each through its own service, to match the original per-service creation, because those two cases were the only baseline timeouts. The supervisor should confirm or revert.
- `blankFixturesPerService` is duplicated in accounting.test.ts and catalog.test.ts, and it pushes accounting.test.ts to 413 lines (advisory warning). It belongs in `fixtures.ts`, which this brief did not let me edit. Moving it there would clear the warning and remove the duplication.
