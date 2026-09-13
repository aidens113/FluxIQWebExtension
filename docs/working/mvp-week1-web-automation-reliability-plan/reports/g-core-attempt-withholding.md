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
