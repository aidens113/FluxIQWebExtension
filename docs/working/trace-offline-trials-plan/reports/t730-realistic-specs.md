# t730 realistic-specs: browser specs on the ten realistic scenarios only

Lead report and running log for brief `t730-realistic-specs` (tree
`fxwork/t730-realistic-only-browser-specs`, branch `task/t730-realistic-only-browser-specs`).

## Scope found (2026-10-19, lead survey)

The rule (AGENTS.md, user 2026-09-29): Lab and browser test runs, Playwright specs and the content
harness included, open only the ten realistic scenarios. Survey of what opens something else:

- `apps/scenario-lab/e2e`: 17 of 19 specs open synthetic scenarios (all but `local-classifieds` and
  `social-network-feed`; `negative-variants` is synthetic too). No guard exists in `lab-fixture.ts`.
- `apps/extension/e2e/content/tests`: about 43 spec files open synthetic scenarios through
  `openHarness("<id>")` or `page.goto("/scenarios/<id>/...")` (basic-form alone is referenced 80 times;
  product-catalog, sensitive-input, identity-drift, ambiguous-targets, modal-flows, keyboard-forms,
  long-document, failure-surfaces, infinite-feed, file-transfer, data-table, delayed-ui,
  social-scheduler, intermediate-state, auth-gate, member-directory, iframe-checkout, navigation,
  company-directory). `harness.ts` has no guard.
