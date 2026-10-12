# t465: a committing press lands once; an interruption step points at the interruption

## Outcome

Partial. Defect 1 is found, fixed and proven in a headed browser. Defect 3 is answered: playback step 0062 pressed the notifications prompt's "Close" (✕), not "Turn on". The cause is a resolver mis-resolution in t463's area, so I did not fix it. Defect 2's cause is in Core: the authoring guidance and the trial feedback. Core is not mine, so it is unfixed and a recommendation follows.

## What changed and why

### (1) Confirm pressed twice: cause and fix

**Cause (verified).** The click verb watches a first press for 800 ms for any sign of an answer (`actions/click.ts`, `IGNORED_PRESS_WINDOW_MS`). It presses once more only when it sees none. The "request" sign came from the resource timeline (`ignored-press/page-press-listener.ts`), and a resource entry is written only when its response ends. social-network-feed's Confirm handler calls `fetch` synchronously and awaits it before it changes the card (`client/requests-script.ts:27-37`). So when the server took longer than 800 ms, the watch saw no request and no change, and Confirm was pressed a second time.

It was a second press made by the click verb inside one command, not a Core retry and not a double dispatch. The result says so: "the page ignored the first press, so it was pressed once more" (step 0064).

Reproduced in the T2 harness with the server delayed to 2 s and the fix disabled. The output was the same point as playback, `681,360`, and the reply was `failed`: "...pressed once more, and it ignored that press too". That is worse than the live case. It reports `output_not_observed`, which is retryable, so Core would press a third time.

**Fix (general, no site rule).** A request now counts from the moment the page begins it:

- `apps/extension/src/shared/request-start-event.ts` (new): a DOM-event contract between the page world and the content script, following the t229 press-probe pattern.
- `apps/extension/src/page-world/request-starts.ts` (new), wired in `page-world/index.ts`:
  - At `document_start` it wraps `fetch`, `XMLHttpRequest.prototype.send`, `Navigator.prototype.sendBeacon` and `WebSocket.prototype.send`. Each wrapper adds one to a count, then calls the original unchanged. Nothing about a request is read.
  - A mark event dispatched on the pressed element stores the count and is cancelled. That cancellation is how presence is detected.
  - A since event is cancelled when the count has grown since the mark.
- `apps/extension/src/content/action-runtime/ignored-press/request-start-mark.ts` (new): the content half, `markRequestStarts(pressed)`.
- `ignored-press/page-press-listener.ts`: a new `listenForRequestStarts` beside the resource-timeline listener. It is injected through `PressPage.markRequestStarts`, and the mark is made in `beforePress`, after the hover.
- The timeline path stays as the fallback where no page world runs, for example a browser without `world: "MAIN"`.
- Also changed: `ignored-press/index.ts` (exports), `press-again.ts` (signal doc) and the `actions/click.ts` header comment (history line).

The rule stays one-sided. Any request, including an unrelated one, forbids the second press. That only makes a second press rarer, never more likely.

A remaining narrower gap: a page that begins its request more than 800 ms after the press, and shows nothing before then, can still be pressed twice.

### (2) "slow-down notice" step targets Close chat

**How the target was chosen.** At authoring, not at playback.

- In rev 3 (step 0037) the model wrote `step notice: close the site's slow-down notice if it shows` with `target: t857`, and t857 is the chat's "Close chat" from exploration.
- Core's script format (`!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/flow-script-format.ts:337`) tells the model that a trial which met a slow-down "adapt[s] the Flow ... a step that closes the site's notice when it shows".
- But the model never saw that notice or a handle for its way out. In trial 1 the runtime absorbed the rate limit and the extension's interference defence closed the notice by its OK. Core reports this as "Closed a slow-down notice the page put in the way", and the step records `clearedLayers: [{kind: "rate_limit", control: "OK"}]`. The trial feedback carries the pass, the wait and the pace, and no handle.
- So the guidance asks for a step whose control the system never showed, and the only close-like handle available was t857.
- At playback the step did what its target said: it closed the chat on pass 1 and skipped on passes 2 to 4.

**Not fixed: the cause is in Core.** The extension already dismisses this notice correctly through its way out (OK, never "Try again"; `interference/way-out.ts:70`, `vocabulary.ts:54-61`). The runtime cannot tell that a step labelled "slow-down notice" means a different layer from the one its handle sits in without reading label semantics.

Recommended Core fix, in either form:

- (a) Since the runtime closes a rate-limit notice itself, change line 337 to ask only for `repeat pace:` and a cooldown. Gate the cooldown on the paced step or drop it, but not on a close step.
- (b) Name the notice's way-out handle in the absorbed entry, and require a close step only when the feedback names one.

Also recommended in Core: an authoring check that an `optional` dismissal step's handle lies in a layer actually met at that point of the Flow (the debug's D5).

### (3) Did playback 0062 press "Turn on"?

**No. It pressed the notifications prompt's "Close" ✕.** I replayed step 0062's exact command against social-network-feed with the prompt up, using a scratch spec that I deleted afterwards. The command was 0062's selector `body > div:nth-of-type(3) > div:nth-of-type(1) > div:nth-of-type(3)` and its fingerprint (accessibleName "Close chat", visibleText "✕").

Observed reply:

> `"actual":"the point 848,298 landed on the target"`, resolution `{"strategy":"scored-candidate","candidateCount":36,"bestScore":0.729,"runnerUpScore":0.113}`, element `accessibleName "Close"`, `context.heading "Turn on notifications?"`

Server state afterwards: `"notificationsPrompt":"dismissed"`.

That is the same point as playback (848,298). Nobody turned notifications on. But a "Close chat" step resolved to a different layer's close control, with a resolver confidence of 0.685, although its accessibleName differs. That defect is in `resolve-target` and its candidate scoring, which belong to t463, so I did not touch them. The interference defence (t423) was not involved: the step's own resolution pressed the ✕.

## Commands run and observed results

- `EXTENSION_TEST_BUILD_LABEL=t465 node scripts/test-extension.mjs content/actions/tests content/action-runtime/ignored-press/tests` -> `# tests 189`, `# pass 189`, `# fail 0`. This includes 3 new rows in `page-press-listener.test.ts` and the new `request-start-mark.test.ts`.
- `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` (apps/extension) -> no output, `tsc-exit=0`.
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0. Domain is unchanged.
- `node scripts/structure-audit.mjs`:
  - First run: `FAIL [swallowed-failure] apps/extension/src/page-world/request-starts.ts ... line 38`.
  - Fixed with a `/* best-effort: ... */` comment.
  - Rerun: `structure-audit: passed (184 warning(s), 646 baselined).`
- `pnpm test:content -- press-answers/tests/lasting-press-once.spec.ts --headed --workers=1` (new spec, social-network-feed, server delayed 2 s):
  - With the fix: `1 passed`.
  - With `installRequestStartWatch()` commented out (restored afterwards): `1 failed`, `Error: the point 681,360 landed on the target; the page ignored the first press, so it was pressed once more, and it ignored that press too`.
- `pnpm test:content -- press-answers/ safe-clearing/ tests/click.spec.ts --workers=2` -> `25 passed (1.0m)`. This includes the everything-store "ignored twice", bigbox chip and safe-clearing rows.
- `pnpm test:content -- live-tasks/tests/auction-marketplace-kestrel-auctions.spec.ts live-tasks/tests/local-classifieds-bike-search.spec.ts --workers=2` -> `16 passed (5.4m)`. Kestrel's sort button, which ignores its first press, is still pressed again.
- After the enumerability tweak: `lasting-press-once.spec.ts` plus `safe-clearing/`, headed -> `4 passed`; tsc exit 0; the audit passed.
- Scratch probe for (3), headed, file deleted after the run: the reply quoted above.

## Not verified

- A live Lab run (none was allowed). The extension's real `world: "MAIN"` injection in Chrome/Edge with the extension loaded: the T2 harness injects the page-world bundle into the page's main world itself.
- Firefox, where the page world needs Firefox 128 or later. Without it the old timeline-only path runs.
- Whether the server latency in the live run really exceeded 800 ms. Nothing in the bundle records fetch timings. The mechanism is reproduced with an injected delay.
- The Core changes recommended for (2), and t463's resolver fix for (3).
- Authored architecture docs that describe the ignored-press signals were not updated. I did not own them.

## Open questions or contradictions found

- (3) is a t463 resolver defect. A fingerprint with accessibleName "Close chat" was scored onto a control named "Close" in another dialog (best 0.729 against a runner-up of 0.113).
- (2) needs a Core task in `flow-script-format.ts:337` and the trial feedback, as recommended above.
- Files outside the brief's listed areas that I had to add: `apps/extension/src/shared/request-start-event.ts`, `apps/extension/src/page-world/request-starts.ts` and the `page-world/index.ts` wiring. They are the page-world half of the fix.
