# t186-S2 downstream sweep for leftover LLM-call-grant references

## Outcome

Done. I ran the sweep grep (`grep -rn -I -i -E 'grant|lease'` over apps, packages, domain, scripts, docs/architecture and docs/user, with the brief's exclusions), then ran it again with `-a` to catch NUL-containing files. Every hit is classified below. 58 files changed, all left unstaged. I did not touch git state, Core, `docs/working/` (except this report), or the three must-not-touch files.

## What changed and why

Categories: 1 = grant-only code or fixture removed; 2 = consequence permission called a "grant", reworded; 3 = grant history or behaviour narration rewritten or dropped.

### Category 1: removed

- `packages/test-contracts/src/harness-recovery.ts`, `harness-recovery-validation.ts`, `packages/test-runner/src/flow-lane/harness-recovery.ts`, `flow-lane/tests/harness-recovery.test.ts`: removed the **`refusalCause`** member everywhere: contract type, validator key and check, run-detail reader, and test block. Core only ever filled `llmGate.cause` with `automationStudioLlmExecutionGrantRefusalCode` (`llm.execution_grant_no_longer_valid` and its siblings). Core commit a14556c deleted that code, and Core's `annotate.ts` now writes `llmGate` with no `cause`.
- `harness-recovery.ts` (contract) and `tests/harness-recovery-result-route.test.mjs`: removed the refusal `grant_does_not_buy_exploration` from `harnessResultReauthorRefusals`. Core's `AutomationStudioRefutedResultReauthorRefusal` no longer has it. The test's free-text sample is now a grant-free sentence. In `flow-lane/tests/harness-recovery.test.ts` the refused-route fixtures now use `flow_unavailable`.
- `flow-lane/creation/tests/lane.test.ts`: dropped `grantId: payload.llmExecutionGrantId` from the recorded run request and from the expected value.
- `live-llm/tests/live-llm-run.test.ts`: removed `GRANT_ENDPOINTS` and its throw, because the fake already throws on any unknown endpoint. Also removed the absence checks for `granted`/`highTokenConfirmation` (snapshot and repair) and renamed two test titles away from "no grant".
- `live-llm/tests/lane-settlement.test.ts`: removed the `"granted" in written` check and a stale comment.
- `live-llm/tests/live-llm-plan.test.ts`: removed the `"highTokenConfirmation" in byDefault` check.
- `tests/demo-llm-exploration-adaptation.test.ts`: removed two source-grep asserts for `preflight-llm-execution|issue-llm-execution-grant`.
- `demo-llm-create-ui/tests/exploration.test.ts`: removed the source-grep assert for `high-token`.
- `http-control/tests/auth.test.ts`: changed the fixture error "LLM key changed during grant authorization." (a grant-authorization message) to "The Flow has no saved LLM key.".

### Category 2: reworded to permit/permitted/permission

- `flow-lane/creation/lane.ts`, `permission-point.ts`, `tests/lane.test.ts`, `tests/permission-point.test.ts`, `run-scenario.ts`: "without the grant for its act", "the grant lacked/held" became "without permission" and "the run was not permitted / already permitted".
- Scenario catalogs: `auction-marketplace/{live-tasks,manifest}.ts`, `company-website`, `crossborder-marketplace`, `everything-store`, `photo-social`, `professional-network` and `social-network-feed` `live-tasks.ts`, plus `live-instructions.ts` and `tests/live-instructions.test.ts`.
- `identity-drift/{manifest,repair}.ts`: here "grant" meant the run intent (`diagnose_and_adapt`), so it now says "intent".
- `existing-fluxiq-control/adaptation-consequences.ts`: "nobody granted / a granted request" became "nobody allowed / an allowed request".
- `domain/src/runtime/llm-evidence/`: in every hit "grant" meant consequence permission, never an LLM grant. Reworded comments and test titles in `node-run/replay.ts`, `node-run/run.ts`, `node-run/tests/run.test.ts`, `permission.ts`, `plan-resolution/step-permission.ts`, `plan-resolution/tests/plan-step-permission.test.ts` (also renamed the locals `granted`/`byGrant` to `permitting`/`byPermit`), `press.ts`, `tests/press.test.ts`, and `tools.ts`. `tools.ts` contains a NUL byte, so the first `-I` grep skipped it; I edited it byte-safely.
- `docs/architecture/testing-facility.md`: "unless granted" became "unless the run is permitted to move money", and "(needs a grant)" became "(needs `--llm-permit move_money`)".

### Category 3: history or behaviour narration

- `flow-lane/terminal-run-wait.ts`: removed the "Core's lease on a claimed execution grant (`..._MAX_RUN_MS`); grants are gone" text. Also changed "the whole lease" to "the whole bound", and "the grant's lease for a granted run" to "the live-run deadline".
- `flow-lane/tests/terminal-run-wait.test.ts`: "lease" became "the run's bound" in two titles and one comment, and "granted it five seconds" became "gave it".
- `flow-lane/creation/build-proposal.ts`: removed the "old grant's claim window, run lease" history.
- `flow-lane/creation/tests/build-proposal.test.ts`: "run lease" became "build's deadline", and the "No grant id" comment line was dropped.
- `live-llm/flow-settings.ts` and `live-llm-plan.ts`: dropped "used to ride on an execution grant" and the "high-token confirmation threshold of the execution grant".
- `test-contracts/src/llm.ts`: the grant default and grant call-ceiling history is rewritten. `LLM_LAB_MAX_CALLS_PER_RUN` is now described as the Lab's own backstop.
- `test-contracts/tests/llm-contracts.test.mjs`: dropped the "Mirrors Core's ..._EXECUTION_GRANT_MAX_CALLS" comment (those constants no longer exist in Core).
- `test-contracts/src/scenario.ts` and `scenario-lab/.../delayed-ui/scenario.ts`: "the grant `--live-llm` takes out must go unspent" became "no provider call".
- `demo-llm-create-ui/limits.ts`: dropped the "old grant claim window" explanation of the extra 75 s.
- `demo-workspace/exploration-adaptation.ts` (two blocks) and `ui-e2e/topology.ts`: dropped "a model call needs no grant, so there is no grant endpoint".
- `existing-fluxiq-control.ts`: dropped ", and never a grant".
- `apps/extension/src/panel/simple/relay/messages.ts`, `shared/protocol.ts`, `docs/architecture/extension-client.md`: "an LLM grant" became "an LLM run intent", or was dropped because an "LLM intent" was already listed. Core's `program-route.ts` now refuses `runIntent`/`permittedConsequences` for paired tokens.
- `docs/architecture/repository-layout.md`: adversarial runs are "provider-free: it runs without `--live-llm`, so no key is installed" (matches `scripts/lab/adversarial-lane.mjs`), no longer "no grant is issued".
- `docs/architecture/testing-facility.md`: removed the "Nothing is preflighted, issued, confirmed (high-token) or revoked", "with no grant id" and "no longer carries `granted` or `highTokenConfirmation`" text, and the "no preflight and no high-token confirmation" sentence. The bold rule "**Model calls need no grant.**" stays.
- `scripts/lab/live-campaign/lab-run/command.mjs`: dropped "mirrored Core's old execution-grant default".

## Hits deliberately left, and why

- **Current-rule statements** "a model call needs no grant" in `commands.ts`, `persisted-flow-run.ts`, `explore-proposal-ui.ts`, `adaptation-ui.ts`, `demo-llm-create-ui/limits.ts:19`, `adapting-run/tests/run-timeouts.test.ts`, `build-proposal.ts:58`, `live-llm/{authorize-flow,live-llm-plan,live-llm-run}.ts`, `test-contracts/src/llm.ts:107`, `scripts/lab/live-campaign.mjs` and `testing-facility.md:2399`. These state the binding rule rather than narrate grants.
- **Negative asserts on real request payloads sent to Core** (the brief allows these): `"llmExecutionGrantId" in sent[0]` in `flow-lane/tests/persisted-flow-run.test.ts:105` and `"llmExecutionGrantId" in body` in `tests/existing-fluxiq-control.test.ts:284`. The latter's title still says "with no grant", which matches what it asserts.
- **`llm.runtime_patch_grant_scope_refused`** (`tests/existing-fluxiq-control.test.ts:406-408`): Core keeps this code's stored spelling on purpose (`annotate.ts:487`, "run records and the Lab match on it").
- **Core's consequence-permission wire shapes and copy**:
  - `permissions: { granted, instructed, lapsed }` and `authority: { granted, instructed }` in `existing-fluxiq-control.ts` and `flow-lane/tests/harness-recovery.test.ts`.
  - Core's sentence "Neither its instruction nor a grant allows that" in `harness-recovery.test.ts`, `plan-step-permission.test.ts:164` and `test-contracts/tests/harness-recovery-permission.test.mjs:33`. It comes from Core `action-permissions/request.ts`, so Core must change it first.
- **Answer kind `"grant"`/`"deny"`**: Core's conversation answer kinds, used in `apps/extension/src/panel/simple/conversation/{ask-copy.ts, tests/ask-copy.test.ts, tests/controller.test.ts}`. This is a person answering a permission ask, not an LLM grant.
- **ui-e2e journey id `P5 permission_grant_refuse`** (`ui-e2e/journey-selection.ts`): the consequence-permission allow/refuse journey. It is an identifier, so I did not rename it.
- **Domain reason code `consequences_not_granted`** (`tool-rejection.ts`, `press.ts`, `node-run/{run,replay}.ts`, `tests/tool-rejection-detail.test.ts`): a closed contract code meaning consequence permission. Renaming it is a contract change outside this sweep.
- **Unrelated, per brief category 4**:
  - bench campaign leases (`bench/**`), machine slots, and `windows-acl.ts` plus its test.
  - The capability wording "grants X to the verbs" in `content/action-runtime/*` and `content/extraction/index.ts`.
  - Browser and OS permission wording: `browser-download.ts` and its test, `domain/src/recording/{domain.ts, web-state/tab-state.ts}`, `domain/src/tests/domain.test.ts:199`, `docs/user/permissions.md`.
  - Scenario page copy: admin-console, member-directory, support-desk, the social-feed "government grant" ad, and property-listings "leasehold".
  - `clone-source-exporter.ts` ("source write APIs"), `real-site-policy/README.md` ("standing permission"), `web-capabilities.md` (capability and time wording), `testing-facility.md` ACL and bench-lease lines (533, 1777, 1785), and `repository-layout.md:181` bench leases.

## Commands run and observed results

- `npx tsc -p tsconfig.json` in `packages/test-contracts`: exit 0.
- `node --test --test-concurrency=2 tests/harness-recovery-result-route.test.mjs tests/llm-contracts.test.mjs tests/harness-recovery-permission.test.mjs`: `# tests 16 # pass 16 # fail 0`.
- `node --test --test-concurrency=2 tests/harness-recovery*.test.mjs` (all five harness-recovery contract files, because the validator changed): `# tests 23 # pass 23 # fail 0`.
- Post-edit grep for `GRANT_ENDPOINTS|refusalCause|byGrant|granted.request`: no hits. Grep for `llmExecutionGrant|highTokenConfirm|preflight-llm|execution_grant|executionGrant|issue-llm`: only the two payload asserts kept above.

## Not verified

- **test-runner.** None of its changed tests were run and none of it was type-checked. A single test file only runs after `pnpm build` (whole-package tsc into `dist/`), which the brief rules out. The changed files are `harness-recovery.ts`, the `lane`/`permission-point`/`build-proposal`/`terminal-run-wait`/`harness-recovery` tests, the `live-llm` tests, `auth.test.ts`, `exploration.test.ts` and `demo-llm-exploration-adaptation.test.ts`.
- **domain and apps.** Domain and scenario-lab tests were not run either (whole-package builds). Their edits are comments, test titles and local variable renames only.
- **Stored records.** Removing `refusalCause` from `recoveryKeys` means an existing stored record that still carries `refusalCause` would now fail `validateRunHarnessRecovery` as an unknown property. I did not check whether any consumer re-validates old records, for example a campaign comparison over old `test-runs/`.

## Open questions or contradictions found

- Core's `AutomationStudioRefutedResultReauthorRefusal` is now only `not_a_wrong_answer | flow_unavailable`. Downstream still lists `adaptations_not_permitted`, which is not grant-related, so I left it. The lead may want it removed too.
- Core's permission sentence still says "Neither its instruction nor a grant allows that" (`action-permissions/request.ts`), and `gate.ts:11` says the same. That wording needs changing in Core; the downstream fixtures would then follow.
