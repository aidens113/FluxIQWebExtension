# p-secret-binding — the node asks for the withheld value

## Outcome

**Partial, and the partition is the reason.** The empty-password defect is
gone: a recorded entry whose value the recorder withheld no longer becomes a
node carrying `""`, and `web.dom.type` no longer accepts an action with nothing
to type. The node now carries an explicit *request* for the value, shaped as
Core's own parameter state binding, and two tests run that request through
Core's real resolver to show a supplied value reaches the dispatched parameters
and an unsupplied one fails the node by name.

What is **not** closed is the last leg: the request cannot yet be answered on
the path W18 actually uses. Two of the four files that leg needs are outside my
ownership and one of them belongs to FluxIQ Core. Each is named below with the
exact edit, and one of them I verified by running it against a copy. Do not
read "the binding exists" as "W18 replays" — see *Not verified*.

## What changed and why

### 1. The vocabulary (`domain/src/output-nodes/secret-binding.ts`, new)

One module that says what a withheld value becomes, and how a supplier finds
the request. It builds Core's `{ $state: { path } }` parameter binding
(`fluxiq/automation-studio/nodes`, `parameter-bindings.ts`) rather than a
second mechanism, because that is the one seam where a run input becomes a node
parameter, and because every web output node parameter already declares
`allowStateBinding: true` (`output-nodes/definitions.ts`) — a binding at `text`
is what the node definition already sanctions.

Three decisions the brief asked me to state:

**How the node knows which secret it wants.** From identity it already carries,
in this order: the recorded visual target's `statePath`
(`web.elements.<stateId>`, built by `recording/web-state/action-target.ts`),
then the author-written identifier (test id, `id`, `name`, the order
`stableElementId` prefers), then the selector. The state path wins because it
is the only one already made unique across the page's controls, positional
suffix included (`element/identity.ts`, `elementStateIdAssigner`). Nothing new
is correlated: a supplier reading the approved Flow sees the path on the node
and needs to derive nothing.

The namespace is `web.secret.`, deliberately **not** `web.elements.`. Core's
`readAutomationStatePath` walks the live state snapshot as well as the run
inputs, so a binding spelled `web.elements.password` would resolve against the
element's own state entry and hand the action an object where a string belongs
— silently, with no missing path to report. A separate segment cannot collide.

**What happens when the secret is absent.** The binding carries **no
`fallback`**. That is the whole fail-closed decision, expressed in Core's
contract rather than a new one: `resolveAutomationNodeParameterValues` puts a
fallback-less unresolved path into `missingPaths`, and
`runtime/executor/node-execution.ts` fails that node with "State-bound
parameter path could not be resolved: `web.secret.<key>`". A fallback is
precisely how an unsupplied secret would become an empty string again.

**The secret never reaches a recording, log, result or evidence packet.** No
value passes through the module — it builds and reads paths only. The request
is safe in a recording, a proposal, a stored Flow and an evidence packet, which
is the point: the value enters at run time, in Core's memory, on the dispatch
path only. A test serializes the recorded parameters and asserts the path is
present and no supplied sentinel is.

### 2. The emission (`domain/src/output-nodes/payloads.ts`)

`web.dom.type`'s `text` was `stringValue(payload.inputValue) ?? ""`. It is now
`recordedTypedText(payload)`: a recorded value replays as itself; **no** value
on a control the sensitivity rule marks becomes the request. The rule is asked
through `isSensitiveElementDescriptor` (`domain/src/sensitivity`), not
restated — I did not touch that directory.

A withheld value on a control the rule does *not* mark keeps `""`. That
combination should not arise (`readElementValue` withholds only for a marked
control, and an entry the user emptied arrives as `""` and maps to
`web.dom.clear`), and asking for a secret on a control nothing calls sensitive
would invent a request no manifest declares.

### 3. The gate (`domain/src/actions/schemas.ts`)

`web.dom.type` now requires `["selector", "text"]`. This is the second half of
the brief's diagnosis: `hasExecutableParameters` (`io/input-model.ts`) checks
exactly the parameters the schema names, so while `text` was absent from that
list a node with nothing to type validated, survived, ran, and reported
success. A type action with no text is always a value that went missing.

