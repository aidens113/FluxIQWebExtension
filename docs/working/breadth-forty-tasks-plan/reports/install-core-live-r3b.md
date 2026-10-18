# install-core-live-r3b report (t707, round 3, second attempt): everything-store kettle-to-cart after D1, D2, P1, P2

Trees: `fxwork/t707/!FluxIQ` and `fxwork/t707/!FluxIQWebExtension`, both with their uncommitted
t707 fixes. Scratch: `<session scratchpad>/t707r3b/` (data root, profile, logs, screenshots,
sqlite copies under `db1/`). Helpers: `<session scratchpad>/t707r3b-scripts/`, copied from
`t707r3-scripts/` with `serve.mjs`, `watch.sh` and `watchloop.sh` repointed to `t707r3b`.
I added one helper of my own, `t707r3b/dump-state.cjs`, a read-only dump of `automation.state`
rows. I used one headed Chrome on a fresh profile. I did not touch the user's panel, profiles,
`.fluxiq`, Lab slots or lane trees. No source edits, no commits.

## Outcome

Partial.
- Install, sign-in, pairing, key and project all worked.
- **P1 and P2 are fixed live.** After the worker stopped, the panel dropped the dead code
  within 2.5 to 4.7 s and said it expired. The web modal showed a notice instead of vanishing.
- **D2 is fixed live.** Every cart "Save for later", "−" and "Move to cart" click whose
  centre was over the price paragraph went through at another visible point.
- The one paid build ran 18 min 2 s and cost **$0.1510** of the $0.25 ceiling. It made about
  **250 model calls** and **14 subflow trials**.
- It ended honestly as **partial, with no promoted Flow**. Step 6 (the rerun) therefore did not
  run, and no second paid build was started.
- The build got much further than round 3. The kettle part met its goal in several trials:
  Sage Green, 1.7 L, sold by Brightaisle, quantity 2.
- It failed on a **new Core defect (R1)**: trials ran on the site as earlier trials left it,
  because the reset kept the build's own Add to Cart and Save for later acts as un-undoable.
  As a result, the judge saw 4 kettles, then an empty cart with everything in Saved for later.

## What changed and why

- No source changes.
- Regenerated build outputs in the t707 trees:
  - Core `apps/web/.next` (web:build)
  - `domain/dist/host/web-panel-host.mjs`
  - the extension `dist/` and store ZIPs
- Scratch only: the `t707r3b/` and `t707r3b-scripts/` folders described above.

## Step log

