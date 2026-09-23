# fa-extension-defenses — B5, B6, B7

Task t078, worktree `F:\fxwork\t078-extension-defenses`, 2026-09-22. Three
browser-side defects that each produced a silent wrong result instead of an
honest failure. Each was reproduced live in a real browser against a Scenario
Lab fixture before any code changed, and shown correct in the same browser
afterwards. No provider calls; `FLUXIQ_TEST_ENV_FILES=none` on every run.

## Outcome

Done, with one deliberate deviation from the brief's wording on B7 (scroll and
upload are held to *part* of the actionability gate, not all of it — the
reasoning and the evidence for it are in **Open questions**, point 2). One
pre-existing load-sensitive test in the content lane times out under four
parallel workers and passes in isolation; it is unrelated to this work
(**Not verified**, point 1).

---

## B5 — a navigate could not tell that it did nothing

### What was wrong

`compareNavigatedUrl` asks one question — *is the tab at the address the Flow
asked for?* A navigation to the page the tab already shows answers that
without the browser doing anything, because the address was already right. The
only thing that makes such a node do work is `updateTabUrl`'s reload, and
nothing read back whether the reload happened: `readTabUrl` returns the same
string either way. A worker-side result then carried no snapshot, no title, no
element and no resolution, so there was nothing on it to judge with either.

### What changed

- **`runtime/automation-tab.ts`.** `updateTabUrl` now returns a
  `TabDriveRecord`: the address and the top frame's document UUID before the
  drive and after the tab settles, whether the tab was opened for it, and
  whether the drive was issued as a reload. `resolveAutomationTab` returns
  `{ tabId, drive }` instead of a bare tab id — it is the function that
  performs the navigation, so it is the only place that can see what the
  navigation did. `readTabUrl`, `readTabTitle` and `tabIsOpen` are now three
  readings of one `readTab`, which also removes one caught-failure-as-absent
  site rather than adding one.
- **`runtime/navigation-outcome.ts`.** New `judgeTabMovement(drive)`, beside
  the destination comparison it belongs with. A navigation is work when the tab
  was opened for it, when the address moved (a same-document move — a fragment
  — is work and keeps its document), or when the document was replaced. It is a
  no-op **only** on positive evidence that both stayed the same. Anything
  unreadable — an older browser, a refused permission, a navigation that drove
  nothing — is reported as unknown and never failed: a check that cannot see is
  not a check that failed.
- **`runtime/action-runner.ts`.** `navigationResult` judges the destination
  first (unchanged), then the movement. A no-op fails with
  `web.navigation.unexpected`, whose closed-set entry already reads "The
  browser landed somewhere other than the requested URL, **or never left where
  it was**" — so no domain change was needed. A successful navigate now carries
  the movement in its validation (`…/store: the browser loaded the page
  again`).
- **`runtime/action-results.ts`.** `workerActionResult` can carry a `title`,
  and the navigate path fills it. `title` is already on Core's result shape;
  it is one property read, and it is the difference between "the address is
  right" and "the address is right and the page behind it is the one we meant".

### Live proof

New lane: `apps/extension/e2e/runtime/` — the background worker's action runner,
bundled by esbuild and evaluated in the extension's own page inside the real
loaded extension, driving a real Scenario Lab tab through Chrome's own `tabs`
and `webNavigation`. `src/runtime/` had no live coverage at all before this:
an action reaches the runner only from the gateway socket and the background
bundle exports nothing, so the one verb whose whole job is to move the browser
was never exercised in a browser.

Scenario `everything-store`, the store whose created Flow this broke.

| Row | Before the change | After |
| --- | --- | --- |
| A navigate the browser did not act on | **`succeeded`**, "Navigation completed.", while the page's own `window` stamp survived — proof no document was loaded | `failed`, `web.navigation.unexpected`, "Navigation left the tab on the page it was already showing" |
| The same navigate with the browser acting | passed, but with no title and nothing saying what the tab did | `succeeded`, stamp gone, `title: "Brightaisle.com. Spend less. Smile more."`, validation says "the browser loaded the page again" |
| A navigate to another page | no evidence of the page it left | `succeeded`, validation names the page it left and the title it reached |
| A fragment move (same document) | passed | `succeeded` — the address moved, so it is work, not a no-op |