Grepped: `webAutomationActionDefinitions` and `parameterSchema` have no
consumer outside `domain/`, so the change is contained.

### 4. Tests

- `output-nodes/tests/secret-binding.test.ts` (new, 11 tests). The two that
  matter call Core's **real** `resolveAutomationNodeParameterValues`, not a
  domain restatement of it: one asserts that a value supplied to the run
  reaches `values.text` — for **two different sentinels**, so a resolver
  returning any constant could not pass — and that `missingPaths` is empty;
  the other asserts that with nothing supplied `missingPaths` is exactly
  `["web.secret.password"]` and `"text" in values` is `false`, so an
  unresolved request never degrades into a value. The rest cover the request's
  shape (one key, one field, no `fallback`), the key derivation order, that
  only a request on the secret namespace is one, and that serializing the
  parameters yields a path and no value.
- `output-nodes/tests/payloads.test.ts` (+2). The branch this file owns: only a
  control the sensitivity rule marks asks for a withheld value, and it is asked
  by every route the rule recognizes — `type=password`,
  `autocomplete=one-time-code`, `billing cc-number`, `data-sensitive=true` —
  which is the case a duplicated copy of that rule once missed.
- `actions/tests/schemas.test.ts` (+1). `web.dom.type` requires selector and
  text.

No credential appears in any test, test name, comment, or this report. The
supplied values are sentinels (`run-one-sentinel`, `run-two-sentinel`), which
is also what makes the resolver assertion decisive.

### 5. Documentation (`.env.example`, `docs/architecture/testing-facility.md`)

`FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` was documented nowhere. Both files now
carry it, with the naming rule (`FLUXIQ_TEST_SECRET_<ID>`, id upper-cased,
hyphens as underscores), what an unset variable does (fails the run closed with
`environment.missing`, never a fallback to the recording), that only the Flow
lane resolves declarations so a recording-lane run needs none, and — stated
plainly in both — that these are **fixture credentials, not real ones**: every
scenario is a deterministic loopback fixture that prints its accepted
credential on its own page, and the value is carried in a variable only so that
no recording or generated Flow holds a literal that reads like a password. The
doc gains a `### Declared replay secrets` subsection under *Scenario lab and
contract* plus a `secrets` bullet in the manifest contents list; the variable
was kept out of the *Existing FluxIQ target* table, which is specific to that
target and this is not.

## Commands run and observed results

Exit statuses captured by redirect (`cmd > file 2>&1; echo $?`), never a pipe.
`DOMAIN_TEST_BUILD_LABEL=p-secret-binding` (lowercase) was set for every run.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/domain check` | 0 | tsc clean, both projects |
| `pnpm --filter @fluxiq-web-extension/domain test` | 0 | `# tests 322`, `# pass 322`, `# fail 0` (310 before this work) |
| `pnpm --filter @fluxiq-web-extension/domain test` (final, after a transient) | 0 | `# tests 322`, `# pass 322`, `# fail 0` |
| `node scripts/structure-audit.mjs` | 1 | 6 violations, **all** `[contract-spread]` in `domain/src/runtime/llm-evidence/**`. Not mine — see below. No file of mine appears anywhere in the output. |

The audit failure is another worker's in-flight change, not a regression:
`scripts/structure-audit/rules/contract-spread.mjs` is untracked (brand new),
`scripts/structure-audit/config.mjs` is modified to list
`domain/src/runtime/llm-evidence`, and that directory has not been cleaned yet
— which the config's own comment forbids ("Configure a path only once it is
clean"). `domain/src/runtime/**` is on my must-not-touch list and I did not
touch it.