| # | Step | Path | Observed |
| --- | --- | --- | --- |
| 1 | Core web | `node scripts/build-cache/cli.mjs fluxiq:build web:build` | `EXIT 0`; `fluxiq:build` "reuse ... inputs and outputs match the stamp"; `web:build` rebuilt in 483 s ("inputs changed: apps/web, packages/fluxiq, packages/fluxiq/dist"). D1 in the build: `packages/fluxiq/dist/.../repeat-guard/written-call.js` exists, and `outcomes.js` (17:12:53) is newer than `outcomes.ts` (16:47:24) |
| 1 | Domain host + setup | `node domain/scripts/build-web-panel-host.mjs`; `FLUXIQ_WEB_AUTOMATION_ROOT=<scratch>/t707r3b/root node domain/scripts/setup-fluxiq.mjs` | exit 0 both; fresh root with `.fluxiq` |
| 1 | Extension + ZIP | `pnpm.cmd --filter @fluxiq-web-extension/extension build`; `node apps/extension/scripts/release/package-extension.mjs` | exit 0 ("inputs changed: apps/extension, ..."). **`fluxiq-web-extension-chrome-0.1.0.zip`, 714145 bytes, 14 files, sha256 `379299d8...02d806`**, which differs from round 3's `fcb61a40`. Firefox: 714204 bytes, `35ea53e3...71c` |
| 2 | Serve | `t707r3b-scripts/serve.mjs`: `next start` on 127.0.0.1:3707, gateway ws://127.0.0.1:4707/client, provider keys and `FLUXIQ_*` stripped, `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25` | "Ready in 4.7s"; "Client gateway WebSocket bound ... ws://127.0.0.1:4707/client"; 3707 and 4707 listening |
| 2 | Scenario | `SCENARIO_LAB_RUN_TOKEN=<fresh scratch token> SCENARIO_LAB_PORT=3717 node apps/scenario-lab/dist/server.js` | `{"status":"ready","origin":"http://127.0.0.1:3717","port":3717}` |
| 2 | Chrome | Chrome 155.0.8059.82, headed, `--user-data-dir=t707r3b/profiles/chrome`, CDP 9357 | pid 21896 |
| 2 | Install | as a person: chrome://extensions, Developer mode (real CDP mouse click on `#devMode`), Load unpacked (mouse click), native folder dialog (`pick-folder.ps1`) to the unzipped ZIP | "FluxIQ Web Automation Client" 0.1.0, id `eodpbkbe...`, no errors (`shot-extensions.png`) |
| 3 | Sign-in | `admin`/`admin`; the forced new password was generated into `t707r3b/admin-pass.txt` and never printed | Home "Programs" as Administrator (`shot-home.png`). Declined Chrome's save-password bubble ("No thanks") |
| 3 | Panel | Extensions button (real mouse click), "Pin FluxIQ Web Automation Client" (UIA invoke), then the pinned toolbar button "FluxIQ / Has access to this site" (real mouse click) | Side panel "Get started with FluxIQ", three steps |
| 3 | Connection | isolation deviation, as in rounds 2 and 3: Settings set to ws://127.0.0.1:4707/client and http://127.0.0.1:3707, then Save | read back as set (the defaults were 4777/3000) |
| 3 | Pair, P1/P2 check | below | P1 and P2 both fixed. Then Connect gave code 218601; the modal showed 218601 and Confirm pairing (real click) paired it: session `298ecde0:ready`, 1 trusted (`shot-panel-paired.png`) |
| 4 | Key | Get started > Open Secret Keys > Add Key. Name "DeepSeek"; value typed from `.env.local` `DEEPSEEK_API_KEY` (never shown); provider DeepSeek (native select setter plus a change event); Continue > password > **Save Key** | "Secret key saved", DeepSeek, LLM, Enabled. Get started: "FluxIQ is ready.", all three steps DONE (`shot-gs-all-done.png`). No sign-out |
| 4 | Project | Get started > Describe an automation > Create project "Home shopping" | URL `...?start=describe&domainId=web-automation&project=b5c989a0...`; panel chat "What can FluxIQ do for you?". (My first press used a broad selector and hit "Show the conversation" in the web app. It only opened that drawer; I then pressed the dialog's own Create project) |
| 5 | Instruction | everything-store home in front (tab 598 px wide, side panel open); the exact `everything-store-kettle-to-cart` instruction (345 chars, byte-identical to round 3's `instruction.txt`) typed into `#conversationInput`; Send pressed (`#conversationSendButton`) | Build started 17:47:57 |
| 5 | Paid build | supervised live (`watch.log`, every 20 s), one build | Ended 18:05:59, **partial, no promoted Flow**. `bill=0` in every sample; no balance, billing or ceiling message |
| 6 | Rerun | - | **Not exercised**: `flows.status = draft`, 0 `graph_nodes`, 0 `flow_publications` |

Starting cart, read before the build: "Subtotal (2 items): $37". The phone case and AA
batteries were in the cart.

## P1 and P2 check (once)

1. 17:43:40: pressed Connect. The panel showed code **673333**, "Approve this browser in
   FluxIQ: In progress". The web modal "Client pairing request" showed 673333, expiring in 297 s.
2. 17:43:51.9: `ServiceWorker.stopWorker` on the FluxIQ worker only (`sw-stop.mjs`), which went
   `running` -> `stopped`. Samples are in `t707r3b/c2-samples.log`.
3. **Web (P2 fixed)**: at 17:43:54.4 (2.5 s after the stop), the modal had become a notice:
   "Pairing request closed. The pairing request closed before you confirmed it. Nothing was paired.
   The request closed before you confirmed, usually because the browser disconnected, so nothing
   was paired. Connect again from the browser to get a new code." It has a Close button and stayed
   until closed (`shot-c2-web-after-drop.png`).
4. **Panel (P1 fixed)**:
   - At 17:43:54.3 it still showed 673333.
   - By 17:43:56.6 (4.7 s after the stop) it showed "2 Connect this browser: Needs attention. The
     approval code expired because the extension restarted. Press Connect for a new code." with a
     Connect button. Step 3 was back to "To do" (`shot-c2-panel-after-drop.png`).
   - This held through 17:44:35. The worker stayed `stopped` the whole time, so the panel noticed
     without the worker coming back.
5. Gateway afterwards: `155e6eb2:disconnected`, 0 pairings, 0 trusted.
6. Connect again gave code 218601 at once. The modal appeared within about 7 s, and Confirm
   pairing paired it.

Minor: in the "expired" state, step 1 ("Open FluxIQ") also read "Next" instead of Done, although
the runtime was running. It turned Done again after Connect.

## The paid build: result, cost, calls and trials

- **Ending** (`build.e72ff611`, `ending.outcome: partial`): "The supervisor ended the build with
  only part of the Flow built", followed by Core's list of acts still on the target. Panel:
  "The build failed: the supervisor ended it with only part of the Flow built ... The Flow ...
  has ..." (`shot-panel-end.png`, full text in `t707r3b/panel-full.txt`).
- **Plan** (revision 1): Main, plus `cart_changes` (parts p1 kettles, p2 phone case) and
  `cart_table` (p3).
- **Briefs**: 11 in all. Eight briefs for `cart_changes`: two builds, then six repairs, each from
  its latest trial. Two `cart_table` briefs were blocked because `cart_changes` never passed. The
  last was a reset (brief-11).
- **Cost**: **$0.1510 billed** (`automation.state` `.../creation-spend`:
  `spentUsd = 0.151015986`, builds 1), against the $0.25 ceiling.
  - Builder returns (spentUsd/calls):
    - b1 0.0121/16
    - b2 0.0133/30
    - b3 0.0116/22
    - b4 0.0173/32
    - b5 0/0
    - b6 0.0212/34
    - b7 0/0
    - b8 0.0233/36
    - b9 0.0161/32
    - b10 0.0244/32
    - b11 (reset) 0.0032/3
  - So **237 builder calls, $0.1425**.
  - The supervisor took 10 recorded decisions for the remaining ~$0.0085. No per-call count is
    stored for it, so the total is **about 250 model calls**.
- **Trials**: 14 `runtime_runs`, all `subflow-trial.*`.
  - 6 ended `execution_failed`: Sage Green swatch covered (2), the step "ended somewhere other
    than expected", "Save for later" ambiguous, quantity control not found.
  - 8 ran to the end and were **judged no**.
- **Command attempts**: 79 browser commands (38 navigations).

### Why no Flow (traced): R1, trials run on the leftovers of earlier trials (Core site-reset)

The judge refused each of the 8 trials that ran through, because the site was not as the build
found it:
- brief-4 trial (17:54:22): "Kettle added: cart shows Tidewell Electric Kettle 1.7 L Sage Green,
  Sold by Brightaisle, quantity 2. But the phone case (Ridgeline Slim Case) is still in the cart".
  That revision lacked the Save for later step, so this one was a real miss.
- brief-6 trial: "Cart shows the sage green 1.7 L kettle with quantity 4, not 2 — s2 set
  quantity 2 but **the build's earlier adds (startedWith act-15, act-18) left 4**".
- brief-8 trial: "cart is empty ... while the header says 2 items in cart; **Saved for later holds
  7 items including three copies of the sage g...**". The trial's "move the phone case to Save for
  later" step found the case already saved and pressed the kettle line's Save for later.
- brief-9 trial: kettle quantity 2 met, but the phone case was "still in the cart". An earlier
  undo had moved it back; see `act-35` "on Move to cart".

The panel narrates the same drift: "The cart now shows 6 items", "Cart shows 4 kettles", "Cart is
empty and the kettles sit in Saved for later", "Saved for later (7 items)". At the end the store's
cart held **8 items, $334.92, with 5 saved** (`shot-cart-after-build.png`), against 2 items and
$37 at the start. Before trials, "Not done: the site first has to be put back the way the build
found it" appears 17 times, so the gate did ask for resets. Each builder then pressed an undo
(Delete, Save for later, Move to cart) and the next trial still ran on what was left.

Cause in Core: `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/site-reset/ledger.ts`.
- The build record holds 22 lasting acts, all `undoable: true`: Add to Cart is `create_new`, and
  Save for later and decrease quantity are `modify_existing`.
- The final reset still reported **17 of them as "the site offers no way to undo it"**. That
  wording (`project-agents/dispatch/reset-done.ts:28`, `supervisor/left-on-target.ts:67`) is given
  only to an act the ledger **kept**: its claim answers `candidate.undo_act_kept`.
- The ledger keeps an act in two ways:
  - The model names it under `cannotUndo`.
  - An undo is refused as `candidate.undo_wrong_target` (`ledger.ts` `target()`, ~line 255). An
    undo is admitted only on the act's own item (`spot`), on an item the act created (an item its
    own page showed new just after it), or in a follow-up dialog.
- Neither condition can hold for these acts:
  - An Add to Cart pressed on the **product page** sits in no row. The cart line it creates appears
    on **another page**, so the act has no item that an undo on the cart page can match.
  - A Save for later moves a line to a different list, so the reverse ("Move to cart") is on
    another item.
- brief-10's return shows the refusal directly: "core.run_node answered
  **candidate.undo_wrong_target**".
- Once kept, an act "is never asked for again and every trial runs with it in place"
  (`ledger.ts` header, t475). So each further trial adds 2 more kettles, and its Save for later
  step acts on whatever line is there.

This breaks the standing rule "A build resets the site before it re-runs its Flow ... undoing
exactly the lasting acts this build made (cart lines added, quantities changed)" (`AGENTS.md`,
user 2026-10-12). This task is exactly that case.

