# w2-w2-extraction-repair-fail-closed: refuse list-extraction target repairs (D-4, part 1), then make recorded repairs work

## Outcome

Done, in three rounds: the brief, and the coordinator's two follow-ups.

1. **Extraction repairs are refused.** A target repair of a list extraction
   (created, or recorded as `builtin.policy.action` + `web.dom.extract_list`)
   is refused with `action_not_repairable` before any handle is read. Core then
   creates no adaptation and no change proposal.
2. **Recorded Flows are repairable again.** The failed action is identified
   from `failedAction.outputId` when Core provides it. A recorded click or type
   repair resolves exactly as a native one does.
3. **The investigation's domain diff is merged**
   (`w2-renamed-repair-rejected.md`):
   - every refusal now names a reason from Core's closed list;
   - a packet the domain did not issue is refused as `evidence_unrecognized`;
   - the failure packet names the parameter a repair fills (`element`). The
     investigation found a live repair is refused without it.

**The live path, checked offline.** An offline probe used Core's real failure
sanitizer and Core's real proposal step, on the Chromium capture of the
renamed-Save page, captured through the real runtime. It showed:
- the packet is 2935 bytes with 20 elements, the same as the investigator
  measured;
- `repairParameters` survives Core's sanitizer;
- a recorded click naming `target.2` is proposed, resolved to "Apply changes";
- a wrong key is refused as `parameter_not_offered`;
- a foreign packet is refused as `evidence_unrecognized`;
- an extraction is refused as `action_not_repairable`, with no proposal.

## What changed and why

All changes are under `domain/src/runtime/llm-evidence/`.

`repairable-parameters.ts`: which parameters a repair may re-point, and which
action failed.
- **List extraction is no longer declared** (D-4). `item`/`field.*` are
  accepted for no action. The unreachable `list_item` role and the field-name
  helper are removed. `WEB_REPAIRABLE_ITEM_PARAMETER` and
  `WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX` are deleted, here and from the barrel
  (`index.ts`); nothing outside tests used them.
- **Each declared parameter carries a `description`.** It is the text the
  failure packet shows the model, the investigator's live-proven wording:
  "the target handle of the one element the failed action should act on
  instead".
- **`webFailedActionDefinitionId(failedAction)`** (moved here from
  `target-override.ts`, so the capture and the check share one rule):
  - without an `outputId`, the definition id is used;
  - with one, it is mapped through `WEB_AUTOMATION_ACTION_TYPES` ->
    `webAutomationOutputNodeId`, but only for a `builtin.policy.action` node or
    that output's own node;
  - an unregistered output id, a node id passed as an output id, or a node
    claiming another node's output returns `undefined`, which is refused.
  - Created Flows are consistent with this: Core requires
    `metadata.outputActionId` to equal the definition's `fixedOutputId`, which
    is the action type (`output-nodes/definitions.ts:114`).
- **New `webFailureRepairParameters(failedAction)`** decides what the failure
  packet offers:
  - **Recorded action with no output named:** `{ element: <description> }`.
    Core's capture request names no output, so the verb is unknown there; the
    check, which Core does tell the output, refuses what does not apply. This
    is the live case, and matches the investigator's change.
  - **Any other action:** exactly its declared parameters, so `{}` for a list
    extraction, a navigate, or a non-web node. See deviation 2.
- **`Object.hasOwn` guard** on the role lookup, so inherited keys such as
  `constructor` are not actions.

`target-override.ts`: every refusal names its reason.

| Refusal | Reason |
| --- | --- |
| Action with nothing to re-point, or an untrusted identity | `action_not_repairable` |
| Target is not a handle map | `target_malformed` |
| Invented parameter | `parameter_not_offered` |
| Required parameter unnamed, including an empty handle map | `parameter_missing` |
| One handle named twice in the packet | `ambiguous` + `handle_ambiguous` |
| No compatible element | `absent` + `no_compatible_element` |
| Several candidates, and the handle named something incompatible | `ambiguous` + `handle_incompatible` |
| Several candidates, and the handle was never issued | `ambiguous` + `handle_not_issued` |
| Unreachable guard: a resolution other than the single `element` | `action_not_repairable` |

- The multi-parameter `targets` output (the D-4 writer) is gone, and the
  resolver writes only the flat `element` fingerprint.

`sanitize.ts`: the failure packet names its repair parameters.
- **New field.** The packet type gains
  `repairParameters?: Record<string, string>`, and the options gain
  `failedAction.repairParameters`. The field is named in the `present()`
  literal, so the packet's key set stays exhaustive.
- **When it is written.** `markFailedTarget` writes a copy before the trim, so
  the bytes it costs are inside the budget. An empty map is written too; it
  says "nothing to re-point".
