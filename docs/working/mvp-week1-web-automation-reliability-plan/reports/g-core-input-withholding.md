# g-core-input-withholding — Core persists run inputs withheld

Worker report for `g-core-input-withholding` in the twenty-fourth dispatch of
[finish-week1.md](../briefs/finish-week1.md). Core `F:\!FluxIQ`, branch `dev`, at
`240c73e`, uncommitted. Written 2026-09-13.

## Outcome

**Done.** A run's supplied inputs are persisted with every value replaced by
`AUTOMATION_STUDIO_WITHHELD_VALUE` (`[withheld]`), keeping each key, in both
places: the runtime session record's `metadata.inputs` and `runDetailEnvelope`'s
`inputs`. The real inputs stay in memory for the run only.
- One service row, one stream-store row, and a third row for a reader I had to
  change (`service.ts:3422`, see Open question 2).
- Each row was proven with its own mutation, and each file was restored
  byte-identical.
- `pnpm check` and `pnpm docs:check` exit 0.
- `service.ts` is still at 6807 lines, its baseline.

## What changed and why

Paths are under `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`
unless stated.

- **`runtime/service.ts`** (net 0 lines, 6807 = baseline):
  - `:88`: `AUTOMATION_STUDIO_WITHHELD_VALUE` added to the existing `./executor.ts`
    import.
  - `:2832` (`startRuntimeSession`):
    `inputs: Object.fromEntries(Object.keys(input.inputs ?? {}).map((key) => [key, AUTOMATION_STUDIO_WITHHELD_VALUE]))`.
    The withholding is applied to the session object itself, so every later write
    of it carries the marker: `:3450`, `:3508`, `:3580`, `:3636`, and the retry at
    `:3299`, which spreads it. So does the returned session.
  - `:3422` (`runRuntimeSession`): `inputs: (input.inputs ?? {})`. It was
    `input.inputs ?? session.metadata?.inputs ?? {}`. Without this change, a queued
    session run by `runId` with no `inputs` would have been run with the literal
    string `[withheld]` as every input value.
- **`storage/project/runtime-stream-store.ts`** (+9 lines, 626):
  - `:20` imports the marker from `../../runtime/executor/index.ts`, the executor's
    barrel. The audit's barrel rule allows a directory's `index` (`imports.mjs:127`),
    and the executor imports no storage module.
  - `runDetailEnvelope` (`:514`): `inputs: withheldRunInputs(detail.inputs)`. The
    new local `withheldRunInputs` follows the envelope; it keeps `undefined` as
    `undefined` and replaces every value.
- **`storage/project/tests/runtime-stream-store.test.ts`:** a new last case, "keeps
  each run input's key and withholds its value in the envelope a run-summary
  event persists".
  - It `putRunDetail`s inputs holding a synthetic string and a number.
  - It asserts both keys read the marker in the `run_summary` event's
    `payload.inputs`, and in `getRunDetail(...).inputs`.
  - It asserts no file under the project root holds the string, as UTF-8 or
    UTF-16LE.
- **`runtime/tests/service-flow-representation.test.ts`:** a new
  `describe("Automation Studio run inputs at rest")` with two rows.
  - **Session and chunks.** A routed Flow's subflow graph has a
    `builtin.policy.action` whose `text` is `{ $state: { path: "web.secret.password" } }`,
    the auth-gate shape. The row runs it with that input set to a synthetic string,
    then reopens the service on the same data directory.
    - It asserts `getRuntimeSession(...).metadata.inputs` equals the marker.
    - It asserts every `run_summary` event in every raw
      `automation-studio.event-chunk.v1` runtime chunk for the run carries the
      marker at `payload.inputs`.
    - It asserts no file under the data directory holds the string.
  - **Queued run.** `startRuntimeSession` with `inputs: { note }`, then
    `runRuntimeSession` by `runId` without inputs. It asserts `trace.values` has no
    `note`.
  - **Why this file.** A new file is impossible:
    - `runtime/tests` holds 25 files, and test files count toward the 25-file
      directory limit (`scripts/structure-audit/context.mjs:130`, `rules/directory-files.mjs`);
    - `service.test.ts` is at its 4787-line baseline.

    This is the service test that already runs a router-selected subflow graph,
    the path that writes run-detail event chunks (`service.ts:3509-3549`).
- **`F:\!FluxIQ\docs\architecture\package-boundaries.md`:** one paragraph in the
  `0.4.0` Migration Notes entry, "A run's supplied inputs are withheld at rest",
  after the trace-withholding paragraph.
- **`docs/reference/framework-reference.md` and
  `packages/fluxiq/docs/reference/framework-reference.md`:** regenerated with
  `pnpm docs:reference`. Exactly 9 rows moved, the `runtime-stream-store.ts:21..94`
  citations, each by +1, because of the import line.

