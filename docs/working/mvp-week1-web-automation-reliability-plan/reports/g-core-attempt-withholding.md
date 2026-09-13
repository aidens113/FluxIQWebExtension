# g-core-attempt-withholding — Core's saved command attempts withhold resolved values

Worker report for `g-core-attempt-withholding` in the twenty-fourth dispatch of
[finish-week1.md](../briefs/finish-week1.md). FluxIQ Core `240c73e`, branch `dev`,
working tree clean. Written 2026-09-13.

## Outcome

**Blocked. The brief's ownership is drawn around files, not around the change.**

- The values Automation Studio resolves out of state reach the framework runtime
  through three files the brief does not own.
- An edit to the owned files alone would compile and pass every gate while doing
  nothing. The Wave 3 binding rule says to report that rather than ship it, so
  nothing was edited.
- Below are the exact chain, the files the brief should add, a design partitioned
  by file, the tests, the compatibility effect, and the Migration Notes paragraph.
- None of the three missing files is on `g-core-input-withholding`'s list, so a
  widened brief can still run beside that worker.

## What changed and why

Nothing. No tracked or untracked file in Core changed, and no scratch file was
written.

### Why the owned files are not enough

A resolved value travels from the executor to the saved attempt like this:

| Step | Code | Owned? |
| --- | --- | --- |
| 1. The executor records what resolution supplied | `executor/node-execution.ts:34` (`withholding.record`), seeded at `executor/graph-run.ts:30` | yes |
| 2. The executor calls the effect dispatcher. The only context it passes is `{ signal }` | `executor/node-execution.ts:144` | yes |
| 3. The dispatcher's context type is `{ signal?: AbortSignal }` | `executor/contracts.ts:163` (`effectDispatcher`) | **no** |
| 4. The runtime dispatcher builds the context for `runtime.dispatch` from `signal`, `preferredClientId` and `preferredSessionId` only | `programs/automation-studio/runtime/io-policy.ts:76`, `:88-100` | **no** |
| 5. The dispatch context type has no field for withheld values | `runtime/contracts.ts:145-148` (`FluxIQRuntimeDispatchContext`) | **no** |
| 6. The runtime builds the attempt from the command, saves it, and saves it again with the result | `runtime/service.ts:194-213`, `:269-278`, `:293-297` → `runtime/storage.ts:51-52` | yes |

Only the last step is owned on the framework side. A field set at step 2 is
dropped at step 4, and there is no type to carry it at steps 3 and 5.

Two workarounds were ruled out:
- **An untyped extra property** on the context object. It escapes TypeScript's
  excess-property check and is dropped at step 4 anyway.
- **An ambient `AsyncLocalStorage` scope** read by `RuntimeService`. It is hidden
  coupling rather than the "generic dispatch-context field" the brief asks for,
  and it still needs an export from `runtime/index.ts`, which is not owned.

### Files the brief should add to Owns

1. `packages/fluxiq/src/runtime/contracts.ts`: the dispatch-context field. Also the
   framework's withheld marker, unless it goes in a new `runtime/` file, which
   needs a `runtime/index.ts` barrel line.
2. `packages/fluxiq/src/programs/automation-studio/runtime/executor/contracts.ts`:
   the `effectDispatcher` context type (`:163`).
3. `packages/fluxiq/src/programs/automation-studio/runtime/io-policy.ts`: its
   signature (`:76`) and forwarding the field into `runtime.dispatch` (`:96-100`).
4. `packages/fluxiq/src/programs/automation-studio/runtime/tests/io-bridge.test.ts`
   or `io-policy.test.ts`: the end-to-end row. Without it, nothing proves the chain
   is connected.
5. `docs/architecture/runtime-kernel.md`, the "Persistence" section (`:110-123`),
   which describes `command-attempts/<attemptId>/attempt.json` and must now say
   what a saved attempt withholds.

`io-policy.ts` is frozen under the `imports` rule (`.structure-baseline.json:235`,
value 1). A type import from `../../../runtime/index.ts`, which the file already
imports at `:9`, adds no new barrel bypass.

## Design, partitioned by file

The seam stays generic. The framework is told "these values are withheld", never
why, and it never sees `web.secret.`.

- **`runtime/contracts.ts`**
  - Add `withheldValues?: { texts: string[]; numbers: number[] }` to
    `FluxIQRuntimeDispatchContext`. Name the shape as its own type, for example
    `FluxIQRuntimeWithheldValues`. It means: values this command carries that the
    caller supplied from run-time data of unknown sensitivity.
  - The framework owns the marker, `"[withheld]"`. Automation Studio's
    `AUTOMATION_STUDIO_WITHHELD_VALUE` becomes an alias of it, so there is one
    marker rather than two equal literals.
