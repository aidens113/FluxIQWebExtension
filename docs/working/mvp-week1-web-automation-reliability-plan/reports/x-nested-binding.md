# x-nested-binding — resolution reaches the value the node actually carries

Worker in **FluxIQ Core** (`F:\!FluxIQ`). Nothing in the downstream repository
was changed except this report.

## Outcome

**Done.** `resolveAutomationNodeParameterValues` now resolves state bindings
wherever they sit in a node's parameter values, not only at the top level, so
the binding a recording-derived node carries at `parameterValues.parameters.text`
is resolved like one at `parameterValues.text`. The fail-closed property holds
identically at depth: an unresolved path with no fallback goes into
`missingPaths`, the key is left out of the object that held it, and
`node-execution.ts` fails the node naming the path. Both proofs are quoted
below, each failing against the previous behaviour and passing after.

**Whether the W18 password step now replays is unanswered.** I ran no Lab
command and no downstream build, and executed no Flow. This closes the Core
link that `p-secret-binding` finding 1 identified; it does not demonstrate a
replay. Two downstream edits that report names (its edits 1 and 3) are still
open, and without them the node is still discarded before dispatch.

## Scope I chose, and why

The brief asked for three deliberate decisions. Each is also written into the
architecture document so the next reader does not have to infer it.

### How deep — arbitrary depth, bounded at 16, with a cycle guard

One level covers the known case and nothing else. It would leave
`parameters.headers.value` silently unresolved, which is the same class of
silent failure this task exists to remove: a binding that looks bound, resolves
to nothing, and reports success. A walk that stops at an arbitrary line makes
the contract "bindings work here but not there", which nobody can hold in their
head.

So resolution descends through objects and arrays to any depth, with two
guards:

- **A bound of 16 levels.** Real payloads nest one or two. The bound exists so
  a pathological or shared-reference document costs bounded time and cannot
  exhaust the stack — and a stack overflow here would be thrown *before* the
  `try` in `executeAutomationStudioNode`, so it would escape the executor
  rather than fail a node. A binding deeper than the bound is left untouched.
  That is the one place the change is silent, and it is documented as such.
- **An ancestor set.** A value already on the current descent path is returned
  as it is, so a self-referential object terminates at once rather than after
  16 levels of copying. `JsonValue` is nominally a finite tree; the guard is
  for values that reach this function through a cast.

### Arrays — yes, and positions are preserved

A binding inside an array element is resolved. An element whose binding cannot
be resolved **keeps its place** rather than being removed, because an array
index is part of the value's shape and dropping element 2 renames every element
after it. The node fails regardless: the path is already in `missingPaths` and
the executor never dispatches. Inside an *object*, the unresolved key is
omitted, matching what the top level has always done.

This asymmetry is deliberate and documented. The property the downstream work
depends on — an unresolved binding never becomes a value the action uses — holds
in both cases.

### What relied on the previous behaviour — nothing, and I established it before changing anything

This was the risk that mattered, so I checked it first rather than reasoning
about it. Sweeping the whole repository for `$state` outside `node_modules`,
`dist`, `.next` and `coverage` returns nine files:

```
apps/web/src/features/automation-studio/flow-editor/commands/tests/commands.test.ts
apps/web/src/features/automation-studio/parameters/ParameterEditor.tsx
apps/web/src/features/automation-studio/parameters/tests/ParameterEditor.test.tsx
docs/architecture/automation-studio-native-nodes.md
packages/fluxiq/src/programs/automation-studio/nodes/contracts.ts
packages/fluxiq/src/programs/automation-studio/nodes/parameter-bindings.ts
packages/fluxiq/src/programs/automation-studio/nodes/tests/parameter-bindings.test.ts
packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/validation.ts
packages/fluxiq/src/programs/automation-studio/runtime/tests/executor.test.ts
```

