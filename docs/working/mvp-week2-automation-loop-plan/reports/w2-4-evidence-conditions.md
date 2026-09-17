# Phase 2.4, downstream — the evidence conditions the recovery verdict asks for

## Outcome

Done. Both condition kinds already existed and were not rebuilt. What was
missing was the honesty rule around them: three claim shapes were reaching the
page and coming back with confident answers to questions nobody could ask, one
of which answered **"yes, the banner is gone"** without looking at anything.
Those are now refused before dispatch and reported as unjudged.

## What already existed, and where

Both kinds the verdict needs are already in the `web.dom.assert` vocabulary
(`domain/src/actions/types.ts:210`, `WebAutomationAssertKind`), already read by
`webAutomationExpectationCondition` and already dispatched by
`createWebAutomationExpectationEvaluator`. Nothing about them was rebuilt.

**1. URL / navigation — exists.** Kind `url`. The domain emits
`{ assert: { kind: "url", expected, timeoutMs } }`; the content script
(`apps/extension/src/content/action-runtime/assertion-evaluation.ts`,
`urlOutcome`) compares against `location.href` and holds on equality **or
substring**, so a claim can name a path without the origin a run assigns. It is
always `judged`, because a document always has an address. There is a
production producer already: `expectation/click-landing.ts` proposes exactly
this condition as the state a recorded click must leave.

Covered: "after the recovery, the browser is at an expected URL." **Not
covered:** "a navigation event occurred" as a claim in its own right, without a
target URL. There is no such kind, and adding one would need
`domain/src/actions/types.ts` and the content script, both outside the files
this brief owns. Handed back rather than done. In practice a post-recovery
landing check is expressible today as the URL it landed on.

**2. Element presence / absence — exists.** Kinds `exists` and `absent`, each
taking a selector, re-queried on every polling attempt so a late arrival and a
late detachment are both seen. `absent` is the canonical dismissed-banner case
and is deliberately not the mirror of `exists`: it holds when nothing matches,
so its only failure is seeing the element.

**Neither depends on `data-testid`.** `conditions.ts` synthesizes no selector —
it carries verbatim whatever the producer wrote — and `click-landing.ts`, the
one producer in this directory, emits a URL claim with no selector at all. A
test-id dependency, if one exists, would be minted where packets are built
(`domain/src/runtime/llm-evidence/`), which this brief does not own. Asserted
by a new test that the payload for both verdict conditions contains no
`data-testid`.

**Element identity stays opaque to Core.** Core hands `expectedState.conditions`
over as raw JSON and never looks inside; this module is the only thing that
reads it. Nothing was added that would make Core parse or understand a selector.

## What was added, and why

The gap was not the kinds. It was that a claim can be well-formed JSON and still
name nothing a page can be asked, and the content script answers it anyway.
Three shapes, read out of `assertion-evaluation.ts`:

| Claim | What the page reports today | Why that is wrong |
| --- | --- | --- |
| `absent` with no selector | **held, judged** → action `succeeded` → domain counts it as evidence that held | `currentElement` has nothing to query, finds nothing, and "nothing matched" *is* `absent` holding. "The blocking banner is gone" answers **yes** with nothing looked at — and that is the answer that lets deterministic execution resume. |
| `url` with no expected URL; `exists` with no element | `malformed` → action `failed` → domain reports the condition rejected | Reports **false** — "the page's URL is wrong" — about a question nobody asked. The brief forbids `false` here as much as `true`. |
| `text` with a blank expected string | held on any page with text, since `"anything".includes("")` | Trivially true. Same lie as the first row. |

`conditions.ts` gains one export,
**`webAutomationExpectationConditionRefusal(condition)`**, returning why the
domain will not ask the claim, or `undefined` when it will. It is driven by
`CLAIM_SUBJECTS`, a record keyed by the same exhaustive `WebAutomationAssertKind`
union as `ASSERT_KINDS`, so a new kind must declare its subject rather than
defaulting to askable:

- `exists`, `absent`, `visible`, `enabled` require a selector. The payload this
  module builds carries only a selector, a frame and a tab, so with no selector
  the content script's `assertionTarget` has no coordinates, bounds or
  fingerprint to fall back to and ends with an empty target.
- `url` and `text` require a non-blank `expected`. Blank counts as absent: a
  `url` claim of `" "` matches no address, a `text` claim of `""` matches every
  page.
- `text` does **not** require a selector. Without one it is the authored claim
  "the page says X", judged against `document.body` — a real question with a
  real answer, so refusing it would lose a working condition.