- **How it is copied.** By spreading a named value, which the
  `contract-spread` rule allows.
- **Trim order.** `repairParameters` is the last droppable field: after the
  page facts, before the last element.

`tools.ts`: three exact-match edits made through a byte-safe Node script. The
NUL byte count was 1 before and 1 after, and `diff --text` showed only these
three changes.
- a new import of `webFailureRepairParameters`;
- the failure capture now passes
  `failedAction: { repairParameters: webFailureRepairParameters({ definitionId }) }`;
- `validateTargetOverrideEvidence` refuses a wrong schema version or a
  non-array `elements` as `evidence_unrecognized`.

### Where I departed from the investigator's diff, and why

1. **One shared identity rule.** It lives in `repairable-parameters.ts` and is
   used by both the capture and the check, instead of a constant in `tools.ts`.
2. **The packet names exactly what the failed action declares.** The
   investigator named `element` on every failure. I name it only where the verb
   is unknown (a recorded action) or declared, and give `{}` for an action known
   to offer nothing, so an extraction failure does not invite a repair that is
   always refused. The live recorded path is unchanged.
3. **An empty handle map is `parameter_missing`, not `target_malformed`.** An
   empty map is a map; what is wrong with it is that it leaves `element`
   unnamed.
4. **The unreachable guard is `action_not_repairable`, not
   `parameter_not_offered`.** The parameters would be offered; they just cannot
   be written anywhere that is read.
5. **`repairParameters` can be dropped, but only last.** The investigator's
   version could never be dropped. Under a tiny budget that would throw and lose
   the whole failure capture; now it is dropped only when it cannot fit beside
   even one element.
6. **The shared contract is unchanged:**
   - `FailedAction.outputId?` is read, and nothing more is required of it;
   - `reason?` values all come from Core's closed list;
   - the domain never returns `domain_check_unavailable`.
   - Core's `dist` (rebuilt 18:28) includes that value, and the domain
     type-checks against it.

### Tests

All written to fail first. Round 3's red run:
- **Build errors** (expected before the new functions existed):
  `repairable-parameters`, `renamed-save-override` and
  `packet-carries-no-selector` would not build, with
  "No matching export ... webFailureRepairParameters / webFailedActionDefinitionId".
- **Per-test failures**, bundled separately:
  - `target-override`: 6 of 19 failed (every new reason);
  - `tools`: 2 of 13 failed (the packet names `element`;
    `evidence_unrecognized`);
  - `sanitize`: 3 of 17 failed (`repairParameters` written, `{}` written, and
    budget behaviour).

What the new and changed tests cover:
- `tests/repairable-parameters.test.ts`: descriptions, identity mapping
  (including every refusal case), and `webFailureRepairParameters` for
  created, recorded, extraction, navigate and non-web actions.
- `tests/target-override.test.ts`: one test per reason, plus the round 1 and
  round 2 extraction and recorded-action tests.
- `tests/repair-proposal.test.ts` (new): the tests that drive Core's
  `proposeAutomationStudioRuntimeTargetOverride`, moved out of
  `target-override.test.ts`, which had reached 434 lines against the 400-line
  advisory limit (now 315).
- `tests/sanitize.test.ts`: `repairParameters` is copied, `{}` is kept, no map
  means no field, and budget behaviour.
- `tests/tools.test.ts`:
  - the capture offers `element` for `web.output.dom-click` and
    `builtin.policy.action`, and `{}` for an extraction or a navigate;
  - `evidence_unrecognized` for a v1 packet, a non-array `elements`, a bare
    schema, and `{}`.
- `tests/renamed-save-override.test.ts`:
  - the fixture packet now mirrors the recorded capture, with
    `repairParameters` and at most 3000 bytes;
  - a recorded-click identity resolves the renamed Save;
  - reasons `handle_not_issued`, `handle_incompatible` and
    `parameter_not_offered`.
- `tests/packet-carries-no-selector.test.ts`: a marked failure packet that
  names its repair parameters still leaks no selector. `failedTarget*`,
  `repairParameters` and `element` were added deliberately to the allowed key
  set.

## Commands run and observed results

Round 3 (rounds 1 and 2 are summarised at the end):
- **Red run:** a scratch esbuild of three test files, run with `node` ->
  `target-override # fail 6`, `tools # fail 2`, `sanitize # fail 3`. The other
  three files hit esbuild "No matching export" errors, as listed above.
- **`pnpm check` (in `domain/`)** -> exit 0, both after the implementation and
  after the test split.
