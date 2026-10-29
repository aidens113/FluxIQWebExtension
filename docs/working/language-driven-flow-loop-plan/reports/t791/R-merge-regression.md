# R791: site-reset specs fail after t791 merged dev

## Outcome

Done. Dev alone is broken, and the t791+dev combination is not what caused it. The cause is a
semantic clash between t790's Core change and an unchanged downstream description, and it has
nothing to do with t791 or t792. The fix is in the t791 downstream tree only. The headed site-reset
suite passes 31/31 there.

## Cause

Every build ended before its first model turn with
`flow_bootstrap.pre_provider_validation_failed`, `issueCodes: ["thrown.Error",
"thrown.at:runtime.llm.harness-options.registry.ts:139"]` (kept diagnostic `reset-job.json`,
`builderStep: 0`). No model turn ran, so no list read issued a destination ref, and the spec's first
assertion read `destinationReference === ""`.

- `registry.ts:139` (`AutomationStudioHarnessOptionRegistry.register`) throws
  `Invalid Automation Studio harness option "web.detect_repeating_structure":
  harness_option.description_invalid`. Core refuses an option description over 2,000 characters
  (`harness-options/option.ts:121`). The same bound is in `evidence-loop-decision.ts:692` and
  `deepseek/preflight.ts:124`.
- The domain's detection description (`domain/src/runtime/llm-evidence/tools.ts`, the
  `WEB_LLM_DETECT_STRUCTURE_TOOL_ID` tool) included Core's `AUTOMATION_STUDIO_FLOW_CONDITION_RULES`
  in full (the t478 design).
- t790 (Core commit `7bcddb82`, "General membership and dates, ...", merged as `af75768a`) added the
  "Date: ..." sentence (about 640 characters) to those rules in
  `flow-bootstrap/plan/flow-script-format.ts`. That made the rules 1,334 characters and the detection
  description 2,641 characters.
- The existing downstream test `domain/src/runtime/llm-evidence/tests/tools.test.ts` already asserted
  the 2,000 bound and failed on dev with "2641 characters, over Core's 2,000". Merges run only narrow
  checks, and t790's narrow checks were Core-side, so nothing caught it before merge.
- The `action-permissions.ts` merge and the t791 or t792 destination-receipt code are not involved.
  The build never reached them.

## Dev alone

The worktrees were `fxwork/r791-dev/!FluxIQ` (detached at Core dev `e2489248`) and
`fxwork/r791-dev/!FluxIQWebExtension` (detached at downstream dev `97505ce4`). After
`pnpm install --frozen-lockfile` and a build of Core's libraries and the workspace packages:

- The domain `tools.test` failed 1 of 14, with "2641 characters, over Core's 2,000".
- `pnpm test:e2e e2e/site-reset/tests/job-failed-save.spec.ts --workers=1` reported 1 failed. The
  failure was the same assertion at line 125 with the same kept diagnostic
  (`pre_provider_validation_failed`, `registry.ts:139`, `builderStep: 0`).

The first e2e attempt there could not start because `test-contracts/dist` was missing. Building
`./packages/*` and the domain fixed that. I left the worktrees in place for the coordinator to remove.

## What changed and why (t791 downstream tree only)

- `domain/src/runtime/llm-evidence/tools.ts`: the detection description now points at the rules
  instead of including them. The new text is: "What a condition may say is the where rules in the
  submission's flow format: is present or absent, a bound on a number (atLeast, atMost, lessThan,
  greaterThan, equals) or on a date written as text with \"as\": \"date\", or a text test. A quantity
  or a date is always compared with a bound, never a pattern."
  - The rules still reach the model whole. They are in the `flow` description of both submission
    tools (`candidate/authoring-loop.ts:131`, `subflow-candidate/builder-loop.ts:276`), which no
    withdrawal removes.
  - The detection is offered only in build loops. A recovery explores with its own declared options
    (`recovery/annotation/exploration.ts`, `explorationRegistryBinding`), so a submission tool is
    always beside the detection.
  - The date bound is named because a read runs during exploration, before any submission is written.
  - The unused import of the rules was removed, and the comment records why.
