# install-core-live-r3 report (t707, round 3): a new person's first automation on everything-store

Trees: `fxwork/t707/!FluxIQ` (uncommitted t707 Core fixes, including Home's Studio
entry and the styled /get-started) and `fxwork/t707/!FluxIQWebExtension`.
Scratch: `<session scratchpad>/t707r3/` (data root, profile, logs, screenshots,
sqlite copies under `db1/`) and `<session scratchpad>/t707r3-scripts/` (copied from
`t707-scripts/`; `serve.mjs` and `watch.sh` repointed to `t707r3`, and two new helpers
added: `sw-stop.mjs` and `watchloop.sh`). One headed Chrome on a fresh profile. No user
panel, profile, `.fluxiq`, Lab slot or lane tree was touched. No source edits, no commits.

## Outcome

Partial. Every install and first-run step a person takes worked. Home's Studio entry now
opens the domain, /get-started is styled, all three Get started steps reached Done, and
round 2's G1 is fixed. The C2 guard was proved: an approval for a dropped socket was refused
honestly, nothing was trusted, and the old session did not become `ready`. The browser
then paired on a new code. The one paid build ended honestly **without a promoted Flow**
($0.0473 billed, about 95 model calls), so step 7 (the zero-call rerun) could not run.
The trace below finds two defects behind the failure (D1 Core, D2 extension) and two
smaller C2 findings (P1, P2).

## What changed and why

- No source changes.
- Regenerated build outputs in the t707 tree: Core `apps/web/.next` (web:build),
  `domain/dist/host/web-panel-host.mjs`, extension `dist/` and store ZIPs.
- Scratch helpers: `sw-stop.mjs` lists or stops one extension's service worker through the
  CDP ServiceWorker domain (`ServiceWorker.stopWorker` on its version id), used for C2.
  `watchloop.sh` samples the panel and gateway every 20 s into `t707r3/watch.log`.

## Step log

