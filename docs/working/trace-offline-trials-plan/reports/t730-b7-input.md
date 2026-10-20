# t730-b7-input: keyboard, select, scroll, waits, frames, shadow-root-in-place on realistic pages

## Outcome

Partial. 51 of the 52 tests in my six specs now run only on realistic scenarios. The last one, W03 (arrow keys in a combobox, and an Enter the page cancels inside a form), is Blocked: it stays on keyboard-forms, unchanged and marked in the file. The D5 platform-evidence tests from the deleted keyboard-forms page spec now live in a new scenario-lab spec on realistic pages. All 52 extension tests and the 3 scenario-lab tests pass headed.

## What changed and why

Files:

- `apps/extension/e2e/content/tests/keyboard.spec.ts`, `select.spec.ts`, `scroll.spec.ts`, `waits.spec.ts`, `frames.spec.ts`, `shadow-roots/tests/shadow-root-in-place.spec.ts`: rewritten onto realistic pages.
- New: `apps/scenario-lab/e2e/realistic-keyboard-platform.spec.ts`.
- No unit tests were added, because no logic moved out of the browser.

How the specs reach a usable page. Each site's timed overlays (consent, notification prompts, chat, offers) are answered through the site's own `/api/<id>/<op>` mutations, and then the page is reloaded. That is how a returning visitor finds the site.

Where class names are hashed, expectations come from the scenario's exported code:

- job-board: `boardClasses(seed)` and `rotatingId`.
- social-network-feed: `feedPlanFor(mode)` gives the feed lengths, and the `quiet-feed` variant is armed from the manifest.

Three rows, plus the rest of the shadow-root file, set a state on a real control or build a construct on a realistic page, as the old basic-form rows did:

- A row that needs a read-only or disabled control sets that on the real control.
- The closed-root, late-root and inserted-component rows build their own component on bigbox's product page. None of the ten sites has a closed shadow root or attaches a root late. **Lead decision:** accept this as a retarget, or reclassify it as Blocked.

| spec | test | capability | disposition | new home (file › test) | headed |
|---|---|---|---|---|---|
| keyboard | type: per-char events + change | type emulation event sequence | Retarget | keyboard.spec › same name, job-board home `input[name=q]` | pass |
| keyboard | type: replaces held value | type replaces + read-back | Retarget | same, job-board `input[name=l]` | pass |
| keyboard | type: read-only → output_not_observed | read-back refuses unkept text | Retarget (state set on real field) | same, job-board `l` | pass |
| keyboard | type: contenteditable via InputEvent | editable-host typing | Retarget | same, social-network-feed chat `[contenteditable][aria-label=Message]` | pass |
| keyboard | clear: empties | clear verb | Retarget | same, job-board `q` | pass |
| keyboard | keypress: Tab moves focus | Tab emulation | Retarget | "…from What to Where", job-board; expected id from `rotatingId` | pass |
| keyboard | keypress: modifiers | modifier delivery, shortcut types nothing | Retarget | same, job-board `q` | pass |
| keyboard | W02 Enter submits, default button submitter | implicit submission with submitter | Retarget | "W02: Enter in the newsletter's email field…", company-website `/newsletter`; oracle `newsletter.subscribers` | pass |
| keyboard | W03 combobox keys | (a) per-keystroke filtering (b) page-cancelled key reported (c) arrows + cancelled Enter inside a form | (a)(b) Retarget; (c) **Blocked** | (a) "W03: typing opens and filters everything-store's suggestions…, and Escape closes them"; (b) "W03: Enter on company-website's faux service select is handled by the page…"; (c) original row kept unchanged on keyboard-forms | pass (all three) |
| keyboard | radio arrow unsupported | unsupported-key refusal | Retarget | same, company-website quote drawer `input[name=contactBy][value=Phone]` | pass |
| keyboard | type/clear/keypress disabled (3) | not_actionable gate | Retarget (disabled set on real field) | same names, job-board `q`/`l`; keypress row checks `resultsViews: 0` | pass |
| select | by value / legacy value / label / index (4) | select verb + validation | Retarget | same names, everything-store header `select[name=i]` ("Search in") | pass |
| select | page observes selection + form carries it | untrusted input/change, FormData | Retarget | "…the search form carries the chosen department": checks the submitted URL's `i=home&k=kettle` | pass |
| select | missing value / label+index / non-select / no option (4) | option_not_offered and no-change rows | Retarget | same names; the closest-options list is matched by regex, the full option list exactly | pass |
| select | disabled / hidden / disabled option (3) | gate reasons | Retarget (state set on real select) | same names | pass |
| scroll | by / past end / toElement / unresolvable / absolute (5) | scroll modes + post-conditions | Retarget | same names, job-board `jobs?limit=50`; target `select[name=limit]` | pass |
| scroll | untilStable all / cap / end-early (3) | untilStable settle and cap | Retarget | social-network-feed feed; counts from `feedPlanFor`; end-early becomes the `quiet-feed` variant | pass |
| waits | present / too-slow / visible-pane / absent (4) | selector waits on late content | Retarget | job-board results, job pane (`aside div[data-jk]`, skeleton `.${css.skeleton}`) | pass |
| waits | visible hidden→revealed | visible condition | Retarget | job-board "Date posted" pill menu (hidden, then opened by the pill) | pass |
| waits | enabled | enabled condition | Retarget | job-board 429 notice "Try again in 5" countdown (5 `results-view` posted first) | pass |
| waits | url same-document | url condition, no mutation | Retarget | job-board card click → `history.replaceState ?vjk=` | pass |
| waits | stable | stable condition | Retarget (injected churn on realistic page) | job-board results | pass |
| waits | wait_for_text found + absent | text waits | Retarget | "Full job description" appears, then the second pane's stuck "This is taking longer than usual." goes after Retry | pass |
| waits | wait_for_text timeout | text timeout | Retarget | job-board results | pass |
| frames | addressing rows | frameId/topFrameOnly routing | Retarget | everything-store checkout, same-origin `iframe[title="Payment methods"]` | pass |
| frames | click in same-origin child | frame-addressed click | Retarget | same; radio `checking-7781` checked in the frame, `checkout.paymentId` unchanged | pass |
| frames | click in cross-origin child | OOPIF-addressed click | Retarget | bigbox guest checkout, `iframe[title="Secure card entry"]` (alt origin) "Use this card" → "Check your card details." | pass |
| shadow-root-in-place | flyout un-hidden in open root | in-place watch sees shadow content | Retarget (real construct) | bigbox product page "Change store" → `vr-fulfillment-picker` flyout | pass |
| shadow-root-in-place | inserted component / late root / closed root (3) | in-place watch edge cases | Retarget host page; construct built (none realistic) | same names, bigbox product page | pass |
| scenario-lab (deleted keyboard-forms) | D5: untrusted Enter never submits | platform fact | Re-homed | realistic-keyboard-platform.spec › everything-store row | pass |
| scenario-lab (deleted keyboard-forms) | D5: requestSubmit has no submitter | platform fact | Re-homed | › company-website newsletter row | pass |
| scenario-lab (deleted keyboard-forms) | D5: radio arrows trusted only | platform fact | Re-homed | › company-website quote-drawer row | pass |