The refusal is kept separate from `webAutomationExpectationCondition`, which
still returns `undefined` for a shape the domain cannot read at all. Both are
unjudged, but they are different facts and each says so in its own words — the
same rule as "could not read" versus "nothing there".

`evaluate.ts` gains `conditionOutcome`, which takes the two pre-dispatch ways a
condition can be unjudged. A refused condition is **never dispatched** and is
reported `evaluated: false` — neither held nor rejected.

One message change: a rejected verdict now also says how many conditions were
never checked. It cannot change the verdict, but omitting it reported a partial
look as a complete one.

## How each of these reports `unknown`

Core's `AutomationNodeExpectationEvaluation` carries a boolean and a count and
has no third value, so `unknown` is carried by the count:

```
judged  = checkedConditionCount
unknown = conditions.length - checkedConditionCount
held    = passed, and only of the judged ones
```

**`passed: true` is never on its own "the evidence held."** It is "nothing
judged said otherwise". A caller that requires evidence must treat any shortfall
in the count as unknown, and unknown as not resumable. Every route out of this
module that fails to judge a condition also declines to count it, so inflating
the count is the one way this module could lie. That contract is now written
into the `evaluate.ts` header, and a test proves the shortfall for each route:
an unreadable shape, a refused claim, a command that never reached a client, a
cancelled action, a status the domain does not read, and a cancelled run that
stops early.

**A trade-off the Core side must know about.** For the *expectation policy node*,
an unaskable condition now yields pass-with-nothing-checked instead of a red
route. That is this module's long-standing and deliberate policy ("a condition
that could not be judged is not a condition that failed"), and the brief
requires it — but it means **the fail-closed property exists only for a caller
that reads `checkedConditionCount`.** A caller that reads `passed` alone gets
`true` from a set of conditions none of which were looked at. That is the one
integration requirement this change puts on Core — and Core does not currently
meet it. See open question 1, which is a confirmed live defect with the exact
line and a one-line fix, not a hypothetical.

## Commands run and observed results

`pnpm --filter @fluxiq-web-extension/domain check` — first run **failed**:

```
src/runtime/expectation/tests/evaluate.test.ts(288,100): error TS2345:
  Argument of type 'unknown[]' is not assignable to parameter of type 'JsonValue[]'.
```

Worth recording: the domain test build uses **esbuild, which does not
type-check**, so the test suite was green while this error stood. After typing
the fixture as `JsonValue[]`, the check passes with no output.

`DOMAIN_TEST_BUILD_LABEL=w24-conditions pnpm --filter @fluxiq-web-extension/domain test`:

```
1..675
# tests 675
# pass 675
# fail 0
# duration_ms 9551.697
```

11 tests are new (5 in `evaluate.test.ts`, 6 in `conditions.test.ts`); the
suite was 664 before.

`node scripts/structure-audit.mjs`, final run, exit code 0:

```
structure-audit: passed (65 warning(s), 122 baselined).
```

This took two observations to report honestly, because the checkout is shared
with concurrent workers. Mid-task the audit reported two violations:

```
  FAIL  [working-docs] docs/working/mvp-week2-automation-loop-plan.md: "## Current State" is 176 lines, over the 150-line budget. Every agent reads this section before every task, so keep only what the next one needs to act on and push the rest into the body or the archive.
  FAIL  [working-docs] docs/working/README.md is out of date with the documents' header blocks. Run "pnpm structure:baseline" to regenerate it.

structure-audit: 2 violation(s) across 1 rule(s).
```

Both were **pre-existing and not mine** — the identical two were present on the
very first run, before any edit in this task, with the Current State at 177
lines. Another agent then shortened that section and regenerated the index,
which is why the final run is clean. Neither run named `runtime/expectation` at
all, and no new `exported-values`, `file-lines`, `swallowed-failure` or
`failure-as-empty` finding appeared: nothing was swallowed and no caught failure
became an empty value.

### Negative probes — the tests are load-bearing

Each probe was reverted immediately afterwards and the suite returned to 675/675.

1. Guard neutered (`if (false && refusal !== undefined)`) → **2 failures**. That
   showed three of my other tests were green for the wrong reason: the scripted
   dispatcher ran out of answers for the unwanted dispatch and returned an
   unrecognised status, which goes uncounted anyway. Fixed by handing those
   fixtures an extra `succeeded` the refusal must stop them reaching.
2. Same probe re-run → **5 failures**, every new evaluator test.
3. Blank rule weakened to `expected === undefined` → **3 failures**, so the
   blank-versus-absent distinction is independently proven.