Every one is the binding's own implementation, its bootstrap validator, its
Inspector editor, its documentation, or a **top-level** parameter value in a
test. Not one place in Core, the web app, or its fixtures puts binding-shaped
data inside another value, so no caller can be relying on such a value being
passed through untouched. `resolveAutomationNodeParameterValues` has exactly one
call site in Core (`runtime/executor/node-execution.ts:23`); it is also public
API through the `fluxiq/automation-studio/nodes` export, which is how the
downstream tests call it.

Three further choices keep the walk from being greedy:

- **A resolved value is never walked again.** What state supplies is a value,
  not another binding, so data cannot name a further path to read. A test
  covers it: state supplies `{ $state: { path: "run.secret" } }` and
  `run.secret` is present, and the result is the object, not the secret.
- **A subtree that resolved nothing is returned by identity.** Resolution never
  allocates a rewritten copy of a payload it did not change; a test asserts
  `toBe` on the original object.
- **Detection is unchanged.** I did not touch `isAutomationNodeParameterStateBinding`.
  The same predicate decides at depth as at the top, so there is no second,
  differently-shaped notion of "is this a binding". The `$` sigil is the
  reservation that makes a false positive implausible.

## What changed

| File | Change |
| --- | --- |
| `packages/fluxiq/src/programs/automation-studio/nodes/parameter-bindings.ts` | `resolveAutomationNodeParameterValues` descends through objects and arrays. Three new private helpers; no change to the exported surface, the signature, or the return shape. |
| `packages/fluxiq/src/programs/automation-studio/nodes/tests/parameter-bindings.test.ts` | +8 tests. The two existing tests are **unchanged, verbatim**. |
| `docs/architecture/automation-studio-native-nodes.md` | New `### Bindings below the top level` subsection: the fail-closed rule at depth, array positions, no re-resolution, identity, the bound, and the `allowStateBinding` gap below. |
| `docs/reference/framework-reference.md`, `packages/fluxiq/docs/reference/framework-reference.md` | Regenerated by `pnpm docs:reference`. The delta is **exactly three line numbers** for the three symbols in the edited file; no other line moved, so no other worker's regenerated content was disturbed. |

No public export was added or removed, no type changed, and no persisted shape
changed: stored Flow documents are untouched, and only run-time resolution
behaves differently.

## Proof

### A nested binding resolves — failing before, passing after

Test: `resolves a binding nested inside an object parameter`. Before the
implementation change, with the test in place:

```
 × Automation Studio node parameter state bindings > resolves a binding nested inside an object parameter

- Expected
+ Received

  Object {
    "missingPaths": Array [],
    "values": Object {
      "outputId": "web.dom.type",
      "parameters": Object {
        "selector": "#password",
-       "text": "supplied-sentinel",
+       "text": Object {
+         "$state": Object {
+           "path": "web.secret.password",
+         },
+       },
      },
    },
  }
```

That received value is the defect exactly as `p-secret-binding` described it:
the object where a string belongs, which the downstream gateway mapping reads
as absent. After the change the same test passes.

### A nested binding with no resolvable path still fails closed, naming the path

Test: `fails a nested binding closed, naming the path and leaving no value behind`.
Before:

```
 × Automation Studio node parameter state bindings > fails a nested binding closed, naming the path and leaving no value behind
   AssertionError: expected [] to deeply equal [ 'web.secret.password' ]

- Expected
+ Received

- Array [
-   "web.secret.password",
- ]
+ Array []
```

After the change `missingPaths` is `["web.secret.password"]`, `values` is
`{ outputId: "web.dom.type", parameters: { selector: "#password" } }`, and
`"text" in values.parameters` is `false` — the request never degrades into a
value. `node-execution.ts` fails a node with any `missingPaths` before
dispatch, with the message `State-bound parameter path could not be resolved:
web.secret.password.`, so the path is named in the trace. That executor branch
is unchanged by this work.

### The whole file, before and after

