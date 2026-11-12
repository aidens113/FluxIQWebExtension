# w5-rehome-programs (lane t901, W5 P4 correction)

## Outcome
Partial. Every function of every retired `/programs/<id>` page now has a home in the panel shell, and each redirect goes to that exact home. The restored view code is the HEAD code moved to new locations, not rewritten. Two things are outside my paths and are still open:
1. Three `/programs/secret-keys` links remain in `features/automation-studio/settings/FlowSettingsView.tsx`, and the onboarding card link comes from Core's `packages/fluxiq/src/platform/panel/onboarding/panel-onboarding-cards.ts`. Both reach `/security/keys` through the redirect.
2. One acceptance test fails because of the parallel worker's Activity change, not this work.

## Where each function lives now
| Retired page | Function | New home | Redirect |
| --- | --- | --- | --- |
| secret-keys | list, search, filter by type and status, key detail | `/security/keys` (`SecretKeysLive`, unchanged) | `/programs/secret-keys` -> `/security/keys` |
| secret-keys | add (two steps: describe, then password+PIN; 2FA not needed, as before) | `/security/keys` | same |
| secret-keys | edit metadata, scope and scope reference (domain/flow catalog), enable/disable | `/security/keys` | same |
| secret-keys | rotate (replace) value; delete; each with the same password/PIN/2FA confirmation | `/security/keys` | same |
| secret-keys | unlock keys and paired browsers (`#unlock` ticket read from the address) | `/security/keys` | same (browser keeps the hash) |
| secret-keys | reveal for 30 s with copy, same modal and auto-hide; nowhere else shows a value | `/security/keys` | same |
| secret-keys | Technical details (API/storage/runtime) | `/security/keys` Technical details button | same |
| identity-access | own password, own PIN, own 2FA set up or turn off, own session count, vault state | `/security/sign-in`, new "Your sign-in" panel at the top, reusing the page's own authorized dialogs | `/programs/identity-access` -> `/security/sign-in` |
| identity-access | users table, add user, edit profile, change role, other users' password/PIN/2FA, enable/disable, roles list, authentication policy and vault | `/security/sign-in` (whole workspace kept, unchanged). People/role admin also exists in features/accounts | same |
| identity-access | Technical details | `/security/sign-in` | same |
| background-tasks | snapshot, run now, enable/disable, run history, countdowns | `/settings/background-tasks` | `/programs/background-tasks` -> `/settings/background-tasks` |
| compute-control | node inventory, commands, freshness | `/settings/compute-control` | -> `/settings/compute-control` |
| database-manager | stores, records, JSON view, sensitive-store authorization | `/settings/database-manager` | -> `/settings/database-manager` |
| deployment-sync | targets, sync with authorization, run history | `/settings/deployment-sync` | -> `/settings/deployment-sync` |
| docs | tree, search, page view, in-doc links, `?doc=` deep link | `/settings/docs` | -> `/settings/docs` (query kept) |
| production-runner | start/stop with parameters, run logs | `/settings/production-runner` | -> `/settings/production-runner` |
| runtime | clients, capabilities, runs, run detail | `/settings/runtime` | `/programs/runtime` -> `/settings/runtime` |
| each of the seven | Technical details drawer | the tool's Settings sub-page | as above |
| automation-studio | (unchanged) | /flows, /?chat=open | unchanged, still first |

The brief said "runtime-control". The program's id is `runtime` (Core `programs/runtime-control/metadata.ts`), so the route and redirect use `runtime`. Bare `/programs` and unknown ids still land on `/settings`.

## What changed and why
- **Relocation.** A scratch script copied each deleted HEAD file to its new path and rewrote every relative specifier, including `vi.mock` and `new URL`. A second script then put one statement per line, because the audit refuses a new file with packed statements and the baseline never adds entries.
  - `features/settings-page/tools/`: one directory per tool, `operational/{payloads,refresh}`, `docs/{model,tree,workspace}`, `database-manager/records`, `production-runner/parameters`, `runtime`.
  - The tool views: `SettingsToolView` (the old `LiveProgramMain` switch with lazy loading) and `SettingsToolPage`.
  - `features/security/keys/manager/` holds `SecretKeysLive`, `unlock/` and `scope-catalog/`.
  - `features/security/sign-in/` holds `IdentityAccessLive`, with the added "Your sign-in" panel.
  - `features/programs/` gains `selection/` (`reconcileVisibleSelection`), `format/` (formatTime, digits, shortJson, yesNo) and `technical-details/`. The last is the old ProgramWorkspace drawer plus the old page's capability table.