The other deleted keyboard-forms page rows tested only the fixture's own workflow (W02/W03 manifest paths, empty name rejected, option chosen by click). Nothing outside that fixture uses them, so I did not port them.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/keyboard.spec.ts content/tests/select.spec.ts content/tests/scroll.spec.ts content/tests/waits.spec.ts content/tests/frames.spec.ts content/tests/shadow-roots/tests/shadow-root-in-place.spec.ts --headed --workers=2` (final run) -> `52 passed (3.1m)`.
- Intermediate runs found and fixed these failures:
  - Unresolvable-target message: it now also names "the page's open shadow roots". job-board has open roots, so this is current product behaviour.
  - `element.selector` in wait replies: it is the content script's own unique selector, not the command's. The waits rows now check that it resolves to the expected element.
  - The soft check replaces the first search result page, so the select-submit row asserts the submitted URL.
  - The closed-root row picked up the bigbox product page's own 700/900 ms timers. It now waits 1.5 s from navigation.
  - bigbox's CSP refuses `waitForFunction`'s eval, so the row uses an evaluate-and-sleep instead.
  - One run had two scroll rows time out in "setting up page". They passed on both reruns, so this was harness or browser startup, not the spec.
- `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts realistic-keyboard-platform.spec.ts --headed` -> `3 passed (1.2m)`.
- `node scripts/structure-audit.mjs` -> 2 violations, both in files I don't own: `identity-ambiguity.spec.ts` line 76 `as never`, and `src/content/extraction/tests/` with 28 files. It flagged none of my files.

## Not verified

- I did not run a TypeScript typecheck of either package (the lead runs it). Playwright transpiles without type-checking.
- Firefox and the chromium-baseline configs were not run.
- I did not run flake or repeat-each passes. Each spec passed in at least two separate headed runs, except the select-submit, unresolvable-target and closed-root rows: each passed only in the runs after its fix (twice for select-submit, once for closed-root).

## Open questions or contradictions found

- **Blocked hook (W03).** This would let the row leave keyboard-forms. Add an armable variant, for example on everything-store's header search, where the suggestion listbox:
  - handles ArrowDown/ArrowUp (preventDefault, moving `aria-activedescendant`);
  - chooses the highlighted suggestion on Enter with preventDefault, without submitting the search form.
  
  A job-board ATS location-lookup variant with the same key handling would also work. Until then, `keyboard.spec.ts` still opens `keyboard-forms` in that one row, and the wave C guard will refuse it.
- **Finding.** job-board's consent wall cancels Enter outside itself, so I first tried it as the "cancelled Enter inside a form" home. It does not work: the runtime's recovery closes the consent as a blocking dialog ("closing 1 dialog the page had put in the way") and then submits the form. That is by design, but it means no realistic overlay can stand in for a page that cancels a key.
- **For the lead.** The shadow-root-in-place rows for a closed root, a late root and an inserted component keep a constructed component, now on bigbox's page. Accept this as a retarget, or reclassify it as Blocked with a hook. A hook would be a closed-root widget variant, for example a third-party badge on bigbox.
- **Overlap.** `keyboard.spec.ts`, `waits.spec.ts` and `scroll.spec.ts` each define a small local `mutate`/`openPath` helper, as other content specs already do. A shared helper module would need a barrel and an owner, so I left them local.