- **`executor/trace-withholding.ts`** (owned)
  - Add `values(): FluxIQRuntimeWithheldValues`, a copy of the recorded `texts` and
    `numbers`, to `AutomationStudioTraceWithholding`.
  - Alias the marker.
- **`executor/contracts.ts:163`**
  - Widen the context to
    `{ signal?: AbortSignal; withheldValues?: FluxIQRuntimeWithheldValues }`.
- **`executor/node-execution.ts:141-144`** (owned)
  - Pass the run's `withholding` into `dispatchAutomationStudioEffects`.
  - Add `withheldValues: withholding.values()` to the dispatcher context when it
    is not empty.
  - Both call sites are covered: the definition path (`:109`) and the native-node
    path (`:71`).
  - The effect itself is unchanged, so the action still types the real value.
- **`io-policy.ts:76,96-100`**
  - Accept the widened context, and forward `withheldValues` into
    `runtime.dispatch`'s context.
  - The IO-adapter fallback `dispatchPolicyOutput` (`:86`) saves no attempt, so it
    needs nothing.
- **`runtime/service.ts`** (owned)
  - `dispatch` (`:194-200`): build `attempt.command` as a copy of `normalizedCommand`
    whose `parameters` are withheld. A string leaf has each withheld text replaced
    in place, the executor's rule (`trace-withholding.ts:172-176`). A number leaf
    equal to a withheld number becomes the marker. Keys and authored values stay.
    The adapter or transport still receives `normalizedCommand` (`:217`), so
    execution is unchanged.
  - `settleAttempt` (`:269-278`): take the same values and withhold
    `result.message`, and the top-level `attempt.message` copied from it at `:275`.
  - Keep the rewrite as private functions in `service.ts`, which is 397 lines with
    no baseline entry. The alternative is a new exported framework helper that
    `trace-withholding.ts` also calls, which removes the duplicated replace rule
    but needs a barrel line.
  - Optionally drop `withheldValues` from the context handed on to adapters and
    transports (`:256-264`). `ClientGatewayRuntimeTransport` never puts the context
    on the wire: it uses it only to pick a session
    (`client-gateway-transport.ts:79-88`), and the wire command is built from
    `command` alone (`:167-175`).

### Tests

- **`runtime/tests/service.test.ts`**, runtime row with a `FileRuntimeStore` in a
  temp dir:
  - Dispatch `parameters: { selector: "#field", text: <synthetic> }` with
    `withheldValues.texts = [<synthetic>]`, through an adapter that records what it
    received and returns `message: "Could not type <synthetic> into #field."`.
  - Read `command-attempts/<id>/attempt.json` from disk, and assert:
    - `command.parameters.text` is `"[withheld]"`;
    - `command.parameters.selector` is `"#field"`;
    - `result.message` holds the marker;
    - the file text does not contain the synthetic value;
    - the adapter received the real value.
  - Mutations: skip the rewrite; drop the context field.
- **`executor/tests/node-execution.test.ts`**, executor row:
  - Use a `$state`-bound `text` and an `effectDispatcher` that captures its context.
  - Assert that `context.withheldValues.texts` contains the supplied value and not
    the authored selector.
  - Mutation: drop the context in `dispatchAutomationStudioEffects`.
- **`io-bridge.test.ts` or `io-policy.test.ts`**, end-to-end row:
  - Run `runAutomationStudioGraph` with
    `createRuntimePolicyEffectDispatcher(io, "example", runtime)`, a store-backed
    `RuntimeService`, and inputs answering the binding.
  - Assert that the saved attempt holds the marker at `command.parameters.text`.
  - Mutation: stop forwarding the field in `io-policy.ts`.
- **Gates:** `npx vitest run <files> --no-file-parallelism`, Core `pnpm check`,
  `pnpm docs:check`. Also `pnpm docs:reference` if `FluxIQRuntimeDispatchContext`
  moves from `runtime/contracts.ts:145`, which both copies of
  `framework-reference.md:1113` cite.

### Compatibility effect

- **Types: additive.** Both new context fields are optional. Existing dispatchers,
  adapters, transports and `runtime.dispatch` callers compile unchanged.
- **Behaviour.** A command attempt whose caller passes withheld values no longer
  holds them in `command.parameters` or `result.message`: the same key holds
  `"[withheld]"`.
  - A caller that passes none sees no change. Today the only such caller is
    Automation Studio's runtime dispatcher.
  - What the adapter or client executes is unchanged.
  - A saved attempt can no longer be replayed to recover a resolved value, by
    design.