```
before: exit=1   Test Files 1 failed (1) | Tests 6 failed | 4 passed (10)
after:  exit=0   Test Files 1 passed (1) | Tests 10 passed (10)
```

The six that failed before are the six that assert new behaviour. The other
four — the two pre-existing tests, the identity test, and the depth-bound test —
passed both times, the latter two vacuously before the change.

### Did any existing test change expectation?

**No.** The only test file I edited is `parameter-bindings.test.ts`, and its
diff is purely additive: one added type import plus 8 new `it` blocks. The two
pre-existing assertions are byte-identical. No test anywhere else in Core was
edited, and no existing expectation was rewritten to accommodate the change, so
the question of "more correct or merely different" does not arise for any
existing test.

For the new behaviour the answer is that it is more correct, and the reason is
narrow: a state binding is a request for a value, and the node contract says a
request that cannot be answered fails the node. Before this change that
contract held only for a parameter whose value *was* the binding, and every
recording-derived node puts its real values one level lower, so for those nodes
the contract did not hold at all.

## Commands run and observed results

All exit statuses captured by redirect (`cmd > file 2>&1; echo $?`), never a
pipe. Core tests run with `--no-file-parallelism`.

| Command | Exit | Observed |
| --- | --- | --- |
| `npx vitest run --no-file-parallelism .../parameter-bindings.test.ts` (before implementation) | 1 | `Tests 6 failed \| 4 passed (10)` |
| `npx vitest run --no-file-parallelism .../parameter-bindings.test.ts` (after) | 0 | `Tests 10 passed (10)` |
| `pnpm docs:check` (first) | 1 | `docs/reference/framework-reference.md is stale. Run pnpm docs:reference` |
| `pnpm docs:reference` | 0 | three line numbers changed, nothing else |
| `pnpm docs:check` (after regenerating) | 0 | `Validated local links in 99 authored/reference Markdown files.` / `Deterministic framework reference is current.` |
| `pnpm check` | 0 | `structure-audit: passed (119 warning(s), 256 baselined).` then `tsc --noEmit` Done for contracts, client-gateway-websocket, fluxiq, apps/web |
| `pnpm build` | 0 | contracts, fluxiq, client-gateway-websocket, then the Next.js build completed |
| `pnpm package:lint` | 0 | publint and attw clean for all three packages |
| `pnpm -r test -- --no-file-parallelism` (run 1) | 1 | `Tests 2 failed \| 854 passed (856)`; both failures `Test timed out in 15000ms`, see below |
| the two failing files alone, `--no-file-parallelism` | 0 | `Tests 117 passed (117)` |
| `parameter-bindings.test.ts` + `runtime/tests/executor.test.ts` + `runtime/executor/tests` (final) | 0 | `Test Files 5 passed (5)` |
| `pnpm -r test -- --no-file-parallelism` (run 2) | 1 | `Tests 3 failed \| 853 passed (856)`; a **different** three, all `Test timed out in 15000ms` |

### The two whole-suite failures are timeouts on this machine, not this change

Run 1 of the full suite failed two tests:

- `runtime/tests/service-flow-bootstrap-adaptation.test.ts > bridges a generated
  proposal ID through standard PIN-gated Adaptation Audit get, approve, and
  apply endpoints`
- `runtime/tests/service.test.ts > keeps large project summary pages free of
  hydrated detail payloads`

Both reported `Error: Test timed out in 15000ms.` — a timeout, not a failed
assertion; neither names a value that resolution produces. The whole suite took
**479 seconds** on this machine. Re-running exactly those two files alone gave
`exit=0`, `Tests 117 passed (117)`, with the bootstrap test finishing in 3.9s
against its 15s budget. Both files are storage- and service-level, both are
being edited by other workers right now (`runtime/service.ts`,
`runtime/tests/service.test.ts`, `runtime/service/proposals/**` are all dirty),
and neither touches parameter resolution. Run 2 of the whole suite settles it. It also failed, at exit 1, `Tests 3
failed | 853 passed (856)`, `Duration 445.29s` — but on a **completely
different** set of tests, all three again `Test timed out in 15000ms`, all in
`runtime/tests/service.test.ts`:

- `instruction readiness summaries > finds one active applicable instruction
  beyond an unfiltered 100-item page and reports none when all are inactive`
- `canonical Flow persistence > persists new canonical Flows in project files
  with project scope enforcement`
- `canonical Flow persistence > changes the LLM execution digest for
  same-timestamp parent and routed dependencies`

Neither of run 1's two failures recurred, and none of run 2's three appeared in
run 1. A resolution change is deterministic; it would fail the same test every
time. A moving failure set of pure timeouts is a machine under load, on the
machine whose RAM the user has confirmed is faulty.

All four distinct tests that timed out across the two runs were then observed
passing in the isolated re-run, **with this change in place**:

```
✓ finds one active applicable instruction beyond an unfiltered 100-item page …   5200ms
✓ persists new canonical Flows in project files with project scope enforcement    407ms
✓ changes the LLM execution digest for same-timestamp parent and routed deps     3511ms
✓ keeps large project summary pages free of hydrated detail payloads             7760ms
```

Two of those sit at a third to a half of the 15s budget when the machine is
otherwise idle, which is the margin that disappears in a 445-second serial run.

## Version and migration

`packages/fluxiq/package.json` is already at `0.3.0`, bumped from `0.2.1` today
by the matcher work and **not yet published**. I did not bump it again, and I
believe that is right rather than an assumption that someone else's bump covers
me:

- The change is a behaviour widening of a public export
  (`fluxiq/automation-studio/nodes`). Under 0.x a minor is the conventional home
  for that, and 0.3.0 is that minor.
- It is *potentially* breaking, but only for a consumer that nests
  binding-shaped data inside an object parameter and needs it left alone. No
  such consumer exists in Core, the web app, its fixtures, or the downstream
  repository (swept above). An unreleased 0.3.0 absorbs it.
- **No migration is needed.** No persisted shape changes. Stored Flow documents
  keep exactly the parameter values they have; what changes is only how they are
  read at execution. There is nothing to rewrite and nothing to roll forward.

If the supervisor would rather the release note be explicit, the sentence is:
*state bindings are now resolved inside object and array parameter values, not
only at the top level; an unresolved binding fails the node at any depth.*

## Not verified

- **Whether the W18 password step replays. Unanswered.** No Lab command, no
  downstream build, no Flow executed, no browser involved. This report closes a
  resolver gap; it does not demonstrate a replay, and it should not be read as
  ticking "credentials at replay".
- **The downstream half.** I did not run any downstream package's checks or
  tests, and did not read downstream source beyond the `p-secret-binding`
  report the brief named. Whether the resolved value now survives
  `hasExecutableParameters` and the gateway mapping is that report's edits 1
  and 3, both still open.
- **The executor path end to end.** Every assertion here calls the resolver
  directly. I added no test to `runtime/executor/tests/` because that directory
  is outside the ownership the brief gave me. The executor's fail-closed branch
  is unchanged code, but I did not exercise it against a nested binding.
- **Run 1's two timeouts were not reproduced as failures**, so their cause is
  inferred from the timeout message, the isolated re-run, and the files'
  subject matter — not proven.
- **`apps/web`'s Inspector at depth.** `ParameterEditor` still only offers a
  binding on a top-level parameter. Resolution now honours a nested one, but no
  UI creates one. That is a gap, not a regression, and I left it alone.

## Open questions and things found on the way

### 1. A resolved secret now reaches the run trace, where the unresolved request used to sit

This is the finding that matters most for the downstream secret work, so it is
first.

