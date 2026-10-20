# t730-b6-evidence: page-evidence specs on realistic pages

## Outcome

Partial. 45 of my 46 tests now run on the ten realistic scenarios only. I rewrote every test in my
seven spec files except one. That one is the native-dialog test in `live-page.spec.ts`, and it is
**Blocked**: none of the ten sites calls `window.confirm`, `alert` or `prompt`, so it still opens
`modal-flows`. Every retargeted test passed headed. One of them, `live-state-digest`, failed on 3 of
19 headed runs (details under Not verified). I deleted no tests and moved nothing to unit tests.

## What changed and why

Spec paths below are relative to `apps/extension/e2e/content/tests/`.

- `evidence/tests/page-evidence.spec.ts`: the table now uses realistic pages. Each row has an
  optional `prepare` step that reaches its page. Interruptions are answered through the site's own
  `/api` operations. Rows about a covering layer leave it up.
- `evidence/tests/snapshot-items.spec.ts`: moved to the job-board home page. The native-select row
  uses the auction site's header instead.
- `evidence/tests/live-page.spec.ts`: four tests retargeted. The native-dialog test is unchanged and
  carries a note saying what it is waiting for.
- `evidence/tests/shadow-overlays.spec.ts`: the first test used a corner widget injected into
  product-catalog. It now uses everything-store's own support-chat bubble, which lives in an open
  shadow root. The second test was already realistic and is unchanged.
- `exploration-state/tests/live-state-digest.spec.ts`: the disclosures injected into basic-form are
  replaced by local-classifieds' own folded filter toggles. "Date listed" is the wrong one; "Item
  condition" is the right one. Before the run, the spec scrolls the feed to its end
  (`loadWholeFeed`), so no batch lands between two state digests.
  - The handle reader is new. The old one read `record.name` and `record.target` from JSON elements.
    The evidence is now a compact text page view, with lines like `t62 button "Item condition ▾"
    closed`. The new reader takes the `tN` handle from the newest view.
- `exploration-state/tests/field-entry-target-stability.spec.ts`: social-scheduler is replaced by
  two tests.
  - The company-website quote drawer covers the click plus four text fields.
  - The auction header covers a select plus a text field. The drawer has no select.
  - Handles are read from the page view, as in `live-state-digest`.
- `resolve-target.spec.ts`: retargeted as follows.
  - ambiguous-targets → company-website price-list accordions, plus the newsletter page's labelled
    email field and job-board's What/Where fields.
  - long-document → the bigbox product page's "See more reviews" button, which sits below the fold.
  - The sites give these controls no test ids, so each row takes the content script's own selector
    from a capture.
- `evidence/tests/captured-snapshot.ts`: unchanged, and its other importers still use it.
- I wrote a scratch probe spec, `evidence/tests/t730-b6-probe.spec.ts`, and deleted it.

### Disposition table

