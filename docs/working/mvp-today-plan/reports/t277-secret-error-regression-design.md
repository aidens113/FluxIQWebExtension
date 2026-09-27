# t277 — Secret-bearing continuation-error regression design

Status: **Complete report-only design**

## Verdict

Add one deterministic unit test to the existing continuation-coordinator test file. It should drive
an arbitrary secret-bearing error specifically from `continueGrant`, then pass the returned fixed
code through the public run-detail projection and assert the complete published marker by exact
equality. This is the smallest test that covers both sides of the t276 gap: reduction at the catch
boundary and the final public provenance shape.

The gap is **not release-blocking**. T276 found no source disclosure: unknown binding-read and
continuation errors share one catch, that catch returns only a fixed typed code, and the projection
accepts only that code plus Core-owned constants. Existing tests already cover an arbitrary
secret-bearing error through the binding-read side and a typed refusal through the continuation
side. This proposed test is defense in depth against a future branch-specific regression.

## Placement

Extend:

`packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/tests/reauthor-continuation.test.ts`

Import `automationStudioRuntimeReauthorContinuationDetail` beside the existing coordinator import,
and import `AutomationStudioFlowRunDetail` as a type from the model boundary already used by the
implementation. Do not add a service-composition fixture option: that would duplicate project,
provider, persistence, and grant setup while testing a pure catch-and-project seam.

Suggested test name:

`"reduces an arbitrary continuation error to closed public provenance"`

## Exact fixture

Reuse the file's `previous`, `adaptation`, and `grant` fixtures. Add only these local values:

- `appliedBinding = { executionDigest: "digest.applied.secret-sentinel", settingsRevision: 8 }`
- an applied adaptation clone with `application: {}`
- three unique disclosure sentinels for message, stack, and cause, for example
  `continuation-message-must-not-escape`, `continuation-stack-must-not-escape`, and
  `continuation-cause-must-not-escape`
- an `events: string[]` sequence
- `continueGrant` that records `"continue"` and throws an ordinary `Error` whose message, explicit
  stack, and `cause` carry those sentinels; optionally attach an enumerable `providerPayload`
  sentinel to make accidental object spreading visible

Invoke `applyAutomationStudioRuntimeReauthorAndContinueGrant` with:

- the existing project, Flow, adaptation, actor, previous binding, and grant
- pass-through `withLock`
- `loadAdaptation` returning the existing adaptation
- `apply` recording `"apply"` and returning the applied clone
- `readAppliedBinding` recording `"read_binding"` and returning `appliedBinding`
- the throwing `continueGrant`

Then construct a minimal typed run detail whose metadata contains exactly:

```ts
resultReauthor: {
  routed: true,
  adaptationId: adaptation.adaptationId,
  applied: true
}
```

Pass it to `automationStudioRuntimeReauthorContinuationDetail` with `applied: true` and the failure
code returned by the coordinator. The rest of the detail may use a narrow test cast; no persistence
or service harness is needed for this pure projection.

## Exact assertions

Assert all of the following in this order:

1. `events` equals `["apply", "read_binding", "continue"]`, proving the error arose after durable
   apply and not from the already-covered binding-read branch.
2. The coordinator result exactly equals:

   ```ts
   { replayReady: false, code: "llm.execution_grant_no_longer_valid" }
   ```

   This proves an arbitrary non-refusal error cannot choose a public code or carry its own fields.
3. The projected `metadata.resultReauthor` exactly equals:

   ```ts
   {
     routed: true,
     adaptationId: adaptation.adaptationId,
     applied: true,
     replayReady: false,
     code: "llm.execution_grant_no_longer_valid",
     stage: "grant_continuation",
     retryable: false,
     providerInvocation: "not_attempted",
     providerResponse: "not_received"
   }
   ```

   Exact equality, rather than `toMatchObject`, simultaneously proves `providerStatus`, message,
   stack, cause, grant identity, binding fields, and arbitrary enumerable error fields are absent.
4. `JSON.stringify(projected)` contains none of the message, stack, cause, or enumerable payload
   sentinels. Also assert it contains neither `grant.grantId` nor `appliedBinding.executionDigest`;
   these are sensitive internal provenance available at the catch boundary but not public fields.

Do not assert that all earlier provider activity was absent. The marker's `not_attempted` /
`not_received` values describe the local `grant_continuation` failure stage; prior verification and
reauthor generation are outside this unit and may legitimately have used a provider.

## Focused command

From `F:\!FluxIQ`:

```powershell
pnpm --filter fluxiq test -- src/programs/automation-studio/runtime/service/runtime-adaptation/tests/reauthor-continuation.test.ts
```

Expected result after implementation: the file's existing two cases plus this case pass, with no
generated artifact or live provider/browser state involved.

No Core source, shared document, generated output, run artifact, provider/browser/Lab state,
commit, or push was changed. This downstream report is the only file written by t277.
