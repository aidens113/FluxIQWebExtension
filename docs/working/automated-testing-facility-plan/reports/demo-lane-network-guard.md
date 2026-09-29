# Demo-lane network guard (Open defects 5 and 6)

Worker report, 2026-09-28. A machine crash interrupted the first attempt before
any source edit. On resume every owned file was confirmed unchanged against
HEAD, NUL-free and complete; at the end every touched file was checked again
(0 NUL bytes each).

## Outcome

**Done.** Every browser launch in `packages/test-runner` now runs under the
network guard, or is a sanctioned direct launch that a structural test proves
guarded. The extension's service-worker background was proven to be a real
hole: under the old guard it fetched `http://example.com/` from the internet
with status 200. It is now intercepted, and a per-worker proof fails the lane
if interception ever stops working. One residual cannot be enforced in
Playwright 1.51.1 and is stated below.

## Service-worker evidence (measured 2026-09-28, one observation each)

Probe: a throwaway MV3 extension in the worker's scratchpad (not in the repo).
Setup: Playwright 1.51.1 with `channel: "chromium"`, headless. It used three
loopback listeners: an allowlisted origin A, an unlisted `127.0.0.1` port U,
and `127.0.0.2` as an IP literal L. It also used `example.com` over the real
internet, which this machine can reach (Node `fetch` returned 200). The
background's requests were driven with `worker.evaluate`. The guard was stood
in by a `context.route("**/*")` handler allowing only A.

| Config | A | U | L | http(s)://example.com | background ws to U | route handler saw |
| --- | --- | --- | --- | --- | --- | --- |
| guard only (the old state) | 200 | **200** | **200** | **200 (internet)** | reached server | **nothing** |
| guard + `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1` | 200 | blocked | blocked | blocked | reached server | all HTTP, `serviceWorker()` set |
| resolver rules + `--no-proxy-server`, no guard | 200 | 200 | blocked | blocked | reached server | n/a |
| all three | 200 | blocked | blocked | blocked | reached server (ws to L blocked) | all HTTP |

Findings:

1. `playwright-core@1.51.1/lib/server/chromium/crServiceWorker.js:38` gives a
   service-worker target a network manager only when
   `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS` is set. Only with that
   manager do the worker's requests reach `context.route`. Setting the
   variable makes the existing guard intercept the extension background's
   HTTP(S). `serviceWorkers: 'block'` was not used, because it would disable
   the MV3 background itself.
2. `routeWebSocket` never sees a service worker's WebSocket, because it works
   by script injection into pages. `--host-resolver-rules` blocks non-loopback
   names and even the `127.0.0.2` literal. **Not enforceable:** a background
   WebSocket to an unlisted port on an allowlisted host (on loopback, the
   machine itself).
3. Playwright adds no `--no-proxy-server` by default, and a system proxy would
   resolve names past the resolver rules, so the flag is now added.
4. **Contradiction with Current State item 5:** no test-runner lane set
   `--host-resolver-rules` before this change. The `extension-context.ts:74`
   rules it cites belong to the extension e2e fixture only.

End-to-end check of the built code (scratchpad `probe2.mjs`, real Chromium,
through `launchGuardedPersistentContext`):

- `routing-on`:
  - The proof passed.
  - The background's fetches to an unlisted port, `example.com` and
    `api.deepseek.com` were blocked and recorded as `request` violations
    (`resourceType: "fetch"`). Only the allowlisted request reached a server.
  - `assertNoViolations()` threw `DeterministicNetworkViolationError ...
    blocked 4 unexpected destination(s)`.
- `routing-off` (the variable deleted, simulating the switch failing):
  - The proof recorded
    `service-worker:chrome-extension://lljpahgkhdnnffbaanlfhdppoidljbea`.
  - The resolver rules still stopped `example.com` and `api.deepseek.com`.
    Only the unlisted loopback port was reached.

## What changed and why

- `src/network-guard.ts`:
  - Sets `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1` when the module
    loads. Every guarded lane imports it statically before it launches, so
    the run, interactive and replay lanes are covered too.
  - `installDeterministicNetworkGuard` now proves every service worker
    (present at install, or attaching later through `context.on`). The worker
    fetches a one-off canary at `http://fluxiq-network-guard-canary.invalid/<uuid>`.
    If the route never sees it, a `service-worker` violation is recorded. A
    worker that closes before it can be asked is not a finding.
  - New guard method `serviceWorkersProven()`.
  - Each internal-protocol pass-through is now documented. They are kept
    because `chrome-extension:`, `data:`, `about:` and `blob:` are all answered
    inside the browser, and the extension set is pinned by
    `--disable-extensions-except`. `file:`, `chrome:`, `filesystem:`,
    `javascript:` and `ftp:` stay refused, which is now tested.
