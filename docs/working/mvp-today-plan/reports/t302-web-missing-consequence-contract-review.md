# t302 Web Missing-Consequence Contract Review

Status: **PASS production contract; four observed failures are stale web-test expectations.**

## Verdict

The current Runtime Debug UI displays the permission classes in `request.missing`, and a person's
approval puts exactly that array into the replacement grant's `permittedConsequences`. It does not
union in the action's full declaration, the old grant's authority, or instruction-derived
authority. The high-token continuation preserves the same exact missing array. This is the intended
least-authority behavior and needs no production change.

The shared test fixture now builds this valid Core request under the risk-only rule:

```text
consequences:      [send_or_publish, modify_existing, create_new]
missing:           [send_or_publish]
authority.granted: [modify_existing]
authority.instructed: []
```

`create_new` and `modify_existing` remain recorded consequences, but neither is a separately gated
class. Only uninstructed/ungranted `send_or_publish` is missing. The four root failures all expect
the former two-class missing set and are stale.

## Field-by-field contract

| Field/path | Meaning and fixture value | UI/continuation behavior | Verdict |
| --- | --- | --- | --- |
| `consequences` | Every lasting consequence declared by the action, in Core order: send, modify, create. | Preserved in the parsed request/run detail as complete audit context. It is not a grant request. | Correct. |
| `missing` | Only separately gated classes absent from both grant and grounded instruction: send. Never empty. | Its phrases alone populate `Consequences requiring approval`; the replacement preflight and grant receive an exact copy. | Correct. |
| `authority.granted` | What the ended run's old grant held: modify. It is disjoint from `missing`. | Rendered separately as `Already allowed for this run`. It is context only and is not copied into the new grant. | Correct. |
| `authority.instructed` | Grounded instruction authority; empty in this fixture. It must also be disjoint from `missing`. | Retained by the strict parsed request, but never converted into grant authority by the UI. | Correct. |
| `sentence` | Core-authored explanation generated from `missing`; it therefore names sending only. | Displayed verbatim after strict parsing. It must not reintroduce ungated creation wording. | Correct. |
| `onAllow(request)` | The complete strictly parsed Core request. | `allowRunPermission` reads only `request.missing`, after verifying project, Flow, input, and step-limit identity. | Correct. |
| replacement preflight/grant | A new exact-purpose `explore_and_adapt` authorization. | Receives `permittedConsequences: [send_or_publish]`; no old run id, full consequence list, or legacy broad-side-effect flag is sent. | Correct. |
| high-token continuation | Deferred issue of the same approved authorization. | State retains and reuses the exact one-element missing array. | Correct. |
| no-grant run | There is no explicit LLM run intent/grant to widen. | Request is shown, but `Allow and run again` is absent. | Correct. |

The full declaration is therefore preserved without being mistaken for the approval set. The UI's
`Already allowed` line is also descriptive, not cumulative authority for the next grant. A later
run that needs another gated class must ask for that class rather than silently inherit it.

## Exact failure classification

1. **Line 126, direct rendering:** stale test. The expected creation phrase is absent because
   `create_new` is not in `missing`. The actual send-only approval list plus separately rendered
   already-allowed modify context is correct.
2. **Line 200, second preflight:** stale test. Expected
   `[send_or_publish, create_new]`; actual `[send_or_publish]` is the exact `request.missing` set.
3. **Line 260, high-token grant:** stale test. The deferred grant correctly carries only send; the
   high-token confirmation must not widen it to the full declaration.
4. **Line 304, cut-short run retry:** stale test. Reading the completed run back changes neither
   the request semantics nor least-authority continuation; the new grant correctly carries send
   only.

Because Vitest stops each case at its first failed assertion, the same fixture leaves additional
stale expectations behind those four failures: the approval-list length must be 1 rather than 2;
the direct `onAllow` payload must have `missing: [send_or_publish]`; and the ordinary replacement
grant expectation must use the same one-element array. The assertion excluding
`modify_existing` from the new grant remains valuable and correct.

## Security impact

Current production behavior is the secure behavior. Changing it to grant `request.consequences`,
or to union `authority.granted`/`authority.instructed` into the new grant, would exceed the person's
answer and silently transfer authority from an ended run. Treating `create_new` as missing would
also resurrect the broad permission boundary that the binding rule intentionally removed.

The omission of creation from the approval list is not loss of evidence: it remains in
`request.consequences` and in Core's declaration record. It is simply not represented as something
the person must authorize. The old grant's modify class remains visible as context but is not
carried forward.

## Smallest safe fix

Edit only
`apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx`:

- assert the fixture's full `request.consequences` is
  `[send_or_publish, modify_existing, create_new]`;
- assert `request.missing` is `[send_or_publish]` and `authority.granted` is
  `[modify_existing]`;
- remove the expectation that the approval UI contains the creation phrase and require one
  approval-list item;
- change every `missing`, preflight, issued-grant, high-token, and cut-short retry expectation from
  `[send_or_publish, create_new]` to `[send_or_publish]`;
- retain assertions that already-allowed modify is shown separately, the replacement grant does
  not contain modify, and the execute command carries neither consequences nor an old run id.

No component, continuation command, Core parser, gate, request schema, or production permission
code should change for these failures.

## Focused validation after the test edit

Run the affected UI file, then the nearest Core contract files:

```powershell
pnpm --filter @fluxiq/web exec vitest run `
  src/features/automation-studio/runtime/tests/run-permission-request.test.tsx

pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/action-permissions/tests/gate.test.ts `
  src/programs/automation-studio/runtime/action-permissions/tests/destructive.test.ts
```

Then rerun the complete Core root test gate, because that is where the four web failures were
observed. A production edit would require broader web/Core checks, but this diagnosis finds none.

## Scope

This was a read-only source and test review. No test, check, build, source/shared document,
generated output, run artifact, provider/browser/Lab command, commit, or push was performed. This
report is the only file written.