- **Split of `live-views/shared.tsx`.** Its exports went to their consumers: docs model, background `schedule.ts`, database `cells.ts`, production `run-logs.ts` and `sign-in/emptyCredentialEdit.ts`. `csv` and `parseJsonObject` had no consumer at HEAD and were not carried.
- **Audit fixes.** `docs/DocsLive.tsx` had an empty catch (it was baselined before); it now carries a `best-effort:` reason. One `as never` in a test became a typed stub. `SettingsToolView` imports tool barrels.
- **Routes.** `app/(panel)/settings/[tool]/page.tsx` serves the seven tools and calls `notFound()` for any other id. `app/(panel)/security/keys/page.tsx` and `security/sign-in/page.tsx` are new. All three read the signed-in user server-side, as the old page did.
- **Security page.** `SecuritySubPage`, `SecurityKeysPage` and `SecuritySignInPage` are new. The Keys section gains "Manage keys", and a "Your sign-in" section links to `/security/sign-in`.
- **Settings.** `ENGINE_TOOLS` is now the seven `/settings/<id>` tools plus Keys and Your sign-in, and Advanced lists all nine. `settingsTool(id)` and its test are in `model/tests/engine-tools.test.ts`.
- **Links.** These now point at the new homes:
  - `PinRequirementNotice` -> `/security/sign-in`
  - `AI_PROVIDER_SECRET_KEYS_HREF` -> `/security/keys`, with `AiProviderSettingsSection.test.tsx` updated
  - `panel-open-control` -> `/security/keys` for keys and `/flows?project=` for the Studio, with its test updated
  - AuthShell "Account and access" -> `/security/sign-in`, with `AuthStatus.test.tsx` updated
  - Unit-test fixture hrefs in `features/programs/tests/component-contracts.test.tsx` and `Menu-keyboard.test.tsx` -> panel paths
- **Redirects** (`next.config.ts`). In order:
  1. automation-studio chat
  2. automation-studio
  3. identity-access -> `/security/sign-in`
  4. secret-keys -> `/security/keys`
  5. `/programs/:tool(background-tasks|compute-control|database-manager|deployment-sync|docs|production-runner|runtime)` -> `/settings/:tool`
  6. `/programs/:path*` -> `/settings`
  7. domains and get-started

  The standalone code is untouched.
- **CSS.** The deleted and pruned stylesheets are back in their original `globals.css` order, so the cascade is unchanged. `global-secret-management.css` is now `app/styles/secret-management.css` because the naming rule counts the `global-` prefix. I kept every rule the previous worker kept, and a rule they removed came back only when a current non-test source names its classes (their method). About 15 dead HEAD selectors stay out (for example `.visual-alert`, `.tsd-*`, `.spec-grid`). `07-program-launcher.css` stays deleted because nothing uses it. New layout-only rules: `tools/settings-tool.css` (3 rules) and 2 lines in `security.css`. Nothing was restyled.
- **Tests.**
  - All relocated tests restored.
  - The request-ownership assertions cut from `global-request-contract.test.ts` are back as `tools/tests/request-ownership.test.ts`, `keys/manager/tests/request-ownership.test.ts` and `sign-in/tests/request-ownership.test.ts`, as regexes over the unpacked text.
  - `phase7-responsive-contract.test.ts` is restored to HEAD.
  - New: `your-sign-in.test.tsx`, `TechnicalDetails.test.tsx` and three route tests.
- **e2e (edited, not run).**
  - `panel-redirects`: all nine ids, query kept, unknown id, signed-in Keys / Your sign-in / Docs / unknown.
  - `surface-matrix`: captures all 11 panel surfaces and restores the Technical Details test on `/settings/database-manager`.
  - `accessibility-baseline`: loops over the 11 surfaces.
  - `panel-settings`: Advanced shows 9 links.
  - `chat-widget`: goes to `/security/keys` and waits for that URL.

## Commands run and observed results
- `pnpm structure:check` -> "structure-audit: passed (531 warning(s), 917 baselined)". The baseline is unchanged at 917, so it did not grow and `pnpm structure:baseline` was not needed. New advisories: `SecretKeysLive.tsx` 521 lines, `IdentityAccessLive.tsx` 474 lines (unpacking made them longer) and `global-foundation/` with 17 files.
- Free memory was 2505 MB, then 3563 MB. Run: `pnpm --filter @fluxiq/web exec vitest run src/features/programs src/features/settings-page src/features/security src/app src/features/automation-studio/settings src/features/automation-studio/authorization src/features/chat-widget/navigation` -> 148 files, 2 failed and 146 passed; 1372 tests, 2 failed.
  - `app/product/tests/OnboardingCards.test.tsx`: I had changed it to expect `/security/keys`, but the link comes from Core's `panel-onboarding-cards.ts`. I reverted the test, and it passes on rerun.
  - `features/security/page/tests/security-page.test.tsx > activity > is unavailable in plain words`: it expects "not available yet". The parallel worker's uncommitted rewrite of `features/security/activity/ActivitySection.tsx` no longer renders that placeholder. This is not caused by this work.