Fix direction (not implemented): let an act that creates or moves an item on another page carry
that item's identity, so its undo there is admitted. For example, the act's product and options
could be matched against the cart line that appears after it, or the line that moved could be
matched as the act's item. Alternatively, have the trial gate refuse to run a trial while a kept
act of this build is in place, rather than judging on leftovers. Either fix belongs in Core's
site-reset ledger.

Not proved: which acts were kept through `cannotUndo` and which through `undo_wrong_target`. Model
call inputs are not stored outside the Lab, and the per-brief ledger is in memory only.

### Other observations

- **Sage Green swatch refused as covered (correctly).** Three `web.dom.check` attempts
  (17:50:28, 17:50:47, 17:53:20) were refused: "the point 291,391 landed on p.css-1gkqqmu, which
  covers the target; it is part of div, a layer over the page whose controls are 'Deliver to Dana
  ...', 'Add to Cart', 'Buy Now' ...".
  - A read-only check after the build, on the product page in the same 598 px tab: the buy-box
    column paints over the swatch row, and **0 of 49 points** on the 46x46 swatch reach it (35 hit
    `p.css-0me067g`, 14 hit `div.css-0u7r8z5`) (`shot-product-swatch.png`). The page also scrolls
    sideways at this width.
  - The D2 probe ran and found no reachable point, so a person's click would also miss. This is
    the site's narrow layout, not a D2 defect.
  - Later trials avoided the swatch: the product URL `B0D7KXS4G7` already opens on Sage Green,
    and those trials used the quantity select and Add to Cart, which succeeded.
