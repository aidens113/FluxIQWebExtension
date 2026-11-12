# W4-SEC1b: the Lab's Chrome side-panel press uses trusted input

## Outcome

Done for the driver. The side-panel driver's `press` now sends real mouse input over CDP to the side
panel's own target. A live probe in Chrome's real side panel showed the press arrives as a trusted
click while the panel has a person's activation. The old script click arrives untrusted and without
activation. The full provider-free ask claim could not reach the press: its saved approval Flow is
refused by Core before any ask appears, and that cause is separate from this change (see Open questions).

## What changed and why

All paths are under `packages/test-runner/src/extension-chat-check/`.

- `panel-driver.ts`: `extensionViewPanelDriver(control, panelPath, openSession?)`. Its `press` no
  longer calls `button.click()` through `chrome.extension.getViews()`. It opens a CDP session on the
  control tab (`control.context().newCDPSession(control)` by default, and tests can inject one), then
  calls `pressInViewTarget` every 300 ms until it gets `"pressed"` or reaches `timeoutMs`. It always
  detaches the session afterwards. The `"press"` branch of `inView` was removed. `send`, `text`,
  `shows` and project selection are unchanged, because sending a message is not gated. The doc comments
  say that answers require a person's activation.
- New `view-target-press/` directory (barrel `index.ts`):
  - `attach-target.ts`, `attachTarget(session, targetId)`: `Target.attachToTarget` with
    `flatten: false`, which is the pattern from `perturbations/stop-service-worker.ts`. Each command
    goes out as `Target.sendMessageToTarget`, and its answer is matched by id on
    `Target.receivedMessageFromTarget`. Each call has a timeout. `detach()` removes the listener and
    calls `Target.detachFromTarget`.
  - `in-panel-target.ts`, `inPanelTarget(step)`: the script that runs inside the panel. Its `locate`
    step uses the same match as before (exact trimmed text, enabled) and adds two checks: the button
    must have a box, and its centre must hit it (`elementFromPoint`). It scrolls the button to the
    middle and returns the centre in CSS pixels. It also adds a capturing `click` watch on the window,
    which records `seen`, `isTrusted` and `navigator.userActivation.isActive`. `confirm` and `forget`
    read the watch and remove it.
  - `press-in-view-target.ts`, `pressInViewTarget(session, { viewUrl, label })`:
    1. Reads the session's own target (`Target.getTargetInfo`) and lists targets (`Target.getTargets`).
    2. Picks the target whose url starts with `chrome-extension://<id>/sidepanel/index.html`, skipping
       the control tab, which has the same url.
    3. Attaches and runs `Runtime.evaluate` (locate).
    4. Sends `Input.dispatchMouseEvent` `mouseMoved`, `mousePressed`, then `mouseReleased` at the
       centre (left button, `clickCount` 1).
    5. Reads the watch for up to 2 s, so success returns at once without waiting 30 s.
    6. Detaches.

    It returns `"pressed"`, or `"not shown yet"` / `the press ... did not reach the button` for the
    caller to retry. If the click reached the button untrusted or without activation, it throws instead
    of pressing again.
- New test `tests/panel-driver-press.test.ts`: a fake CDP session plus the panel document as a
  `node:vm` context, so the real script source runs the way `Runtime.evaluate` runs it. It covers:
  - the order attach -> `Runtime.evaluate` -> 3x `dispatchMouseEvent` at the computed centre (140, 215);
  - that it attaches to the side-panel target and not the control tab with the same url;
  - that the watch is removed and both the target and the session are detached;
  - that no enabled button with that label gives "not shown yet" and sends no mouse input (a disabled
    "Yes" and a "Yes please" do not match);
  - that an untrusted arrival throws after one release.

## Commands run and observed results

- Narrow typecheck plus tests before the slot: a temporary tsconfig (since removed) listing the four
  touched files, `node node_modules/typescript/bin/tsc -p tsconfig.t900-sec1b.json`, exited 0. Then
  `node --test` on the two emitted test files: `# pass 7`, `# fail 0`.
