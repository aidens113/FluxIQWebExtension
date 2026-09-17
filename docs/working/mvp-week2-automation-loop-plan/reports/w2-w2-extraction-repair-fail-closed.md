# w2-w2-extraction-repair-fail-closed: refuse list-extraction target repairs (D-4, part 1)

## Outcome

Done, including the coordinator's follow-up (recorded Flows).

- **Extraction is refused.** A target repair of a list extraction now gets
  `{ status: "absent", reason: "action_not_repairable" }` before any handle is
  read. That holds whether the extraction was created
  (`web.output.dom-extract_list`) or recorded (`builtin.policy.action` with
  `outputId: "web.dom.extract_list"`). Core's proposal step then creates no
  adaptation and no change proposal, and it records
  `targetOverrideRefusal: { status: "absent", reason: "action_not_repairable" }`.
- **Recorded click and type repairs work again.** The failed action is now
  identified from `failedAction.outputId` when Core provides it, falling back to
  `definitionId` when it is absent. A recorded click or type override resolves
  exactly as the native one does.
- **Proof.** Domain tests drive Core's real
  `proposeAutomationStudioRuntimeTargetOverride`. Core derives `outputId` from
  the recorded node's `parameterValues.outputId`, and the domain accepts the
  click and refuses the extraction.
- **No inert output remains.** The keyed `targets` output is gone, so no
  resolution can be written where nothing reads it.

## What changed and why

`domain/src/runtime/llm-evidence/repairable-parameters.ts`
- `web.output.dom-extract_list` is no longer declared, so
  `webRepairableParameters` returns `[]` for it. `webRepairableParameterFor` is
  now a plain lookup and no longer accepts `item` or `field.<key>` for any
  action.
- Removed the now-unreachable pieces: the `list_item` role (and its branch),
  `isFieldParameterName`, and `LIST_EXTRACTION_DEFINITION_ID`.
- `WEB_REPAIRABLE_ITEM_PARAMETER` and `WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX`
  stay, because the barrel (`index.ts`, not mine) re-exports them. Their doc
  comments now say that no action declares them. See open question 3.
- Hardening: the role lookup uses `Object.hasOwn`. Before, a definition id such
  as `constructor` found an inherited function and was declared repairable.
  Tested.

`domain/src/runtime/llm-evidence/target-override.ts`
- **New `failedActionDefinitionId(failedAction)`**, which decides which node
  definition failed:
  - No `outputId`: use `definitionId`, exactly as before.
  - With `outputId`: map it through the domain's own action vocabulary
    (`WEB_AUTOMATION_ACTION_TYPES` -> `webAutomationOutputNodeId`, the same
    derivation `runtime/host-runtime.ts` and
    `plan-resolution/resolve-plan-node.ts` use). The mapped node is used only
    when the failed node can carry that output: a recorded
    `builtin.policy.action`, or that output's own node.
  - It returns `undefined`, which is refused as `action_not_repairable`, when:
    - the output id is not registered (a vendor id, or a node id passed as an
      output id), or
    - a node of another kind claims an output, for example an extraction node
      claiming `web.dom.click`, or `builtin.llm.prompt` claiming a click. A
      contradiction is refused rather than trusted either way, because trusting
      the wrong half is exactly how an inert repair gets written.
- **Import check.** Created Flows are safe: Core requires a created node's
  `metadata.outputActionId` to equal its definition's
  `outputAction.fixedOutputId`, and the web definitions set that to their own
  action type (`output-nodes/definitions.ts:114`). So a created click reports
  `web.dom.click`, which maps back to `web.output.dom-click`. The new imports
  (`../../actions/types`, `../../output-nodes`) follow
  `resolve-plan-node.ts:36`, and nothing under `output-nodes/` or `actions/`
  imports `llm-evidence`.
- An action with no declared parameters, or an untrusted identity, returns
  `{ status: "absent", reason: "action_not_repairable" }`. The action is judged
  before the target is read.
- Removed the multi-parameter `targets` output (the D-4 writer). The resolver
  always writes the flat `element` fingerprint, and any other resolution is
  refused. No declared action can reach that branch today.
- `WebResolvedRepairTarget` lost `targets`, and `tagName` became required.
  Fields are still written one by one through `present()`, because the
  `contract-spread` rule requires it.

Tests, written to fail first. There were two red rounds, and every failure
was the one intended.
- Round 1: five tests failed; Core reported `preflight.ok === true` for an
  extraction repair.
- Round 2: three tests failed. A recorded click was refused
  `action_not_repairable`, a contradictory click node with a type output
  resolved, and Core refused a recorded click.
- `tests/repairable-parameters.test.ts`:
  - extraction declares nothing, and `item`/`field.*` are found for no action;
  - lookup is by name only;
  - inherited keys are not actions.
- `tests/target-override.test.ts`:
  - **Unchanged refusals:** an invented parameter or a malformed target still
    gets a bare `{ status: "absent" }`.
  - **Undeclared action:** navigate gets `action_not_repairable`, even for a
    malformed target.
  - **Extraction refusal:** refused for every handle shape and for a malformed
    target, as created, recorded, and a contradictory node. The recorded
    fixture now uses the real output id `web.dom.extract_list`; my first round
    wrongly passed a node id there.
  - **Recorded actions resolve by output:** a recorded click
    (`builtin.policy.action` + `outputId: "web.dom.click"`) resolves `named`,
    flat. A recorded type pointed at a button falls back to the one fillable
    control (`inferred`), which proves the output decides the role. A created
    click whose `outputId` agrees resolves.
  - **Refused identities:** policy action with no output, a vendor output,
    `web.browser.navigate`, a node id used as an output id, a click node with a
    type output, and an LLM node claiming a click are all refused.
  - **Flat click on a list row:** still resolves flat, with
    `listIndex`/`listTotal`.
  - **Through Core, extraction:** a created extraction and a recorded one
    (`parameterValues.outputId: "web.dom.extract_list"`) are both refused, with
    no change proposal and the reason recorded.
  - **Through Core, recorded click:** a recorded click
    (`parameterValues.outputId: "web.dom.click"`) passes preflight, carries the
    flat fingerprint, and gets an adaptation and a change proposal.
  - **Through Core, native click:** unchanged.