- **D2 live**: all 8 cart "Save for later" clicks, 2 "−" clicks and 1 "Move to cart" click went
  through at another point. Their details read "landed on the target; its centre 220,391 landed
  on p.css-1y6w9q1". In round 3 the same element blocked all 8 trials.
- **D1**: the `repeat_refused (failed)` codes in the returns each follow a call that really failed:
  b1 after `target_unobserved`, b3 after `target_covered (covered_by_layer)` and
  `address_not_shown`, b10 on a `submit_subflow` after
  `evidence_completion_parameters_unresolved`. No return shows a written step followed by a refusal
  of its repeat. This is consistent with D1 being fixed but does not prove it, because call inputs
  are not stored.
- Builder churn: several submissions were refused as unchanged ("sent the same steps again,
  unchanged", 7 times), or with "uses a kind of step that doesn't work on what it points at". The
  builders also hit `iteration_limit` six times. Most of this followed from R1: each builder
  repaired against a cart that kept changing under it.

## Commands run and observed results

- Build, serve, install, pairing, key and project commands as in the step log, each exit 0 or
  observed as stated.
- Gateway state from `GET /api/client-gateway/snapshot` (signed-in page): after the drop
  `155e6eb2:disconnected`, 0 trusted; at the end `155e6eb2:disconnected`, `298ecde0:ready`.
- Build trace, read-only on copies in `t707r3b/db1/`:
  - `project.sqlite`: `flows` 1 draft, `flow_publications` 0, `graph_nodes` 0, `subflows` 0,
    `runtime_runs` 14 (6 failed, 8 succeeded at run level, all judged no).
  - `global.sqlite` `automation.state`: build record, 11 builder returns, `creation-spend`.
  - Extension `command-attempts/*/attempt.json` (79).
  - Dumps: `t707r3b/build-record.json`, `t707r3b/trial-sessions.json`.
- Cleanup: stopped Chrome (21896 and its tree), `serve.mjs` (36720) with cmd 30456 and
  `next start` 25036, the scenario server (37840, its `nohup` 42980), the background shells I
  started (19092, 33796), the watch tail (1180, 36376). The watch loop exited on `watch.stop`.
  - `Get-NetTCPConnection -State Listen` printed "no listener on 3707, 4707, 3717, 9357".
  - No t707r3b chrome, node, next or helper process remained.
  - `git status --short` in both trees matched the snapshots taken at the start, except for this
    new report file.

## Not verified

- Step 6, the rerun with zero model calls, because no Flow was promoted. No second paid build
  was started.
- Which kept acts came from `cannotUndo` and which from `undo_wrong_target` (no call inputs or
  ledger snapshots are stored outside the Lab).
- D1's exact call inputs, for the same reason.
- The swatch layout was measured after the build, not at the moment of each refusal. The point
  291,391 and the covering buy box match the attempt records.
- Edge, Firefox and a wider window were not tried. The site was left with the build's leftovers
  (8 items in the cart, 5 saved); the scenario server was stopped, which resets it.

## Open questions or contradictions found

- The build record marks all 22 acts `undoable: true`, while the ending calls 17 of them ones
  "the site offers no way to undo". The site does offer a way: Delete, Move to cart and the
  quantity controls. Core's wording blames the site for what is its own identity rule (R1). A
  person reading the ending is misinformed.
- The supervisor dispatched eight `cart_changes` briefs, each repairing "from its latest trial",
  without noticing that the cart state drifted between trials. Nothing in Core tells the
  supervisor that a judged-no trial started with kept acts in place.
- The ending reason begins with a stray "T" ("... with only part of the Flow built. — T Still on
  the target ..."). The model's own reason appears to have been cut to one character by
  `left-on-target.ts` `reason()` once Core's note filled the 2000-character record.
