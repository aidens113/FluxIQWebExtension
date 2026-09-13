# Report: i-final-navigation-live-refusal

Read-only diagnosis, 2026-09-13. I read the current bounded W10 report,
safe structured run summaries/events, and only the runner/extension control and
recording-sequencing source and closest tests needed to trace the refusal. I did
not read driver logs, raw page data, screenshots, or secrets. This report is the
only edit; I changed no source, tests, generated output, shared working document,
Core file, commit, or remote state, and ran no build, test, or Lab command.

## Disposition

**Exact root cause found: the extension returns `forbidden` for the runner's
trusted control document because that document is deliberately opened in a
normal browser tab.** This is a P1 live-integration blocker, narrowly confined
to the sender-shape guard. Recording state, destination validation, active-tab
derivation, intent lifecycle, and gateway acknowledgement are not reached.

All six safe run summaries fail at event sequence 7 with the fixed summary
"The extension refused to arm scripted navigation." The safe structured
artifacts do not retain the allowlisted `reasonCode`, so this diagnosis does not
claim to have extracted it from a bundle. The code path nevertheless determines
the response: the runner and guard disagree on a directly observable sender
property before `manager.armScriptedNavigation` can run.

## Evidence and causal chain

1. `extensionControlPage` obtains the extension id, creates a Playwright page
   with `context.newPage()`, and navigates that page to the exact
   `chrome-extension://<id>/sidepanel/index.html` URL
   (`packages/test-runner/src/run-scenario.ts:524`). This is an extension
   document hosted in a browser tab, not a browser-managed side-panel surface.
2. The local Chromium typing defines `MessageSender.tab` as the `tabs.Tab`
   which opened the connection and says it is present when the connection was
   opened from a tab, including content scripts
   (`node_modules/@types/chrome/index.d.ts:7794-7808`). It separately defines
   `sender.url` as the URL of the sending page or frame. The runner's sender is
   therefore expected to have all of: this extension's id, the exact trusted
   side-panel document URL, and a `tab`.
3. `isControlPage` currently rejects any sender for which
   `sender.tab !== undefined`, before checking its exact URL
   (`apps/extension/src/background/scripted-navigation-control.ts:6-11`). The
   runner's legitimate tab-hosted control document is consequently classified
   as unauthorized, and arm returns the fixed `{ ok:false, code:"forbidden" }`
   without calling the manager (`:21-27`).
4. The runner recognizes that exact negative shape and raises the fixed arm
   refusal before `scenarioPage.goto` or await/cancel intent handling
   (`packages/test-runner/src/scenario-steps/scripted-navigation.ts:34-45,89-96`).
   This matches the live observation that all runs stop before recording/Flow.
5. Recording sequencing is otherwise correctly ordered: the runner waits for
   `recordingState === "recording"`, then constructs the step runner and sends
   arm (`run-scenario.ts:276-288`). The intent's `not_recording`, URL, tab, and
   busy checks occur only inside `manager.armScriptedNavigation`; the forbidden
   branch prevents all of them from participating in this failure.

## Why unit coverage missed it

The control test fixtures model `sidepanel` and `popup` without `tab` and call
those the allowed shapes. The security row then constructs
`{ ...sidepanel, tab:{ id:7 } }`, labels it "content," and requires rejection
(`apps/extension/src/background/tests/scripted-navigation-control.test.ts:14-17,
30-65`). That conflates transport location with document identity. A content
script in a web tab has this extension's sender id and a `tab`, but its
`sender.url` is the web document/frame URL, not the exact own-extension
side-panel or popup URL. The production runner shape was therefore asserted as
forbidden rather than represented as the legitimate integration shape.

## Smallest file-partitioned fix and tests

One serial extension partition is sufficient; no runner, domain, Core, or
architecture contract change is needed.

**Partition E1 - control boundary and focused regression**

- `apps/extension/src/background/scripted-navigation-control.ts`: remove only
  the blanket `sender.tab !== undefined` rejection. Continue requiring
  `sender.id === chrome.runtime.id`, a string `sender.url`, and exact equality
  with this extension's `sidepanel/index.html` or `popup/index.html`. Those
  document-identity checks reject web/content frames, other extensions, and
  other own-extension pages while admitting the runner's tab-hosted trusted
  control document.
- `apps/extension/src/background/tests/scripted-navigation-control.test.ts`:
  add an explicit runner-shaped sender with the exact side-panel URL plus a
  realistic `tab` (and top-frame id if desired) and prove arm reaches the
  manager with the exact success shape. Replace the mislabeled “content” case
  with a sender having this extension's id, a web-page URL, and a `tab`; keep
  wrong-extension, other-page, missing-URL, unauthorized await, and idempotent
  unauthorized-cancel assertions.
- Mutation proof: temporarily restore `sender.tab !== undefined` in the guard;
  the new runner-shaped acceptance row must fail. Restore it and require the
  focused control suite and extension package check to pass.

After source validation, regenerate the tracked extension build through its
own build command and run the repository-required supervisor gates. The
generated bundle must not be hand-edited. Then rerun the bounded W10 primary
and `broken-link` acceptance; this static diagnosis does not substitute for
that live proof.

## Security and boundary assessment

Dropping the `tab` prohibition does not make these controls callable from an
ordinary page or content script: exact own-extension document URL plus exact
runtime id remain mandatory, and unauthorized responses remain fixed. The
caller still cannot provide a tab id, URL validation stays loopback-only, and
responses expose no URL, tab id, page data, or caught error. This is entirely
downstream browser-test control wiring and requires no Core API change.