- **Domain tests**
  (`DOMAIN_TEST_BUILD_LABEL=w2-w2-green3 node scripts/test-domain.mjs`) ->
  **exit 0**, `# tests 613 # pass 613 # fail 0`. No entry failed to load: the
  earlier `domain.test.ts` failure is fixed by the other worker. After the
  split (`w2-w2-green4`) the result was the same: exit 0, 613 of 613.
- **Root `pnpm check`** -> exit 0;
  `structure-audit: passed (60 warning(s), 17 baselined)`, and every workspace
  check printed `Done`. The only `llm-evidence` warning is the existing
  `vocabulary.ts` "10 exported values" warning, a file I did not touch.
- **Extension tests**
  (`EXTENSION_TEST_BUILD_LABEL=w2-w2-ext node scripts/test-extension.mjs`, in
  `apps/extension`) -> exit 0, `# tests 652 # pass 652`. I ran them because an
  extension test bundles this runtime.
- **Offline probe.** A scratch bundle combined the real
  `createWebAutomationLlmEvidenceRuntime`, Core's source
  `sanitizeAutomationStudioLlmFailureEvidence`, Core's `dist`
  `proposeAutomationStudioRuntimeTargetOverride`, and the investigator's
  renamed-Save fixture. Observed:
  - recorded capture: `domain bytes 2935`, `core bytes 2935`, `elements 20`;
  - `repairParameters` after Core's sanitizer:
    `{"element":"the target handle of the one element ..."}`;
  - recorded click through Core: `true`, target `tagName: button`,
    `accessibleName: Apply changes`, selector hint present, `proposal: true`;
  - wrong key: `false {"status":"absent","reason":"parameter_not_offered"}`,
    with the issue "... the target names a parameter the failed action does not
    offer (parameter_not_offered).";
  - foreign packet: `false {"status":"absent","reason":"evidence_unrecognized"}`;
  - extraction: repair parameters `{}` after Core's sanitizer; through Core,
    `false {"status":"absent","reason":"action_not_repairable"}`,
    `proposal: false`.
- **Tracked `.test-build`** regenerated with `node scripts/test-domain.mjs`
  (no label) -> exit 0, `# tests 613 # pass 613 # fail 0`.
  - Untracked bundles now include my new `tests/repair-proposal.test.mjs`, and
    another worker's `plan-resolution/tests/plan-node-identity.test.mjs`.
- **Cleanup.** Scratch builds (`domain/.test-build-scratch/w2-w2-*`,
  `apps/extension/.test-build-scratch/w2-w2-ext`) were deleted. The copy of
  `tools.ts` from before my edit is kept at
  `<scratchpad>/w2-w2-tools.ts.before`.
- **Rounds 1 and 2:**
  - round 1: red 5 failures, then green 582 of 582;
  - round 2: red 3 failures, then green 600 of 600;
  - root `pnpm check` exit 0 both times.
- **RAM faults.** No failure looked like one.

## Not verified

- **Live runs.** None of the merged code has run against DeepSeek.
  - The investigator's live run 2 used an equivalent change for the recorded
    path: `element` offered, reasons named.
  - The `{}` offer for a known non-repairable failure has not run live.
- **Apply and replay** of a recorded repair. Only the proposal step was
  exercised.
- **Core's recovery annotation path** (`patches.ts`) was not driven; the probe
  called Core's proposal function directly.
- **Root `pnpm test` and `pnpm build`** were not run.
- **The tracked `.test-build`** includes bundles of other workers' in-flight
  files. Regenerate it at integration.

## Open questions or contradictions found

1. **Core's execute path never asks the domain.** Without an explicit proposal
   grant, `recovery/annotation/patches.ts:98-101` executes a target override
   whose preflight never calls `validateTargetOverrideEvidence`, and
   `live-patch.ts:485-489` writes the raw `patch.target`. None of these domain
   refusals apply on that path. This needs a Core brief.
2. **Core's capture request names no output.**
   `recovery/annotation/annotate.ts:170-181` sends only `attemptId`, `nodeId`,
   `definitionId`, `status` and `route`. So a recorded action's packet offers
   `element` even when its output turns out to be an extraction or a navigate,
   and only the check refuses it. If Core passed `outputId` there too, the
   domain could offer exactly what the action declares, by adding one optional
   field to `WebLlmFailureEvidenceRequest.failedAction`.
3. **Contract dependency.** The domain relies on Core's still-uncommitted
   `live-patch.ts` (`outputId?`, `reason?`, the reason list). The coordinator
   will commit both repositories together.
4. **The design document is stale.** `w2-back-half-design.md` §3 X6
   (lines 645-647) and the §7 item near line 890 still say `item`/`field.*`
   are declared repairable.
5. **`vocabulary.ts` advisory warning.** It has 10 exported values, over the
   advisory limit of 8. It predates this work and was not touched.