`builtin.policy.action`'s executor puts its whole payload into an effect:
`effects: [{ type: "policy.output.dispatch", payload: { outputId, parameters: … } }]`
(`nodes/policy/action.ts`). `nodeAttemptFromResult` copies `result.effects`
into the attempt trace verbatim (`runtime/executor/attempt-trace.ts`), and
`graph-run.ts:64` pushes every attempt effect onto the run's `effects` list,
which is carried on the run session as `trace` and persisted
(`runtime/service.ts:3299`, `:3633`). There is **no redaction anywhere in the
executor** — `grep -rn "redact\|sanitiz\|secret"` over
`runtime/executor/` returns nothing.

Before this change, a secret bound at `parameters.text` stayed a
`{ $state: { path } }` request all the way into that trace, because it was never
resolved. After it, the resolved value is what lands there. The exposure is not
new in principle — a secret bound to a *top-level* parameter of an importer
output node has always resolved and could always be echoed — but this change is
what makes the recording-derived path, which is the path the downstream secret
feature actually uses, reach it.

`p-secret-binding` was careful that the value "never reaches a recording, log,
result or evidence packet" and verified that for everything it owned. That
guarantee now needs one more link: either the trace redacts a value whose
parameter arrived as a binding on the `web.secret.` namespace, or the effect
payload records the path instead of the value. Both are in
`runtime/executor/**` and `runtime/service.ts`, outside my ownership and
currently dirty with two other workers' edits, so I made no attempt. **This
should be decided before a real credential is ever put through the Lab.**

### 2. `allowStateBinding: false` is validated at the top level only

`runtime/flow-bootstrap/plan/validation.ts:143` rejects a binding on a
parameter that declares `allowStateBinding: false`, but `validateParameters`
only inspects the top level of a node's parameters. A binding nested inside a
literal-only *object* parameter was never flagged, and is now resolved, so the
flag no longer means quite what it says for object-valued parameters.

Nothing in Core sets `allowStateBinding: false` (grepped: only the contract
declaration, the catalog projection, the validator, and the Inspector read it),
and every downstream web output-node parameter sets it to `true`, so this is
latent, not live. It also does not touch the recording-derived path at all,
which never goes through bootstrap validation.

The exact fix, if it is wanted: in `validateParameters`, when
`parameter.allowStateBinding === false`, walk the value and raise
`bootstrap.invalid_state_binding` for a binding found at any depth, not only
when the value itself is one. I did not make it — the file is outside the
ownership the brief gave me. It is documented as a known limitation in
`automation-studio-native-nodes.md` in the meantime.

### 3. A repeated missing path is still reported once per binding

If two bindings name the same unresolved path, `missingPaths` contains it
twice, and the executor's message joins them with a comma. That was already true
for two top-level parameters; nesting makes it easier to hit (ten array elements
bound to one absent path produce ten entries). I did not dedupe, because doing
so would change existing top-level behaviour for a cosmetic gain, and because
"every unresolved binding is reported" is the more literal reading of the
property the downstream work depends on. Worth a one-line change if a message
ever gets unreadable.

### 4. `pnpm build` in Core rewrites the dist the downstream repository links to

I ran `pnpm build` because the brief's definition of done requires it. It
rewrites `F:\!FluxIQ\packages\fluxiq\dist`, which the downstream workspace
links to — the same window that broke one of `p-secret-binding`'s runs with
`ERR_MODULE_NOT_FOUND`. It completed at exit 0. If a downstream worker's test
run failed with a missing `fluxiq/dist/...` module between roughly 18:41 and
18:44 today, that build is the likely cause and a re-run is the answer.

### 5. The suite takes eight minutes serially

`pnpm -r test -- --no-file-parallelism` took 479s in run 1. With a 15s
per-test timeout and storage tests that legitimately need several seconds, the
whole-suite run is close enough to the timeout budget that a slow moment
produces a red that a targeted re-run does not reproduce. That is worth knowing
before anyone reads a single timeout in this suite as a regression.
