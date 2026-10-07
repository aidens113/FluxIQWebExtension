# live-C-r4-next-page: Next page refused `node_not_runnable_here` (lane C, round 4)

## Outcome

Done. The cause is not in the domain, Core or the extension source. It is in the
Lab's persistent browser profile. Chromium keeps the extension's background
service worker that a persistent profile first registered, and it keeps running
that copy on later launches even after the unpacked files on disk change (a
changed manifest `version` does not help either). Lane C's persistent workspace
`t274-c` was therefore running a background worker from a build that predates
`web.dom.next_page` (added in `3ac340bc`, 2026-10-06 17:49 -0700). That worker's
gateway mapping refuses an action type it does not know with `UNSUPPORTED_TYPE`
before anything reaches the page. The domain maps that code to
`invalid_input` + `node_not_runnable_here`.

Fix (Lab, `packages/test-runner`): every persistent Chromium launch now removes
the profile's `Default/Service Worker` store before it launches. Sign-ins,
cookies and storage stay. A source-reading test fails the build if a launch site
does not do this.

## Cause, file and line, and why

1. `domain/src/runtime/llm-evidence/node-run/run.ts:367` dispatches
   `web.dom.next_page`. The client answers `failed` with
   `failure.code = web.action.unsupported_type`, and
   `action-failure/refusal.ts` turns that into `invalid_input` /
   `node_not_runnable_here`. The lead's trace of this part was correct.
2. The only producers of that code on this path are the worker's gateway mapping
   (`domain/src/client/gateway-mapping.ts` `normalizeWebAutomationActionType`,
   answered at once by `background/connection/gateway-session.ts:313-321`) and
   the content script's fallthrough (`content/actions/execute.ts:230`). Both fire
   only for an action type the running build does not know. The domain sends
   the canonical `web.dom.next_page` (probe below).
3. The current extension build handles `web.dom.next_page` correctly from
   end to end. The cached worker did not: at `3ac340bc^`, the action types list has
   no `web.dom.next_page` (`git show 3ac340bc^:domain/src/actions/types.ts | grep -c web.dom.next_page` -> `0`),
   while `normalizeWebAutomationActionType` already answered unknown types with
   `UNSUPPORTED_ACTION_TYPE_FAILURE` (line 393 at that commit), and
   `gateway-session.ts:316` answered the rejection without sending anything to the page.
4. Why the old worker ran: `packages/test-runner/src/run-scenario/browser-session/launch-browser.ts`
   (used by the run lane and the Chrome chat check) launched
   `chromium.launchPersistentContext(topology.allocation.browserProfileDir, --load-extension=...)`.
   With `FLUXIQ_TEST_TARGET` / `FLUXIQ_TEST_PERSISTENT_WORKSPACE` set (run.json
   `invocation.fluxiqEnvironment`), that directory is the persistent workspace's
   `browser-profile` (`allocation.ts:101`), which is reused across runs. Chromium
   serves the content scripts, pages and manifest fresh from disk, but runs the
   background worker it stored in the profile.

The run's own timing fits this. Each refused call took about 980 ms, nearly all
of it two page captures. The dispatch itself returned at once, which is what a
mapping rejection in the worker looks like. A content-side Next page waits for
the list and presses the control, which takes several seconds.

## Evidence (provider-free, nothing paid, no Lab paths)

- **Extension bundles are not the cause.** The Lab instance's built files
  (`apps/extension/.lab-instances/t274-slot-1/dist/e2e-chromium/{background,content,page-world}/index.js`,
  `manifest.json`) are byte-identical (`cmp`) to a fresh
  `pnpm.cmd run test:e2e:build`. Both contain the `web.dom.next_page` route.
- **The real worker runner moves the list.** A scratch Playwright spec ran the
  real `runBrowserActionCommand` in the real extension (e2e runtime harness)
  against the everything-store results page. Result:
  `NEXT_PAGE {"status":"succeeded","message":"The list moved to its next page.","nextPage":{"outcome":"moved","by":"next","page":2},...&page=2}`.
- **The real service worker, driven over a stand-in gateway, moves the list.**
  A scratch spec with a fake WebSocket gateway (`server.session_ready`, then
  `server.execute_action`) drove the real service worker after a restart. It ran
  detection around the first result's h2 link (as the live run did with t237),
  a list read, a look, and then `web.dom.next_page` with the detected
  `{item, pagination:{next}}`. Result:
  `NEXT_PAGE_RESULT {"status":"succeeded","message":"The list moved to its next page."} ...&page=2`.
- **The domain sends the canonical command.** A scratch domain probe (look,
  detect, then run `web.output.dom-next_page` with `{nextPage:{list:<handle>}}`
  on the captured product-catalog detection) sent
  `{"actionType":"web.dom.next_page","parameters":{"nextPage":{"item":"[data-testid=\"product-card\"]","pagination":{"next":"[data-testid=\"pagination-next\"]"}}}}`.
  `webAutomationActionFromGatewayCommand` mapped it without rejection.
