# t288 Permission-Test Invariant Review

Date: 2026-09-26
Repository reviewed: `F:\!FluxIQ` (read-only)
Outcome: **Stale test expectation; product permission behavior is correct.**

## Exact failure

The failing case is `runtime/recovery/annotation/tests/patches.test.ts`, **"runs a repair that only
makes or sends something, with no grant and the policy withholding side effects"**. It declares:

```text
["create_new", "send_or_publish"]
```

with no granted or instructed authority. At line 265 the test expects `gate.request` to be
undefined. The actual value is a permission request for action `recorded.press` / verb `press`,
control `Add to queue`, full declared consequences `[send_or_publish, create_new]`, missing
`[send_or_publish]`, and empty granted/instructed authority.

## Invariant verdict

The actual result is the required risk-only boundary:

- `move_money`, `delete`, and `send_or_publish` require an instruction or grant;
- `create_new` and `modify_existing` do not;
- a declaration retains all declared classes for audit, while `missing` contains only gated classes
  for which authority is absent.

`destructive.ts` encodes exactly that complete five-class decision table and explicitly describes
communicating or publishing on the person's behalf as gated. The test's phrase "makes or sends"
incorrectly combines one ungated class with one gated class. An instruction can authorize the send,
but this fixture supplies neither an instructed consequence nor a grant.

The received request is also internally precise: `create_new` remains in `consequences` but not in
`missing`; only `send_or_publish` blocks execution. Weakening product code to satisfy the old
expectation would let an uninstructed recovery publish or communicate on the person's behalf and
would violate the binding MVP rule.

## Patch-outcome contract

`applyAutomationStudioRuntimeRecoveryPatches` checks every acting target override/action sequence
through the recovery permission gate. For a `required` outcome it:

1. appends a held attempt with `executed:false`, `preflightOk:false`, the full declared consequence
   set, the missing gated set, and permission-required verification;
2. stops at the first request rather than trying later patches;
3. returns no adaptation or change-proposal id.

That contract makes the failing test's later success expectations stale as well: the correct result
has no executed trace and `adaptationIds`/`changeProposalIds` remain empty. This is not a patch-
application defect.

## Closest consistent tests

- `action-permissions/tests/destructive.test.ts` pins `send_or_publish` as gated while
  `create_new`/`modify_existing` are not.
- `action-permissions/tests/declared.test.ts` preserves `[send_or_publish, create_new]` in the
  declaration and permits it only when both needed authority conditions are satisfied.
- `action-permissions/tests/gate.test.ts` proves missing lists contain only unauthorized gated
  classes.
- `recovery/annotation/tests/recovery-permissions.test.ts` proves a `create_new`-only repair runs
  with no grant despite policy side-effect withholding, while an unauthorized gated class produces
  a request and no adaptation.
- Adjacent `patches.test.ts` cases already prove unauthorized money/delete are held and granted
  delete is permitted.

Together these make the single make/send expectation the outlier.

## Smallest safe fix

Update only the failing test and its misleading comments to assert the existing correct behavior:

- rename it to state that an uninstructed send/publish repair is held even when it also creates;
- assert the request has full consequences `[send_or_publish, create_new]` and
  `missing:[send_or_publish]`;
- assert the attempt is `permissionOutcome:"required"`, `executed:false`, `preflightOk:false`, and
  records the same full/missing sets;
- assert no adaptation or change proposal is returned.

No production change is warranted. A second create-only test is not required for minimum closure
because `recovery-permissions.test.ts` already exercises that exact no-grant, policy-withheld path;
adding a local `create_new`/`modify_existing` permitted case is acceptable if maintainers want the
two halves adjacent, but it is redundant rather than a release blocker.

## Regression scope

After editing the test, the narrow safe matrix is:

```powershell
pnpm --filter fluxiq exec vitest run `
  src/programs/automation-studio/runtime/recovery/annotation/tests/patches.test.ts `
  src/programs/automation-studio/runtime/recovery/annotation/tests/recovery-permissions.test.ts `
  src/programs/automation-studio/runtime/action-permissions/tests/destructive.test.ts `
  src/programs/automation-studio/runtime/action-permissions/tests/declared.test.ts `
  src/programs/automation-studio/runtime/action-permissions/tests/gate.test.ts
```

Then rerun the previously failing root test gate. The separate deadline failure reported elsewhere
is outside t288's scope and receives no classification here.

No test, build, source/shared-document edit, generated-output command, or live action was performed.
This report is the only file written.