One run in between exited 1 with `# tests 129`, `# pass 129`, `# fail 0` and
`ERR_MODULE_NOT_FOUND` for
`domain/node_modules/fluxiq/dist/programs/automation-studio/index.js`. That was
a **concurrent FluxIQ Core build**, not my change: `F:\!FluxIQ/packages/fluxiq/dist`
was being rewritten at 18:22:32 and my run landed inside the window. I reran
rather than assumed (this machine's RAM is known faulty) and the rerun was
322/322 with no such error, matching the two runs before it.

Two other files in directories I edited are dirty and are **not** mine:
`domain/src/actions/types.ts` (last written 17:51, before my first edit) and
`domain/src/client/gateway-mapping.ts` (17:40). `domain/src/io/input-model.ts`
is clean and untouched since 2026-09-11, which confirms the copy-probe below
left the real file alone.

### Mutation checks — the tests have teeth

Two mutations, each reverted from a copy taken before the edit and re-verified.

- **Removed the binding.** `payloads.ts` back to
  `text: stringValue(payload.inputValue) ?? ""`. Result: `test exit=1`,
  `# pass 315`, `# fail 7` — every new assertion fails, including
  `not ok 63 - with nothing supplied the node fails and names the path, rather
  than typing nothing` (`missingPaths` came back `[]` instead of
  `['web.secret.password']`) and `not ok 57` failing on "an empty string is
  what typed nothing into a password field and reported success". Restored;
  `# pass 322`.
- **Removed the schema gate.** `required` back to `["selector"]`. Result:
  `test exit=1`, `# fail 1`,
  `not ok 11 - web.dom.type requires the text, so an action with nothing to
  type is not a valid one`. Restored; `grep` confirms
  `required: ["selector", "text"]` is back.

### Probe: what the recorded action does today

Run through a bundled probe (built with the domain's own esbuild into the
scratchpad, source deleted afterwards), on the real
`webAutomationRecordedAction`:

```
withheld sensitive entry -> undefined
recorded value entry     -> {"...","text":"typed-by-the-user",...}
```

So **today** a withheld password entry produces no executable node at all: the
request is built, then discarded by `hasExecutableParameters`, because that gate
requires a non-empty *string* and the request is an object. That is the
fail-closed state described below — closed, but quiet.

## Not verified

- **Whether W18 replays. Unanswered, and not answerable from this seat.** I ran
  no `pnpm lab` command and no `pnpm build`, per the brief. Nothing here has
  been exercised against a browser, a real recording, or a real Core.
- **The recording-derived dispatch path.** Every assertion about resolution is
  against Core's resolver called directly. I did not execute a Flow.
- **`packages/test-runner`, `apps/extension`, `apps/scenario-lab` checks and
  tests** were not run. The schema change has no consumer outside `domain/`
  (grepped), but "grepped" is not "ran".
- **Root `pnpm check` / `pnpm test`** were not run: they include other workers'
  in-flight packages and `pnpm lab:test`.
- **The proposed `client/gateway-mapping.ts` guard** (edit 2 below) was not
  executed in any form. Edit 1 *was* executed, on a copy — see below.

## Open questions or contradictions found

### 1. The binding cannot be answered on the path W18 uses, and the last link is in Core

This is the finding that decides the rest, so it is first. A recording-derived
node is materialized at run time as `builtin.policy.action` with the recorded
payload **nested** under `parameterValues.parameters`
(`materializeRecordingNode`, `runtime/service.ts`). Core's
`resolveAutomationNodeParameterValues` iterates only the **top level** of
`parameterValues`, so a binding at `parameters.text` is copied through
unresolved. It then reaches `domain/src/client/gateway-mapping.ts`, where
`text: stringValue(parameters.text)` reads an object as `undefined`, and
`typeAction`'s `action.text ?? action.value ?? ""` types an empty string and
reports success — today's defect, unchanged.

An **authored** `web.output.dom-type` node has flat top-level parameters and
resolves correctly, which is what the two resolver tests exercise. Nothing in
this repository authors one; the Flow lane generates from a recording.

So the last link is a Core change: either resolve state bindings nested inside
an object parameter, or materialize a recording-derived node's parameters flat.
That crosses the repository boundary, which needs the user told first, and
FluxIQ Core is not in my ownership. I did not attempt it.

### 2. Fail-closed today is quiet, and loud costs one file I do not own

Because the request is discarded by `hasExecutableParameters`, the password
step currently **drops out of the Flow** rather than typing nothing. Nothing
lies: no action reports success having typed an empty password. But Core
records a per-entry mapper miss only when a mapper emitted *zero* candidates
(`runtime/service.ts`), so the drop is silent, and W18 fails at the final-state
oracle rather than with a message naming the missing secret. That is
strictly better than today and still short of "loudly".

Three edits close it. The first two are small and in `domain/`; I did not make
them because they are outside the ownership the brief gave me, and I would
rather hand you an exact edit than a surprise.

**Edit 1 — `domain/src/io/input-model.ts`, `hasExecutableParameters`.** One
line, so a request satisfies a required parameter:

```ts
if (!required.every((key) => isNonEmptyString(parameters[key]) || webAutomationSecretBindingPath(parameters[key]) !== undefined)) return false;
```

with `webAutomationSecretBindingPath` added to the existing
`from "../output-nodes"` import. **Verified**: applied to a *copy* of the file
in a scratch directory inside the package (the real file was never modified —
it is clean in `git status` and untouched since 2026-09-11), bundled, and run.
Observed: `with the one-line gate change -> {"$state":{"path":"web.secret.password"}} outputId= web.dom.type`.
The scratch directory was deleted.

**Edit 2 — `domain/src/client/gateway-mapping.ts`,
`webAutomationActionFromGatewayCommand`.** Refuse a command whose parameters
still carry an unmet request, instead of reading it as absent text. The file
already has the rejection shape (`normalizeWebAutomationActionType` returns
`{ status: "rejected", message, failure }`), and
`webAutomationUnresolvedSecretParameters(parameters)` returns names and paths
only, so the message carries no value:

```ts
const unmet = webAutomationUnresolvedSecretParameters(parameters);
if (unmet.length) return { commandId: command.commandId, status: "rejected", actionType: command.actionType,
  message: `Parameters ${unmet.map((entry) => entry.parameter).join(", ")} need values supplied at run time that this run did not supply: ${unmet.map((entry) => entry.path).join(", ")}`,
  failure: /* the same failure record shape the unknown-action-type path builds */ };
```

**Caution: that file is contended.** It is modified in `git status` and was
last written at 17:40 today, so co-ordinate before editing it.

**Edit 3 — `packages/test-runner/src/flow-lane/**`.** Supply the declared
secret at the path the node asks for. **Contended, and I did not write there**:
`run-flow-lane.ts` was rewritten 17 seconds before my first check and again
during the work, `finalized-recording.ts` and `index.ts` likewise. The exact
edit: in `run-flow-lane.ts`, the run's `inputs` currently carry
`declaredSecretFlowInputs(input.secrets)`, keyed by secret id. Keep that, and
add an entry keyed by the node's path. The lane already reads the approved
Flow's nodes (`readFlowActionTypes`), so the path is read off the node rather
than re-derived: scan each node's `parameterValues.parameters` with
`webAutomationSecretBindingPath`, then pair each path with a declaration by
matching the declared `step`'s `target` — `auth-gate`'s `enter-password` has
`target: "testid:password"` — against the node's element identity, and **fail
the run when the pairing is not exactly one-to-one**, so an unpaired request
never becomes an unanswered one at replay.

Edits 1 and 2 alone make the failure loud. Edits 1 and 3 plus the Core change
in finding 1 make it replay.

### 3. `expected.actions` cannot notice the missing step, for auth-gate specifically

`auth-gate` declares `actions: [{ action: "web.dom.type", outcome:
"succeeded" }, …]`, and the **username** step satisfies that whether or not the
password step exists. So the drop in finding 2 is invisible to the action
expectation and shows only in the final-state oracle. Worth knowing before
anyone reads a W18 failure as a target-resolution problem.

### 4. A latent path by which a resolved secret could reach a label

`apps/extension/src/background/connection/runtime-status.ts:131`,
`runtimeActionTarget`, returns `action.url ?? action.selector ?? action.text ??
…` for a runtime status label. For `web.dom.type` the selector is always
present, so `text` is never reached today and this is **not** a live leak. It
becomes one the moment a type action arrives without a selector. `apps/extension`
is on my must-not-touch list; recording it so it is not discovered by accident
later.

### 5. The plan entry still needs splitting

Confirming what `p-declared-secrets` said. "Credentials at replay" now has
three distinct remainders, not one: the environment variable (**done here**),
the node binding (**emitted here, unanswerable without finding 1**), and the
supply (**edit 3, contended**). Ticking the entry would claim W18 replays.