| # | Step | Path | Observed |
| --- | --- | --- | --- |
| 1 | Core web | `node scripts/build-cache/cli.mjs fluxiq:build web:build` | exit 0; `fluxiq:build` reused (stamp), `web:build` built in 341 s |
| 1 | Domain host + setup | `node domain/scripts/build-web-panel-host.mjs`; `FLUXIQ_WEB_AUTOMATION_ROOT=<scratch>/t707r3/root node domain/scripts/setup-fluxiq.mjs` | exit 0 both; fresh root with `.fluxiq` |
| 1 | Extension + ZIP | `pnpm.cmd --filter @fluxiq-web-extension/extension build`; `node apps/extension/scripts/release/package-extension.mjs` | exit 0; "core-build ... is current"; extension restored from the shared store. **`fluxiq-web-extension-chrome-0.1.0.zip`, 712440 bytes, 14 files, sha256 `fcb61a40...105fa4`** (same as round 2). Firefox ZIP 712508 bytes, `4b7cdf12...0c58` |
| 2 | Serve | `next start` 127.0.0.1:3707, gateway ws://127.0.0.1:4707/client, provider keys and `FLUXIQ_*` stripped, `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25`, fresh root | "Ready in 5.3s"; "Client gateway WebSocket bound ... ws://127.0.0.1:4707/client" |
| 2 | Scenario | `SCENARIO_LAB_RUN_TOKEN=<scratch file> SCENARIO_LAB_PORT=3717 node apps/scenario-lab/dist/server.js` | `{"status":"ready","origin":"http://127.0.0.1:3717"}` |
| 2 | Install | as a person: chrome://extensions, Developer mode (CDP mouse click), Load unpacked, native folder dialog (`pick-folder.ps1`) | Card "FluxIQ Web Automation Client 0.1.0", id `jliikagk...` (unpacked ids follow the path), no errors (`shot-extensions.png`) |
| 3 | Sign-in | `admin`/`admin`, forced new password generated into `t707r3/admin-pass.txt` (never printed) | Home as Administrator (`shot-home.png`). Declined Chrome's "save password" bubble |
| 3 | Studio from Home | person: clicked the plain **Automation Studio** row (its href is `/programs/automation-studio`) | **Lands in the domain**: URL `/programs/automation-studio?domainId=web-automation`, the Web Automation project chooser ("No projects yet") (`shot-studio-entry.png`). No domain chooser, because only one domain exists |
| 3 | /get-started | person: Home > Get started | URL `/get-started?domainId=web-automation`. **Styled**: topbar (FluxIQ logo, Administrator menu), "Set up FluxIQ" heading, checklist card with Check again, three step cards with status icons and colours, then three start cards (`shot-gs.png`; body font Inter). Step 1 **Done**, step 2 Next, step 3 "Blocked: finish step 2 first" |
| 3 | Panel | person: Extensions menu > Pin (UIA invoke) > toolbar button (real mouse click) | Side panel "Get started with FluxIQ" |
| 3 | Connection | isolation deviation, as before: Settings, ws://127.0.0.1:4707/client and http://127.0.0.1:3707, Save | read back as set (the defaults were 4777/3000) |
| 4 | C2 guard | below | proved |
| 3 | Step 2 | Check again after pairing | **Done: "1 browser extension is connected."** (G1 fixed) (`shot-gs-paired.png`) |
| 5 | Key | Get started > Open Secret Keys > Add Key; name, value typed from `.env.local` `DEEPSEEK_API_KEY` (never shown); provider DeepSeek (shortcut: `<select>` set through the native setter plus a change event); Continue > password > **Save Key** | "Secret key saved"; DeepSeek, LLM, Enabled. Get started: **all three Done**, "FluxIQ is ready." (`shot-gs-all-done.png`). No sign-out |
| 5 | Project | Get started > Describe an automation > Create project "Home shopping" | URL `...?start=describe&domainId=web-automation&project=a2caac7b...`; panel chat "What can FluxIQ do for you?" |
| 6 | Instruction | everything-store home in front; typed the exact `everything-store-kettle-to-cart` instruction (345 chars) into the panel composer and pressed Send (`button[aria-label=Send]`) | Build started 16:25:24. (My first press matched a suggestion chip whose text contains "send". It only replaced the composer text and nothing was sent; I retyped and pressed the real Send) |
| 6 | Paid build | supervised live (`watch.log`), one build | Ended 16:33:30 (8 min 6 s), honest ending, **no promoted Flow** |
| 7 | Rerun | - | **Not exercised**: no Flow (`flows.status = draft`, 0 graph nodes, 0 `flow_publications`) |

## C2: approving a dropped session (proved, with two side findings)

