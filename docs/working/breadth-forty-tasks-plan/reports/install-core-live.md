# install-core-live report (t707): a new person's first automation, on the fixed code

Trees: `fxwork/t707/!FluxIQ` (holding the uncommitted t707 Core fixes) and
`fxwork/t707/!FluxIQWebExtension`. Scratch:
`<session scratchpad>/t707/` (data root, profile, logs, screenshots) and
`<session scratchpad>/t707-scripts/` (helpers adapted from `t706-scripts/`,
which were left alone). One headed Chrome on a fresh profile. No user panel,
profile, `.fluxiq`, Lab slot or lane tree was touched. No source edits, no commits.

## Outcome

Partial. Every install step a person takes worked on the fixed code, and C1, C3,
C4 and C5 were proved live. The one paid build ran to an honest ending
without a promoted Flow: "Its test run from the start did not get to the end, so
nothing was put into the Flow. I kept what I wrote as a draft." It spent about
$0.10 of the $0.25 ceiling. With no Flow, the zero-call rerun (step 6) could
not happen. I found one new Core defect on Get started (G1, below).

## What changed and why

- No source changes.
- Build outputs were regenerated in the t707 tree: Core `apps/web/.next` and `.server-runtime`,
  `domain/dist/host/web-panel-host.mjs`, `domain/.script-build/`,
  `apps/extension/dist/` (including the store ZIPs).
- Scratch helpers in `t707-scripts/`: `serve.mjs` (t707 web build, ports
  3707/4707, fresh root, strips provider keys and `FLUXIQ_*`, sets
  `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25`), `cdp.mjs` (copied; the text/eval
  output limit was raised from 6000 to 200000 characters, see "Note on observation"),
  `watch.sh`, `sq.cjs` (read-only queries on *copies* of the sqlite files),
  plus the copied `pick-folder.ps1`, `uia.ps1`, `newtab.mjs`, `targets.mjs`.

## Step log (person's path vs shortcut, observed result)