- `apps/extension/e2e` outside content: `action.spec.ts` and `install-and-content.spec.ts` serve an
  inline synthetic page (`fixtures/scenario-page.ts`); `runtime/tests/` `browser-navigation-readiness`,
  `meaningful-assert-wait`, `requests-settings`, `sanitized-field-typing`, `typed-browser-readiness`
  serve inline HTTP pages; `user-script-feasibility` serves synthetic probe pages; `cancellation/tests`
  start HTTP servers (to classify). Out of scope by brief: `content/tests/snapshot-fidelity/**` (lane T),
  `reconnect.spec.ts` (lane G), `site-reset/**` (in t724's dirty set; it is realistic anyway).
- `.github/workflows/testing-facility.yml`: "Run all scenario pages without extension or Core" runs the
  scenario-lab Playwright suite (synthetic today); nightly sizing comment cites 41 scenarios.

## Plan

1. **Wave A (parallel).**
   - Atlas: three workers map the ten realistic sites (routes, constructs with locators, variants,
     oracle fields, existing browser coverage) into `reports/t730-atlas-{1,2,3}.md`, the input every
     retargeting worker reads.
   - Scenario-lab: three workers (SL1-SL3) take the 17 synthetic page specs. These specs prove a
     synthetic fixture's in-browser contract, which nothing consumes once the fixture is barred from
     browsers. Disposition per spec: delete; port every server-side check (final-state oracle, API
     mutations, variant arming) that no unit test covers into a browser-free unit test in
     `src/scenarios/<id>/tests/`; flag any generic capability that needs a realistic home.
2. **Wave B (after the atlas).** Content-harness and extension workers, partitioned by spec file:
   retarget each test to a realistic page with the same construct, or delete where a realistic spec
   already proves it (cite it), or move browser-free logic to a unit test beside its subject. Anything
   without a realistic home is reported, never silently dropped; realistic-scenario test hooks in
   `scenarios/**` are made serially by the lead.
3. **Wave C (guards, last).** `lab-fixture.ts` refuses any `/scenarios/<id>`, `/api/<id>` or
   `/__control/...?scenario=<id>` request for a non-realistic id (shared guard module that reuses
   `packages/test-runner/src/realistic-scenarios/index.ts`, the one list); the content harness and the
   extension fixtures refuse the same; a static spec-source scan fails on a synthetic id or an inline
   synthetic page server in a browser spec; tests for both. Workflow step renamed and restricted,
   nightly comment corrected.
4. Validation: every rewritten or retargeted spec run headed (`--headed`), provider-free; guard tests;
   `node scripts/structure-audit.mjs`; scenario-lab and extension typechecks.

## Disposition table

Per-test rows (capability, disposition, new home, headed result) are in each worker's report; this is the
per-spec summary.

### Scenario Lab page specs (`apps/scenario-lab/e2e`)

Each synthetic page spec proved "fixture X behaves as its manifest promises in a browser", which nothing
consumes once the fixture is barred from browsers. Disposition for all 17: **deleted**; every server-side
check moved to a browser-free unit test; browser-only checks of the fixture's own DOM are recorded as
fixture-only; generic capabilities are proved by the extension specs on realistic sites (below).

| Spec | Capability | Disposition | New home | Detail |
| --- | --- | --- | --- | --- |
| admin-console | console fixture: virtualised extraction, inner-pane scroll, shadow switch, same-page routing, inline edit, variants | deleted; oracle, routes, 404, variant arms moved | `src/scenarios/admin-console/tests/lab-server.test.ts`; five pinned product defects recorded (SL1) | t730-sl1.md |
| auth-gate | sign-in, expiry redirect, sign-out | deleted; already covered | existing `auth-gate/tests/scenario.test.ts` | t730-sl1.md |
| data-table | header-mapped extraction, column reorder, sort persistence | deleted; reorder arm and sort moved | `data-table/tests/lab-server.test.ts`; header lookup also `extension/src/content/extraction/tests/field-reader.test.ts` | t730-sl1.md, t730-b4 |
| file-transfer | download and upload recorded | deleted; already covered | existing `file-transfer/tests/scenario.test.ts` | t730-sl1.md |
| identity-drift | save through drifted controls (7 variants) | deleted; arms and press recording moved | `identity-drift/tests/lab-server.test.ts` | t730-sl1.md |
| infinite-feed | pages load in order, end-early | deleted; moved | `infinite-feed/tests/lab-server.test.ts` | t730-sl1.md |
| scenario-pages | eleven foundational fixtures (form, list, navigation, long document, frames, ambiguity, delay, failures, reconnect, target drift, sensitive input) | deleted; server checks moved or already covered | `{dynamic-list,long-document,reconnect}/tests/scenario.test.ts` (new); `{sensitive-input,llm-target-drift,navigation,ambiguous-targets}/tests/scenario.test.ts` (extended) | t730-sl2.md |
| negative-variants | armed pages fail as declared (broken link, too slow, no/form context, disabled, detached, blocked URL) | deleted; covered or moved | `navigation`, `delayed-ui`, `ambiguous-targets`, `failure-surfaces` scenario tests | t730-sl2.md |
| intermediate-state | processing interstitial, unannounced confirmation | deleted; covered | existing `intermediate-state/tests/scenario.test.ts` | t730-sl2.md |
| keyboard-forms | Enter submit, combobox keys, D5 platform evidence | deleted; state covered; D5 re-homed | `apps/scenario-lab/e2e/realistic-keyboard-platform.spec.ts` (realistic forms) | t730-sl2.md, t730-b7 |
| multi-tab | new tab, window.open, popup blocked | deleted; covered | existing `multi-tab/tests/scenario.test.ts`; tab mechanics in `extension/e2e/runtime/tests/opened-tab.spec.ts` (crossborder) | t730-sl2.md |
| member-directory | roster console at scale, filters, drawer cover | deleted; moved | `member-directory/tests/lab-server.test.ts` | t730-sl3.md |
| modal-flows | invite dialog, consent, interstitial, native confirm | deleted; moved | `modal-flows/tests/lab-server.test.ts`; native confirm on realistic site: company-website `confirm-unsubscribe` | t730-sl3.md, t730-c1 |
| order-operations | refunds, dispatch, filters | deleted; moved | `order-operations/tests/lab-server.test.ts` | t730-sl3.md |
| product-catalog | search, pagination, extraction | deleted; moved | `product-catalog/tests/lab-server.test.ts`; extraction on realistic sites in `extract-list-*` specs | t730-sl3.md, t730-b4 |
| storefront-checkout | frame payment, consent, support widget | deleted; moved | `storefront-checkout/tests/lab-server.test.ts`; frames on realistic sites in `frames.spec.ts` | t730-sl3.md, t730-b7 |
| support-desk | support console | deleted; moved | `support-desk/tests/lab-server.test.ts` | t730-sl3.md |
| local-classifieds, social-network-feed | realistic site workflows, oracles, traps | kept; two stale expectations fixed (C6) | same files | t730-c6 |

### Extension browser specs (`apps/extension/e2e`)

Capability is the content-script or runtime behaviour the spec proves; every listed spec now opens only
realistic scenarios. "Mode" means a realistic-site test mode switched on by the site's `set-mode` (see
`docs/architecture/testing-facility.md`, "Realistic-site test modes").

