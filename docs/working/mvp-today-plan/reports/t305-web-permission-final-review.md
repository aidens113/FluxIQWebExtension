# t305 Web Permission Final Review

Status: **GO — complete contract coverage, no weakened UI/security assertion.**

## Final verdict

The settled t304 diff is test-only and exactly reconciles the stale web expectations with Core's
risk-only permission contract. It preserves the distinction among the action's full declaration,
the one consequence still requiring approval, and prior run authority. It does not weaken an
assertion to accommodate the implementation, remove a security boundary, or change production
behavior.

Changed scope is exactly one Core web test file:

`apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx`

No production source appears in the diff.

## Assertion map

| Required invariant | Final assertion | Verdict |
| --- | --- | --- |
| Full declared context survives the gate/request | `request.consequences` exactly equals `[send_or_publish, modify_existing, create_new]` in Core order. The fixture declaration itself remains unchanged. | GO |
| Risk-only missing subset is distinct from the declaration | `request.missing` exactly equals `[send_or_publish]`. | GO |
| Prior run authority stays context rather than new authority | `request.authority.granted` exactly equals `[modify_existing]`, and the UI still shows it separately as already allowed. | GO |
| Approval UI shows only what is missing | Send/publish text is present, create-new approval text is absent, and the labelled approval list has exactly one item. | GO |
| Direct allow callback returns the authoritative subset | The callback fires once and its parsed request carries `missing:[send_or_publish]`. | GO |
| Ordinary retry preflight is exact-missing | Second preflight matches `permittedConsequences:[send_or_publish]` under the same `explore_and_adapt` purpose. | GO |
| Ordinary replacement grant is least-authority | Issued grant's array exactly equals `[send_or_publish]`; explicit negatives retain both `modify_existing` and `create_new` exclusions. | GO |
| Permission does not leak into execution input | Existing assertion still excludes `permittedConsequences` and old `runId` from the execute command. | GO |
| High-token confirmation cannot widen authority | Confirmed grant retains `highTokenConfirmation:true`, the same purpose, and singleton send permission. | GO |
| Cut-short/read-back transport cannot widen authority | Replacement grant after explicit run-id recovery exactly equals singleton send; new-run identity assertions remain. | GO |
| Refusal/no-grant/input-drift protections remain | Those tests and assertions are untouched: dismiss sends nothing, no-grant offers no allow action, and changed inputs prevent a new grant/run. | GO |
| Strict parsing/malformed-request protections remain | The parser-facing rejection cases are untouched. | GO |

The new fixture comment is also accurate: the old grant *carried* `modify_existing`; this is not
evidence that ordinary modification still requires a grant. Creation and ordinary modification
remain recorded but are not separately gated.

## Security review

The final assertions enforce the safer direction. They would fail if Runtime Debug:

- treated all declared consequences as missing;
- added policy-allowed `create_new` to the person's approval or new grant;
- transferred prior `modify_existing` authority from the ended run;
- lost the singleton permission across high-token confirmation;
- widened authority while recovering a cut-short run; or
- sent permission classes into execution instead of carrying them only on the new grant.

The full declaration has not been deleted from the fixture to make the test pass. That is the key
regression guard: one test simultaneously proves that all three declared effects remain auditable
while only the genuinely missing risk class is displayed and granted.

No additional production or test edit is required for this contract.

## Validation evidence and remaining gate

T304 ran the settled diff and reported:

- affected web file: **1/1 file, 11/11 tests passed**;
- nearest Core permission matrix: **2/2 files, 30/30 tests passed**;
- scoped `git diff --check`: **passed with no output**.

The exact remaining decisive validation gate is the complete Core root suite on this same settled
tree:

```powershell
$env:NODE_OPTIONS='--max-old-space-size=8192'
pnpm test
```

Record exit status, complete totals/skips/duration, and confirmation that
`run-permission-request.test.tsx` passes. The earlier root attempt exposed these four stale web
assertions, so focused 11/11 and 30/30 results do not replace the root rerun. A root failure outside
this file must be classified from its exact output rather than attributed to t304 by proximity.

## Scope

This review read t301–t304 and the exact final test diff. It ran no test, check, build, source or
shared-document edit, generated-output command, run-artifact operation, provider/browser/Lab
action, commit, or push. This report is the only file written.