- **Readers of attempts in Core:**
  - tests only: `runtime/tests/service.test.ts:157,179,246` and
    `automation-studio/runtime/tests/io-bridge.test.ts:238,260`, none of which uses a
    bound parameter;
  - `RuntimeService.snapshot()`, `commandAttempt()` and `commandAttemptsList()`,
    which serve the runtime program's `snapshot` API.
  - A grep of Core source, `apps/web` included, found no other reader.
- **Old attempts are not rewritten.** Attempts saved by earlier versions keep any
  clear value on disk.

### Migration Notes paragraph (for the unreleased `0.4.0` entry in `package-boundaries.md`)

> **Runtime command attempts withhold values their caller marks as withheld.**
> `FluxIQRuntimeDispatchContext` gains an optional `withheldValues` field
> (`{ texts, numbers }`). Automation Studio's runtime dispatcher fills it with every
> value the executor resolved out of state for the run, the same values it already
> withholds from the run trace. Before `RuntimeService` keeps and saves a command
> attempt, it replaces those values with `"[withheld]"` in the attempt's
> `command.parameters` and `result.message`, keeping every key and every authored
> value. The adapter or transport still receives the real value. A reader of
> `command-attempts/<attemptId>/attempt.json`, or of `commandAttemptsList()`, that
> expected a resolved parameter now sees the marker. Callers that pass no
> `withheldValues` see no change. Attempts saved by earlier versions are not
> rewritten; remove `.fluxiq/artifacts/runtime/command-attempts/` if they may hold
> run-time secrets.

## Commands run and observed results

- `git log --oneline -3` in `F:\!FluxIQ`: `240c73e`, `5845f5d`, `187f40d`.
  `git status --short` printed nothing.
- Greps for:
  - `effectDispatcher`: the only non-test implementation is wired at
    `automation-studio/runtime/service.ts:3426-3428`, and uses `io-policy.ts`;
  - `runtime.dispatch(`: the only non-test caller is `io-policy.ts:88`;
  - readers of command attempts, and `FluxIQRuntimeDispatchContext`: see the
    compatibility section;
  - `.onEvent(` and `command.dispatched`: nothing in Core source persists the
    `command.dispatched` event. `client-gateway/service/commands.ts:74` audits only
    `sessionId`, `commandId` and `actionType`;
  - `docs/architecture` for attempts: `runtime-kernel.md:17,119`.
- Final check:
  `HEAD=240c73e`; `git status --short` printed nothing;
  `git diff --stat -- packages/fluxiq/src/runtime packages/fluxiq/src/programs/automation-studio/runtime/executor packages/fluxiq/src/programs/automation-studio/runtime/io-policy.ts`
  printed nothing, `diff-exit=0`.
- No vitest, `pnpm check` or `pnpm docs:check`: there was no change to validate.

## Not verified