| # | Step | Path | Result |
| --- | --- | --- | --- |
| 1 | Build Core web | `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build web:build` | exit 0. Libraries were reused because the stamp matched; `web:build` was built (240 s) |
| 1 | Domain host + setup | `node domain/scripts/build-web-panel-host.mjs`; `FLUXIQ_WEB_AUTOMATION_ROOT=<scratch>/t707/root node domain/scripts/setup-fluxiq.mjs` | exit 0 both; fresh root with `config.json`, domain `web-automation` |
| 1 | Extension + ZIP | `pnpm.cmd --filter @fluxiq-web-extension/extension build`; `node apps/extension/scripts/release/package-extension.mjs` | exit 0. Built (inputs changed: Core dist/src); chrome/firefox/e2e each "verified 22 files". `fluxiq-web-extension-chrome-0.1.0.zip` **712440 bytes**, 14 files, sha256 **fcb61a40...105fa4** (identical to t706's post-fix ZIP; the extension source is unchanged). Firefox ZIP 712508 bytes, sha256 4b7cdf12...0c58 |
| 2 | Serve | shortcut, as in t706: `next start` on 127.0.0.1:3707, gateway ws://127.0.0.1:4707/client, isolated root and host module (`pnpm dev` would use the shared checkout and `.env.local`) | 200 on `/`; log "Client gateway WebSocket bound ... ws://127.0.0.1:4707/client"; snapshot: `clientGatewayListening: true`, `clientGatewayError: null`, `hostModuleLoaded: true` |
| 3 | Install | person: unzip, `chrome://extensions`, Developer mode toggle (CDP mouse click), Load unpacked, native folder dialog filled through Win32 (`pick-folder.ps1`) | Chrome card "FluxIQ Web Automation Client 0.1.0", id `koiohengkmpcbcjhgnbobikaeoccchdl`, no errors (`shot-extensions.png`) |
| 3 | Scenario | `SCENARIO_LAB_PORT=3717 node apps/scenario-lab/dist/server.js` with a random run token kept in a scratch file | ready on 3717; `company-website` served |
| 4 | First sign-in | person: `admin`/`admin`, then the forced "Replace the temporary password" (value generated into `t707/admin-pass.txt`, never printed) | Home loaded as Administrator |
| 4 | `/get-started` | person: Home > Get started (URL carries `?domainId=web-automation`) | **C1 proved**: step 1 "Done: The runtime is running and listening for the browser extension." The page is still unstyled (`shot-gs.png`), as t706 also found |
| 4 | Open panel | person: Extensions menu > Pin > toolbar button (real mouse clicks via UI Automation) | Side panel "Get started with FluxIQ" |
| 4 | Connection | isolation deviation: Settings > Connection, set ws://127.0.0.1:4707/client and http://127.0.0.1:3707, Save | saved (values read back) |
| 4 | Pair | person: Connect, web tab brought to front, code compared, **Confirm pairing at ~70 s** | Service worker present at 15, 30, 45 s; modal code matched the panel; panel switched to chat. Gateway: exactly **one** session, `ready`, one pairing consumed, one trusted client. See C2/C3 |
| 4 | Get started after pairing | person: Check again | **New defect G1**: step 2 still says "No browser extension is connected yet." while a session is ready (below) |
| 4 | DeepSeek key | person: Open Secret Keys (link on Get started) > Add Key; name, value typed from `.env.local` `DEEPSEEK_API_KEY` (never shown), provider set to DeepSeek (shortcut: the `<select>` value was set through a native setter and a change event, not the dropdown), Continue > "Authorize New Key" > password > **Save Key** | "Secret key saved"; listed DeepSeek, LLM, Enabled, global. Get started step 3 then showed "Done: DeepSeek key ... is ready." **No sign-out** |
| 4 | Project | person: Get started > **Describe an automation** | **C4 proved**: it went to `/programs/automation-studio?start=describe&domainId=web-automation`; Create project "Kestrel Lane team" created project `5be3e310...`. The panel chat accepted it ("What can FluxIQ do for you?"), with no "not a web automation project" refusal. The Flow row has `scope_kind: domain`, `scope_id: web-automation` |
| 4 | Instruction | person: scenario page `/scenarios/company-website/` in front, typed into the panel chat: the realistic task `company-website-apprentices` ("From Kestrel Lane's team page, list every apprentice at every branch ... columns name, role and branch ...") | Build started 15:04:57 |
| 5 | Paid build (one) | supervised live, from start to end | **C5 proved**: model calls ran in the same sign-in that added the key (plan, then builders), with no "key is locked". Result below |
| 6 | Zero-call rerun | - | **Not exercised**: no Flow was promoted (`flows.status = draft`, 0 graph nodes, 0 publications) |

## C-items

- **C1 proved live.** Step 1 was Done on a healthy runtime (the snapshot had `clientGatewayError: null`).
- **C2 not exercised in its failure path.** No socket dropped during approval
  (the worker stayed alive throughout), so the "approve a disconnected session"
  guard was never triggered. The normal path is proved: approval after ~70 s
  paired, and the gateway held one `ready` session with no orphan.
- **C3 proved live.** The build's browser commands went to the one live session
  (`0db172e0`): navigate, click, scroll, extract_list, check and capture
  commands settled with results in `artifacts/runtime/command-attempts`, and
  the page in front moved (home > team). No stall like t706's.
- **C4 proved live.** Get started's start button carries `domainId=web-automation`,
  the project it creates is accepted by the paired panel's chat, and the build ran in it.
- **C5 proved live.** The key was added, there was no sign-out, and the build's model calls succeeded.

## The build's result and cost

Ended honestly at 15:16:19 (11 min 22 s), with no promoted Flow and a saved
candidate draft (`candidate.adc26fc6...`). Conversation turns 3-4: "Its
test run from the start did not get to the end, so nothing was put into the
Flow. I kept what I wrote as a draft." / "Saved candidate draft. Verification
pending; the Flow's steps are unchanged." The supervisor's last step: "Five builder attempts on list apprentices
have failed on the same 'Show more people' control; I end honestly as partial
rather than resend an unchanged brief."

What happened: there was one plan (1 subflow, $0.01 kept back) and six builder dispatches
(the first plus five re-briefs and repairs). Each builder's Read list returned the
first 8 of 26 people. The builders then tried the "Show more people" button,
which `apps/scenario-lab/dist/scenarios/company-website/client/team-script.js` keeps
`hidden` until the grid has been scrolled to its end three times (an
infinite-scroll sentinel) and which swallows its first press. Every click on it failed in
the extension with `web.target.not_shown` ("Action rejected: the element's
display is none ... did not recover within its 4 attempts"), and the no-repeat
guard refused the identical retries. Only one `web.dom.scroll` was issued
(15:15:49), and it did not reach the sentinel. Trials: whole-Flow runs "Didn't
pass" (for example, "1 row came back"). This is the model failing to discover
scroll-to-load on a deliberately hard realistic page, not an install or
pairing defect. Nothing stalled: commands and model calls continued until
the honest ending.

Cost, from the panel (the run records no billed total I could find; the project
objects carry only `estimatedCostUsd: 0` in adaptive metrics):

- Allowance per dispatch: $0.23 > $0.22 > $0.20 > $0.18 > $0.16.
- Builder spend: $0.01 + $0.02 + $0.01 + $0.01 + $0.02. The first dispatch's
  builder is the $0.01 at line 121, so the five builder returns total about **$0.07**.
- Supervisor calls account for the rest. The total is **about $0.10-0.11 of the
  $0.25 ceiling**.
- No balance, billing or ceiling error. One "The AI model's answer didn't make
  sense, so FluxIQ is asking it again" retry, at the very start.

## New defect (recorded, not fixed)

**G1: Get started step 2 never passes, and never shows a waiting pairing.**
`apps/web/src/features/automation-studio/onboarding/onboarding-steps.ts`
`pairingCheck` (lines ~51-54) counts `gateway.value.sessions` and
`gateway.value.pairings`. The source it reads is the program endpoint
`automation-studio/client-gateway-snapshot`
(`useOnboardingSources.ts` > `client-queries.ts`). That endpoint
(`packages/fluxiq/src/programs/automation-studio/api/handlers/client-gateway.ts`
lines 17-20) deliberately returns `{ ...summary, sessions: [], pairings: [],
trustedClients: [], auditLog: [] }`, with the real numbers only in `counts`.

Evidence while paired:
`GET /api/programs/automation-studio/client-gateway-snapshot` returned
`counts: { sessions: 1, pairings: 1, trustedClients: 1 }` with `sessions: []`
and `pairings: []`. Meanwhile `/api/client-gateway/snapshot` listed the `ready`
session, and the page still said "No browser extension is connected yet." It said the
same while the approval modal was open, so the "A pairing request is waiting"
hint is also unreachable. Step 3 still turned Done after the key was added.

Fix direction (for the supervisor): read `counts.sessions` and
`counts.pairings` (or a pending-pairing count) in `pairingCheck`, or read the
lists through `list-client-gateway-items`. The current tests miss it because
their fixtures give lists to a source that ships empty lists.

Observation, not traced: opening the project in Automation Studio by its URL sat on
"Opening project... Restoring the project from the current URL" for more than 30 s
before it rendered.

## Commands run and observed results

- `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build web:build` (Core) -> exit 0; three libraries `reuse ... inputs and outputs match the stamp`; `web:build` `build ... ms 240224`.
- `node domain/scripts/build-web-panel-host.mjs` -> exit 0, "Built web panel host module".
- `FLUXIQ_WEB_AUTOMATION_ROOT=<scratch>/t707/root node domain/scripts/setup-fluxiq.mjs` -> exit 0, created `.fluxiq` and `config.json`.
- `pnpm.cmd --filter @fluxiq-web-extension/extension build` -> exit 0; "core-build: ... is current"; chrome/firefox/e2e-chromium "verified 22 files"; build-cache `build`.
- `node apps/extension/scripts/release/package-extension.mjs` -> `ok chrome ... 712440 bytes, 14 files, sha256 fcb61a402a2c...105fa4`; `ok firefox ... 712508 bytes ... 4b7cdf12b2eb...0c58`; gecko placeholder warning.
- Live checks as in the step log. Gateway state was read from `/api/client-gateway/snapshot`
  and the program snapshot. The build trace came from `command-attempts/*/attempt.json` and from read-only
  queries on copies of `project.sqlite` (`conversation_turns`, `flows`,
  `flow_publications`, `graph_nodes`, `runtime_runs` = 6).

## Note on observation

For about 10 minutes mid-build I believed the build had stalled at "Reading the
list" and then at "Looking for Load more". That was my helper: the t706
`cdp.mjs` cuts `text` output at 6000 characters, so I was reading a stale middle
of the transcript. A screenshot showed the real ending. The t707 copy raises the limit.
The build itself never stalled.

## Not verified

- Step 6, the zero-call rerun, because no Flow was promoted.
- C2's guard against approving a dropped session (no drop occurred).
- Edge and Firefox (only Chrome 155 this time).
- The exact billed total: no spend ledger is written outside the Lab, so the cost is from the panel's figures.
- Whether a person following the quickstart would choose an easier first task than
  `company-website-apprentices`. I chose a read-only realistic task with no permission point.

## Cleanup

Stopped Chrome (the t707 profile), the web server (next start, pid 27020, and its
parent shell) and the scenario server. Checked with
`Get-NetTCPConnection -State Listen` on 3707, 4707, 3717 and 9357: "no listener on
3707, 4707, 3717, 9357", and no process command line still names the t707
profile, the t707 web app or the scenario server. Data root, profile,
password file, run token and screenshots stay in `<scratchpad>/t707/`.

## Open questions or contradictions found

- G1 (above) contradicts the C1 fix's intent that Get started guide a new person through
  all three steps. Pairing works, but the page never acknowledges it.
- The t706 report says the key step ends with "Authorize New Key". That is the dialog's
  title; the button the person presses is **Save Key**.