- Rerun `vitest run src/app/product src/features/security/page` -> 25 passed, 1 failed (the activity test above).
- Earlier focused run over the relocated code -> 45 files, 520 tests passed.
- `grep -rn "\"/programs\|'/programs\|\`/programs" apps/web/src` (excluding `/api/programs`):
  - UI links left: only `FlowSettingsView.tsx:331-333`, which I do not own.
  - Test data only: `localAuthDestination.test.ts`, `AuthShell.test.tsx:91`, `RunDataset*.test.tsx`, `panel-nav-items.test.ts`, `phase-10f-ownership.test.ts`, and `OnboardingCards.test.tsx`, which asserts the Core-produced link.
  - A comment: `lib/resolve-setup-domain.ts`.

## Not verified
- apps/web typecheck: the supervisor runs it. Vitest compiles without type checks, so type errors in the moved code (all import paths are rewritten) or the new routes could remain.
- e2e: not run, per the brief.
- A Next build, and the redirects running live.
- Visual result of the CSS restoration (no browser).
- That `/flows` honours `?project=` for the chat's "Open the Studio" control; I relied on the redirect comment that says it does.

## Open questions or contradictions found
- **Needs a path grant.** `apps/web/src/features/automation-studio/settings/FlowSettingsView.tsx` lines 331-333 have three literal `href="/programs/secret-keys"`. Replace them with `AI_PROVIDER_SECRET_KEYS_HREF` (already `/security/keys`).
- **Core, must-not-touch.** `packages/fluxiq/src/platform/panel/onboarding/panel-onboarding-cards.ts:5` `SECRET_KEYS_HREF = "/programs/secret-keys"` should become `/security/keys`. Then `app/product/tests/OnboardingCards.test.tsx:33` follows.
- **Security page test.** The test's "activity is unavailable" case needs reconciling with the parallel worker's Activity section.
- **Duplicate admin.** `/security/sign-in` keeps the whole identity workspace, including admin over other users. That overlaps features/accounts for invite, role and enable. I kept it because accounts has no edit-profile, reset-another-user's-credentials or roles list, so dropping it would remove functions. If accounts gains them, the admin half could go.
- **Brief wording.** "runtime-control" in the brief is program id `runtime`.

```text
Outcome: Partial
Changed: apps/web/next.config.ts; apps/web/src/app/(panel)/settings/[tool]/**, app/(panel)/security/{keys,sign-in}/**; apps/web/src/features/settings-page/{index.ts,model/engine-tools.ts,model/index.ts,model/tests/*,ui/EngineToolsSection.tsx,tools/**}; apps/web/src/features/security/{index.ts,security.css,keys/KeysSection.tsx,keys/manager/**,page/**,sign-in/**}; apps/web/src/features/programs/{format,selection,technical-details}/**, programs/tests/{phase7-responsive-contract,component-contracts}.test.*, programs/components/controls/tests/Menu-keyboard.test.tsx; apps/web/src/app/{globals.css,styles/**,AuthShell.tsx,tests/AuthStatus.test.tsx}; automation-studio/authorization/PinRequirementNotice.tsx; automation-studio/settings/{ai-provider-model.ts,tests/AiProviderSettingsSection.test.tsx}; chat-widget/navigation/{panel-open-control.ts,tests/panel-open-control.test.ts}; apps/web/e2e/{panel-redirects,surface-matrix,accessibility-baseline,panel-settings,chat-widget}.spec.ts
Validation: `pnpm structure:check` -> passed (531 warnings, 917 baselined, unchanged); acceptance vitest -> 1372 tests, 2 failed (OnboardingCards: Core-produced link, test reverted and now passes; security-page activity placeholder: parallel worker's ActivitySection change)
Not verified: apps/web typecheck, e2e, Next build and live redirects, CSS visuals
Report: C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/w5-hosted-panel/w5-rehome-programs.md
Notes: Needs a grant for automation-studio/settings/FlowSettingsView.tsx (3 /programs/secret-keys links) and a Core change in packages/fluxiq/src/platform/panel/onboarding/panel-onboarding-cards.ts.
The program id is "runtime", not "runtime-control". Restored files were unpacked to one statement per line so the baseline stays at 917.
```