- **The design is not built or tested.** None of the rows or mutations above exists.
- **Downstream readers of saved attempts** (this repository's test-runner and Lab)
  were not searched.
- **Whether `result.payload` can echo a resolved value** was not examined. In the
  auth-gate probe it held page text only, and the brief does not name it.
- **Lab proof still owed**, after a Core build. An `auth-gate --flow` run with a
  kept workspace must show:
  - no `$.attempt.command.parameters.*` path holds the declared value;
  - no `$.attempt.result.message` holds it;
  - the password node still reports `web.dom.type:succeeded`.

## Open questions or contradictions found

1. **Ownership defect.** The brief owns the two ends of the chain but not the three
   files between them. See "Files the brief should add to Owns".
2. **Memory as well as disk?** The brief says "before it persists". If only
   `persistCommandAttempt` rewrites, then:
   - `snapshot()` and `commandAttemptsList()` serve the clear value for the life of
     the process;
   - the same attempt reads as withheld after a restart (`loadStoredState`,
     `service.ts:280-285`).

   Withholding when the attempt is built costs nothing, because dispatch uses
   `normalizedCommand`, and it makes the two agree. I recommend it.
3. **`result.error` and `attempt.message`.** The brief names only `result.message`.
   `attempt.message` is a copy of it (`service.ts:275`), and Core's own failure
   results duplicate the message into `error` (`:361`, `:376`, `:384`, `:388`). An
   adapter's `error` can quote the value as easily as its `message` can. I
   recommend withholding all three.
4. **One marker.** The framework cannot import
   `AUTOMATION_STUDIO_WITHHELD_VALUE` without inverting the dependency direction.
   The marker should move to the framework, with Automation Studio aliasing it.

---

# Redispatch

Worker report for `g-core-attempt-withholding, redispatched` (twenty-fifth dispatch),
and for its amendment from `g-core-input-withholding`. FluxIQ Core `240c73e`, branch
`dev`, uncommitted. Written 2026-09-13. Open questions 2-4 above were settled by the
brief, and the build follows those decisions.

## Outcome

**Done.** Every step of the brief and the amendment is built, tested and
mutation-proved, and Core `pnpm check` and `pnpm docs:check` pass.

- **Saved command attempts.** When a value came out of a `$state` binding, the
  saved attempt now holds `"[withheld]"` in its place:
  - in `command.parameters`;
  - in `result.message`, `result.error` and `attempt.message`.

  The adapter still receives the real value.
- **Run inputs.** A run input that no binding reads is now withheld in
  `trace.values` and in each attempt's `inputs`.
- **Design change in the amendment.** The obvious design, withholding every
  input by value, was built first. A probe proved it changes what a Call Flow
  parent executes with, so the amendment is built by position instead.

Two consequences need a decision from outside my files. They are open questions
1 and 2 below.

## What changed and why

All paths are under `F:\!FluxIQ\packages\fluxiq\src\` unless absolute.

**Framework runtime.**
- **`runtime/contracts.ts`**
  - `FLUXIQ_RUNTIME_WITHHELD_VALUE = "[withheld]"` (`:150`) is the framework's marker.
  - `FluxIQRuntimeWithheldValues` (`{ texts, numbers }`, `:156`) is the new type.
  - `FluxIQRuntimeDispatchContext.withheldValues?` (`:172`) is the new field.
  - `runtime/index.ts` already re-exports the whole file, so it needed no barrel
    line and was not edited.
- **`runtime/service.ts`**
  - **Stripping.** `dispatch` removes `withheldValues` from the context first
    (`:188`). Target selection and the adapter or transport get the context
    without it (`:200`, `:224`).
  - **Withholding when built.** The attempt is built from a withheld copy of the
    command (`:204`), and settles with a withheld copy of the result (`:281`).
    Memory, `snapshot()` and `attempt.json` therefore hold the same attempt.
  - **The rule, in private functions (`:403-451`).**
    - A withheld text is replaced wherever it appears in a parameter string.
    - A parameter number equal to a withheld number becomes the marker.
    - Keys and every other value stay.
    - Texts are replaced longest first. Empty texts and non-finite numbers are ignored.
    - `message` and `error` get the same text rule.
  - **Execution is unchanged.** The target still executes `normalizedCommand`,
    and the caller gets the unwithheld result.

**Automation Studio, carrying the values to dispatch.**
- **`executor/trace-withholding.ts`**
  - `AUTOMATION_STUDIO_WITHHELD_VALUE` is now `= FLUXIQ_RUNTIME_WITHHELD_VALUE` (`:54`).
  - New `values()` returns copies of the recorded texts and numbers (`:96`, `:112`).
- **`executor/contracts.ts:169`**
  - `effectDispatcher`'s context type gains `withheldValues?`.
- **`executor/node-execution.ts`**
  - Both dispatch paths pass the run's withholding: native nodes at `:71`,
    definitions at `:109`.
  - `effectDispatchContext` (`:172`) adds `withheldValues` when anything was recorded.
  - A dispatch with no signal and nothing withheld still gets `undefined`, as before.
- **`io-policy.ts`**
  - The runtime dispatcher accepts the widened context (`:76`), and forwards
    `withheldValues` into `runtime.dispatch` (`:99`).
  - The import line was widened, not added, so the frozen `imports` entry for
    this file does not grow.

**Amendment: `executor/graph-run.ts`.** `runAutomationStudioGraph` now withholds
the run's inputs from the finished trace before the value-based rewrite (`:32`).
- **Where.** `withholdRunInputs` (`:77`) covers the two places this module saves
  inputs: `trace.values[key]` and each attempt's `inputs[key]`.
- **Proof.** An entry is withheld only if it still holds the exact value the
  caller supplied. A node output written over the same key is kept.
- **Shape.** A withheld input keeps its shape: strings and numbers become the
  marker, while booleans and null stay, as in the existing rule (`:89-106`).
- **The binding seed** `recordDeclaredStateBindings` is unchanged.

**Why by position, not by value.** Value seeding would be
`withholding.record({}, options.inputs)`. I built it and ran two probe rows:
- a computed `result: 5` with inputs `{ left: 5, right: 0 }` failed with
  `- "result": 5, + "result": "[withheld]"`;
- a Call Flow child with authored port defaults 5 and 0 failed with
  `expected '[withheld]' to be 5`.

That is a change in execution, not only in the trace:
- `composite-executor.ts:50-51` builds the parent's outputs from the child's
  withheld `trace.values`;
- a child's inputs include the port defaults its published interface authors.

Under the positional design both probes passed. The composite probe was then
removed, because its home is `runtime/tests/composite-executor.test.ts`, which I
do not own. See open question 2.

**Does the amendment change what the runtime dispatch context carries?** No.
- The context carries only values recorded from resolution, so an input no
  binding reads is not in it.
- `executor/tests/graph-run.test.ts:22` asserts the dispatcher's
  `withheldValues.texts` is `undefined` for such a run.
- No command carries such an input either, unless a node copies it by key (open
  question 3).

**Tests.**
- **`runtime/tests/service.test.ts:264`, runtime row.**
  - Setup: a `FileRuntimeStore` in a temp dir, and an adapter that records what it
    received.
  - Dispatch `{ selector, text, pin, retries, notes: [{ sent }] }` with the text
    and the number withheld, and an adapter that quotes the value in `message`
    and `error`.
  - Asserts:
    - the adapter got the real parameters and no `withheldValues` in its context;
    - the caller's result is unwithheld;
    - `attempt.json` does not contain the value;
    - `text`, `pin` and the nested prose hold the marker, while `selector` and
      `retries` are kept;
    - `result.message`, `result.error` and `attempt.message` hold the marker;
    - `commandAttemptsList()` and `snapshot().commandAttempts` equal the saved attempt.
- **`runtime/tests/service.test.ts:317`.** An empty text and `NaN` withhold nothing.
- **`executor/tests/node-execution.test.ts:57`, executor row.**
  - The dispatcher's `withheldValues.texts` contains the resolved value, and not
    the authored `#field` or `type-text`.
  - The effect still carries the real value.
- **`executor/tests/node-execution.test.ts:79`.** The same through the
  native-node path.
- **`executor/tests/node-execution.test.ts:100`.** A run with nothing withheld
  gives the dispatcher `undefined`.
- **`runtime/tests/io-policy.test.ts:181`, end-to-end row.**
  - `runAutomationStudioGraph`, `createRuntimePolicyEffectDispatcher` and a
    store-backed `RuntimeService` run together.
  - The adapter executes the real `text`, and `attempt.json` holds the marker at
    `command.parameters.text`.
  - The file contains the value nowhere. Core's element-target normaliser also
    copies `text` into `parameters.target.fingerprint.visibleText`
    (`model/action-element-target.ts:134`), so a real type command carries the
    value twice.
- **`executor/tests/graph-run.test.ts`**, new file (untracked), for the amendment.
  - **`:22`.** A run with inputs no node reads (text, number, boolean):
    - the serialised trace holds neither value;
    - `trace.values` and the attempt's `inputs` hold the marker under the same
      keys, and the boolean is kept;
    - the effect's authored `elementId` and `retries` are kept.
  - **`:43`.** A computed value equal to an input is kept. This row guards
    against a switch to value seeding.
- **`docs/architecture/runtime-kernel.md:125`, "Persistence".**
  - What a saved attempt withholds, and what it keeps.
  - Where Automation Studio's values come from.
  - That old attempts are not rewritten.
- **The two `framework-reference.md` copies**, regenerated by `pnpm docs:reference`.

### Migration Notes paragraph, as built (for the `0.4.0` entry in `package-boundaries.md`)

> **Runtime command attempts withhold values their caller marks as withheld, and a
> run trace withholds its run inputs where it saves them.**
>
> - **The contract.** `FluxIQRuntimeDispatchContext` gains an optional
>   `withheldValues` field (`FluxIQRuntimeWithheldValues`, `{ texts, numbers }`).
>   The runtime exports its marker as `FLUXIQ_RUNTIME_WITHHELD_VALUE`
>   (`"[withheld]"`), and `AUTOMATION_STUDIO_WITHHELD_VALUE` is now that constant.
> - **The attempt.** `RuntimeService` builds a command attempt with the marker in
>   place of each withheld text inside `command.parameters`, and of each parameter
>   number equal to a withheld number. When the attempt settles, it does the same
>   inside `result.message`, `result.error` and the attempt's `message`.
> - **What stays.** Every key and every other value stays, so the attempt in
>   memory, in `snapshot()` and in `attempt.json` is the same. The adapter or
>   transport still executes the unwithheld command, and is not handed the list.
> - **Automation Studio.** Its runtime dispatcher fills `withheldValues` with every
>   value its run resolved out of a parameter state binding, and the executor's
>   `effectDispatcher` context gains the same optional field.
> - **Run inputs.** A run trace now also withholds each run input, in `values` and
>   in every attempt's `inputs`, while that entry still holds the supplied value,
>   whether or not a node reads it.
> - **What a reader sees.** A reader of `commandAttemptsList()`, of
>   `command-attempts/<attemptId>/attempt.json`, or of a trace's input entries that
>   expected a clear value now sees the marker. Callers that pass no
>   `withheldValues`, and runs without inputs, see no change.
> - **Not withheld:** `command.metadata`, `result.payload`, `result.failure` and
>   `result.metadata`.
> - **Old attempts.** Attempts saved by earlier versions are not rewritten. Remove
>   `.fluxiq/artifacts/runtime/command-attempts/` if they may hold run-time secrets.

### Compatibility effect

- **Types: additive.**
  - Both new context fields are optional.
  - `FLUXIQ_RUNTIME_WITHHELD_VALUE` and `FluxIQRuntimeWithheldValues` are new exports.
  - `AUTOMATION_STUDIO_WITHHELD_VALUE` keeps its name and value.
  - Core `pnpm check` type-checks `apps/web` and every package, and it passed.
- **Behaviour.**
  - A saved attempt no longer holds a resolved value in the fields above.
  - A trace no longer holds a run input in clear at `values[key]` or
    `attempts[].inputs[key]`.
  - Execution is unchanged, except in the two cases in open questions 1 and 2.
- **Readers in Core.**
  - Attempts: `RuntimeService.snapshot()`, `commandAttempt()` and
    `commandAttemptsList()`, and the tests named in the first report.
  - Trace inputs: the nine test files that assert on `trace.values` or attempt
    `inputs`. All nine passed in the final run.
  - Live-patch and composite execution also read the trace (questions 1 and 2).

### Brief question 5: can `result.payload` carry a resolved value?

Yes, and it was not changed.
- **Payload.** An adapter or client decides what `payload` holds. Core's own test
  adapter at `runtime/tests/io-bridge.test.ts:214` echoes `command.parameters`
  into it, which would carry a resolved `text`.
- **Failure record.** `result.failure.expected` and `.actual` can carry one as well.
  The trace test's failure record quotes the value in `actual`
  (`executor/tests/trace-withholding.test.ts:72`), and saved attempts do not
  withhold it.
- **The web extension.** Its `web.dom.type` validation quotes the typed text for
  a non-sensitive field (`apps/extension/src/content/actions/type.ts:66-67,78`),
  and gives only a length for a sensitive one. Where the gateway puts that
  validation in the command result was not traced.

### Brief question 6: does anything in `F:\!FluxIQWebExtension` read a saved attempt?

No.
- A search outside `node_modules`, `dist`, `build`, `.test-build`, `.script-build`
  and `docs/working` found no match for any of these:
  - `commandAttempts`, `command-attempts`, `commandAttemptsList`, `commandAttempt(`;
  - `attempt.json`, `FluxIQRuntimeCommandAttempt`;
  - `list-runs`, `get-run`, `programs/runtime`, `FluxIQRuntimeSnapshot`.
- A second search found no reader of `trace.values`, attempt `inputs` or
  `metadata.inputs`.
- The only thing downstream that sees saved attempts is the Lab's workspace leak
  scan, which reads files as bytes.

## Commands run and observed results

All from `F:\!FluxIQ` or `F:\!FluxIQ\packages\fluxiq`, with output redirected to
`gcaw-*` files in my scratchpad and the exit code echoed.

- **First run, the dispatch chain before the amendment.** `npx vitest run` over the
  runtime service, node-execution, io-policy, io-bridge and trace-withholding tests
  with `--no-file-parallelism`: `exit=0`, `Test Files 5 passed (5)`,
  `Tests 57 passed (57)`.
- **Value seeding.** The same set plus the rest of `executor/tests`,
  `composite-executor.test.ts` and `region-compiler.test.ts`: `exit=0`,
  `10 passed`, `77 passed`. The existing composite test passes only because its
  output, 5, equals neither input, 2 or 3.
- **Probe under value seeding.** `npx vitest run .../executor/tests/graph-run.test.ts`:
  `exit=1`, `Tests 2 failed | 1 passed (3)`.
  - `keeps a value the run computed even when it equals an input` failed with
    `- "result": 5, + "result": "[withheld]"`.
  - The composite probe failed with `expected '[withheld]' to be 5`.
- **Positional design, probe still in place.** The ten-file set: `exit=0`,
  `10 passed`, `79 passed`.
- **Type check.** `npx tsc --noEmit` in `packages/fluxiq`: `exit=0`, no output.
- **Mutations.** One scratch script ran each mutation in turn:
  - copy the file aside;
  - apply one exact, single-occurrence replacement;
  - run the owning test file;
  - copy the file back, and compare hashes.

  Every run was `vitest exit=1`, and every restore printed `restored byte-identical=True`.

  | Mutation | Test run | Observed failure |
  | --- | --- | --- |
  | M1: attempt keeps `normalizedCommand` and `result` (skip the rewrite) | `runtime/tests/service.test.ts` | `Tests 1 failed \| 10 passed (11)`, `expected '{ "attempt": …' not to contain` |
  | M2: `withheldLookup(undefined)` (drop the context field) | `runtime/tests/service.test.ts` | `1 failed \| 10 passed`, the same `not to contain` |
  | M3: pass `context`, not `dispatchContext`, to the target | `runtime/tests/service.test.ts` | `1 failed \| 10 passed`, `expected { withheldValues: … } to not have property "withheldValues"` |
  | M4: stop ignoring empty texts | `runtime/tests/service.test.ts` | `1 failed \| 10 passed`, `expected [ { …(10) } ] to match object` |
  | M5: dispatcher context back to `{ signal }` only (drop the context in the executor) | `executor/tests/node-execution.test.ts` | `2 failed \| 12 passed (14)`, texts `undefined` |
  | M6: native path given an empty withholding | `executor/tests/node-execution.test.ts` | `1 failed \| 13 passed`, texts `undefined` |
  | M7: remove the `withheldValues` forwarding line in `io-policy.ts` | `runtime/tests/io-policy.test.ts` | `1 failed \| 10 passed (11)`, `expected '{ "attempt": …' not to contain` |
  | M8: `withholding.apply(trace)` (restore the resolution-only seed) | `executor/tests/graph-run.test.ts` | `2 failed (2)`: `expected '{"status":"succeeded",…' not to contain`, and `expected { left: 5, right: +0, … } to match object { left: '[withheld]', … }` |

  M8 also fails the computed-value row, because without the positional pass
  `left` is no longer withheld. That row's own purpose is shown by the
  value-seeding probe above.
- **`pnpm docs:check`, before regeneration:** exit 1,
  `docs/reference/framework-reference.md is stale`.
- **`pnpm docs:reference`:** `exit=0`,
  `Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (1576 public declarations).`
  - New rows: `FLUXIQ_RUNTIME_WITHHELD_VALUE` (`contracts.ts:150`) and
    `FluxIQRuntimeWithheldValues` (`:156`).
  - Moved rows: `FluxIQRuntimeDispatchContext` `:145` → `:163`,
    `AUTOMATION_STUDIO_WITHHELD_VALUE` `:52` → `:54`,
    `AutomationStudioGraphExecutionOptions` `:152` → `:153`.
- **`pnpm docs:check`, after regeneration:** `exit=0`,
  `Validated local links in 101 authored/reference Markdown files.` and
  `Deterministic framework reference is current.`
- **Structure audit with the new test file.** `.git/index` copied to a scratch
  `GIT_INDEX_FILE`, `git add` of `graph-run.test.ts` into that scratch index, then
  `node scripts/structure-audit.mjs`: `exit=0`,
  `structure-audit: passed (121 warning(s), 256 baselined).` One advisory warning is new:
  `packages/fluxiq/src/runtime/service.ts: 459 lines is past the 400-line advisory threshold.`
- **Core `pnpm check`:** `exit=0`.
  - `structure-audit: passed (121 warning(s), 256 baselined).`
  - `packages/contracts check: Done`, `packages/client-gateway-websocket check: Done`,
    `packages/fluxiq check: Done`, `apps/web check: Done`.
- **Final run, alone,** after every mutation was restored and the probe removed:
  - the fifteen files are the fourteen above, plus `nodes/tests/parameter-bindings.test.ts`,
    `runtime/tests/executor.test.ts`, `native-node-runtime.test.ts`,
    `service-flow-representation.test.ts`, and Automation Studio's
    `runtime/tests/service.test.ts`;
  - result: `exit=0`, `Test Files 15 passed (15)`, `Tests 225 passed (225)`,
    `Duration 124.14s`.
- **Final tree.** `git status --short` in Core at `240c73e`.
  - **Mine:** the files listed under "What changed", and untracked
    `executor/tests/graph-run.test.ts`.
  - **Not mine:** changes by `g-core-input-withholding` and by a Client Gateway
    worker (`client-gateway/bridge.ts` and its test, untracked
    `client-recording-write-order.ts` and its test, and
    `docs/architecture/automation-studio/client-gateway.md`). I did not touch them.

## Not verified

- **No Core `pnpm build` and no full Core `pnpm test`,** as the brief says. Only
  the fifteen files above ran.
- **The Client Gateway transport path.** Every row uses a direct adapter.
  `withheldValues` is stripped before either kind of target, but no test
  dispatches through `ClientGatewayRuntimeTransport`.
- **Live-patch reruns and a pass-through Call Flow child** (open questions 1 and 2)
  are not covered by any test.
- **In-memory events still carry the raw values.** The `command.dispatched` and
  `command.result` events still hold the raw command and result. A search of
  Core source found only their emit sites, `runtime/service.ts:214` and `:220`
  before this change, plus an audit at `client-gateway/service/commands.ts:74`
  that records ids only. Nothing in Core persists them.
- **Where the extension puts `web.dom.type`'s validation strings** in its gateway
  result.
- **Lab proof, owed after a Core build.** An `auth-gate --flow` run with a kept
  workspace must show:
  - no `$.attempt.command.parameters.*` holds the declared value, including
    `parameters.target.fingerprint.visibleText`;
  - no `$.attempt.result.message`, `$.attempt.result.error` or `$.attempt.message`
    holds it;
  - the session record's `trace.values` and each attempt's `inputs` hold
    `"[withheld]"` under the secret's key;
  - the password node still reports `web.dom.type:succeeded`;
  - the leak check reads 0 for command-attempt files.

## Open questions or contradictions found

1. **Live-patch reruns now execute with the marker for unbound run inputs.**
   - `automation-studio/runtime/service.ts:3528` and `:3583` take the failed
     attempt from the finished, withheld trace.
   - `live-patch.ts:177` runs the patch with `inputs: input.failedAttempt.inputs`.
   - Before this change, only inputs a binding resolved were markers there. Now
     every run input is, so a patched node that reads one gets `"[withheld]"`.
   - It applies only to the LLM runtime-patch path, which the provider-free Week 1
     bench does not use.
   - The fix belongs where the rerun's inputs are chosen (`live-patch.ts` or that
     service), from the run's real inputs. I own neither file.