| spec | test (old → new) | capability | disposition | new home | headed run |
| --- | --- | --- | --- | --- | --- |
| page-evidence | product-catalog element totals | funnel totals, truncation | Retarget | bigbox-retail home, "element totals and truncation" | pass |
| page-evidence | intermediate-state totals agree | changed and recentlyInteracted are 0 at rest | Retarget | job-board home | pass |
| page-evidence | product-catalog loading at rest | loading evidence at rest | Retarget | job-board home | pass |
| page-evidence | product-catalog navigation | navigation evidence | Retarget | job-board home | pass |
| page-evidence | product-catalog landmarks | regions with labels and bounds | Retarget | auction results `sch/i.html?_nkw=kestrel` | pass |
| page-evidence | product-catalog repeating | run container, count, representative, order | Retarget | professional-network sent invitations (10 rows) | pass |
| page-evidence | (same row: numbered test-id signature) | `pagination-page-#`-style signature | Retarget | everything-store order confirmation, `order-line-#` (3 lines, order placed through `/api`) | pass |
| page-evidence | infinite-feed repeating | feed items as a run | Retarget | social-network-feed home, first batch of 5 `[role=article]` | pass |
| page-evidence | intermediate-state repeating not invented | repeating undefined | Retarget | job-board home | pass |
| page-evidence | intermediate-state forms model | form, controls, labels, no values | Retarget | company-website quote drawer (14 controls) | pass |
| page-evidence | (new) | password control marked sensitive, values never quoted | Retarget (added) | photo-social `accounts/login/` | pass |
| page-evidence | product-catalog forms group by owner | controls outside a form are not counted | Retarget | bigbox results: facet checkboxes outside the header form | pass |
| page-evidence | infinite-feed forms not invented | forms undefined | Retarget | local-classifieds results (inputs but no `<form>`) | pass |
| page-evidence | modal-flows blocking overlays | blocker, blocked list, counts | Retarget | job-board consent wall (`input[name="q"]` and Find jobs are blocked) | pass |
| page-evidence | product-catalog no overlays | overlays undefined | Retarget | local-classifieds results with consent and notifications answered through `/api` | pass |
| page-evidence | modal-flows no dialog before open | a hidden dialog is not reported | Retarget | professional-network sent (withdraw and connect dialogs under `[hidden]`) | pass |
| snapshot-items | basic-form 7 rows, selection/focus, empty title, 2 expected-state tests | visible text, URL, title, selection, attributes, `web.dom.assert` evidence | Retarget | job-board home (select row: auction header `_sacat`) | 13/13 pass |
| live-page | modal-flows open modal | dialog role, name, modal, occlusion | Retarget | auction listing `itm/226152268190` bid drawer "Place your bid" | pass |
| live-page | modal-flows native confirm | `dialogs.lastNative` | **Blocked** | unchanged; hook needed (below) | not run (synthetic) |
| live-page | intermediate-state mid-work progressbar | busy plus progressbar indicator | Retarget | everything-store cart: the failing first "Save for later" spinner `role=progressbar` "Updating" | pass |
| live-page | infinite-feed aria-busy region | busyRegions | Retarget | social-network-feed home `[role=feed]` before the first batch | pass |
| live-page | modal-flows change and recency | `changed` / `recentlyInteracted`, run growth | Retarget | bigbox product: qty stepper "+" (qty changes, + only interacted), then "See more reviews" grows the run 3→6 | pass |
| shadow-overlays | product-catalog injected corner widget | a shadow widget's own button is not "blocked" by its host | Retarget | everything-store support chat bubble (`div[data-chat-host]`) | pass |
| shadow-overlays | job-board consent wall | (already realistic) | Kept | unchanged | pass |
| live-state-digest | basic-form injected disclosures | state-digest reduction (change, reversal, branch) | Retarget | local-classifieds results filter toggles | 16/19 pass (see Not verified) |
| field-entry | social-scheduler composer | node entries keep handles stable | Retarget | company-website quote drawer; auction header select plus text | 2/2 pass |
| resolve-target | ambiguous-targets coordinates / visual / order | strategy order and reach | Retarget | company-website services accordions | 3/3 pass |
| resolve-target | ambiguous-targets label-only name | a fingerprint `name` does not read `<label>` | Retarget | company-website newsletter email field | pass |
| resolve-target | ambiguous-targets focused fallback | no strategy → active element | Retarget | job-board What/Where | pass |
| resolve-target | ambiguous-targets all miss | one failure naming every miss | Retarget | job-board home | pass |
| resolve-target | long-document 4 tests | below-fold selector, coordinates, document bounds, fingerprint | Retarget | bigbox product "See more reviews" (review count 3→6 is the oracle) | 4/4 pass |

### Hook needed (Blocked)

The `lastNative` test needs a realistic page that calls `window.confirm`. One option is an armable
local-classifieds variant in which "Remove from saved items" on `saved/` asks `window.confirm`
before it removes the item, which leaves the default site unchanged. Any variant that raises a
native confirm on a deliberate press would do.

## Commands run and observed results

Every command was run from the tree root:

`pnpm --filter @fluxiq-web-extension/extension test:content -- <specs> --headed --workers=2`

- `evidence/tests/page-evidence.spec.ts` → 16 passed.
- `snapshot-items` and `live-page` with `--grep-invert modal-flows` → 14 passed, 1 failed. The
  failure was my own assertion (innerText against textContent). After the fix, the bigbox test →
  1 passed.