## Not verified

- **No live browser validation.** The `absent`-holds-without-looking behaviour
  was read from `assertion-evaluation.ts` source and reasoned through
  `assert.ts`'s status mapping; it was not observed in a running browser. The
  defence is in the domain and is proven by unit test, so the fix does not
  depend on that reading being right — but the severity claim does.
- **Frame and tab unreachability.** A condition naming `browserFrameId` for a
  frame that is gone: whether the assert fails, or silently runs in another
  document, was not traced. An `absent` judged in the wrong frame would still
  hold. This is an extension-side hole outside the owned files and is the
  nearest remaining instance of the same defect class.
- **An invalid selector.** `document.querySelector("not a selector")` throws;
  which action status that becomes, and therefore whether the domain reads it as
  rejected or unjudged, was not traced.
- **The Core defect in open question 1 was traced by reading, not by running.**
  The chain from `trial.ts:261` through `verdict.ts:135` was followed in source;
  no Core test was written or run to demonstrate the fail-open end to end. The
  five steps are each a direct read of a line quoted in that section, but the
  composite claim — "a recovery with unlooked-at evidence reports resumable" —
  has not been executed.
- **`pnpm check` / `pnpm test` / `pnpm build` at the repository root** were not
  run: several workers are editing this shared checkout concurrently, so a
  repository-wide run would report their state, not this change's.

## Open questions and contradictions found

1. **CONFIRMED DEFECT IN CORE — the count is not read, and the verdict fails
   open.** This started as a hypothetical recommendation. The Core side landed
   mid-task (`reports/w2-4-recovery-verdict.md`, commit `5ea076c`), so I traced
   it. It reads `passed` alone:

   `AS/runtime/flow-change/trial.ts:261`

   ```ts
   record(context, evaluation?.passed === true ? "passed" : evaluation?.passed === false ? "failed" : "unknown");
   ```

   `checkedConditionCount` is never read anywhere on this path. The full chain:

   1. This domain, with every required-evidence condition unjudged, returns
      `{ passed: true, checkedConditionCount: 0 }` — Core's own documented
      default for "nothing could be checked".
   2. `trial.ts:261` records that as **`"passed"`**.
   3. `trial.ts:181` puts it on the attempt as `expectedState: "passed"`.
   4. `verdict.ts:134-135`: with no `"failed"` and nothing other than
      `"passed"`, this returns `check("expected_state", "passed")`.
   5. Per the Core report's own line 136, only `passed` evidence enters `basis`
      — so the verdict reaches `verified` and the run is resumable.

   **A recovery whose required evidence was never looked at is reported as
   verified and resumable.** That is the exact fail-open this phase exists to
   close, reached without any condition being wrong — only unanswerable, which
   is the common case when a model authors the conditions.

   The machinery to handle it is already there and simply is not fed:
   `expectedStateCheck` already maps anything that is not `"passed"` to
   `unknown` with reason `expected_state_unevaluated`. The fix is one line, and
   `conditions` is already in scope at that call site:

   ```ts
   const judged = (evaluation?.checkedConditionCount ?? 0) >= conditions.length;
   record(context, evaluation?.passed === true && judged ? "passed" : evaluation?.passed === false ? "failed" : "unknown");
   ```

   This is in `F:\!FluxIQ`, outside this brief's owned files, so it is reported
   rather than fixed. **It should be fixed before Phase 2.4 is called done**;
   everything this brief added is defeated without it.

   Separately, and still worth doing: an explicit unknown field on
   `AutomationNodeExpectationEvaluation` would make the shortfall impossible to
   forget rather than merely documented. This module would fill it, with the
   count contract as the fallback.
2. **Opaque handles do not reach expectation conditions.** The domain already
   has a handle system that keeps element identity opaque
   (`runtime/llm-evidence/plan-resolution/target-packets.ts`, resolving
   `target.N` to a selector per project and Flow). An expectation condition
   cannot use it: resolution needs a `{projectId, flowId}` scope, and
   `AutomationNodeExpectationEvaluationContext` carries only `source`, `nodeId`,
   `attemptId`, `stateRef` and `signal`. So a verdict asking "is the banner
   gone?" must today carry a selector string as opaque JSON rather than a
   handle. Core still never interprets it, so the stated constraint holds — but
   the stronger form, where the domain mints the identity and the condition
   names only a handle, needs `domain/src/runtime/host-runtime.ts` and a scope
   on Core's context. Neither is in this brief's file set.
3. **No "a navigation completed" kind**, as above. Needs `actions/types.ts` and
   the content script.
