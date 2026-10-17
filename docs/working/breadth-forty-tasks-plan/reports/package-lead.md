# package-lead report (t706): Install FluxIQ, as a new person

Written as the work lands. Worktree `fxwork/t706-install-package-proof`, base
`3c32eadc`. Every browser below is headed, on a fresh profile under the
session scratchpad; no user profile, panel, `.fluxiq` or Lab slot was used.

## Packages built

- `pnpm.cmd --filter @fluxiq-web-extension/extension build` -> exit 0
  (`core-build: ... current`, `build-cache: reuse ... inputs and outputs match the stamp`).
- `node apps/extension/scripts/release/package-extension.mjs` (the command in
  `docs/user/install.md`) -> exit 0:
  - `fluxiq-web-extension-chrome-0.1.0.zip` 712292 bytes, 14 files, sha256 `a53cfd49...60ce`
  - `fluxiq-web-extension-firefox-0.1.0.zip` 712368 bytes, 14 files, sha256 `4a9e8664...7ef3`
  - warn: gecko id `fluxiq-web-automation@example.local` is a placeholder.
- `--release` mode: chrome ok; firefox FAIL on the placeholder gecko id (owner-only, below).

## Step log (person's path vs test shortcut)

| # | Step (doc) | Browser | Path | Result |
| --- | --- | --- | --- | --- |
| 1 | Unzip Chrome package into a kept folder (install.md 2) | - | person (unzip) | 14 files |
| 2 | Open `chrome://extensions`, Developer mode, Load unpacked, pick folder | Chrome 155.0.8059.82 | person's clicks; page clicks sent over CDP, native folder dialog filled through Win32 messages (no `--load-extension`) | Installed, id `ddiljigjpbdbkpigfdndbpcejkeplifk`, 0.1.0, no errors |
| 3 | Same in `edge://extensions` | Edge 155.0.4283.62 | same | Installed, id `iciniipnddjacedgkmjmmmembhiiaoib`, 0.1.0 |
| - | Firefox | not installed (only Playwright's bundled Firefox) | not exercised | - |
| 4 | Start FluxIQ (install.md 1, quickstart 1) | - | **shortcut**: `pnpm dev` would run `next dev` inside the shared Core checkout (`fxwork/!FluxIQ/apps/web/.next`, which holds a production build other tasks use) and would load the worktree's `.env.local`, which holds a DeepSeek key a new person would not have. Instead the two preparation steps of `pnpm dev` ran as written (`domain/scripts/build-web-panel-host.mjs`, `domain/scripts/setup-fluxiq.mjs`) against a fresh empty root, and the Lab's staged Core build was served with `next start` on 3706 / gateway 4706 | 200 on `/`, gateway listening, snapshot 401 unauthenticated |
| 5 | Sign in or create the local account (quickstart 1) | Chrome | person | Sign-in form gives no hint. First account is `admin` / `admin` (Core `identity-access/runtime/service.ts` `ensureDefaultAdmin`), then a forced "Replace the temporary password". **Doc gap, fixed in quickstart.** |
| 6 | `/get-started` checklist (quickstart 1) | Chrome | person | **Core defect**: step 1 says "The FluxIQ runtime did not answer" on a healthy runtime, so steps 2-3 stay blocked. Page is also unstyled. Reported to supervisor |
| 7 | Click the FluxIQ toolbar button (quickstart 2.1) | Chrome | person: Extensions menu, Pin, toolbar button, real mouse clicks through UI Automation | Side panel opened with "Get started with FluxIQ" |
| 8 | Connection address (quickstart 2, "Can't reach") | Chrome | isolation deviation: set to `ws://127.0.0.1:4706/client` and `http://127.0.0.1:3706` in Settings > Connection; a person on default ports skips this | Saved |
| 9 | Connect, compare code, approve (quickstart 2.2-2.3) | Chrome | person | **Extension defect**: approval at ~108 s failed. The service worker was stopped ~35 s after the code appeared (no traffic while waiting), the socket closed, Core minted the token for the closed session, and the panel stayed on "In progress" with a stale code. Reproduced a second time (worker gone between 40 s and 50 s). **Fixed** (keepalive while pairing/connecting), see below |
| 10 | Update the unpacked install (install.md "Updating") | Chrome | person: replace folder contents, reload button on the card | Settings survived the update |
| 11 | Pair again, approving after 80 s | Chrome | person | Worker alive at 20/40/60/80 s, no disconnect; codes matched; panel green dot, "Connected to FluxIQ" |
| 12 | Chat after pairing | Chrome | person | "This chat isn't updating: ... FluxIQ hasn't said which project this browser belongs to." A fresh install has no project; the quickstart never mentions one |
| 13 | Add DeepSeek key (quickstart 3) | Chrome | person (value typed from the worktree's `.env.local` without being shown) | Listed: DeepSeek, llm, DeepSeek, global, enabled. Provider defaults to OpenAI in the form |
| 14 | Create a project via Get started > Describe an automation | Chrome | person | Project created without a domain; panel chat refused it: "This browser was paired for web automation projects, and this project is not one". **Doc gap, fixed** (Home > Web Automation > Automation Studio > Create project); the Get started route itself is a Core gap (it drops `domainId`) |
| 15 | Create a project via Web Automation > Automation Studio | Chrome | person | Project "Kestrel Lane" (web automation); panel chat ready ("What can FluxIQ do for you?") |
| 16 | First automation (quickstart 4) on `company-website` (scenario server `apps/scenario-lab/dist/server.js` on 3716, run token local) | Chrome | person: page in front, instruction typed in the panel chat | Attempt 1: "The build failed: your model key is locked" (key added during this sign-in; no model call). **Doc gap, fixed** (log out and in after adding the key). After re-login, "Build it again": plan made ($0.01 kept back, allowance $0.24), subflow dispatched at 13:51:48, then nothing for 6 min: no model connection open from the server, no project writes, page never touched. Stopped with **Stop build**: "Build stopped. The Flow was not promoted. Nothing was changed." **Root cause (Core)** below. Not retried: one paid build only |
| 17 | Install + pair Edge | Edge 155 | person (same clicks; Edge's Extensions menu, pin, toolbar button) | Reloaded the updated folder via **Reload**; paired with approval after ~55 s, worker alive, green dot. The approval modal appeared only once the Chrome window was in front (the modal stops polling while its tab is hidden), which matches the doc's "switch to the FluxIQ web app" |

Observation only: each browser was started with `--remote-debugging-port` so
the agent could click and read pages; a person would not need it.

## Per browser

| Browser | Package (file, version) | Installed how | Paired | First automation |
| --- | --- | --- | --- | --- |
| Chrome 155.0.8059.82 | `fluxiq-web-extension-chrome-0.1.0.zip`, final sha256 `fcb61a40...05fa4` (pre-fix `a53cfd49...60ce`) | Load unpacked of the unzipped ZIP; updated by replacing the folder and the card's reload button | Yes (after the fix; failed before it) | Not reached: build stalled after planning (Core defect C3), stopped by the person's Stop build |
| Edge 155.0.4283.62 | same ZIP | Load unpacked; updated with **Reload** | Yes (approval after ~55 s) | Not attempted (one paid build) |
| Firefox | `fluxiq-web-extension-firefox-0.1.0.zip`, sha256 `4b7cdf12...0c58` | Not installed on this machine | No | No |

## Defects and fixes

**E1 (fixed, extension): pairing failed for anyone slower than ~30 s.**
While the session waits for approval nothing crosses the socket, so Chrome's
MV3 idle rule stopped the service worker 30-45 s after the code appeared and
closed the socket. Fix: the 20 s heartbeat tick now calls a cheap extension
API (`chrome.runtime.getPlatformInfo`) while the state is `pairing` or
`connecting`, which resets the idle timer for the whole 5-minute approval
window; connected behaviour is unchanged.
- Files: `apps/extension/src/background/connection/gateway-session.ts`
  (optional `keepAlive` handler, tick dispatch), `apps/extension/src/background/connection.ts`
  (wiring), tests `apps/extension/src/background/connection/tests/gateway-session.test.ts`
  (5 tests: pairing 15 ticks -> 15 keepalives, connecting, connected -> heartbeat only,
  after drop and after close -> nothing). Worker report: `package-lead-keepalive.md`.
- Live proof: Chrome approval after 80 s and Edge after ~55 s both paired; the
  worker was present at every 20 s check (pre-fix: gone by 45-50 s).
- Not covered: Firefox's event page lifetime (no Firefox here). The extension
  architecture doc (`docs/architecture/extension-client.md`, not owned by this
  lane) should gain one line on the pairing keepalive.

**D1-D5 (fixed, docs/user).** `install.md`: Developer mode switch location in
Chrome and Edge, the card that confirms the install, pin the toolbar button,
reload closes the panel. `quickstart.md`: first sign-in is `admin`/`admin`
then a forced new password; Connect under "Connect this browser", six-digit
code, **Confirm pairing**, 5-minute window; where the connection settings
really are (Settings > Connection, both addresses, Save); the Add Key form
field by field (provider starts on OpenAI), Continue > Authorize New Key with
the password; log out and in to unlock a new key; create a Web Automation
project first and build from the panel chat.

## Core defects (reported, not fixed: no Core edits in this lane)

- **C1 `/get-started` never passes step 1.** `apps/web/src/lib/fluxiq.ts:58`
  returns `clientGatewayError: null` on a healthy runtime;
  `features/automation-studio/onboarding/useOnboardingReadings.ts:85`
  (`validGateway`) accepts only a string or `undefined`, so the whole reading
  is rejected and the page shows "The FluxIQ runtime did not answer", with
  pairing and key steps blocked. The page also renders without the app's
  layout styling. The quickstart still points people to it.
- **C2 Approving a pairing for a disconnected session.**
  `packages/fluxiq/src/client-gateway/service/pairing-flow.ts` `complete()`
  does not check `session.status`; it registers durable trust, sends the token
  to a closed socket (lost), and `attachTrustedClient` marks the dead session
  `ready` (observed: session `2359d638` `status: ready` with `disconnectedAt`
  set). The UI reports success. E1 removes the usual trigger; any other socket
  drop during approval still hits it.
- **C3 Commands routed to that dead session (stalled the first build).**
  `packages/fluxiq/src/runtime/client-gateway-transport.ts` `selectSession`
  picks the first `ready` session with the preferred clientId; the C2 orphan
  has the same clientId and comes first, so the build's browser commands went
  to a closed socket and the build waited forever (6 min: no model connection,
  no writes, page untouched). Inferred from the code and the session list, not
  traced command by command. A runtime restart clears it (sessions are in
  memory); a rerun of the first automation after that, or after the Core fix,
  is the next proof step and needs a paid-build go-ahead.
- **C4 Get started's three buttons create projects with no domain**
  (`/get-started` -> `/programs/automation-studio?start=describe` without
  `domainId`), which the paired extension then refuses.
- **C5 A key added during a sign-in stays locked until the next sign-in**, with
  no unlock control on Secret Keys; the chat says "unlock your keys in FluxIQ"
  without saying how.
- **C6 First sign-in screen does not say `admin`/`admin`** (documented now).

## Only the owner can do

- Choose the permanent Firefox add-on id: `--release` fails on
  `fluxiq-web-automation@example.local`.
- AMO signing (Firefox release builds will not keep an unsigned add-on),
  Chrome Web Store and Edge Add-ons submission and their developer accounts.
- Set the CI owner values in `release-packaging.md` (`FLUXIQ_CORE_*`).

## Validation (observed)

- `EXTENSION_TEST_BUILD_LABEL=t706-keepalive node scripts/test-extension.mjs background/connection/tests`
  (in `apps/extension`) -> `# tests 254`, `# pass 254`, `# fail 0`. The worker
  reports 4 of the new tests fail with the fix line removed.
- `pnpm.cmd --filter @fluxiq-web-extension/extension build` -> `core-build: ... current`,
  `build-cache: reuse ... restored from the shared store`; both `dist/chrome` and
  `dist/firefox` `background/index.js` contain the keepalive call (grep count 1 each).
  The worker's uncached run: tsc passed, chrome, firefox, e2e-chromium each "verified 22 files".
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (203 warning(s), 639 baselined).`
- `node apps/extension/scripts/release/package-extension.mjs` -> both ZIPs ok,
  14 files each, read-back verified; repeat run gave identical hashes.

## Spend

One paid build: the plan call ("$0.01 kept back", allowance $0.24 of the
default purse), then the stall; no model connection was open afterwards.
Attempt 1 made no model call (key locked).

## Not exercised

Firefox (not installed); the store and signed-package paths; `pnpm install` /
`pnpm build` in Core and `pnpm dev` itself (see step 4); a first automation
reaching a result; run-again and adaptation (quickstart 5); uninstall.

## Cleanup

At hand-back the isolated runtime (3706/4706), the scenario server (3716) and
both scratchpad-profile browsers were stopped; no listener remained on
3706, 4706, 3716, 9355 or 9356. The isolated data root, profiles and helper
scripts stay in the session scratchpad (`t706/`, `t706-scripts/`), so the
run can be restarted with `t706-scripts/serve.mjs` for a rerun.