- `shadow-overlays.spec.ts` → 2 passed.
- `field-entry-target-stability.spec.ts` with `live-state-digest.spec.ts` → 3 passed.
- `resolve-target.spec.ts`: the first run gave 6 passed and 4 failed. The fix is described under
  Open questions, item 4. After it → 10 passed.
- All seven files together, `--grep-invert modal-flows` → **45 passed, 1 failed**. The failure was
  `live-state-digest`, which hung inside the exploration.
- `live-state-digest` with `--repeat-each=3`/`=4`. Nine headed runs passed with no failures: three
  before the hang was seen and six after.
  - Headed `--repeat-each=4` runs: one passed 2 and failed 2 (each worker's first run hung on a
    `runAction` until the test timed out, with `stateDigestFailures` reading `page.evaluate: Test
    ended`); a later one passed 4/4.
  - One run without `--headed`, `--repeat-each=4` → 4/4 passed.
  - Not counting runs with the debug logging I added, the headed total is 16 of 19.

I ran no unit tests, because I moved no logic into one. I ran no typecheck, as the brief asked: the
lead runs it. Playwright compiles the files but does not typecheck them.

## Not verified

- **TypeScript types.** The specs were not run through `tsc`, so types are unchecked. One example
  is the cast of `(await harness.finalState()).state`, which is typed `object`, to
  `{ orders?: ... }`.
- **Why `live-state-digest` sometimes hangs.** I did not find the cause.
  - The hangs happened only in headed runs. When they happened, Playwright also failed to write its
    artifacts (`ENOENT ... .playwright-artifacts-N`).
  - About 46 Chromium processes were running, which suggests other workers were running Playwright
    in the same `apps/extension/e2e/test-results` directory at the same time.
  - I did not prove that this was the cause. The test should be run again when no other workers are
    running.
- **The native-dialog test was not run.** It opens a synthetic scenario, which the rule bars.
- **I did not run the original synthetic specs for a baseline**, because the same rule bars it.
  Reading the current source suggests some of their assertions would already fail. They are listed
  under Open questions.

## Open questions or contradictions found

1. Three of the old claims no longer match the current content-script contract, so I wrote the new
   assertions to the current contract.
   - The funnel claimed `scanned > candidates`, but `dom-snapshot.ts:199` reports
     `candidates: walked`, which equals `scanned`.
   - "Relevant attributes: exactly the allowlisted attributes" no longer holds. Since t200 every
     attribute travels (`descriptor-attributes.ts`), so the row now compares against the page's own
     attributes, in order.
   - The repeating `fields` come only from test ids inside a row (`repeating.ts:itemFields`). No
     realistic site has rows with inner test ids, so the "fields named" claim cannot be proven on a
     realistic page. The rows now assert that no fields are invented (`fields` is undefined). A
     positive proof needs a realistic row template that has inner `data-testid`s, which is a hook
     for the lead.
2. `field-entry-target-stability` claimed that typed values never reach the packet. That
   contradicts the current page view, which prints `="value"` for non-sensitive fields
   (`domain/src/runtime/llm-evidence/page-view/element/state-tokens.ts`). The rewritten test now
   checks that each entry shows on the line its handle names. The withholding of sensitive values
   is pinned in `sensitive-names.spec.ts`, which another worker owns. If "values never leave the
   page" is still the intended product rule, this is a product question.
3. Both `live-state-digest` and `field-entry-target-stability` were already broken before this
   brief. Their helpers read an `elements[]` / `{name, target}` JSON shape that the evidence no
   longer has, because the evidence is now a compact text page view. Both now parse the page view.
4. On pages with open shadow roots, the resolver also searches inside those roots. Its failure
   message then names a second pass after the main one, such as `"..., element fingerprint in the
   page's open shadow roots."`. Every realistic page used here has shadow roots, so
   `resolve-target` now expects those longer messages.
5. `evidence/tests/sensitive-names.spec.ts` shows as modified in this tree. I did not edit it; it
   belongs to another worker.