2. **Call Flow children are read from their withheld trace.**
   - `composite-executor.ts:50-51` builds the parent's outputs from `childTrace.values`.
   - With the positional rule, only a child whose output port id equals an input
     port id (a pure pass-through) hands the parent the marker. With value seeding,
     any output equal to an input did (proved above).
   - The same class already affects a resolved value that a child echoes to an output.
   - Recommendation: the parent should read the child's unwithheld values, and
     `runtime/tests/composite-executor.test.ts` should gain the probe row. That row
     is a child with authored defaults 5 and 0 and output `result` bound to `total`,
     where the parent must see `total === 5`.
3. **Remaining gap in the amendment.**
   - An input that no binding reads, but that a node reads by key from `context.inputs`
     and copies into an output, an effect or a message, stays in clear at that copy.
   - Value seeding would close the gap, but it changes execution (question 2).
   - The Week 1 Flow lane sends only `web.secret.*` inputs, which are bound, so
     the value rule covers them.
4. **Authored defaults in a child trace.** A Call Flow child's authored port
   defaults arrive as that child's run inputs (`composite-executor.ts:33`), so they
   are withheld in the child trace's `values` and `inputs`. `graph-run` cannot
   tell a default from a supplied value.
5. **The substring rule.**
   - An authored parameter that contains a withheld text is rewritten in the saved
     attempt, as the trace already does.
   - The runtime replaces longer texts first. The executor's rule
     (`trace-withholding.ts:183-187`, unchanged) does not, so where one withheld
     text contains another, the trace can keep fragments of the longer one.
6. **Duplication.**
   - `runtime/service.ts` repeats the executor's text-replacement rule.
   - `graph-run.ts` repeats the depth bound of 64.
   - One shared framework helper would need a new `runtime/` file and a barrel line.
7. **`runtime/service.ts` is at 459 lines,** past the 400-line advisory threshold,
   but far from the 800-line limit.
8. **The regenerated reference includes other workers' changes.** Both
   `framework-reference.md` copies were generated from a tree holding their
   uncommitted changes. If the work is committed separately, rerun
   `pnpm docs:reference` at each commit.
9. **Stale architecture pages.** `docs/architecture/automation-studio.md:407-418`
   and `automation-studio-native-nodes.md` describe trace withholding only for
   resolved values. The run-input rule is not in them, and I do not own them.