- **Chromium keeps the stored worker.** A scratch script copied the e2e build to a
  fixed path, stamped `background/index.js` with a build marker, and relaunched one
  persistent profile:
  - `launch 1 (files stamped A, version unchanged): [ 'A', '0.1.0' ]`
  - `launch 2 (files stamped B, version unchanged): [ 'A', '0.1.0' ]`. The files served were `globalThis.__probeBuild = "B"`.
  - `launch 3 (files stamped C, version 0.1.0.1): [ 'A', '0.1.0.1' ]`. The manifest was fresh and the worker was still A.
  - `launch 4 (files stamped D, version 0.1.0.1 again): [ 'A', '0.1.0.1' ]`
  - With `Default/Service Worker` removed before launch: `launch 3 on B after removing Default/Service Worker: B`,
    `launch 4 on C (store not removed): B`, `launch 5 on C after removing it again: C`.
  - `chrome.runtime.reload()` is not a usable fix. On an extension loaded from
    the command line it unloaded the extension (`net::ERR_BLOCKED_BY_CLIENT`), and
    the next launch of that profile had no service worker at all.
- Every scratch spec, script and probe has been deleted. Nothing touched
  `lab-slots/`, other lanes' trees or `persistent-isolated/t274-c`.

## Fail-first output

Test `packages/test-runner/src/run-scenario/browser-session/tests/launch-browser-worker.test.ts`
launches a real headed Chromium twice through `launchBrowser` on one profile. It
uses a two-file extension whose worker reports its build, and it rewrites that
build between launches at the same path and version. Before the fix:

```
not ok 1 - a persistent profile runs the background worker on disk, not the one it ran before
  error: |-
    the second launch runs the second build's worker
    'first' !== 'second'
# pass 0
# fail 1
```

## Fix

- New `packages/test-runner/src/guarded-browser/forget-cached-service-workers.ts`:
  `forgetCachedServiceWorkers(userDataDir)` removes `<userDataDir>/Default/Service Worker`
  (`rm` with `recursive` and `force`, so it does nothing on a fresh profile). It is
  exported from `guarded-browser/index.ts`.
- It is called right before each persistent Chromium launch:
  - `run-scenario/browser-session/launch-browser.ts`: the run lane and the Chrome chat check, which is the path the failing run used.
  - `guarded-browser/launch-guarded-context.ts`: the demo workspace and UI e2e lanes.
  - `interactive-session.ts`
  - `saved-flow-replay/replay-browser.ts`
- Tests:
  - `run-scenario/browser-session/tests/launch-browser-worker.test.ts`: the fail-first behavioural test above.
  - `guarded-browser/tests/forget-cached-service-workers.test.ts`: the store is removed, and `Cookies` and `Local Storage` stay. A fresh profile is untouched.
  - `guarded-browser/tests/fresh-extension-worker.test.ts`: reads the sources and fails if any persistent Chromium launch does not call `forgetCachedServiceWorkers(` before it launches, including any new launch site.

## Commands run and observed results

- `pnpm.cmd run build` (packages/test-runner) ->
  `{"build-cache":"build","step":"test-runner:build",...}`. No errors.
- `node --test dist/run-scenario/browser-session/tests/launch-browser-worker.test.js dist/guarded-browser/tests/forget-cached-service-workers.test.js dist/guarded-browser/tests/fresh-extension-worker.test.js dist/guarded-browser/tests/launch-guarded-context.test.js dist/guarded-browser/tests/launch-containment.test.js`
  -> `# tests 10`, `# pass 10`, `# fail 0`. This includes
  `ok 10 - a persistent profile runs the background worker on disk, not the one it ran before`.
- `node --test dist/tests/interactive-session.test.js dist/saved-flow-replay/tests/*.test.js` -> `# tests 20`, `# pass 20`, `# fail 0`.
- `pnpm.cmd run check` (packages/test-runner, which is the tsc typecheck) -> `{"build-cache":"build","step":"test-runner:check",...}`. No type errors were printed.
- `node scripts/structure-audit.mjs` (downstream root) -> `structure-audit: passed (176 warning(s), 118 baselined).` None of the warnings name a changed file.

## Not verified

- I did not read the contents of the `t274-c` profile's `Default/Service Worker`
  store, because the brief forbids touching it. The claim that this profile's
  stored worker predates `3ac340bc` is inferred from four things: the refusal
  can only come from an unknown action type; the current bundles handle the
  action; and Chromium demonstrably keeps the first stored worker. It also
  assumes the workspace was first used before 17:49 on 2026-10-06, which I did
  not check. A read-only check, before the next lane C launch
  (which now deletes the store), would settle it:
  `grep -c "web.dom.next_page" -r "<downstream>/test-runs/instances/t274-slot-1/persistent-isolated/t274-c/browser-profile/Default/Service Worker/ScriptCache"`.
  0 confirms the cause.
- No live or Lab run after the fix. Whether Next page now works live is still
  open, and the next lane C round will show it.
- The Firefox chat launcher (`extension-chat-check/firefox/launch-firefox.ts`)
  is unchanged. It installs a temporary add-on, which is a different mechanism,
  and it was not probed.
- No full suites were run, per the brief.

## Open questions or contradictions found

- **Lane C's earlier live results ran a stale background.** Any lane that used
  a persistent workspace has run the background worker its profile first
  stored. Each background-side change made after that profile was created
  (runner, continuations, page pace, navigation landing, and so on) was absent
  from those runs, while the content scripts were current. Those runs' verdicts
  on background behaviour need re-reading in that light. Isolated
  (non-persistent) runs get a fresh profile every time and are unaffected.
- The lead's suspects (gateway-mapping parameter building,
  `gateway-action-parameters.ts`, command options, a stale *built* bundle) were
  each checked and cleared. The bundle on disk was current; the copy in the
  profile was not.
- `docs/architecture/testing-facility.md` may warrant one line on the
  persistent profile forgetting stored service workers at every launch. This
  report does not own that file, so I did not edit it.