## Commands run and observed results

All test runs are in `domain/`. The ones with a label wrote to ignored
per-label directories.
- **Baseline** (`DOMAIN_TEST_BUILD_LABEL=w2-w2-baseline node scripts/test-domain.mjs`)
  -> exit 1, `# tests 577 # pass 577 # fail 0`.
  - It also printed `1 of 75 domain test entries failed to load: src/tests/domain.test.ts`
    (`+ [ 'end' ] - []` at
    `bootstrapContext.catalogSelection.missingRequiredTerms`). This was there
    before my change, and it persists unchanged through every run below.
- **Round 1:**
  - red: `# tests 582 # pass 577 # fail 5`;
  - `pnpm check` (in `domain/`): exit 0;
  - green: `# tests 582 # pass 582 # fail 0`.
- **Round 2:**
  - red (`w2-w2-red2`): `# tests 597 # pass 594 # fail 3`, the three intended.
    Other workers' tests had been added in between;
  - `pnpm check` (in `domain/`): exit 0;
  - green (`w2-w2-green2`): `# tests 600 # pass 600 # fail 0`, including
    `tools.test.ts`, which calls the validator through the runtime.
- **Root `pnpm check`** (after round 2) -> exit 0;
  `structure-audit: passed (61 warning(s), 17 baselined)`. Every workspace check
  printed `Done`, and no warning names my files (grep count 0).
- **Tracked `.test-build`** regenerated with `node scripts/test-domain.mjs`
  (no label) -> exit 1, `# tests 600 # pass 594 # fail 6`.
  - All six failures are outside my files:
    - two in `client/tests/gateway-mapping-identity.test.ts` (tests 35 and 37);
    - four in `output-nodes/targets/tests/targets.test.ts` (tests 112, 116, 119
      and 120).
  - Those test files were written at 18:00, and `client/gateway-mapping.ts` and
    `output-nodes/targets/targets.ts` were edited at 18:03, during my run. That
    is the other worker's area.
  - Neither test file imports my modules; they only mention
    `validateWebRuntimeTargetOverrideEvidence` in a comment and hardcode the
    resolved shape.
  - The same `domain.test.ts` load failure appeared again.
- No failure looked like a RAM fault (all were deterministic assertion diffs).
  Scratch builds `domain/.test-build-scratch/w2-w2-*` were deleted.

## Not verified

- No live run and no browser run, as the brief said. The recorded-Flow repair
  cycle (diagnose -> repair -> apply -> replay) was proven only up to Core's
  proposal step, in unit tests. Apply and replay were not exercised.
- Core's recovery annotation path (`patches.ts`) was not driven; only
  `proposeAutomationStudioRuntimeTargetOverride` was called directly.
- The tracked `.test-build` was built from a tree with other workers' in-flight
  edits. Regenerate it at integration.
- Root `pnpm test` and `pnpm build` were not run.

## Open questions or contradictions found

1. **Core's execute path never asks the domain.**
   - Without an explicit proposal grant, `recovery/annotation/patches.ts:98-101`
     sends a `temporary_target_override` to
     `executeAutomationStudioRuntimePatch`.
   - Its preflight never calls `validateTargetOverrideEvidence`, and
     `live-patch.ts:485-489` writes the model's raw `patch.target` (a bare
     handle map) into the node's `parameterValues.target`.
   - This refusal therefore takes effect only on the explicit-proposal-grant
     path. The execute path still needs `allowExternalSideEffects` plus
     authorization under the default repair policy.
   - This needs a Core brief.
2. **Resolved by the follow-up:** the domain now reads `failedAction.outputId`.
   It relies on Core's uncommitted `live-patch.ts:84-92,242-258`. D-1 (a
   persisted repair on a recorded Flow dispatching the stale recorded identity)
   is unaffected by this change and still open.
3. **Barrel leftovers.** `llm-evidence/index.ts:31-32` still exports
   `WEB_REPAIRABLE_ITEM_PARAMETER` and `WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX`,
   and nothing outside tests uses them. Drop them from the barrel, the file and
   the test once someone owns `index.ts`.
4. **Cross-repository dependency.** `reason` and `outputId` exist only in
   F:\!FluxIQ's *uncommitted* `live-patch.ts`, which the domain type-checks
   against through Core's `dist` (built 17:38). If that change does not land,
   the domain fails `tsc`. The coordinator will commit both repositories
   together.
5. **Other refusal reasons.** The domain still names none of Core's other
   refusal reasons (`parameter_not_offered`, `parameter_missing`,
   `target_malformed`, `handle_not_issued`, `handle_incompatible`,
   `handle_ambiguous`, `no_compatible_element`). `evidence_unrecognized` would
   belong in `tools.ts:303-304`. They are out of this brief.
6. **The design document is now stale.** `w2-back-half-design.md` §3 X6
   "What exists" (lines 645-647) and the §7 item near line 890 still say `item`
   and `field.*` are declared repairable.
7. **Pre-existing, not mine.** `src/tests/domain.test.ts` fails to load: the
   bootstrap catalogue reports `missingRequiredTerms: ['end']`.