- `domain/src/runtime/llm-evidence/tests/tools.test.ts`, in the production-seam bind test:
  - New check: Core's real `automationStudioHarnessOptionRegistry` is built over the bound runtime,
    which is the call that threw in production, and every domain tool must have no
    `automationStudioHarnessOptionIssues`.
  - The detection must be at most 1,800 characters, leaving room for the rules to grow.
  - It must name `"as": "date"`.
  - The t478 assertion that the rules appear whole is reversed: the description must not repeat them
    and must point at them.
- I first wrote the new assertions as a separate test file. The structure audit refused it (an
  `as never` stub, and a 26th file in a directory capped at 25), so I folded the assertions into the
  existing bind test, which already holds the bound runtime.
- Core is not changed. Raising the 2,000 bound would change a provider-facing contract enforced in
  three places, and the rules cannot fit beside the detection's own 1,307 characters.

## Commands run and observed results

- Before the fix, in the t791 tree,
  `DOMAIN_TEST_BUILD_LABEL=r791 node scripts/test-domain.mjs runtime/llm-evidence/tests/tools.test`
  reported pass 13, fail 1, with "2641 characters, over Core's 2,000".
- Before the fix, the new registry check (then a separate file) failed with
  `'Invalid Automation Studio harness option "web.detect_repeating_structure": harness_option.description_invalid'`.
  This is the exact production throw.
- After the fix, `tools.test` plus `harness-options/tests/` reported pass 39, fail 0.
- I restored the HEAD `tools.ts` temporarily: `tools.test` reported fail 1 ("2641 characters"). I then
  put the fixed version back.
- `npx tsc -p tsconfig.test.json --noEmit` in `domain` exited 0.
- `pnpm structure:check` reported "structure-audit: passed (232 warning(s), 616 baselined)".
- `node scripts/check/model-text.mjs` printed "model-text: ok".
- Headed `pnpm test:e2e e2e/site-reset/tests/job-failed-save.spec.ts --workers=1` in the t791 tree
  reported 1 passed (2.0m).
- Headed `pnpm test:e2e e2e/site-reset/tests --workers=1` in the t791 tree reported **31 passed
  (32.2m)**. That was run 1 of 1. Before the fix the same suite was 30 failed, 1 passed (the
  coordinator's run).
- Core `pnpm test src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/service`
  in `packages/fluxiq` exited 1.
  - The parallel group passed: 435 files passed, 1 skipped; 4,284 tests passed, 2 skipped.
  - The real-sql group had 1 failure: `project-build-reset.test.ts` > "a reset brief's requests
    through DeepSeek's own pre-send checks" > "pass from its first decision, and one whose
    completion schema is not its decision schema's still refuses". I did not capture its message.
  - It did not come back on rerun. That file alone passed 10/10. The real-sql group over both
    directories passed 50/50 files (332 tests passed, 1 skipped).
  - I am treating it as intermittent under load. I changed no Core file, and this test has no
    downstream binding.
- `pnpm check` in the t791 downstream tree exited 1. The one failure is
  `scripts/build-cache/tests/check-prefix.test.mjs:41`, which expects the check script's prefix to
  be core-build, core-mirror, test-contracts:build. t793's P0 commit `75b8699e` ("Fail pnpm check
  when Core's model-facing text names a realistic scenario") inserted `node scripts/check/model-text.mjs`
  into the script and did not update that test.
  - This is on dev and unrelated to this fix. I did not fix it because it is outside this brief.
  - It stops `pnpm check` at its `node --test` step, so the structure audit and `pnpm -r check` did
    not run inside it. I ran the structure audit, the domain test typecheck and the model-text check
    separately, and the extension's `tsc --noEmit` runs in every `test:e2e` build. All four passed.

## Not verified

- No live Lab run or model call was made, so I have not checked whether the model writes date
  conditions as well from the pointer as it did from the full text at exploration time. The full text
  is still in the submission format on every turn.
- The fix is not applied in the dev trees. It lands on dev when t791 merges.

## Open questions or contradictions found

- t478's rule that the detection "says that same text ... never a copy" cannot hold together with
  Core's 2,000 bound once the rules exceed about 690 characters. The detection now names the keys
  and points at the full text. The supervisor may want that recorded in the working document.
- Any other domain tool that includes a growing Core text has the same exposure. The new registry
  assertion covers every tool this domain binds.
