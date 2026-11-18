# t915 final acceptance (testing only, no source edited)

Trees: EXT/CORE under `fxwork/t915`, branch task/t915-usable-client. Dev panel (pids 11924, 10344, 2696) stopped first.

## Builds
- Core libs (contracts, sdk, fluxiq, client-gateway-websocket, ui-components) built: all Done (2m55s).
- Extension build: chrome/firefox/e2e-chromium verified 26 files each; Core-current guard reported current (test-runner build printed "FluxIQ Core's build ... is current").
- test-runner build: Done.

## Checks
| Command | Result |
| --- | --- |
| CORE `@fluxiq/contracts check` | exit 0 |
| CORE `fluxiq check` | exit 0 |
| CORE `@fluxiq/ui-components check` | exit 0 |
| CORE `@fluxiq/web check` | exit 0 |
| CORE `node scripts/structure-audit.mjs` | passed (550 warnings, 914 baselined; 2 baseline entries can be lowered) |
| ui-components vitest src/chat src/project-switcher src/screens | 115 files, 811 tests pass |
| contracts vitest | 112 files, 995 tests pass |
| apps/web vitest src/features src/app (real config) | 412 files pass, 1 FAILED: 3297 pass / 2 fail of 3299 |
| packages/fluxiq parallel group, 57 test dirs from the diff since 592a188a4 | 322 files, 3097 tests pass |
| EXT test-extension.mjs src/panel src/background src/shared | 1690 tests, 1690 pass |
| EXT `tsc -p tsconfig.test.json --noEmit` (apps/extension) | exit 0 |
| EXT `node scripts/structure-audit.mjs` | passed (250 warnings, 551 baselined) |

## Failures
1. apps/web `src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts`, 2 tests: "reaches projects ..." and "reaches create-project as the person who approved the pairing" expect 200, get 403. Re-run alone: same 2 fail (77 pass). NOT pre-existing: the t914 tree passes the file (77/77); the two cases are new in t915 (commit 93a8c9986). Cause found: the test's `CLASSIFICATIONS` map (route.test.ts ~line 84) has no entry for `projects` or `create-project`, so the registered endpoints default to `"destructive"` and route.ts line 38 (`isPairedClientClassification`) refuses them. A test fixture gap, not a product bug: in the live journey below the extension lists and creates projects through the same route fine. Fix: add `"projects": "read"` and `"create-project": "authoring"` (or the real classifications) to the map.
2. Step 6 proof, see below.

## Production panel timings (headed Chromium, ms; shell / content / network idle)
Round 1 and 2 (second open): Home 84/332/843 then 86/322/826; Projects 97/144/690 then 77/107/690; Chats 95/116/780 then 83/100/765; Flows 80/100/673 then 85/99/660; Runs 89/117/838 then 88/107/811; Data 99/114/809 then 74/95/793; Security 103/123/780 then 85/105/734; Settings 97/123/780 then 102/112/719. Every page has content in about 100 to 330 ms.

## Visual notes (32 screenshots: 8 pages x light/dark x 1440/390, all in EXT test-runs/final-acceptance/panel-*.png)
Automated scan: no horizontal scroll, no default-looking (unstyled) controls, no empty or login-redirected pages in any of the 32. Viewed by eye: home dark 1440, projects light 390, settings dark 390, flows light 1440, security dark 1440, data light 390 all coherent, themed, with bottom nav at 390.
Minor, not blocking: Security lists a long run of stale "Signed in, ends ..." sessions with a Sign out button each (plain, long); Home and Flows show "Chat unavailable" in the assistant composer while no model key exists; Settings AI keys page is dense text on 390.

## Extension journeys (built dist/chrome, fresh profile, headed)
- Pairing approval: panel modal "Confirm pairing" clicked; composer appeared 164 ms later; no unlock, passphrase or key step (text scan false). PASS.
- Project switcher listed the panel's projects (Final Check Project, Walkthrough C, My automations, Walkthrough B2, Walkthrough A). PASS.
- Create project "Acceptance Project": header changed to it and it is selected. Switch to Walkthrough A: header followed. PASS.
- New chat "Plan my weekly grocery run": titled the same in the bar and in the Chats list. PASS.
- No-key reply: "No model key is set up yet, so add one in Settings, under AI keys." only. PASS. (An older chat in Final Check Project from an earlier build still shows a longer "I could not tell what you wanted done..." reply; old stored data, not the new build.)
- Settings, Automations (Tasks/Library tabs) and Library opened with content. PASS.
- Header at 360, 400, 480, 540 px: height 81 px, no horizontal scroll, nothing clipped or overflowing. PASS (screenshots ext-hdr-*.png).
- Console errors in the extension page: none printed.

## Step 6 free model-access proof (everything-store, --no-ask --model-key)
Verdict: FAIL as a run (exit 2, three runs, same result, with and without the panel on :3000). All 20 named checks are true (approvedWithoutAKey, keylessLibraryUsesPairedAuthority, configured-later/after-panel-logout/after-reconnect/after-core-restart/approved-without-password modelAccess and noUnlockPrompt, reconnectedWithoutReapproval, restartedWithoutReapproval, aCopyIsCaughtWhenTheBrowserReturns, neitherHoldsTrustAfterReuse, approvalNeedsNoSecondPassword, configurationHasNoUnlockFragment, explicitRevokeReachesCore, revokedCredentialCannotCallModel), but the final stage "network guard" failed: "Deterministic browser network policy blocked 1 unexpected destination(s): request:http://127.0.0.1:3000/.well-known/fluxiq". That is the extension's default-address discovery probe; its URL string exists in both t914 and t915 background/connect code, so a guard allow-list or a probe that should not fire in the check is the likely cause. Pre-existing or not: undetermined. The t914 tree's check cannot run (its scenario-lab dist/registry.js is missing, exit 1). Evidence: `C:\Users\osrs_\FluxStuff\evidence\t198\2026-11-17T00-32-25-488Z-chrome` (also 00-23-33 and 00-28-55 runs).

## Panel
Production panel (`node scripts/run-fluxiq-web.mjs`, Next 15.5.24 `next start`) is RUNNING at http://127.0.0.1:3000 (HTTP 200, "Ready in 3.5s"), log scratchpad panel.log. It was briefly stopped and restarted during the proof diagnosis.

Outcome: Partial
Changed: none in source; created screenshots and a profile in EXT test-runs/final-acceptance/ and this report
Validation: all type checks, audits and test groups above pass except `vitest src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts` (2 of 79 fail, new in t915, fixture gap) and the step 6 proof (checks true, network guard stage fails)
Not verified: real-sql group; whether the network guard failure exists on t914; paid or live-model behavior; Firefox build
Report: C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/usable-client-plan/reports/final-acceptance.md
Notes: Fix the route.test.ts CLASSIFICATIONS map; decide whether the .well-known/fluxiq probe is allow-listed in the guard.