Row A injects exactly one fault, and it is the one nothing verified:
`chrome.tabs.reload` is replaced on the harness page with a call that resolves
without reloading. Chrome's own way of doing nothing — ignoring a `tabs.update`
to the address a tab already shows — is already worked around by
`automation-tab.ts`'s reload branch; what was never checked is whether that
workaround took effect. This is the same shape as the repository's existing
`disable(page, selector)` helper, which sets `disabled` on a live control "so
the rejection path is proven without a fixture that ships one disabled".

---

## B6 — a wait could not see into a shadow root

### What was wrong

Every condition in `wait-conditions.ts` resolved its selector with a bare
`document.querySelector`, while `resolveTarget` has looked in the roots the
recorded host chain reaches ever since the recorder began writing that chain.
So a Flow that waited for a widget's control before clicking it timed out, and
then clicked that same control successfully a moment later.

**A justification was not found, but a downstream workaround was**, and it
documents the same defect from the other side:
`domain/src/recording/proposals/late-target-wait.ts` refuses to propose a wait
at all for a click recorded inside a shadow root (`insideShadowRoot`, `:103`),
with the test comment "A wait names a selector and no root, so for a click
inside a shadow root it would look in the light document for a selector written
within that root". That is a reason to fix the wait, not to leave it, and the
workaround can now be lifted — see **Open questions**, point 1. I did not touch
it (`domain/src/**` is outside this brief).

### What changed

- **`content/action-runtime/recorded-shadow-hosts.ts`** (new) — the host chain
  a command carries, read from the same two places and in the same order as
  `resolve-target.ts`'s `recordedTarget`: the declared `element` first, then the
  untyped `options.element`, first *described* element decides. Its unit test
  pins that precedence, because a wait scoped to one set of roots and a click
  scoped to another would resolve different controls.
- **`content/action-runtime/wait-conditions.ts`** — the request gains
  `shadowHosts`, and `present`, `visible`, `enabled` and `absent` resolve
  through `resolveShadowScope`. The scope is resolved **per evaluation**, not
  once, because the widget being waited for may not have attached its root yet
  — which is the case a wait exists for. An unparsable selector throws, as it
  did before: `waitUntil` ends the wait on it rather than retrying it to the
  timeout, which is what that module's header already promised.
- **`content/actions/wait-for-selector.ts`** — passes the recorded chain.
  `wait_for_text` needs nothing: `pageText()` is `body.innerText`, which
  already includes text rendered inside open shadow roots.

### Live proof

Scenario `job-board`, whose consent platform ships as `rf-consent` with an open
shadow root — the same widget lane D's replay failed on.

- **Before:** `wait_for_selector` for `button[data-choice="accepted"]` with the
  recorded chain `["body > rf-consent"]` → `timed_out` after 1.5 s, "Timed out
  waiting for selector". `visible` and `enabled` the same.
- **After:** all four rows pass — `present`, `visible`, `enabled`, and `absent`
  satisfied by the widget removing itself — and the click on that same control
  with that same target succeeds, with the Lab's own oracle confirming
  `consent: "accepted"`.
- A fourth row pins the other direction: a wait with **no** recorded chain still
  looks only in the document, so a light-document target is never answered by a
  widget's copy of the same selector.

---

## B7 — three actions skipped actionability

### What was wrong, and what each verb is now held to

`check`, `scroll` and `upload` never called `checkActionability`. The gate is
not the same instrument for all three, and treating it as one would have
created false refusals as bad as the silent successes:

- **`check` — the whole gate.** A checkbox is a control a person operates, so
  covered, hidden and disabled all apply. `checked` is a property, so setting it
  succeeds on a page no person could touch. The gate also replaces the verb's
  own `scrollElementIntoView`, because the gate scrolls to the viewport centre
  before hit-testing — the geometry the action will actually use.
  One refinement: the gate is read against **the thing a person would press**.
  A page that draws its own checkbox hides the real input behind a styled
  label, so a `hidden` refusal is retried on the label bound to the control
  (`for=` in the control's own tree, then an enclosing `<label>`); only a hidden
  control with no label at all is refused.
- **`upload` — `disabled` and `inert` only.** The files go in through a
  `DataTransfer` and the input is never pressed. The standard way to ship a file
  input is to hide it behind a styled label — **job-board's ATS and
  everything-store's photo dialog both do, in this repository's own fixtures** —
  so refusing `hidden` would refuse nearly every real upload. A disabled input
  takes the files and submits none of them, and an inert subtree is the page
  withdrawing interaction entirely; both are refusals.
- **`scroll` — evidence, no refusal.** Nothing covering a target stops the page
  from scrolling to it, and refusing would take away the very move that reveals
  a covered control. So `toElement` reads the gate *after* it has moved the page
  and reports what it saw in the validation's `actual`: "the target is at 256,346
  in a 1280x720 viewport; the point 308,361 landed on div.scrim, which covers
  the target". Pass or fail is still whether the target reached the viewport.

### Live proof

Scenario `bigbox-retail` (every page opens under a full-viewport scrim with a
modal `role="dialog" aria-modal="true"` consent dialog over it) and
`file-transfer`.

| Row | Before | After |
| --- | --- | --- |
| `check` a results facet behind the consent scrim | **`succeeded`**, "Check state set." — set straight through the scrim | `failed`, `web.action.blocked_by_dialog` / `unexpected_state`, "…covers the target"; the facet is unchecked and the page never filtered |
| `check` the same facet once the dialog is answered | succeeded | `succeeded`, and the page filters (`?facet=fulfillment_method%3APickup`) — no false refusal |
| `upload` into a `display:none` file input | succeeded | `succeeded` — the hidden input is the ordinary case |
| `upload` into a disabled file input | **`succeeded`**, "Files uploaded." | `failed`, `web.action.rejected`, and the input holds no files |
| `upload` into an inert subtree | succeeded | `failed`, `web.action.rejected`, "the file input is inert" |
| `scroll` to a covered target | position only | `succeeded`, and the validation names what covers it |

---

## Commands run and observed results

Every command from `F:\fxwork\t078-extension-defenses`, with
`FLUXIQ_TEST_ENV_FILES=none`.

1. **B6 live, before the change** —
   `pnpm --filter @fluxiq-web-extension/extension test:content -- --workers=2 -g "a wait for a control inside an open shadow root"`
   → `2 failed, 2 passed`. "Error: Timed out waiting for selector:
   button[data-choice=\"accepted\"]", status `timed_out`, while the click on the
   same target succeeded.
2. **B6 live, after** — same command → `4 passed (6.6s)`.
3. **B7 live, before** —
   `… test:content -- --workers=2 actionability-gate` → `3 failed, 2 passed`:
   check returned `succeeded` ("Check state set.") behind the scrim, upload
   returned `succeeded` ("Files uploaded.") into a disabled input, and scroll
   carried no gate evidence.
4. **B7 live, after** — same command, with the inert row added → `6 passed (11.5s)`.
5. **B5 live, before** — the four runtime rows against `src/runtime/` restored
   to HEAD (`git checkout` of the four files, rebuild, run, restore):
   `npx playwright test -c e2e/playwright.config.ts runtime/tests/navigate --workers=1`
   → `3 failed, 1 passed`. The no-op row reported
   `status: "succeeded"`, "Navigation completed.", `url` the requested address,
   while the page's stamp survived.
6. **B5 live, after** — same command → `4 passed (41.7s)`, twice (once before
   the revert, once after restoring).
7. **Extension unit suite** —
   `EXTENSION_TEST_BUILD_LABEL=t078 pnpm --filter @fluxiq-web-extension/extension test`
   → "Extension smoke test passed." then `# tests 731 / # pass 731 / # fail 0` (715 before this work: 6 new
   `recorded-shadow-hosts` rows, 5 new `judgeTabMovement` rows, 3 new
   navigate-result rows, 2 new upload-gate rows).
8. **Content lane, whole** —
   `pnpm --filter @fluxiq-web-extension/extension test:content`
   → `337 passed, 1 failed (1.4m)`. The failure is
   `exploration-state/tests/field-entry-target-stability.spec.ts`, "Test timeout
   of 30000ms exceeded" in `page.evaluate`; it passes alone in 28.7 s and
   `w2-t026-field-entry-target-stability.md` records it taking 22.1 s at
   `--workers=1` when it was written. It touches no verb this work changed.
9. **Structure audit** — `node scripts/structure-audit.mjs` →
   `structure-audit: passed (89 warning(s), 122 baselined)`. It failed twice on
   the way and both were fixed rather than baselined: a 26th file in
   `e2e/content/tests/` (the new spec moved into `actionability/tests/`), and a
   caught failure returned as absent in the new wait lookup (the throw now
   propagates, as the module's header already said it should).
10. **`pnpm check`** (structure tests, lab tests, task tests, the audit, and
    every package's type check and browser-entry bundle) → `exit=0`.
11. **Extension e2e lane, whole** — `pnpm --filter @fluxiq-web-extension/extension test:e2e`
    → first run `11 passed, 1 failed (13.1s)`; the failure was
    `install-and-content.spec.ts:4`, "worker.evaluate: TypeError: Cannot read
    properties of undefined (reading 'getManifest')" — the MV3 service worker
    not awake when Playwright evaluated in it. Re-run twice since: `12 passed`
    at `--workers=2` and `12 passed` at the default 6 workers, and the row
    passes alone. A load-sensitive flake in a spec this work does not touch;
    all four new navigate rows passed in every run.

## Not verified

1. **The one content-lane failure is not proven to be pre-existing by a run on
   unmodified source.** It is a wall-clock timeout, it passes in isolation, the
   spec exercises only `type`/`select`/capture (no verb this work touched), and
   a prior report records it at 22.1 s against a 30 s limit. I did not re-run the
   whole lane on a clean tree to confirm, because the lane takes about 90
   seconds per run and the evidence above is one-directional.
2. **No Flow-level or Lab-level run.** Nothing here was exercised through Core,
   the gateway, a saved Flow replay, or the panel. The navigate rows drive
   `runBrowserActionCommand` directly in the extension's page; the command
   router, the gateway projection and Core's own handling of the new failure are
   unexercised.
3. **No Firefox.** Every live run was Chromium. `chrome.webNavigation`'s
   `documentId` is what the movement check reads, and the judgement degrades to
   "unknown" where it is absent — which is the safe direction, but it means the
   check may simply not fire on a browser that does not report it.
4. **The `check` label fallback is not proven live.** No Lab fixture ships a
   visually hidden checkbox behind a styled label, so that path is reasoned and
   unit-shaped only. The hidden-file-input equivalent for `upload` *is* proven
   live (`display:none` row).
5. **`domain/`, Core and `packages/test-runner/` were not touched**, and no
   measurement of the campaign's own scenarios was re-run.

## Open questions or contradictions found

1. **The domain works around B6 and can now stop.**
   `domain/src/recording/proposals/late-target-wait.ts:97,103` refuses to propose
   a wait for any click recorded inside a shadow root, for exactly the reason
   this task fixed. Now that a wait resolves through the recorded host chain, the
   proposal could carry the target (and therefore the chain) and cover widget
   controls — which is where the late-target waits are most needed, since a
   consent platform attaches its root after first paint. It is a small change in
   a file this brief does not own.
2. **B7's wording versus B7's substance.** The plan's step says "Make `check`,
   `scroll` and `upload` call `checkActionability`, so a covered control refuses
   instead of acting through an overlay." All three now call it, but only
   `check` refuses on the whole gate. Applying it whole to `upload` would refuse
   the hidden file inputs this repository's own fixtures ship (job-board's ATS
   resume input, everything-store's photo dialog), and applying it whole to
   `scroll` would refuse the move that uncovers a covered control. If the
   supervisor wants the literal reading instead, the change is two lines in each
   verb, and the two fixture rows above are what would break.
3. **`in-place-effect.ts` was deliberately *not* armed more widely, and this is
   the part of B5 I did not do.** The brief said to consider it. Arming the
   existing watch around every click would wait up to 5 s after any click that
   shows nothing, and would report `output_not_observed` for four ordinary
   cases: a click that only moves focus, a click on a checkbox or radio (whose
   `checked` is a property, so the watch sees no structural change), a click
   that opens a native picker or another window, and — the dangerous one — a
   click that starts a cross-document navigation, where waiting risks losing the
   reply to the teardown and turning a good click into a Core-deadline timeout.
   The link path is safe from that only because it answers immediately when the
   click's default action was *not* prevented, and "not prevented" carries no
   information for a `<button>`. The narrow widening that *is* safe, and that I
   recommend as its own step, is to arm the watch when a non-link click's
   default action **was** prevented — the page saying "I am handling this" —
   which is the same rule the link path already applies. I did not take it
   because it is a behaviour change across every click and this brief's live
   budget was spent proving the three defects it names.
4. **`navigation-target.ts` already claims E9's cause.** Its header says the
   campaign's created Flow "navigated in a tab nobody looked at", and that half
   is fixed on `dev`. The half B5 fixes is the other one — a navigate that
   reports success having done nothing — which d4 found by reading
   `compareNavigatedUrl`. Both are true of E9; the plan's framing of B5 as "the
   exact defect that broke the created Flow" is half the story.
5. **`resolution` is still emitted and never consumed** (d4's point 4), and
   nothing gates on the new movement evidence either — it is on the result for
   Core's ladder to use. That is B-series work, not this one.