1. 16:19:48: pressed Connect in the panel. Panel code **114605**; web modal "Client pairing request" showed 114605, expires in 297 s. Gateway: session `e15eda07` `pairing_required`, one pairing for it.
2. 16:20:04.9: `ServiceWorker.stopWorker` on the FluxIQ worker only (`sw-stop.mjs`; Google Docs Offline's worker was left alone). Worker went `running` -> `stopped`.
3. 16:20:05.8 gateway: `e15eda07:disconnected`, pairings `[]`. Audit: `pairing.withdrawn` ("withdrawn because its session ended") and `session.disconnected`, both at the drop.
4. The web app **closed the modal by itself** within about 1 s, so a person had no Confirm button left to press. I then sent exactly what the modal's Confirm sends (`POST /api/client-gateway/approve-pairing {pairingCode:"114605"}`, from the signed-in page). Result: **HTTP 409** `{"ok":false,"error":"The browser disconnected before this pairing was approved, so nothing was paired. Reconnect from the browser to get a new code.","code":"pairing.client_disconnected"}`. Gateway afterwards: `e15eda07:disconnected`, trusted clients **0**, no `ready` session. Audit `pairing.refused`: "Client pairing approval refused; no trust was kept."
5. Reconnect: the browser did **not** reconnect by itself (P1). After a Cancel in the panel woke the worker, Connect gave the new code **582024**. The modal appeared about 10 s later with 582024, and Confirm pairing (real click) paired it.
6. Gateway session list after: `e15eda07:disconnected`, `9dd09476:ready`; trusted 1; pairing 582024 `consumedAt` set. The same list held at the end of the run.

**P1 (extension): the panel does not notice its worker died while it waits for approval.** For more than 100 s after the drop (sampled every 10 s from 16:20:49 to 16:21:48), the panel still showed "Connected: Done", "Approve this browser: In progress" and the dead code 114605. The worker stayed `stopped`, so nothing reconnected. A person would wait on a code that no longer exists. Pressing Cancel restarted the worker and reset the panel (`shot-c2-panel-stale.png`). A real worker death (crash, update, Chrome's kill) would leave the same state.
**P2 (Core web): the modal vanishes with no word.** When the pairing is withdrawn, `GlobalClientGatewayPairing` removes the modal. Its `closedNotice` is set only on a failed approve, so the person sees no "the browser disconnected" message (`shot-c2-after-drop-web.png`).

## The paid build: result, cost and calls

- Plan (1 supervisor call): 3 parts, 4 subflows (Main; add two kettles; phone case to Save for later; report the cart). Briefs: the kettles and phone-case builders were dispatched together, then re-briefed once (a fresh kettles build and a phone-case repair). One supervisor Dispatch was refused ("it wasn't allowed"), and the next one succeeded.
- Ending (build record `build.5acdd9ba`, `ending.outcome: blocked`): "Two build attempts for add_kettles were blocked by repeated refusals (target covered by overlay, repeat_refused) and two attempts for save_phone_case failed every trial with web.target.not_actionable on 'Save for later'; no subflow reached a done proposal ... The cart page's app-download overlay covers the controls and the builders could not dismiss it reliably."
- Panel: "The build failed: the supervisor ended it because it could not finish the Flow ... has no steps yet, but it keeps your instruction".
- **Cost: $0.0473 billed** (`automation.state` `flow_creation_spend.spentUsd = 0.047293506`, builds 1), against the $0.25 ceiling. Builder returns (spentUsd/calls): kettles#1 0.00505/11, phone#1 0.01623/30, kettles#2 0.00758/16, phone-repair 0.01231/30, so **87 builder calls, $0.0412**. The supervisor made 8 visible decisions (about $0.006). No per-call count is stored for it, so **about 95 model calls** in all.
- No balance, billing or ceiling message (`watch.log` `bill=0` throughout). No "asking it again" retries.
- 8 subflow trials (`runtime_runs`, all `subflow-trial.*`, all `failed`), all from the phone-case builders. 49 browser command attempts.

### Why no Flow (traced)

**Phone-case builders: "Save for later" refused as covered, but only its centre is covered (D2, extension).**
Every trial ended at `click` with "Action rejected: the point 220,451 landed on p.css-1y6w9q1, which covers the target" (`command-attempts`, 8 of 8 trials; 16:26:29 to 16:33:13).
Live check after the build, read-only, on the cart page: the tab is **543 px wide** (window 945 px, side panel open), so the cart squeezes into narrow columns.
The covering element is the line's **price paragraph** (`$19.99`, `position: static`, box 110 x 812 px). It draws nothing over the link, but its box overlaps the "Save for later" span's centre.
Of 63 sampled points on that span, **27 hit the span itself**: a person clicking the visible words succeeds, and the centre point does not (`shot-cart-after-build.png`).
`apps/extension/src/content/action-runtime/actionability.ts` hit-tests only the centre ("the point at its centre must land on the element itself") and refuses as `covered` without trying any other point of the target.
The builders and supervisor read that as a blocking overlay ("covered by a price layer", "app-download overlay") and could not find anything to dismiss.
Fix direction: before refusing, probe further points inside the target's visible rect (the extension already has `interference/probe-points.ts`) and act on the first one that hits the target.
The narrow tab is the normal layout for a person who keeps the side panel open.

**Kettle builders: written steps counted as failures by the repeat guard (D1, Core).**
The first kettle builder wrote its dismissals and its search with `core.run_node` `write: true` (cards "Added to the Flow, not run yet"), so the cookie and notification layers stayed up.
The one search it ran was rejected (`web.action.rejected.target_covered (covered_by_layer)`).
Each later identical call was refused as "Not done: it was already tried exactly this way and did not work".
The builder's return summary reads: "core.run_node on web.output.dom-click answered core.run_node.written; core.run_node on web.output.dom-type answered web.action.rejected.target_covered (covered_by_layer); core.run_node answered llm_evidence_loop.repeat_refused (failed)". It ended after 11 calls with "kept trying without getting any further".
In Core, `packages/fluxiq/src/programs/automation-studio/runtime/llm/repeat-guard/outcomes.ts` ~line 433 computes `failed = call.refused || (call.effect === "mutate" && !call.effectApplied && !runsDraft)`.
A written step is a mutate with nothing applied by design, so it is recorded as `failed`, and its repeat is refused with the "did not work" words.
`draft-amendment-feedback/did-not-work.ts:13` does exclude written steps (`step.written !== true`). The repeat guard does not, so the model is told that a step which went into the Flow failed.
The second kettle builder ran its search and opened the kettle, but it **wrote** "Click to select Sage Green". Its later "Open page" was "not accepted", and it ended after 16 calls with two `repeat_refused (failed)` in a row.
Not proved: whether every refused resend was byte-identical to a *written* call. No provider request files are written outside the Lab, and the gateway audit log keeps only the last 100 entries, so the early exploration commands had rolled off.

Other observations: the phone-case trials' cookie "Decline" and notification steps did not resolve in later trials ("No target resolved ... 2 matched, none the recorded"). The Flow excused them ("step 3 didn't work and was passed over"), so they did not decide the outcome. One "Robot check" cleared on its own after 9 s.

## Commands run and observed results

- Build, serve, install and pairing commands as in the step log; each exit 0 or observed as stated.
- Gateway state from `GET /api/client-gateway/snapshot` (signed-in page). C2 approval via `POST /api/client-gateway/approve-pairing` -> 409 `pairing.client_disconnected`.
- Build trace: `command-attempts/*/attempt.json` (49), read-only queries on copies (`t707r3/db1/`) of `project.sqlite` (`flows` draft, `flow_publications` 0, `graph_nodes` 0, `runtime_runs` 8 failed, `conversation_turns` 3) and `global.sqlite` (`automation.state`: build record, builder returns, `flow_creation_spend`).
- Cleanup: stopped Chrome (pid 23056 and its children), `next start` (14868, plus cmd 41656 and node serve.mjs 25508) and the scenario server (40016, confirmed by port ownership first). `Get-NetTCPConnection -State Listen` -> "no listener on 3707, 4707, 3717, 9357", and no remaining t707r3 chrome/node/next process. `git status` in both trees is the same as at the start.

## Not verified

- Step 7, the zero-call rerun, because no Flow was promoted. No second paid build was started.
- The modal's own Confirm button against a dropped session: the modal closes before a person can press it, so I sent the identical request directly.
- D1's exact call inputs (no provider request or step files outside the Lab; the audit log was capped). D2 was measured live on the final cart layout, not at the moment of each trial (the same point 220,451 was refused in all 8 trials).
- Whether the everything-store task passes in a wider window. Edge and Firefox were not tried.

## Open questions or contradictions found

- The supervisor's ending names "the cart page's app-download overlay". The real cover is the price paragraph's oversized layout box, a product defect (D2) and not a site overlay. The model's explanation inherits the extension's `covered` wording.
- A refused-then-allowed supervisor Dispatch ("it wasn't allowed") was not traced.
- Round 2's helper-text note still applies: `cdp.mjs` `click` matches by substring, so "Send" can hit a chip whose text contains "sending". Use `css:` selectors for exact controls.
