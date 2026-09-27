# t286 — Root-suite recovery permission failure diagnosis

Status: **Complete read-only diagnosis**

## Verdict

**Stale test expectation; production behavior is correct.** The final binding rule deliberately
classifies `send_or_publish`, `move_money`, and `delete` as consequences requiring instruction or
grant authority. The failing recovery test still encodes the superseded rule that sending was
ungated. No production permission or patch code should be relaxed to make it pass.

## Exact failure

Core root `pnpm test` failed:

```text
packages/fluxiq/src/programs/automation-studio/runtime/recovery/annotation/tests/patches.test.ts:265
applyAutomationStudioRuntimeRecoveryPatches with the recovery's permission gate
> runs a repair that only makes or sends something, with no grant and the policy withholding side effects
```

The assertion expected `gate.request` to be `undefined`. It instead received a permission request
whose declared consequences were `["send_or_publish", "create_new"]`, whose missing set was
`["send_or_publish"]`, and which had no grant or instructed authority. That received shape is the
required final policy outcome.

## Exact control flow

1. The fixture constructs `recoveryGate([])`. It provides no granted consequences and no
   `instructed` entries; observing the failure packet only permits the request to carry the shown
   control name and does not confer authority.
2. The target-override patch declares `consequences: ["create_new", "send_or_publish"]` and runs on
   the acting, non-proposal path with a permission gate.
3. `applyAutomationStudioRuntimeRecoveryPatches` calls `patchPermission` before executing the
   patch. Its side-effect-permitted preflight succeeds, so the permission decision is meaningful
   rather than a question whose answer could not change execution.
4. `patchPermission` normalizes the declaration to Core order and calls the recovery gate for the
   failed Flow step.
5. `AutomationStudioActionPermissionGate.checkFor` reads no grant or instruction authority, then
   filters the declaration through `automationStudioDestructiveConsequences`.
6. The final exhaustive table in `action-permissions/destructive.ts` marks
   `send_or_publish: true` and `create_new: false`. Therefore the declaration remains fully recorded
   as `["send_or_publish", "create_new"]`, while its permission-relevant missing subset is exactly
   `["send_or_publish"]`.
7. The gate raises the request. `patchPermission` returns `outcome: "required"`; the patch layer
   records a held attempt, executes nothing, creates no adaptation, and stops at the first request.

The behavior is consistent with the final action-permission unit tests, which explicitly prove
that creation stays free while an ungrounded send is refused, and that a send proceeds once grant
or instruction authority covers it.

## Smallest invariant-complete fix

Change only `runtime/recovery/annotation/tests/patches.test.ts`:

1. Rename the failing case to state the current rule, for example:

   ```text
   asks before a repair sends or publishes when no instruction or grant allows it
   ```

2. Replace the stale `gate.request`-is-undefined and permitted/executed assertions with exact
   request/held-patch assertions:

   - request consequences `["send_or_publish", "create_new"]`;
   - missing `["send_or_publish"]`;
   - `permissionOutcome: "required"`, `permissionRequired: true`;
   - `preflightOk: false`, `executed: false`;
   - verification reason `permission_required`;
   - no adaptation or change proposal.

3. Add one adjacent narrow case using only `consequences: ["create_new"]`. Preserve the former
   successful-path assertions there: no request, `permissionOutcome: "permitted"`, clean preflight,
   an executed attempt, and one adaptation despite the legacy side-effect policy flag being false.

4. Update the immediately preceding test comment. It currently groups “makes or sends” as always
   executable. It should say that ordinary creation/editing is ungated, while sending/publishing
   needs standing instruction or grant authority.

Splitting the old mixed declaration is slightly larger than deleting `send_or_publish` from the
fixture, but it is the smallest fix that protects both halves of the final invariant. Merely adding
`send_or_publish` to `recoveryGate` would hide the regression that the root failure correctly
exposed; weakening `DESTROYS` or bypassing the recovery gate would violate the accepted binding
rule.

## Invariants affected

- **Permission boundary:** only `move_money`, `delete`, and `send_or_publish` need authority;
  `create_new` and `modify_existing` remain ungated.
- **Authority source:** the person's active instruction or the run grant can authorize a gated
  consequence. Failure evidence and a policy flag cannot.
- **Truthful declaration:** the receipt retains all declared consequences, while `missing` contains
  only the unauthorized gated subset.
- **No silent side effect:** a recovery patch that would send/publish without authority becomes an
  answerable permission request and does not execute.
- **Ordinary repair remains live:** a create-only recovery is not blocked by the old broad
  `allowExternalSideEffects: false` preflight.
- **First-request stop:** once permission is required, no later patch or adaptation is attempted.

## Focused validation after the test edit

From `F:\!FluxIQ`:

```powershell
pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/recovery/annotation/tests/patches.test.ts
```

Then rerun the complete Core `pnpm test`; t286 diagnoses only this permission failure and makes no
claim about the separately reported DeepSeek bootstrap exploration failure.

No Core/downstream source, shared document, generated output, run artifact, provider/browser/Lab
state, test command, commit, or push was changed or executed. This downstream report is the only
file written by t286.