## Readers of `metadata.inputs` and run-detail `inputs`, and what each now sees

Found by grep across `packages/` and `apps/`.

| Reader | What it sees now |
| --- | --- |
| `runtime/service.ts:3422`, the graph inputs of `runRuntimeSession` | The request's `inputs`, or `{}`. It no longer reads the record (changed). |
| `runtime/service/summaries/conversions.ts:94` `runtimeSessionToFlowRunDetail` | Markers, because the session it converts carries them. It feeds the run detail saved by `saveFlowRunDetail`: the typed store through `runDetailEnvelope`, or the legacy `run.json` (`summaries/store.ts:104`) when no project database pool is available. It also feeds the adaptive retry's detail (`service.ts:3316`). |
| `runtime-stream-store.ts` `runDetailFromEvents` (the envelope spread) | Markers. It feeds `getRunDetail`, `service.getFlowRunDetail` (`service.ts:3840`), and the `get-flow-run-detail` API. |
| `listFlowRunEvents`, `getRuntimeEventDetail` (`run_summary` payloads) | Markers. |
| `getRuntimeSession` and `listRuntimeSessions` (`summaries/store.ts:76-90`); the `start-`, `run-` and `cancel-runtime-session` API responses | Markers in `metadata.inputs`. |
| `apps/web` | No reader. `FlowRunView.tsx:117,124` sends inputs on `start` and again on `execute`, so the web run is unaffected. `RunDetailPanels.tsx:240,259` shows trace `attempt.inputs`, not run-detail `inputs` (see Open question 1). |
| `api/handlers/router.ts:152` | The request payload's inputs, not persisted ones. Unaffected. |
| Downstream test-runner (compatibility only) | `persisted-flow-run.ts:133` and `existing-flow-run.ts:87` send `inputs` again with `runId`, so they are unaffected. A grep found no downstream reader of `metadata.inputs` or `detail.inputs`. |

## Compatibility effect

A behaviour change in unreleased `fluxiq` 0.4.0, with no type or export change:
1. **Hosts that read input values back** from a session record, a run detail,
   or run events now see keys with `[withheld]` values.
2. **A queued session run by `runId` without `inputs`** runs with no inputs,
   instead of the inputs recorded at start. The web panel and the downstream
   runner already send them again.
3. **Records persisted before this change are not rewritten.** A run detail
   re-saved after upgrading appends a new `run_summary` event with markers,
   because the envelope changed. Older chunks keep what they held.

## Commands run and observed results

- **Before editing.** `git -C F:\!FluxIQ log --oneline -1` printed
  `240c73e Bring Core's Week 1 plan Current State up to the 0.4.0 release`, and
  `git status --short` was empty.
- **Line counts.** `wc -l` after the edits printed `6807 …/runtime/service.ts`
  and `626 …/runtime-stream-store.ts`.
- **Tests.**
  `npx vitest run …/runtime/tests/service-flow-representation.test.ts …/storage/project/tests/runtime-stream-store.test.ts --no-file-parallelism`
  printed `exit=0`, `Test Files 2 passed (2)`, `Tests 15 passed (15)`. The three
  new rows passed in 1106 ms, 1191 ms and 305 ms.
- **Mutations.** Scratch script `g-core-input-withholding-mutate.mjs`. For each
  mutation it:
  - checks the original text occurs exactly once;
  - writes the mutation and runs only the matching row with `-t`;
  - restores the original bytes in `finally`;
  - compares SHA-256.

  All three mutations were caught:

  | Mutation | What it restored | Observed | Restored |
  | --- | --- | --- | --- |
  | A, `service.ts:2832` | `inputs: input.inputs ?? {}` | `vitest exit=1`, `× … persists each run input's key with its value withheld, in the session record and every runtime event chunk`, `AssertionError: expected { Object (web.secret.password) } to deeply equal { 'web.secret.password': '[withheld]' }` | `sha-before=ab3989fb…6e243a`, `sha-after=ab3989fb…6e243a`, `byte-identical=true` |
  | B, `service.ts:3422` | `input.inputs ?? session.metadata?.inputs ?? {}` | `vitest exit=1`, `× … runs a queued session …`, `AssertionError: expected { note: '[withheld]', …(6) } to not have property "note"` | `byte-identical=true`, same SHA |
  | C, `runtime-stream-store.ts` | `inputs: detail.inputs` | `vitest exit=1`, `× … keeps each run input's key and withholds its value in the envelope a run-summary event persists`, `AssertionError: expected { …(2) } to deeply equal { …(2) }` | `sha-before=5013932…17a2c`, `sha-after=5013932…17a2c`, `byte-identical=true` |
