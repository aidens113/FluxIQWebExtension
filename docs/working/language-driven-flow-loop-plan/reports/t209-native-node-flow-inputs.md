# t209: native node Flow inputs (Core red test)

## Outcome

Done. Product regression, fixed in Core; the test was right and is unchanged. A new test pins both halves of the contract.

## What changed and why

**Cause.** Core commit `de5d5bfa` (2026-09-29, "Live lane D, round 1", task t195) changed
`runtime/executor/node-execution.ts` to hand `nativeNodeExecutor` only
`collectWiredNodeInputs(flow, node, values)`, meaning only values an edge brings to a
port. Before that commit it received `collectNodeInputs`, which is every run value plus
the wired values. The commit's stated intent (the comment in `executor/node-inputs.ts`) was
narrow: a node after a For Each that declares `item` picked up the loop's last row from
the *bare output key another node left behind*, with no edge giving it one. Dropping the
run's own Flow inputs (`options.inputs`) was collateral. Nothing in the commit says native
nodes should stop receiving Flow inputs, and t195 added no test for the change, so this
test went red without anyone noticing. Verdict: **the product regressed. The test was correct.**

**Mechanism.** `graph-run.ts` seeds `values` from `options.inputs`, then writes every node
output under both `node.port` and the bare `port` (lines ~484-485). So `values` cannot
tell a Flow input apart from a bare output that shares its name. `native-node-runtime.ts:86`
then filters to the definition's declared input ports. That filter is the security
isolation, and it did not change.

**Fix** (`packages/fluxiq/src/programs/automation-studio/runtime/executor/node-execution.ts`):
native inputs are now `{ ...(options.inputs ?? {}), ...collectWiredNodeInputs(flow, node, values) }`.
Flow inputs are read from `options.inputs` directly, not from `values`, so a bare output
key still cannot fill a port or overwrite a Flow input. t195's guard holds. Undeclared
Flow inputs (`ambientSecret`) are still dropped by the runtime's declared-port filter.

**New test** (`runtime/tests/native-node-runtime.test.ts`, "fills a declared port from the
Flow's inputs, never from a bare key another node left behind"). An upstream native node
outputs `in: 99`, reaching the transform over a control edge only. With Flow inputs
`{ in: 4, ambientSecret }` the implementation gets exactly `{ in: 4 }`. With no Flow
inputs it gets `{}`. The run's `values.in` is 99, which proves the bare key existed and was
refused.

## Commands run and observed results

All from `fxwork/t209/!FluxIQ/packages/fluxiq`, through `heavy.sh`:
- `npx vitest run src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts`: 16 passed (16), 1 file. Before the test was added: 15/15, including the originally red test.
- `npx vitest run src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/tests/native src/programs/automation-studio/runtime/tests/executor src/programs/automation-studio/runtime/tests/graph`: Test Files 22 passed (22), Tests 333 passed (333).
- `npx tsc --noEmit -p .`: exit 0, no output.
- `node scripts/structure-audit.mjs` (Core root): 1 violation, `[directory-files] runtime/llm/evidence-loop/: 26 source files exceeds the 25-file limit`, plus "1 baseline entries can be lowered". **Pre-existing and not caused by t209**: that directory has 26 `.ts` files at base `9d9f1df8`, and t209 touches no file there.

## Not verified

- I did not mutation-check the new test against the pre-fix code by running it. By reasoning, the pre-fix code gives `[{}, {}]` and a `values`-based fix gives `[{in: 99}, {in: 99}]`, so both would fail it.
- I did not run the full Core vitest suite, and I did not check composite/call-flow children beyond the executor and runtime tests listed above.
- No Lab run, per the brief.

## Open questions or contradictions found

- The Core structure audit is red on `dev` because of `runtime/llm/evidence-loop/`, which has 26 files against a limit of 25. Another task needs to regroup that directory.
- `collectWiredNodeInputs` skips every edge whose `targetPortId` is `"in"`, treating it as the control port. A native node whose *data* port is named `in` therefore can never be fed by an edge, only by a Flow input. That behaviour predates t209 and I left it alone.

Ready to commit (Core, branch task/t209-native-node-flow-inputs):
`packages/fluxiq/src/programs/automation-studio/runtime/executor/node-execution.ts`,
`packages/fluxiq/src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts`;
validation: `npx vitest run src/programs/automation-studio/runtime/tests/native-node-runtime.test.ts` -> 16 passed (16).