- New `src/guarded-browser/`:
  - `launchGuardedPersistentContext`: launches, appends the containment
    switches, and installs the guard before returning. It closes the browser
    if the guard fails, and `proxy` is refused by type.
  - `networkContainmentArgs(origins)`: resolver rules that exclude loopback
    plus the lane's own allowlisted hosts, so an `existing` target on a remote
    `https`/`wss` host (allowed by `target-config.ts:320-329`) still resolves.
    Hosts that would inject a rule, such as `a,b`, are refused. Also adds
    `--no-proxy-server`.
  - `loopbackLanePolicies`: the extension browser may reach the Lab (both
    loopback spellings, plus a second port via the Lab's signed proof, as in
    the run lane), the panel's HTTP origin and the gateway WebSocket.
  - `panelNetworkPolicy`: the panel origin only. Core's web app is a
    production Next build with no WebSocket, service worker or remote asset;
    I checked Core's `apps/web` sources for these.
  - No model provider is on any list: provider calls go through Core's Node
    process.
- `src/demo-workspace/browser-session.ts`: all three launches go through the
  guarded launcher. `withDemoBrowser` proves containment right after the
  extension worker appears, before the operation spends anything, and asserts
  again after the operation, before `finalize("passed")`.
  `withDemoPanelBrowser` asserts after its operation.
- `src/ui-e2e/topology.ts`: both browsers are guarded. The guard is
  installed before the provider-free endpoint stubs; Playwright runs the
  newest route first, so `blockedProviderRequests()` still counts every
  attempt. Containment is proven at start, and each `journey()` fails on
  violations new since it began.
- `src/run-scenario/browser-session/launch-browser.ts`: adds
  `networkContainmentArgs` scoped to the run's scenario, FluxIQ and gateway
  origins.
- Tests:
  - `guarded-browser/tests/`: `containment-args`, `launch-guarded-context`,
    `lane-network-policies` (proves exactly what each lane may reach and that
    DeepSeek, the user's 3000/4711, the demo defaults 3300/4877, unlisted
    loopback and `127.0.0.2` are refused), and `launch-containment`. The last
    is the structural test. It scans `src/` with comments stripped, and any
    `chromium|firefox|webkit.launch*/connect*` or `.launchPersistentContext(`
    outside five sanctioned files fails the build. For each sanctioned file it
    checks that the guard is installed before the first `newPage(` after the
    launch. It sits here, not in `src/tests/`, because the audit caps that
    directory at its baseline of 49 files.
  - `tests/network-guard.test.ts`: six new cases (service-worker proof,
    scheme pass-through), and stubs updated.
  - `install-run-network-guard.test.ts`: stub updated with no service workers.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner test` -> `# tests 1489`,
  `# pass 1488`, `# fail 1`. The one failure is `not ok 204 - the progress
  observer is installed before the click and reads only Core's own progress
  labels` (`demo-llm-create-ui/tests/exploration.test.ts:194`). It is not
  caused by this change: it reads Core's
  `apps/web/.../BlankFlowAuthoringPanel.tsx` and expects
  `aria-label="Build Flow from instructions"`. Core commit `68bad85`
  (2026-09-28 13:59, "The panel stops asking permission for its own work...")
  removed that string, as `git log -S` shows. All 16 new or changed guard,
  containment and policy tests pass.
- `pnpm --filter @fluxiq-web-extension/test-runner check` -> exit 0.
- `node scripts/structure-audit.mjs` -> `1 violation(s) across 1 rule(s)`:
  `FAIL [working-docs] docs/working/README.md is out of date`. This is not
  mine: the rule indexes only top-level `docs/working/*.md`, and this report
  is in `reports/`. My two earlier findings are fixed: `directory-files`
  (`src/tests/` 50 > 49) and `swallowed-failure` (`network-guard.ts`; both
  catches now carry a best-effort reason). There is one advisory warning:
  `ui-e2e/topology.ts: 433 lines` (it was 399).
- Structural-test mutation check: I planted
  `chromium.launchPersistentContext("x", {})` in `ui-e2e/topology.ts`. The
  test failed 2 of 3 with "These files launch a browser without the network
  guard ... ui-e2e/topology.ts". After restoring the file from a backup, 3 of
  3 pass.
- The probe runs described above.

## Not verified

- No live `demo:*`, `demo:llm:*` or UI e2e lane was run under the guard (the
  brief forbids a Lab run). The first live lane is the real test that the
  panel and Lab fixtures need nothing off-list. A violation now fails the
  lane.
- Behaviour change in the run, interactive and replay lanes: the extension
  background's HTTP now passes through their guards. Anything off-list that
  it used to reach silently now fails those lanes. This has not been
  exercised live.
- `interactive-session.ts` and `saved-flow-replay/replay-browser.ts` are not
  mine, so they did not get `networkContainmentArgs`. Their background
  WebSockets to non-loopback hosts are therefore not blocked. Their HTTP is
  covered by the guard and the proof.
- The proof runs in any page-registered service worker too, not only the
  extension's. That is harmless, but not exercised live.
- Each probe figure is a single observation on this machine.

## Open questions or contradictions found

1. Current State item 5 says `--host-resolver-rules` "still covers" the
   service-worker traffic. It covered no test-runner lane; see finding 4.
2. The residual that cannot be enforced: a service worker's WebSocket to an
   unlisted port on an allowlisted host.
3. For the supervisor: `interactive-session.ts` and `replay-browser.ts` should
   move to `launchGuardedPersistentContext`, or add `networkContainmentArgs`.
   `docs/working/README.md` needs `pnpm structure:baseline`. The
   `exploration.test.ts:194` assertion needs updating to Core's new label.
