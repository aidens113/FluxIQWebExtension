# Observer discovery — t840

Outcome: Done (read-only discovery). The saved native failure does not identify which positive-settlement gate refused proof. The content-harness pass proves the observer's DOM behavior in one MAIN world; it does not prove delivery or coverage in the installed MAIN/isolated pair. No source change, test, browser, provider call, Lab control, or git operation was run.

## Established evidence

- `apps/extension/e2e/content/harness.ts:12-21,132-140` explicitly installs both bundles in MAIN, before navigation, with a runtime stub and no background/tab/frame routing. The accepted browser spec uses that transport (`company-definition-fields.spec.ts:118-129`): first canonical NO_EFFECT, then success, two Host attempts, two physical clicks, and one appended batch. Its exact eight-record/four-column read remains asserted at lines 138-154.
- `apps/extension/manifest.chrome.json:30-46` installs page-world at document start in MAIN and content at document start in the extension's default isolated world. `src/page-world/extension-world.ts:12-14` intentionally refuses observer installation if it sees the extension runtime. The harness's injection order avoids that refusal; an installed positive proof additionally depends on real cross-world DOM-query and click delivery.
- Content asks through cancelable, composed DOM events: request mark/health (`src/content/action-runtime/ignored-press/request-start-mark.ts:20-24`) and work mark/observed/pending (`work-mark.ts:4-10`). MAIN replies through preventDefault; work observation requires a captured click plus healthy handler/scheduling wrappers (`src/page-world/press-work/index.ts:13-27`). This mechanism is an observation channel, not authentication against hostile page code.
- The normal Lab network guard routes browser requests/WebSockets and probes worker scope (`packages/test-runner/src/network-guard.ts:120-174`). It does not replace the fixture page's fetch, XHR, timer or Promise APIs. There is no source evidence that this guard alone makes request/scheduling health fail.
- The finalized diagnose artifact is `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-31/run-mvx64gvn-6781507e/steps/0063-diagnose/request.json`. Privately inspecting its structured context found the generic OUTPUT_NOT_OBSERVED/list_unchanged failure, failedTargetUnknown, and empty repair candidates. The custom supported-work-settled message is absent. It contains no settlement reason, request-health, work-state, or outside-mutation diagnostics. Only field presence/schema was emitted during this inspection; no page, selector, model, or recorded row values are copied here.
- The native failure's generic no-new-item message comes from `src/content/extraction/page-advance/load-more.ts:126-127`, after the settlement attempt has returned undefined. Different rejection paths at `loader-progress/settlement.ts:45,50-51,64,68` collapse to that same undefined result. The saved verdict therefore cannot distinguish missing provenance, absent/unhealthy MAIN probes, unknown/pending work, another press signal, actionability, changed origin, or a failed settled-page comparison. Its elapsed time does not uniquely distinguish those paths.

## Overlay hypothesis, bounded by source

`src/content/action-runtime/ignored-press/settled-look.ts:123-131` observes the whole document and all reachable open shadow roots. Any non-notice mutation outside the press scope irrevocably marks an answer; there is no extension UI ownership filter. A newly reachable open root also vetoes certainty (142-148). This is stricter than recorder/snapshot ownership filtering.

Native background activity is delivered to the content overlay (`src/background/activity/activity-relay.ts:300-320,362-381`; `src/content/message-handler.ts:186-191`). The harness has no live background activity relay unless a spec explicitly delivers activity messages.

The activity pill's ordinary headline, step and detail changes occur inside a CLOSED shadow root (`src/content/activity-overlay/status-pill.ts:183-190,360,410-411`). They are invisible to the document/open-root observer; an elapsed-text update alone is not evidence of a veto. Same-view delivery also performs no writes (170-171).

The following host writes are visible and would veto certainty if they occur outside the control's scope during observation:

- creation/reattachment/removal: `status-pill.ts:203,242,331`;
- initial visibility restoration: `status-pill.ts:212,220`;
- actual placement changes: `status-pill.ts:248-251` (the keeper only adopts a changed placement, `placement/placement-keeper.ts:182-188`).

There is no saved mutation/gate timeline proving one of these writes overlapped the failing native press. Overlay interference is a concrete untested interaction, not an established cause of this run.

`src/content/picker-host.ts:38-44` recognizes UI solely by page-visible attributes. It is not a private ownership registry and must not be used to hide mutations when granting new positive no-effect authority. If native evidence establishes an own-UI veto, a fix needs private content-world identity of nodes actually created by the extension, not a page-forgeable attribute. That would still need to distinguish extension writes from page writes to an owned host; node ownership alone does not establish who mutated it.

## Minimal next diagnostic

Preserve every safety gate. Retain one closed, non-executable rejection reason per command, and expose only that fixed code through the existing fallback failure reason/actual diagnostic. No new model-writable proof field or cross-attempt metadata is required. This is a proposal, not an implemented interface.

The existing branches can distinguish: unrecognized binding; missing request/work probe; unhealthy request hook; request started; work unknown; pending work at deadline; non-change signal; origin changed; unsafe control; and overall deadline. To resolve the overlay hypothesis, the internal settled-look result additionally needs to distinguish unreadable baseline, outside-scope mutation, new open root, changed/unsettled origin, and deadline. Keep this diagnostic separate from the private WeakMap proof and never let its scalar value mint NO_EFFECT.

Do not record mutation nodes, markup, text, URLs, selectors, callback sources or request data. A private, bounded classification/counter for extension-caused host writes is useful only if it has trustworthy write provenance; the existing DOM attributes cannot supply it. The first installed replay can simply identify an outside-mutation veto without suppressing it.

## Installed regression required before another paid run

Use the actual installed manifest pair, production background/runtime adapter and normal Host retry boundary, with provider wiring disabled and real activity display enabled. Start from a fresh realistic fixture navigation, reproduce the saved Flow's paging path without a manually primed loader, and preserve the original fields, filters, order and exact eight-by-four oracle. Do not inject proof or manually click the control.

The positive boundary remains: the spinner-only first press yields canonical NO_EFFECT (execution/unacted/certainNoEffect), normal Host retry issues the second command, exactly two physical loader presses append one batch (24 to 28), and the original exact dataset succeeds. Record closed gate diagnostics for the first attempt. The other discovery worker owns saved-flow/replay inspection; this report does not claim that replay has run.

If a UI-specific correction is justified, also prove that ordinary page mutations outside the list and a page node imitating extension marker attributes still prevent positive settlement. Retain delayed-request, unsupported/unknown work, copied-proof and lasting-effect refusal controls. No generic click relaxation, extra internal click ladder, fixture-specific guidance, oracle change, or new cross-command identity is justified by current evidence.

The accepted observer boundary remains limited to supported handlers/tasks, healthy request observation and exact settled DOM/provenance. It does not certify that an opaque synchronous helper cannot conceal native async work or that no future JavaScript can ever execute.

## Inspection and limits

Validation: read-only PowerShell source reads/searches and Node parsing of finalized diagnose schemas/field presence; observed the world split, collapsed gate branches, unfiltered outside observer, closed overlay shadow and lack of gate telemetry. An initial attempt to JSON-parse response.json found it is SSE; subsequent inspection used request.json/decision.json, not the SSE response.

Not run: source edits, tests, builds, browser/provider execution, Lab controls, shared Core changes and git. The actual failing positive gate, cross-world delivery during native playback, overlap with an extension host write and a successful installed zero-call replay remain unverified.