- **Docs reference.** `pnpm docs:reference` printed `exit=0` and
  `Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (1574 public declarations)`.
  `git diff --stat` showed 18 lines changed in each copy: the 9 `runtime-stream-store.ts` rows, +1 each.
- **Docs check.** `pnpm docs:check` printed `exit=0`,
  `Validated local links in 101 authored/reference Markdown files.` and
  `Deterministic framework reference is current.`
- **Core check.** `pnpm check` printed `exit=0`: the structure tests `ok 1..57`,
  `structure-audit: passed (121 warning(s), 256 baselined).`, and
  `packages/contracts`, `client-gateway-websocket`, `fluxiq` and `apps/web`
  `check: Done`.
- **Probe, temporary.** A read-only probe asked where a run input that no binding
  asks for persists. The probe was
  `runtime/tests/g-core-input-withholding-probe.test.ts`, untracked, run once and
  deleted.
  - `probe exit=0`, `PROBE run.status=succeeded`.
  - `PROBE holds: programs\automation-studio\projects\<p>\runtime\sessions\<run>.json paths=["$.data.session.trace.attempts.0.inputs.unbound.note","$.data.session.trace.attempts.1.inputs.unbound.note","$.data.session.trace.attempts.2.inputs.unbound.note","$.data.session.trace.values.unbound.note"]`.
  - No other file held it.
  - After the delete: `probe file exists after delete: no`. `git status --short`
    lists only the 7 changed files above.
- No Core `pnpm build`, root `pnpm test` or Lab command was run. Nothing was
  committed.

## Not verified

- **A Lab run.** A kept-workspace `auth-gate --flow` run must show that no
  `inputs.*` key path holds the value in any runtime event chunk
  (`$.events[*].payload.inputs.*`) or in a `global.sqlite` `"automation.state"`
  session row (`$.session.metadata.inputs.*`). Both must read `[withheld]` under
  their keys, and the password node must still type (`web.dom.type:succeeded`).
  This needs a Core build, which this brief excludes.
- **The Lab's storage layout.** The service row ran on the test data directory's
  plain JSON layout. The layout-v2 SQLite path the Lab uses (`_shared/storage.ts:227-264`)
  was not exercised. The byte scan would cover any file, but only in this layout.
- **The rest of Core's suites.** Only the two owned test files ran; root
  `pnpm test` and the full `service.test.ts` did not. By grep, no test reads
  `metadata.inputs`. The one `service.test.ts` row that runs by `runId`
  (`:2625`) runs a cancelled session, which returns before the changed fallback.
- **Every result is a single observation.** Tests, mutations and probe each ran
  once, with no retry needed.

## Open questions or contradictions found

1. **A run input that no parameter binding asks for is still persisted in
   clear, in the trace.**
   - **Where.** The probe found it in the session record's `trace.values` and
     every `trace.attempts[n].inputs` (single observation). It comes from
     `graph-run.ts:65` and `node-execution.ts:26`.
   - **Why the trace keeps it.** Trace withholding covers only values a
     declared binding supplies (`graph-run.ts:45-55`, `trace-withholding.ts:94-96`).
   - **Auth-gate is covered.** The Flow's password node binds `web.secret.password`,
     so that value is recorded before execution, even when the run fails early.
   - **What is not covered.** Any input the Flow does not bind: an unused secret,
     or the id-keyed `auth-gate-password` copy until `f-runner-secret-input`
     lands. Such an input reaches the session record's trace.
   - **Where the fix belongs.** Recording every supplied run input as withheld in
     the executor (`graph-run.ts`). No current brief owns that file, and
     `g-core-attempt-withholding` owns `trace-withholding.ts`.
   - **The web panel shows these values.** `RunDetailPanels.tsx:240` displays
     trace `attempt.inputs`.
2. **`service.ts:3422` is outside the letter of "persisted `metadata.inputs`
   only".** It is the reader of that field, and leaving it would run a queued
   session with `[withheld]` as its input values. The supervisor may prefer
   another shape, for example refusing to run a session whose record holds
   withheld inputs when the request supplies none. Mutation B pins the current
   choice.
3. **The service rows' placement is a compromise** forced by
   `runtime/tests`'s 25-file limit and `service.test.ts`'s line baseline. A
   `runtime/tests` split would give them their own file.
4. **The two regenerated reference files are not in my Owns list.** The brief
   allowed `pnpm docs:reference` because a cited line moved.
   `g-core-attempt-withholding` may regenerate them too. The output is
   deterministic from source, so the last run after both edits is correct.
5. **`docs/architecture/automation-studio.md:407-418` still describes only trace
   withholding.** It could say that run inputs at rest are withheld too. Not
   owned, so not edited.