- Via the slot (`heavy-slot.mjs run t900 -- node <scratch chain>`):
  - `node scripts/build-cache/cli.mjs domain:build domain:host-build scenario-lab:build extension:build`
    -> `exit 0 after 211 s` (extension: `e2e-chromium: verified 26 files`).
  - test-runner whole-package tsc: `node scripts/build-cache/cli.mjs test-runner:build`
    (`clean-dist && tsc -p tsconfig.json`) -> `exit 0 after 55 s`.
  - `node --test packages/test-runner/dist/extension-chat-check/tests/panel-driver-press.test.js packages/test-runner/dist/extension-chat-check/tests/panel-driver.test.js`
    -> `# pass 7`, `# fail 0`.
- `node scripts/structure-audit.mjs` (root) -> `structure-audit: passed (245 warning(s), 552 baselined).`
  It reports no finding on the new or changed files.
- The provider-free chat check, via the slot:
  `node packages/test-runner/dist/extension-chat-check/cli.js --browser chrome --scenario social-network-feed --page friends/requests/ --evidence <scratchpad>`
  - The first attempt failed in 6 s: `test-evidence/dist` was missing. I built it with
    `test-contracts:build test-evidence:build` (exit 0).
  - The second attempt -> exit 2 at `claim ask`, `panelMode: side-panel`, `panelInput: view-dom`
    (Playwright handed over no panel page). The relay claim passed: all 7 checks were true, including
    `panelShowedTheAnswer`. The ask never appeared: `the last by automation: "The run failed: Write
    active instructions in this automation's Instructions before running or building it. Nothing was
    changed."`
  - So the press was never reached, and this run neither proves nor disproves the change.
- Live probe in the real side panel, via the slot. It used a scratch script, with no Core and no model:
  - Setup: the scenario lab served social-network-feed `friends/requests/`. Headed Chromium ran the
    freshly built e2e extension. The real side panel was opened with `openSidePanel` (`opened: {ok: true}`),
    and `playwrightPanelPage: false`. A probe button was put into the panel document. Its click
    listener recorded `isTrusted` and `userActivation.isActive`.
  - Script `HTMLElement.click()` from the control tab -> `[{ isTrusted: false, activation: false }]`.
    This is the old path.
  - `extensionViewPanelDriver(control, "sidepanel/index.html").press("Probe press", 15000)` -> resolved
    in 32 ms, `[{ isTrusted: true, activation: true }]`.
  - `press("No such button", 1000)` -> `The side panel showed no enabled "No such button" button to press: not shown yet`.
  - Script: `<scratchpad>/t900-probe/probe.mjs`. Output: `<scratchpad>/t900-probe.log`.

## Not verified

- A real ask answered end to end in the Chrome side panel: Core's "Yes" control, `panelConversationAnswer`
  reaching Core, the ask settling. This is blocked by the approval-Flow defect below. The probe proves
  that the input is trusted and carries activation in the real side panel. It does not prove Core's own
  answer button.
- Firefox, and the Chrome path where Playwright does hand over a panel Page: these are unchanged and
  were not run.
- A Lab (`pnpm lab`) run.

## Open questions or contradictions found

- **The provider-free ask claim is broken before the press, for a separate cause.** `approval-flow.ts`
  (`saveApprovalFlow`) saves a Flow with no active Instructions. Core now refuses to run it ("Write
  active instructions in this automation's Instructions before running or building it"), so
  `proveAskAnswered` times out waiting for the pending ask. Fixing it means giving the saved Flow
  active instructions. That file is outside this brief's ownership, so it is not changed here.
- `open-chrome-session.ts:65` `panelNote` still says "Send and Yes pressed with HTMLElement.click()".
  Yes is now pressed with CDP mouse input. Only the note text is stale, but that file is on the
  must-not-touch list.
- Other `button.click()` presses from the control tab are not answers, so I left them alone:
  - `panel-controls.ts:74` (recording controls);
  - `person-simulation/panel-run-control.ts:295` (run controls);
  - `attempt-lane/live/press-run-again.ts:39`, which is the results port and not an ask answer.

  If any of them becomes gated on activation later, `pressInViewTarget` can serve them as well.
