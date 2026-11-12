# Codex t901 hosted-panel validation

## Scope and current result

Review of Core WIP `11bd1c1a7` and W5's checkpoint and round-8 reports, resumed
2026-11-11. The lead owns git and shared working documents. No paid calls,
panel server or full suite is authorized for this pass.

Outcome: **Done.** The WIP and focused fixes are ready for lead integration under
the required narrow gates; all those gates passed. This is not a fresh review
of every earlier W5 UI file or hosted production-release acceptance. The original
identity/IAM/workspace-key baseline passed. Two regressions proved a stale-read
authorization gap in both case-only username paths, now fixed at mutation time.
Product source is frozen. The lead approved `identity-access/runtime/service.ts`,
`runtime/usernames/recase-error.ts`, its barrel, adjacent tests and documentation
in addition to the original WIP scope. A later approved scope extension carries
the actor's own username through the existing Security sign-in server route and
`features/security/page/SecuritySignInPage.tsx` (the wrapper's actual path).
The independent security reviewer then confirmed a key-consent race, and the
lead approved `runtime/conversations/assistant/model/key-model-source.ts` and
its adjacent test. The final read-only review found no concrete remaining
security issue; the lead also independently repeated the consent file (12/12).

## Findings

- The round-8 workspace-key edit preserves explicit holder offers and workspace
  administrator choice. Both choosers refuse an unoffered key, release requires
  the offer, and withdrawing it prevents further provider calls for others.
- `recase-my-username` validates the case-only condition against a snapshot,
  then writes through `updateUser`. `update-user` likewise exempts a re-case
  from authority delegation based on an earlier snapshot. A concurrent real
  rename can make either approved re-case a different canonical name by the
  time it is written. The new regression interleaves that real rename.
- Both regressions returned `ok: true` on the original WIP. The fix adds a
  server-selected `recase` mode to `updateUser`; the live canonical-name check
  and existing uniqueness check precede its synchronous map mutation. It
  tightens the write and does not grant any additional access. A stale re-case
  receives `identity.recase_not_case_only`, with no other field changed.
- The concurrency guarantee is within one identity-service instance. No new
  cross-process storage transaction or username normalization/migration is
  claimed.
- Hosted members intentionally have no `iam:Snapshot` grant, but the WIP showed
  the new self-service UI only after that broader read succeeded. The route now
  supplies only its authenticated actor's username, and the control remains
  available when the identity-list read is refused. It still submits only
  `{ username }`, with identity derived from the server actor. No identity-list
  grant or another person's profile is added. A second UI regression protects
  an in-progress draft while the broader read finishes with a refusal.
- The independent reviewer found that a returned assistant model captured
  `resolveAssistant()` once for the whole turn. Its lower key-release helper
  checks the holder/unlock/key but has no workspace offer or choice state.
  Six regressions proved that withdrawing an offer, clearing/changing the key
  choice, changing provider/model, or withdrawing during reveal still reached
  the fake provider. The model source now re-resolves the live choice and
  consent before and after each asynchronous release, refusing a changed
  key/provider/model/holder and preserving the named consent reason or typed
  lock through the provider error wrapper. No other key is tried and no real
  provider is used by these tests.

## Whole-lane readiness basis

This resume reviews the WIP and the focused fixes above. It does **not** claim a
fresh code review or full acceptance run over the entire W5 branch (614 changed
files versus dev before this resume). The previous checkpoints provide the
following historical evidence:

| Work | Latest relevant recorded acceptance | What remains unverified now |
| --- | --- | --- |
| Brand theme, Data, Security, rehomed tools, presets, welcome and accessibility | Checkpoint 6 production e2e: read-only 98 passed; assistant 3; Flows 5; data-collection 6 plus 1 expected skip; task-automation 7 | No fresh production e2e after checkpoint 7 key controls and the WIP sign-in changes; no human browser validation |
| Dock's project/panel threads, attachments, rename/delete, choice and open asks | Checkpoint 6 chat-widget rerun: 15 passed after a spec-only drawer fix, using the current production build | The shared list still uses project-name prefixes instead of actual groups; no fresh browser rerun in this resume |
| Identity, authority, offered/chosen keys and locked-key message | Checkpoint 7: identity/key set 37 files / 364 passed; fluxiq and web typechecks passed. Round 8: assistant/key set 41 files / 328 passed | Current affected non-browser gates are recorded below; real multi-tenant service and primary reload concurrency were not exercised |
| Image, Compose, Caddy, manual/disabled deploy workflow and self-hosting guide | Checkpoint 1 static YAML/shell checks; the later build-cache registry suite cleared 11/11 | Docker image build/run, Caddy, Compose runtime and deployment were never exercised; no deployment target is configured and the job remains disabled |
| Accounts, invitations, audit | Prior route/unit acceptance and welcome e2e; the route audit and account delegation decisions are documented in the W5 report | No real email delivery; production glue and non-primary tenant isolation remain mocked or unexercised |

Additional report limits: there is no task-settings surface in the hosted panel;
Flow settings use the shared humanness control. Legacy names differing only by
case are not migrated; writes cannot create a new collision, but existing
duplicate-name sign-in behavior remains documented. Snapshot owner-lookup cost
and two-process identity/storage behavior have not been measured here. The
round-7 worker report's claim that default-key selection accepts an unoffered
key is superseded by the committed chooser refusal and the round-8 regression.

## Package versions

The lead approved minor bumps under the global feature-version policy:
`@fluxiq/contracts` 0.19.0 -> 0.20.0 and `fluxiq` 0.45.0 -> 0.46.0. These are the
only published packages with branch source changes versus dev. UI components,
SDK and client-gateway-websocket have no branch source diff; web is private.
The two owning manifests were updated. Internal references use `workspace:*`
and lockfile `link:` entries, so no lock or internal version edit is needed.
No package publishing occurred.

## Validation observed

- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run codex-t901 -- "pnpm --filter fluxiq exec vitest run src/programs/identity-access src/platform/iam/predefined src/programs/automation-studio/api/panel-assistant/tests/workspace-key.test.ts --no-file-parallelism"`
  -> 23 files, 213 tests passed on the unchanged WIP (112.49 seconds).
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run codex-t901 -- "pnpm --filter fluxiq exec vitest run src/programs/identity-access/api/tests/recase-my-username.test.ts -t 'refuses a stale re-case' --no-file-parallelism"`
  -> 2 failed / 11 skipped before the fix, as intended (12.52 seconds). Both
  received `ok: true` instead of the required named refusal.
- The same isolated regression command after the fix -> 2 passed / 11 skipped
  (9.66 seconds).
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run codex-t901 -- "pnpm --filter fluxiq exec vitest run src/programs/identity-access/api/tests/authority-held-elsewhere.test.ts src/programs/identity-access/api/tests/own-name-recase.test.ts src/programs/identity-access/api/tests/username-case.test.ts src/programs/identity-access/runtime/usernames src/platform/iam/catalog src/programs/_shared/assistant/tests/catalog.test.ts src/programs/secret-keys/api/tests/key-offers.test.ts src/programs/secret-keys/api/tests/workspace-choices.test.ts src/programs/secret-keys/api/tests/member-model-access.test.ts src/runtime/conversations/assistant/model/tests/key-model-source.test.ts --no-file-parallelism && pnpm --filter @fluxiq/contracts exec vitest run src/platform/model-keys src/iam --no-file-parallelism"`
  -> Core 12 files / 86 passed (89.46 seconds); contracts 8 files / 95 passed
  (4.22 seconds). The generated IAM action lists/catalog are current.
- Lead-reported independent run (not re-run here): API re-case and runtime
  service-usernames files -> 25/25 passed after the mutation guard.
- `pnpm.cmd --filter fluxiq exec vitest run src/runtime/conversations/assistant/model/tests/key-model-source.test.ts --no-file-parallelism`
  -> before fix, 6 new tests failed / 6 existing passed (37.44 seconds); every
  stale-choice case made a second fake provider call and the in-flight revoke
  case made a fake call when zero was required. After the fix, 12/12 passed
  (27.16 seconds), with no provider call under revoked/changed consent.
- `pnpm.cmd --filter fluxiq exec vitest run src/platform/iam/audit src/platform/iam/authorize src/programs/_shared/iam src/programs/_shared/tests/api-iam-escalation.test.ts src/programs/automation-studio/api/panel-assistant/tests/workspace-key.test.ts --no-file-parallelism`
  -> 12 files / 82 passed on final source (80.77 seconds), including zero
  cross-user escalations through the live registry and the workspace-key
  offer/choice/withdrawal paths under the new per-release consent checks.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run codex-t901 -- "pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build"`
  -> all three prerequisite libraries built successfully on final source.
- `pnpm.cmd --filter @fluxiq/web exec vitest run src/features/security src/features/settings-page/model src/features/settings-page/ui/tests/AiKeysSection.test.tsx src/features/settings-page/ui/tests/AssistantModelSection.test.tsx src/app/api/programs src/app/api/accounts src/app/api/security 'src/app/(panel)/security/sign-in/tests' --no-file-parallelism`
  -> 43 files passed / 1 failed; 402 passed / 2 failed (404 total, 188.22 seconds).
  The two failures were the WIP's new Flow endpoints sharing the loop's old
  conversation-response mock. The correct route shaper returned `{ flow: null }`
  because that mock contained no Flow. The test now provides a positive full
  Flow fixture and requires exactly its id/humanness, stripping inputs/defaults,
  variables, model/check authorization and caller context. No product code or
  authorization assertion was changed.
- `pnpm.cmd --filter @fluxiq/web exec vitest run 'src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts' --no-file-parallelism`
  -> 77/77 passed after the fixture correction (57.30 seconds). The other 327
  tests in the initial affected set passed and were not needlessly repeated.
  The own-sign-in component's 11 tests and server-route's 2 tests pass, including
  denied-snapshot access and keeping the draft while the read is refused.
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run codex-t901 -- "pnpm --filter @fluxiq/contracts check && pnpm --filter fluxiq check && pnpm --filter @fluxiq/web check"`
  -> all three package typechecks passed, exit 0, on final source.
- `pnpm.cmd --filter fluxiq exec vitest run src/programs/_shared/assistant/tests/generated-module.test.ts --no-file-parallelism`
  -> 2/2 passed; the generated assistant-tool module is current (73.97 seconds).
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run codex-t901 -- "pnpm structure:check"`
  -> exit 0, `structure-audit: passed (543 warning(s), 916 baselined).`
- `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run codex-t901 -- "pnpm docs:reference && node scripts/docs-reference.mjs --check"`
  -> exit 0. Generator: `Wrote docs/reference/framework-reference.md and packages/fluxiq/docs/reference/framework-reference.md (809 public declarations).`
  Freshness: `Deterministic framework reference is current.`
- `git diff --check` -> exit 0 after the fix (line-ending warnings only).

The initial `node scripts/docs-reference.mjs --check` was launched without the
heavy coordinator before its TypeDoc memory cost was recognized. It completed
with the expected stale-reference failure. The lead approved owning-generator
regeneration; subsequent heavy jobs wait for the 2.5 GiB floor and use a slot.
The lead clarified that small mocked unit runs are outside the heavy-run floor;
they run one file at a time. A temporary inline guarded launcher first hit a
PowerShell/bash quoting error before running any test. Its corrected version
waited for memory; only that waiting process tree was cancelled on the lead's
instruction, and the proof above then ran serialized. No useful test, paid run
or panel server was stopped.

The last docs preflight initially read 2.09 GiB. The lead permitted a narrow
documentation-only exception based on the earlier estimated footprint (about
1 GiB of shared free-memory movement, not an isolated peak measurement), while
requiring serialization with t906. `click_readiness` let its build finish
naturally and held its next browser launch. Actual docs start preflight was
2.93 GiB, above the normal 2.5 GiB floor, so that conditional exception was not
needed. Only the two required docs commands ran in that gap.

## Files changed in this resume

Core paths (the two reference copies are both tracked and generator-owned):

```text
apps/web/src/app/(panel)/security/sign-in/page.tsx
apps/web/src/app/(panel)/security/sign-in/tests/page.test.tsx
apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts
apps/web/src/features/security/page/SecuritySignInPage.tsx
apps/web/src/features/security/sign-in/IdentityAccessLive.tsx
apps/web/src/features/security/sign-in/tests/your-sign-in.test.tsx
docs/architecture/package-boundaries.md
docs/architecture/platform.md
docs/reference/framework-reference.md
packages/contracts/package.json
packages/fluxiq/docs/reference/framework-reference.md
packages/fluxiq/package.json
packages/fluxiq/src/programs/identity-access/api/handlers.ts
packages/fluxiq/src/programs/identity-access/api/tests/recase-my-username.test.ts
packages/fluxiq/src/programs/identity-access/runtime/service.ts
packages/fluxiq/src/programs/identity-access/runtime/tests/service-usernames.test.ts
packages/fluxiq/src/programs/identity-access/runtime/usernames/index.ts
packages/fluxiq/src/programs/identity-access/runtime/usernames/recase-error.ts
packages/fluxiq/src/programs/identity-access/runtime/usernames/refuse-taken-username.ts
packages/fluxiq/src/runtime/conversations/assistant/model/key-model-source.ts
packages/fluxiq/src/runtime/conversations/assistant/model/tests/key-model-source.test.ts
```

Extension: this report,
`docs/working/mvp-launch-plan/reports/codex-t901.md`.
The lead's shared Core working document/index edits are not worker changes and
were left intact. No git mutation was run by this worker.

## Not verified

No required scoped gate remains pending. No full suite, new production/browser
e2e, paid/provider network call, panel server, deployment or publishing was run
in this resume. The historical W5 deployment/container, real-email,
non-primary-tenant and human-browser limits listed above remain. The lead owns
integration, commit/push and the shared working-document state; this worker
performed no git mutations. `click_readiness` was notified that both docs
commands finished and its heavy/browser hold could end.

## Lead independent acceptance

- `pnpm --filter fluxiq exec vitest run src/programs/identity-access/api/tests/recase-my-username.test.ts src/programs/identity-access/runtime/tests/service-usernames.test.ts --no-file-parallelism` -> 25 passed.
- `pnpm --filter fluxiq exec vitest run src/runtime/conversations/assistant/model/tests/key-model-source.test.ts --no-file-parallelism` -> 12 passed, including all six reproduced consent regressions.
- `pnpm --filter @fluxiq/web exec vitest run src/features/security/sign-in/tests/your-sign-in.test.tsx "src/app/(panel)/security/sign-in/tests/page.test.tsx" --no-file-parallelism` -> 13 passed.
- `pnpm --filter @fluxiq/web exec vitest run "src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts" --no-file-parallelism` -> 77 passed (72.11 s).
- Reviewed the independent security resolution and the owning generator's six public-declaration additions. Core follow-up committed as `966b45ad7`; dev integration remains the lead's next step. These scoped checks do not claim a fresh production-browser run or a full sweep of the older W5 branch.