| Spec | Capability | Disposition | New home (realistic page or mode) | Detail |
| --- | --- | --- | --- | --- |
| identity, identity-ambiguity, identity-signals, identity-wire-chain | element identity: fingerprints, ambiguity refusal, signals, wire chain | retargeted | look-alikes and drift on everything-store, company-website, local-classifieds; sensitive checkbox on bigbox `account-recovery` | t730-b1, t730-c2 |
| identity-resolution | recovery after drift | retargeted | realistic drift; reworded-aria row on company-website `reworded-quote-submit` | t730-b1, t730-c1 |
| identity-veto | veto of look-alikes after a redeploy | retargeted; page edits replaced by modes | company-website `quotes-paused`, `quote-footer-redesign`, `phone-quotes` | t730-b1, t730-d4 |
| click | click semantics, coverage gate, links, in-place loads | retargeted | everything-store, company-website, job-board, photo-social; in-place row load on job-board `in-place-filters`; cart-page link and cover rows: F1 (pending) | t730-b2, t730-c4 |
| actions | typed actions; reads that skip sensitive contents | retargeted; injected sensitive controls replaced by a mode | photo-social `saved-logins` and realistic forms | t730-b2, t730-d1 |
| recorder-trust, repeat-exemplars | recorder trust of events; repeated exemplars (current folding) | retargeted | realistic pages; 4 repeat-exemplars rows had already failed on dev (t200 removed the ranking) and now test current folding | t730-b2 |
| redaction, selection-redaction | sensitive values never reach snapshots, events or extraction | retargeted | bigbox checkout sign-in wall and cross-origin card frame; photo-social login | t730-b3 |
| evidence/sensitive-names, extraction/extract-list-sensitive | names and extraction skip sensitive-marked contents | retargeted | bigbox `account-recovery` | t730-b3, t730-c2 |
| extraction/extract-list-catalog, -pagination, -continuation, pagination-stop, extract-list-table | list extraction, Next, continuation, stopping, tables | retargeted; 2 deleted (covered by realistic specs, cited); 3 moved to unit tests (column reorder, load-more end, 1,000-record cap) | realistic list pages; `src/content/extraction/tests/{field-reader,list-reader}.test.ts`, `page-advance/tests/load-more.test.ts` | t730-b4 |
| extraction/structure-detection, inference, extraction-picker | structure detection, field inference, picker | retargeted; credential rows on photo-social `saved-logins` | realistic list pages | t730-b5, t730-d1 |
| selectors/unique-selectors | unique, stable selectors | retargeted; **bounded injection kept** for three writer-shape rows (duplicate ids, quote-bearing ids, a 2-D grid): no realistic site has the shape and a mode drawing malformed markup would be out of proportion | store results page | t730-b5 |
| large-page-resolution | resolution at scale | retargeted (row 1 on everything-store `reworded-prompt`); size **injected** as filler anchors (a page bigger than any site draws, by design); rows 1-2 **Blocked** on the identity-capture regression (`src/content/identity/control-row.ts`, separate task) | company-website home; everything-store | t730-b5, t730-c3 |
| evidence/page-evidence, snapshot-items, live-page, shadow-overlays; exploration-state/*; resolve-target | page evidence, digests, target resolution | retargeted; native-confirm row on company-website `confirm-unsubscribe` | job-board consent wall, everything-store chat, local-classifieds filters | t730-b6, t730-c1, t730-c5 |
| keyboard, select, scroll, waits, frames | keys, selects, scrolling, waits, frames | retargeted; W03 row on everything-store `keyboard-suggestions`; waits "stable" on job-board's own rate-limit countdown | job-board, local-classifieds, bigbox/auction cross-origin frames, everything-store | t730-b7, t730-c3, t730-d5 |
| shadow-roots/shadow-root-in-place | closed, late and inserted shadow roots | retargeted; constructed component replaced by a mode | bigbox `partner-widgets` | t730-b7, t730-d2 |
| dialog-dismissal, dialog-refusal | dialog dismissal; refusal behind challenge dialogs | retargeted; injected dialogs replaced by modes | company-website `account-move`, `security-check`, `captcha-check`, `sign-in-again`, `sign-in-code`, `card-on-file`, `deposit-authorisation`; photo-social and local-classifieds real dialogs | t730-b8, t730-d4 |
| upload-dialog | uploads; native confirm handling | retargeted | job-board ATS resume input; company-website `confirm-unsubscribe`; inert-upload row was a product defect fixed by t732 | t730-b8, t730-c1, t730-c5 |
| failures, check-assert, actionability-gate | failure classification, check/assert, actionability | retargeted; two stale bigbox check rows rewritten | company-website, job-board, photo-social, bigbox | t730-b8, t730-c5 |
| harness-guard/tests/realistic-scenarios (new) | the content harness refuses non-realistic scenarios | new | company-website, everything-store | lead |
| action, install-and-content, runtime/browser-navigation-readiness, requests-settings | extension install, injection, actions, open validation, requests setting | retargeted; inline page fixture `fixtures/scenario-page.ts` deleted | everything-store, bigbox | t730-b9 |
| runtime/meaningful-assert-wait | refusal of empty predicates | retargeted; **Blocked on t732** (blank `wait_for_text` retried as a plain Error) | bigbox search results | t730-b9 |
| runtime/sanitized-field-typing | native typed values, refused and reverted edits, per-key events | retargeted; own server removed | job-board `extended-application`; everything-store search; photo-social login | t730-b9, t730-e1 |
| runtime/typed-browser-readiness | controlled checks; Next across documents and in place | retargeted; own server removed | crossborder `cart-add-ons`, professional-network `in-place-paging`, company-website quote drawer, everything-store results, photo-social comments | t730-b9, t730-e2 |
| user-script-feasibility/** | userScripts world on a strict-CSP page, isolation, network counting (gated by `FLUXIQ_USER_SCRIPT_PROBE=1`) | F1 (pending): retarget onto the everything-store receipt page with its own CSP and the Lab's `/__control/requests` | everything-store | t730-b9, F1 |
| cancellation/** | Stop cancels a build or run | kept: its servers are gateway mocks, no page | n/a | t730-b9 |


## Progress log

- 2026-10-19: survey above; plan written.
- 2026-10-19: atlas written by three workers: `reports/t730-atlas-1.md` (everything-store,
  crossborder-marketplace, bigbox-retail, auction-marketplace), `t730-atlas-2.md` (job-board,
  local-classifieds, company-website), `t730-atlas-3.md` (photo-social, social-network-feed,
  professional-network). Scarce constructs: no native alert/confirm/prompt and no closed shadow root on
  any of the ten; password only on bigbox's checkout sign-in wall; contenteditable only in
  local-classifieds' chat reply box; file inputs are hidden (job-board ATS resume; everything-store camera
  dialog under `redesigned-header`); cross-origin frames only in bigbox (card form), auction (seller
  description) and social-network-feed (video player).
- 2026-10-19: SL1 and SL2 landed (reports `t730-sl1.md`, `t730-sl2.md`). Deleted 11 scenario-lab specs:
  admin-console, auth-gate, data-table, file-transfer, identity-drift, infinite-feed, scenario-pages,
  negative-variants, intermediate-state, keyboard-forms, multi-tab. Server-side checks moved to unit
  tests: new `src/scenarios/{admin-console,data-table,identity-drift,infinite-feed}/tests/lab-server.test.ts`,
  new `src/scenarios/{dynamic-list,long-document,reconnect}/tests/scenario.test.ts`, extended
  `src/scenarios/{sensitive-input,llm-target-drift,navigation,ambiguous-targets}/tests/scenario.test.ts`
  (comment fixes in iframe-checkout and failure-surfaces tests). Lead check, from `apps/scenario-lab`:
  `node --test dist/scenarios/{admin-console,infinite-feed,data-table,identity-drift}/tests/lab-server.test.js dist/scenarios/{dynamic-list,long-document,reconnect,sensitive-input,llm-target-drift,navigation,ambiguous-targets,iframe-checkout,failure-surfaces}/tests/scenario.test.js`
  -> `# tests 58 # pass 58 # fail 0`. Generic capabilities they flag (keyboard, frames, scroll, waits,
  actionability, multi-tab, pushState, shadow targets, uploads) are product behaviour of the content
  script and runtime, proved by the extension specs wave B retargets. SL1 notes the admin-console spec
  pinned five known product defects (virtualised-list extraction returns the render window; scroll into an
  inner pane; shadow-root target found by engine not document query; same-document routing; element
  replaced during inline edit); no realistic site has a virtualised list, so that one has no home.
- 2026-10-19: SL3 re-dispatched (first dispatch hit the concurrent-agent limit).
- 2026-10-19: harness smoke in this tree:
  `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/facts/tests/deal-wheel-facts.spec.ts --headed --workers=1`
  -> `1 passed (1.3m)`.

- 2026-10-19: SL3 landed (`t730-sl3.md`): deleted member-directory, modal-flows, order-operations,
  product-catalog, storefront-checkout, support-desk specs; 27 browser-free tests in
  `src/scenarios/{member-directory,modal-flows,order-operations,product-catalog,storefront-checkout,support-desk}/tests/lab-server.test.ts`
  (worker: `node --test` on the six dist files -> 27 pass, 0 fail). All 17 synthetic scenario-lab specs are now gone.
- 2026-10-19: wave B landed (reports `t730-b1-identity.md` ... `t730-b8-dialogs-failures.md`; B9 re-dispatched
  after the agent limit). Headed results as the workers report them: B1 62 passed; B2 49 passed; B3 13+6+5+5
  passed; B4 34 passed plus 9 unit; B5 26 passed, 1 slow row failing (also failing at HEAD); B6 45 passed,
  live-state-digest flaky 16/19; B7 52 passed plus 3 scenario-lab; B8 56 passed, 3 actionability-gate rows
  failing as on dev. Rows left Blocked (still synthetic): 13, each with a named hook.
- 2026-10-19: **lead ruling, injected DOM**: a bounded test-authored element injected into a live realistic
  page (B2, B5, B7, B8 rows; each marked in its spec and listed in the worker's table) counts as a retarget:
  the page is realistic and its traps stay live around the construct. This is a lead decision, not a user
  rule; if the user rules injected markup out, the rows and the hook each would need are in those reports.
- 2026-10-19: wave C dispatched: hooks on realistic sites for the Blocked rows, partitioned by scenario (C1
  company-website: native confirm on newsletter unsubscribe, reworded quote submit; C2 bigbox-retail:
  account-recovery panel with sensitive-marked controls; C3 everything-store: suggestion-list keys and a
  reworded "Not now"; C4 job-board: in-place filters), C5 live-state-digest flake and actionability-gate
  failures, C6 two stale realistic scenario-lab specs (below).
- 2026-10-19: guard landed (lead). `apps/scenario-lab/e2e/realistic-scenario-guard/` (`scenarioIdInUrl`,
  `installRealisticScenarioGuard`, `findSyntheticPageUses`, barrel, tests). Wired into: `lab-fixture.ts` (auto
  fixture on every test; `readFinalState`/`armVariant` assert too), `apps/extension/e2e/content/harness.ts`
  (refuses a non-realistic id before the lab starts, guards the page's context, `close()` throws the
  refusal), `apps/extension/e2e/fixtures/extension-context.ts` (every extension session). The deterministic
  network guard now passes allowed requests with `route.fallback()` so the two routes compose.
  `apps/scenario-lab/tsconfig.e2e.json` rootDir widened to the repository root (noEmit) so e2e may import the
  one list from `packages/test-runner/src/realistic-scenarios` (TS6059 otherwise). Workflow step renamed and
  commented, nightly sizing comment corrected to ten scenarios.
  - `node_modules/.bin/playwright test -c e2e/playwright.config.ts realistic-scenario-guard --headed` (from
    `apps/scenario-lab`): guard tests 3/3 and URL tests 2/2 pass; scanner self-test passes; the repository scan
    fails, listing exactly the 13 Blocked rows still in flight and B9's six inline page servers (expected until
    wave C and B9 land).
  - `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/harness-guard/tests/realistic-scenarios.spec.ts --headed --workers=2`
    -> `3 passed`.
  - `tsc -p tsconfig.e2e.json --noEmit` (scenario-lab) -> exit 0; `tsc -p tsconfig.test.json --noEmit`
    (extension, includes e2e) -> exit 0 after fixing two type errors in B5/B7 files (`shadowHostsOf` read via
    `Reflect.get`; `mutate` payload typed `object`).
  - Structure audit: fixed my packed statement; moved the harness guard spec to
    `content/tests/harness-guard/tests/` (folder was at 26 files); B4's three unit tests folded to fit
    `src/content/extraction/tests/` (25-file limit): column test into `field-reader.test.ts`, item-cap into
    `list-reader.test.ts` (795 lines), load-more ending to `page-advance/tests/load-more.test.ts`.
    `EXTENSION_TEST_BUILD_LABEL=t730-lead node scripts/test-extension.mjs` -> `# tests 3280 # pass 3280 # fail 0`
    (this ran the whole extension unit suite, about 5 minutes; the runner has no file filter).
  - Realistic scenario-lab specs under the new guard, headed: 39 passed, 2 failed
    (local-classifieds:183 `only-the-offer` text; social-network-feed:313 testid list). Both specs date from
    2026-09-21 and the sites changed since; scenario sources untouched here, so the failures predate this lane.
    Sent to C6.

## Wave B shared brief (read by every wave-B worker)

- Tree: `C:/Users/osrs_/FluxStuff/fxwork/t730-realistic-only-browser-specs`, absolute paths only. No
  commits. Never edit `C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ`. No paid or live Lab runs.
- Rule: a browser may open only the ten realistic scenarios (everything-store, crossborder-marketplace,
  bigbox-retail, job-board, local-classifieds, auction-marketplace, photo-social, social-network-feed,
  company-website, professional-network). That includes inline pages served by a spec's own HTTP server.
- Read the atlas files above for what each realistic site offers (routes, constructs, locators, variants).
- For each test in your files, name the capability it proves (the content-script or runtime behaviour,
  not the fixture), then one disposition:
  1. Retarget: the same assertion on a realistic page with the same construct. Derive expectations from
     the scenario's exported data where it exists. Deal with the site's traps (consent walls, chat
     widgets, notification prompts, delayed overlays) as a person would, through the site's own controls
     or its `/api` mutations and variants.
  2. Delete: only when an existing realistic spec already proves the same capability; cite file and test.
  3. Unit: logic that needs no browser moves to a unit test beside its subject
     (`apps/extension/src/a/b.ts` -> `apps/extension/src/a/tests/b.test.ts`, run by
     `scripts/test-extension.mjs`, Node only, no DOM).
  4. Blocked: no realistic page has the construct. Leave the test unchanged and record exactly which
     hook it needs (scenario, page, construct, ideally as an armable variant so the default site is
     unchanged). Never drop a test silently.
- Do not edit: `apps/scenario-lab/src/scenarios/**` (report hooks instead), `apps/extension/e2e/content/{harness,fixture,runtime-stub,global-setup,bundle-env}.ts`,
  `apps/scenario-lab/e2e/{lab-fixture,network-policy}.ts`, `content/tests/snapshot-fidelity/**`,
  `reconnect.spec.ts`, `site-reset/**`, `packages/**`, `scripts/**`, extension `src/**` except new unit
  tests, any file another worker owns.
- AGENTS.md structure rules apply (one export per file, barrels, tests in `tests/`).
- Validation: run each changed spec headed, provider-free, from the repo root:
  `pnpm --filter @fluxiq-web-extension/extension test:content -- <spec paths relative to apps/extension/e2e> --headed --workers=2`
  and record the command and pass counts. Unit tests: `EXTENSION_TEST_BUILD_LABEL=<your-brief-id> node apps/extension/scripts/test-extension.mjs` filtered if it supports a filter. No full suites, no typecheck of the whole package (the lead runs it).
- Report: your own `reports/t730-<brief-id>.md` with a table: spec | test | capability | disposition |
  new home (file and test name) | headed run result.

## Hand-back state (2026-10-19, lead)

- C4 landed (`t730-c4-job-board-hooks.md`): job-board `in-place-filters` mode (set-mode, not a manifest
  variant); click.spec.ts no longer opens company-directory; worker: job-board dist tests 57/57, click.spec
  headed 17 passed. Not yet re-verified by the lead.
- Still running at hand-back, each writing its own report in this folder: C1 company-website hooks, C2
  bigbox-retail hooks, C3 everything-store hooks, C5 live-state-digest flake and actionability-gate rows,
  C6 stale realistic scenario-lab specs, B9 extension non-content specs.
- Not done yet: the repository scan
  (`apps/scenario-lab/e2e/realistic-scenario-guard/tests/browser-specs-scan.spec.ts`) stays red until C1-C3
  and B9 land; then a headed re-run of every changed spec; `pnpm structure:baseline` (deleted specs leave
  baseline entries that can be lowered); the per-spec disposition table (per-test tables are in each worker
  report); docs/architecture/testing-facility.md still describes the deleted scenario-pages and
  negative-variants specs (around lines 1234-1241) and should say the selector and browser specs use only
  the ten realistic scenarios (around line 285). That file is outside this brief.
- Product defects found and reported, not fixed (src outside brief): see B1 (resolver retry closes the quote
  drawer; unchanged control scores 0.840), B2 (recorder logs the click verb's own scroll as dom.scroll), B3
  (bigbox `cvc` without autocomplete may be captured), B4 (load-more swallowed first press ends at 24/28;
  `next` presses a hidden control; `next` never presses Retry), B5 (shadow-root descriptors carry no
  shadowHosts; price table detection returns accordion sections), SL1 (five admin-console defects).
- C6 landed after hand-back (`t730-c6-realistic-page-specs.md`): both failures were specs out of date with
  the sites (classifieds `only-the-offer` fact added in 7e360eb0; social feed oracle readouts in hidden
  `<script>` elements). Lead diff review: social-network-feed still requires `build-marker` to be the only
  visible test id and accepts only the named hidden readouts; no oracle weakened. Worker:
  `playwright test -c e2e/playwright.config.ts local-classifieds.spec.ts social-network-feed.spec.ts --headed`
  -> `33 passed`. Not re-run by the lead.
- C2 landed after hand-back (`t730-c2-bigbox-hooks.md`): bigbox-retail `account-recovery` mode (set-mode;
  default site, manifest and live tasks unchanged); the 7 blocked sensitive rows retargeted. Worker: bigbox
  node tests 44/44, `test:content -- <3 specs> --headed --workers=2` -> 14 passed, twice. Confirmed product
  defect (headed): bigbox `input[name=cvc]` value "7391" reaches the snapshot, keydown `key` and `dom.input`
  `inputValue`; the B-1 checkbox is sensitive only through its group, so the wire descriptor carries no
  marker. Not fixed (src outside brief).
- 2026-10-19, **supervisor ruling (not a user rule), replaces the lead ruling on injected DOM**: the preferred
  retarget is a realistic-site test mode switched on by the site's own control (as bigbox
  `account-recovery`), because the page stays a realistic site. A bounded injected element on a realistic page
  is allowed only where no realistic site has the shape and a mode would be out of proportion; each such row
  is listed in the disposition table with its reason. The guard still refuses any non-realistic URL.
- 2026-10-19: injection sites in specs this lane changed (grep for createElement / insertAdjacentHTML /
  innerHTML= / attachShadow): click (12), shadow-root-in-place (10), unique-selectors (6), actions (3),
  dialog-dismissal (2), dialog-refusal (2), identity-veto (2, drift simulations), large-page-resolution (2, C3),
  sanitized-field-typing (2, B9), inference (1), structure-detection (1), identity-resolution (1, C1),
  waits (1). Specs already realistic before this lane that inject (activity-overlay, shadow-root-controls,
  shadow-root-targets, text-sighting, dialog-bound-identity, user-script-feasibility probe) are listed but
  out of this conversion.
- 2026-10-19: conversion dispatched: D1 photo-social mode for the sensitive-control rows (actions 4,
  inference, structure-detection); D2 bigbox product-page badge with a closed, late shadow root
  (shadow-root-in-place 3 rows); D5 waits "stable" onto real page churn (professional-network countdown or
  feed batches). Queued behind running workers: everything-store rows in click.spec (cart links, covered
  target) after C3; company-website challenge and consequential dialogs (dialog-refusal, dialog-dismissal)
  and identity-veto after C1. Kept injected, mode out of proportion: unique-selectors writer-shape markup
  (duplicate ids, quote-bearing ids, a 2-D grid) — reason recorded in the table.
- 2026-10-19: item 3 (sensitive-cvc-capture task): no spec in this lane asserts the absence of the bigbox
  CVC value or the B-1 checkbox marker (C2's rows pass without depending on either), so no row is Blocked on
  that task.
- 2026-10-19: supervisor assigned `docs/architecture/testing-facility.md` to this lane.
- C1 landed (`t730-c1-company-website-hooks.md`): company-website set-mode states for a native confirm on
  newsletter unsubscribe and a reworded quote submit; upload-dialog (2 confirm rows), live-page
  (`dialogs.lastNative`) and identity-resolution (reworded-aria) no longer open synthetic scenarios;
  identity-fixtures.ts lost its identity-drift helpers. Worker: company-website dist tests 54/54; headed
  `test:content` on the three specs -> 38 passed. Inert-upload row in upload-dialog is a real product
  defect (reproduces single-worker): `upload.ts` refuses an inert input with reason "disabled" ->
  `not_actionable`, while the row expects `not_shown` since ba9fea58; fix belongs in `upload.ts` (src,
  outside brief). D4 dispatched for the company-website challenge/consequential dialogs and identity-veto.
- D5 landed (`t730-d5-waits-stable.md`): waits "stable" now waits on job-board's own rate-limit notice
  ("Try again in N", rewritten each second, then stops); the injected ticker is gone (lead grep: no
  createElement/insertAdjacentHTML left in waits.spec.ts). Worker: waits.spec headed -> 10 passed.
- Lead: `docs/architecture/testing-facility.md` updated: the refusal table gains the three Playwright entries;
  the static scan and the test-mode policy are described (supervisor ruling recorded as such); the deleted
  synthetic page specs are replaced by what moved where; new "Realistic-site test modes" table (bigbox
  `account-recovery`, company-website `confirm-unsubscribe` and `reworded-quote-submit`, job-board
  `in-place-filters`; C3, D1, D2, D4 modes to add when they land); the selector row says it hands out only
  the ten.
- B9 landed (`t730-b9-extension-specs.md`, relayed by the supervisor): 7 extension specs on realistic pages,
  `e2e/fixtures/scenario-page.ts` deleted, cancellation servers kept (gateway mocks, no page). Worker headed run
  12 passed, 3 failed: `meaningful-assert-wait` (product defect, below) and the two unchanged Blocked rows at the
  30 s budget. `meaningful-assert-wait` is **Blocked on t732**: a blank `web.dom.wait_for_text` throws a plain
  Error in `src/content/action-runtime/wait-conditions.ts` and is retried; assertion kept, comment added in the
  spec (lead). Supervisor answers recorded: passive listeners a test attaches are instrumentation and allowed
  (the scan does not flag them); no change to the global timeout in `e2e/playwright.config.ts` (L1 owns it);
  slow tests get an explicit per-test budget with the reason in a comment.
- Lead dispatched E1 (job-board application mode: native date/number inputs, refused and reverted edits,
  read-only field, covered-after-change; `sanitized-field-typing`) and E2 (crossborder controlled and
  self-unticking checkboxes; professional-network in-place Next; `typed-browser-readiness`).
- Decision needed from the supervisor: `user-script-feasibility/**` (gated by `FLUXIQ_USER_SCRIPT_PROBE=1`,
  branded Chrome/Edge) serves its own strict-CSP page and counts requests on its own server. A realistic home
  needs Lab server changes outside this brief: a per-route CSP a scenario route can set (for example an
  everything-store printable receipt) and a `/__control/requests` counter. Until decided, the scan flags
  `user-script-feasibility/pages.ts`.
- Supervisor approved (2026-10-19): (a) a per-route page CSP a realistic scenario route can set, home the
  everything-store printable receipt page (reads as a real page); (b) a Lab `/__control/requests` counter in
  `apps/scenario-lab/src/control.ts` / `server.ts`; this lane owns those two files and the receipt route, tests
  beside each; the probe is retargeted and stays gated by `FLUXIQ_USER_SCRIPT_PROBE=1`, not retired. Plan:
  one worker (F1) after C3 lands, since it and the click.spec everything-store conversion both touch
  everything-store.
- D2 landed (`t730-d2-bigbox-shadow-mode.md`, relayed by the supervisor): bigbox `partner-widgets` mode on the
  product page (closed shadow root offer, click-inserted delivery estimate, late-attached review highlights),
  default site byte-identical (unit-tested); worker: bigbox dist tests 77 pass; shadow-root-in-place headed
  9 passed on its second run (first run: one row hit 30 s because browser launch took 27 s on a loaded machine).
- D1 landed (`t730-d1-photo-social-mode.md`): photo-social `saved-logins` mode (login page on a device that
  remembers its accounts: pre-filled form, password hint, security answer, saved accounts, backup codes); the 6
  injected rows in actions, inference and structure-detection moved to it. Worker: photo-social dist 27/27;
  headed 32 passed; audit passed. Sent back to move `openFilledLogin` (writes the password value attribute on
  the baseline page) onto the mode too.
- D1 follow-up: `openFilledLogin` removed; the row runs on `saved-logins` (lead grep: no `openFilledLogin` or
  `PASSWORD_SECRET` left). Worker: actions.spec headed 20 passed; audit passed.
- D4 landed (`t730-d4-company-website-dialogs.md`, relayed by the supervisor): company-website modes for 7
  interstitial dialogs (recording the pressed button), `quotes-paused` and `phone-quotes`; dialog-refusal,
  dialog-dismissal and identity-veto retargeted. Worker: company-website and qualification tests 62/62,
  cross-scenario 29/29; headed run of the 3 specs plus upload-dialog and live-page 36 passed. Sent back to
  convert identity-veto rows 2 (footer reorder) and 3 (restyle) to a redeploy-style mode and to typecheck.
- E1 landed (`t730-e1-job-board-typing-mode.md`, relayed): job-board `extended-application` mode on the
  Talentloom form; sanitized-field-typing retargeted, its own server removed, explicit 150 s per-test budget
  with the reason; job-board dist 62 pass; headed 3 passed in runs 1 and 4 (runs 2-3 failed at extension start
  while another agent rebuilt dist in this checkout: serialize `test:e2e:build`).
- C5 landed (`t730-c5-digest-flake.md`, relayed): live-state-digest 35/35; the hangs were new workers stalling
  on imports on a starved machine (`--repeat-each` starts a worker per repeat), not test logic. Two stale bigbox
  check rows in actionability-gate rewritten (consent now cleared by the product; a navigating check is judged
  on the new page), 5/5. Inert-upload row: product defect now fixed by t732 (`not_shown`); assertion kept.
  Concurrent runs wipe `test-results/content/artifacts`, so every run passes its own `--output`.
- D4 follow-up landed: identity-veto rows 2 and 3 on a new company-website `quote-footer-redesign` mode; the
  spec no longer edits the page; company-website 64/64; identity-veto headed 4 passed. D4 reports
  `tsc -p tsconfig.test.json` TS2352 at `e2e/runtime/tests/typed-browser-readiness.spec.ts(172,26)` and an audit
  violation in `professional-network/tests/in-place-paging.test.ts` (import past a barrel), both in E2's
  in-progress files; E2 told to clear them before handing back.
- C3 landed (`t730-c3-everything-store-hooks.md`, relayed): everything-store `keyboard-suggestions` and
  `reworded-prompt` modes; keyboard.spec headed 15 passed; everything-store dist 66/66; audit passed.
  large-page-resolution rows 1-2 time out at 30 s on a product regression (identity capture in
  `src/content/identity/control-row.ts` walks up to 3 x 2,000 nodes per element; a 6,000-anchor page takes
  372 s against about 4 s in September): **Blocked on that regression** (separate task, supervisor); lead
  added a comment above each row; assertions and budgets unchanged. C3's stale-comment note on
  identity-fixtures.ts was already resolved by C1 (no `SAVE_BASELINE`/`armMode` left). F1 dispatched (Lab
  per-route CSP, `/__control/requests`, everything-store receipt, probe retarget, click.spec everything-store
  rows).
- E2 landed (`t730-e2-checkbox-and-paging-modes.md`, relayed): crossborder `cart-add-ons` and
  professional-network `in-place-paging` modes (default sites byte-identical); typed-browser-readiness
  rewritten, own server gone, per-test budgets commented; worker: scenario tests 102/102 and 26/26, headed 5
  passed, extension tsc exit 0, audit passed. Lead check of the changed assertion: pressing the pager's "3"
  instead of Next is the documented contract (`follow-next.ts`: a script Next is swapped for the pager's
  following number, `by: "following"`); the oracle still checks moved, same row nodes rewritten, address
  unchanged, end on `control_disabled`, exactly one press. Lead tightened the press check from
  `["Next","3"]` to exactly `"3"` with the contract cited.
