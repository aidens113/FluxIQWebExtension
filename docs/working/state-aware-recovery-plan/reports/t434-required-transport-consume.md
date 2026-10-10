# t434: a required run on Core's runtime transport fails before sending anything

Trees:

- Core: `fxwork/t434/!FluxIQ`, branch `task/t434-required-transport-consume`. Not committed.
- Downstream: `fxwork/t434/!FluxIQWebExtension`. Only this report was written there.

## Outcome

**Done.**

- **Cause found and fixed.** A required run on Core's own `ClientGatewayRuntimeTransport` now
  sends each command and settles.
- **Never-sent commands are honest.** A required command that provably never left now ends as an
  act that did not happen (`effect: "unacted"`), not as Outcome uncertain.

## Cause

The run never failed in the ledger. **It never picked a target.**

1. Automation Studio's runtime effect dispatcher (`io-policy.ts`, `runtimeCanDispatchOutput`)
   decides the runtime can perform an output when any runtime capability names it in `outputIds`
   **or in `actionTypes`**. So it sends the command to `RuntimeService.dispatch` with `outputId`
   and `actionType` both set to the output id.
2. `RuntimeService.selectTarget` → `capabilityMatchesCommand` demanded that the output id appear in
   `outputIds` whenever `command.outputId` is set. A gateway capability
   (`ClientGatewayCapability`) has no `outputIds` field at all; it can only name `actionTypes`. So
   no transport client ever matched.
   - Result: `rejected` with "No runtime adapter or transport client matches the requested
     command", plus `ClientGatewayCommandOutcome.stop(context, "runtime.missing_target")`.
3. That stop called the command run's `uncertain` observer, which latched the whole run as
   `command_run.outcome_unknown`. The latch applied even though nothing had been claimed in the
   ledger, and the ledger claims before any send.
   - Before t427, the executor's `consume` then threw `command_run.unhandled_outcome`, which the
     controller wrapped as `command_execution.consume_failed`; the next `checkpoint` also refused.
     That is the reported 0.9 s failure.
   - Since t427, the unreceipted answer becomes `executor.required_outcome_unknown`, and the run
     stops with "answer never came back".
4. **A second mismatch, in the transport itself.** `ClientGatewayRuntimeTransport.sessionMatchesCommand`
   accepted a domain only from the session's own metadata. `RuntimeService` also accepts it from a
   capability's metadata. So a client whose domain sat only on its capability passed the runtime's
   selection and was then refused by the transport (`missing_session`).

**The bug is not specific to required mode.** Ordinary runs on this path were also rejected
whenever the client named its outputs only as action types. Required mode just made it look like
a lost answer.

## What changed and why (Core, `packages/fluxiq/src`)

**Routing fix (the cause)**

- `runtime/service.ts`, `capabilityMatchesCommand`: an `outputId` now also matches a capability
  that names it in `actionTypes`. This is the same rule `runtimeCanDispatchOutput` applies, so
  the runtime no longer refuses a command it was just judged able to send.
- `runtime/client-gateway-transport.ts`, `sessionMatchesCommand`: a session serves a domain when
  its own metadata names it or one of its capabilities does. This matches `RuntimeService`.

**Never-sent commands end as unacted**

- `programs/automation-studio/runtime/service/command-run/controller.ts`:
  - New `withdraw(context)`. It returns true only when nothing was ever claimed for the command
    (no claim, no ticket, not consumed), and marks the effect withdrawn.
  - A withdrawn effect can never be claimed afterwards: `claim` rejects with
    `command_run.effect_withdrawn`. So it can never be sent, even if a late gateway pipeline tries.
  - A withdrawn effect no longer holds the run. `available` and the first-command rule ignore it.
  - The `uncertain` observer now withdraws when no claim exists, and latches
    `command_run.outcome_unknown` only for a claimed command.
- `.../command-execution/controller.ts`: the executor port exposes `withdraw`.
- `.../executor/command-scope/contracts.ts`: `withdraw(context): boolean` added to
  `AutomationStudioExecutorCommandRun`.
- `.../executor/command-scope/outcome-unknown.ts`: new `AUTOMATION_STUDIO_REQUIRED_COMMAND_NOT_SENT`
  with these fields:
  - `action_failed`
  - `executor.required_command_not_sent`
  - `retryable: true`
  - stage `dispatch`
  - `effect: "unacted"`
- `.../executor/node-execution/attempt.ts`: an unreceipted required command is first offered to
  `withdraw`.
  - **Withdrawn:** the attempt fails as unacted. It keeps the dispatcher's own failure record,
    with `effect: "unacted"`; when the dispatcher gave none, it uses the new record. Nothing is
    consumed, the next checkpoint passes, and the usual retry policy applies.
  - **Not withdrawn:** it is t427's Outcome uncertain stop, unchanged.

**Tests (beside the change)**

- `runtime/tests/client-gateway-transport.test.ts`: new case. It routes an output-addressed
  command through `RuntimeService` to a client that names the output only as an action type, with
  the domain only on its capability. The pairing helper gained a `sessionDomain` option.
- `.../service/command-execution/tests/required-transport.test.ts` (new), using the real
  FluxIQ, gateway and SQLite:
  - A required run on the transport sends both commands and succeeds.
  - A required run whose output nothing serves sends nothing, and its attempt fails
    `output_dispatch.output_not_registered` with `effect: "unacted"`. The run message has no
    "Outcome uncertain" or "never came back", and the second node is never reached.
