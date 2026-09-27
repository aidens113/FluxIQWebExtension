# t303 — Web permission fixture audit

Status: **Complete read-only fixture/assertion map**

Scope: Core `apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx`
only. No test command was run.

## Shared fixture map

`coreRequest()` deliberately supplies three different classes to Core's real gate:

| Role | Consequence | Fixture source | Correct request/UI meaning |
| --- | --- | --- | --- |
| Declared and permission-gated | `send_or_publish` | `checkFor(...).consequences` at line 39 | It is the only missing class, so it is the only class the person must approve and the only class a retry grant may add. |
| Declared but policy-allowed | `create_new` | same declaration | It remains part of what the action declares, but the risk-only rule does not gate it. It is neither missing nor authority already granted, must not appear under "Consequences requiring approval," and must not be added to the retry grant. |
| Declared and already in run authority | `modify_existing` | declaration at line 39 plus `permittedConsequences` at line 30 | It is not missing. The request may describe it as already allowed for this run, but the retry grant must not add it again. |

Thus the fixture's relevant semantic partition is:

```text
declared:        [send_or_publish, create_new, modify_existing]
missing:         [send_or_publish]
already granted: [modify_existing]
policy-allowed:  [create_new]
```

The four failures all come from the same stale assumption: they treat every declared class that
was not in the fixture's prior grant as missing. Under the risk-only boundary, `create_new` is
allowed by policy without becoming grant authority.

## Assertion-by-assertion corrections

### 1. `RunPermissionRequest > shows the request Core built...` (first failure at line 126)

Keep the sentence/control and `send_or_publish` rendering assertions. Correct the remainder to:

- line 126: assert that rendered output **does not contain** `create something new that stays`;
- line 127: the `Consequences requiring approval` list has length **1**, not 2;
- line 128: keep the `modify_existing` "Already allowed for this run" assertion;
- line 132: `onAllow` receives `missing: ["send_or_publish"]`.

The request can still carry the full declared consequence set; this component is presenting what
requires approval, not restating every declared effect.

### 2. `Runtime Debug permission request from a run > allows exactly the missing classes...`
(first failure at line 200)

- line 200 preflight expectation:
  `permittedConsequences: ["send_or_publish"]`;
- line 203 issued-grant expectation: exactly `["send_or_publish"]`;
- keep line 204's negative assertion that the grant does not add `modify_existing`;
- add the symmetric negative assertion that it does not add `create_new`.

The title's existing invariant, "exactly the missing classes, and nothing more," then matches the
fixture and Core's request.

### 3. `...keeps the allowed classes through a high-token confirmation` (line 260)

The confirmed grant must contain
`permittedConsequences: ["send_or_publish"]`, with `highTokenConfirmation: true` unchanged. The
high-token confirmation preserves the pending retry authority; it does not widen it to a
policy-allowed creation class.

### 4. `Runtime Debug run whose request was cut short > names an explicit run...` (line 304)

The recovered request's second issued grant must equal `["send_or_publish"]`. Timeout/read-back
transport does not change the request partition, so `create_new` must not appear merely because the
request was recovered by explicit run id.

## Missing invariant coverage

Before rendering the request, add one direct fixture contract assertion block after
`const request = await coreRequest()` in the first test:

```ts
expect(request.consequences).toEqual(["send_or_publish", "create_new", "modify_existing"]);
expect(request.missing).toEqual(["send_or_publish"]);
expect(request.authority.granted).toEqual(["modify_existing"]);
```

If Core emits a different stable order for `request.consequences`, use set-equivalence only for
that declared-field assertion; `missing` and the issued grant should remain exact ordered arrays.
Also retain/add explicit UI and grant negatives for `create_new`. Together these assertions prevent
three concepts from collapsing again:

1. what the action declared;
2. what the risk-only gate says is missing; and
3. what prior run authority already granted.

No production change is indicated by these four failures. The smallest coherent fix is confined to
this one test file and updates stale expectations while strengthening the partition invariant.

t303 changed no Core source/test, shared document, generated output, run artifact, or live state.
This downstream report is its only write.