- `.../service/command-run/tests/controller-withdraw.test.ts` (new):
  - withdraw frees the run and refuses a later claim, and a retry attempt can claim;
  - a stop before any claim withdraws instead of latching;
  - a claimed command is never withdrawn, and a stop over it latches.
- `.../executor/tests/effect-check/tests/required-outcome.test.ts`: the fake port gains
  `withdraw: () => false`.

## Which real paths use this transport

- **Hosts.** Every Core program host registers it in `programs/_shared/runtime.ts:136`
  (`runtime.registerTransport(new ClientGatewayRuntimeTransport({ gateway }))`).
- **When it is used.** `RuntimeService.selectTarget` tries registered adapters first, so the
  transport is used only when **no runtime adapter matches** the command.
- **This repository's web domain.** It registers its own adapter
  (`domain/src/runtime/service.ts:21`), so web Flows normally go through the adapter and were not
  affected. They would reach the transport only if that adapter declined a command.
- **Other domains.** Any domain run on Core with a paired gateway client and no domain runtime
  adapter uses this path. Core itself registers no adapter, so such a domain was affected in
  ordinary and required runs alike.
- **Tests.** The transport is used by `runtime/tests/client-gateway-transport.test.ts`,
  `runtime/tests/service.test.ts`, and now `required-transport.test.ts`.

## Commands run and observed results

**Reproduction, before the fix.** I ran a probe test with real FluxIQ, no adapter, and a client
declaring `actionTypes`:

- With the output defined in IO: the attempt was `runtimeStatus: "rejected"`, "No runtime adapter
  or transport client matches the requested command", failure `executor.required_outcome_unknown`.
  The run message was "Outcome uncertain: The step's answer never came back…", with SENDS 0.
- Without an IO definition: "Output is not registered", also ending `executor.required_outcome_unknown`.

**Cause check.** I saved the matcher diff to the scratchpad, reverted `runtime/service.ts` and
`client-gateway-transport.ts`, and ran
`npx vitest run …/required-transport.test.ts src/runtime/tests/client-gateway-transport.test.ts`:

- the new transport case failed with "expected undefined to match object { type: 'server.execute_action' }";
- the required-transport success case failed (`failed`, not `succeeded`);
- the never-sent case passed, because the withdraw half was still in place;
- the summary printed `Tests 2 failed | 9 passed (11)`.

I then re-applied the patch with `git apply`.

**Named suites.** In `packages/fluxiq` I ran
`npx vitest run src/client-gateway src/runtime/tests $AS/service/command-execution $AS/service/command-run $AS/executor`.
It printed `Test Files 113 passed (113)  Tests 965 passed (965)`.

- That run started before the final edits, which were statement unpacking for the structure audit
  and contained no logic change.

**Reruns after the final edits.**

- `$AS/service/command-execution $AS/service/command-run src/runtime/tests/client-gateway-transport.test.ts $AS/executor/tests/effect-check`
  printed 4 failures. Three were 15 s timeouts. The fourth was a `consume` spy counting calls left
  over from a timed-out test.
  - At that time the CPU was at 100% with 30 node processes running, other agents' work.
- `npx vitest run $AS/service/command-execution $AS/service/command-run --testTimeout=60000`
  printed `Test Files 5 passed (5)  Tests 40 passed (40)`.

**Checks.**

- `pnpm run check` in `packages/fluxiq` printed the build-cache `fluxiq:check` "build" line and
  exited 0.
- `node scripts/structure-audit.mjs` in Core printed
  `structure-audit: passed (324 warning(s), 1160 baselined).`
  - The first run failed `statement-packing` on my new lines; I fixed them.

## Not verified

- **Downstream build and tests.** I did not rebuild Core into the downstream tree, and ran no
  domain tests. The web domain uses its own adapter, so it should not change.
- **No live browser run.**
- **A never-sent command whose IO dispatch throws.** One example is
  `io.unsupported_required_handler`, for an output with only a legacy dispatch. It still throws
  from the attempt and stops the run through `executor.attempt_failed`, as before. That stop does
  not use the uncertain wording, but it is not withdrawn as unacted either.
- **The timeout race.** A RuntimeService timeout or abort can fire before the gateway claims. The
  effect is then withdrawn, and the later claim is refused by design. This is covered by the unit
  semantics, not by an end-to-end race test.
- **The named suites were not rerun after the final formatting edits.** Only the changed
  directories were rerun, with `--testTimeout=60000`.

## Open questions or contradictions found

- **Scope of the matcher change.** `capabilityMatchesCommand` now matches `outputId` against
  `actionTypes` for adapters too, not only transport clients. This matches what Automation Studio
  already assumed, but it widens adapter matching slightly.
- **Retry depends on the dispatcher's record.** "Retry allowed" holds for the run, which is no
  longer latched, and for the fallback record, which is `retryable: true`. But when the dispatcher
  supplies its own record, that record's `retryable` is kept. For example,
  `output_dispatch.output_not_registered` is `retryable: false`. Say if every never-sent required
  command should be forced to `retryable: true`.
- **The t427 report's wording.** It says the error was raised at
  `AutomationStudioRequiredCommandRun.checkpoint`. The brief says `consume_failed`. Both come from
  the same latch: `consume` refuses first, then `checkpoint` does.
