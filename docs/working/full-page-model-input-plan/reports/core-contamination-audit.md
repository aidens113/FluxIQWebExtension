# Core Contamination Audit (phase 0)

Read-only audit of FluxIQ Core (`C:/Users/osrs_/FluxStuff/!FluxIQ`, packages `fluxiq`, `contracts`, `ui-components`, `client-gateway-websocket`, `sdk`, `cloud`, and `apps/web`) for web, browser and extension logic. Done 2026-11-28 by a worker. No code changed, no git run.

## Summary

63 findings, grouped by module cluster (one finding can span several files):

| Class | Count | Meaning |
| --- | --- | --- |
| (a) generic, fine | 12 | Uses a word; the logic is domain-agnostic. |
| (b) web-shaped naming of a generic idea | 27 | The mechanism is generic and opaque; names and model or person text say "page", "press", "site". Rename, or take the words from a domain vocabulary port. |
| (c) web logic that belongs downstream | 24 | Core parses URLs, reads the web domain's own words, ids or handle shapes, or teaches web authoring. Move it. |

Scale, measured with a comment-stripping scan of non-test source (method under "Commands run"):
- 287 files in `packages/fluxiq/src` hold web wording inside string literals (816 lines): "the page", "the site", "website", "next page", "cookie", "banner", "URL", "press the ...".
- 213 files carry strong web terms in code (click, scroll, pager, xpath, href, tabId, website, cookie, iframe, selector).
- 17 files outside platform and server code call `new URL` or `URL.canParse` on page addresses.
- The existing `web-vocabulary` rule passes with 6 baselined files. It sees about 2 percent of the surface, because it reads names only and skips every string.

Worst offenders (all class c):
1. **Core parses page addresses.** `answer-first/rows/address-split.ts:4-17` and `rows/page-word.ts:7-14` split a URL's query and a `/page/N` path into a view and a page place. `engine/automation/records/read/location.ts:13` falls back to `snapshot.url`. `answer-first/task-key/task-key.ts:29-33` keys every task by the page origin. `caller/scope-rule.ts:55-73` pulls hosts out of any http string. `project-parts/card/origins.ts:5-20` reads `step.params.url` of nodes whose kind matches `/navigate/`.
2. **Core reads the web domain's read-stop and paging words.** `summaries/extraction-summary.ts:118-170` holds closed sets of `control_disabled`, `no_following_page`, `scrolled_to_end`, `control_not_clickable`, `page_settled`, `next_page`, `load_more`, `infinite_scroll`. `result-verification/read-account/stop.ts:29-36`, `pages-clause.ts:36-45`, `list-continues.ts:89-109` and `judge-paging.ts:48` turn them into judge sentences such as "its pager showed no page after page 3".
3. **Core's Flow script guidance teaches web authoring.** `flow-authoring/bootstrap/plan/flow-script-format.ts:205-423`: a `url:` parameter example, `extractList.*`, presses, cookie and consent banners, "on a real site that press takes the offer", next-page loops and `done when: text t11 contains "Booked"`. The same holds for `script-guidance/render-act.ts:9-10`.
4. **Core and the shared chat name web tool ids and verbs.** `ui/activity-status/wording.ts:68` keys words by `web.detect_repeating_structure`. `ui-components/src/chat/stream/step/words.ts:28-48` keys them by `web.dom.capture_snapshot` and `web.inspect_current_page`. `ui/activity-action/verb.ts:14-44` and `automation-activity/wording/action.ts:62-99` hold a browser verb catalogue ("Clicking on the page", "Scrolling the page", "Opening a page"). The `fluxiq/src/ui/activity-action/types.ts:6-176` kinds are `click`, `navigate` and `scroll`.
5. **Core knows the web handle shape.** `runtime/activity/text/reason-text.ts:27,29,48` matches `[tde]\d{1,6}` and a `web.` id prefix. The same shape is in `automation-activity/candidate/trial-words.ts:53` and `unfinished-build/judge-words.ts:32`.
6. **Public contracts carry the web runtime.** `contracts/src/fluxnode/spec/definition.ts:65,79-88` (`checkWebStart`) and `fluxnode/spec/scope.ts:16-30` (`sites` as host names) are web-specific. So are `contracts/src/task-attempts/task-result.ts:72-76,194-196` (`{site, pages}`) and `client-gateway/message/server-message.ts:18` (`server.set_active_tab {tabId}`).

Recent tasks:
- **t1083 route reach** is opaque and well designed. Its answer words (`pressed`, `went`) and its "page" text are class (b).
- **t1084 judge page views** is (b): a generic target view with web wording.
- **t1096** is loop detection, (b): "page" stands for target state.
- **t1099 statuses** sit on the (c) verb catalogue and the (b) "Getting the page ready" words.
- **t1094 page turns**, as far as this audit found, live in the (c) address-split and list-move area. No file is tagged t1094 in Core source.

Interaction with the plan: phase 2 deletes the look tools and the per-address diffs. Do not rename the view channel (`core.full_page`, `core.page_window`, page budget, page parts); remove or replace it in phase 2 and apply this audit's naming there. Several (c) moves below (stop words, address parsing, verb catalogue) are independent of phase 2 and can go first.

## Classification

Paths are under `C:/Users/osrs_/FluxStuff/!FluxIQ/packages/` unless stated. "f/" stands for `fluxiq/src/`, "fas/" for `fluxiq/src/framework/automation-service/service/`.

### (c) Web logic to move downstream (24)

| # | Path and line | What it does | Move: generic port Core keeps / what goes downstream |
| --- | --- | --- | --- |
| C1 | fas/answer-first/rows/address-split.ts:4-17, rows/page-word.ts:7-14; callers result-feed/read-of.ts:18,61, rows/read-evidence.ts:39-51, result/output-group.ts:30, result/types.ts:35 | Parses a page URL: sorts the query, drops page words (`page`, `pg`, `offset`, `cursor`, `scroll`...), extracts `/page/N`, and builds `view` and `place`. | Core keeps the opaque `place` (already read by `engine/automation/records/read/place.ts`) and a new opaque `viewKey` on the read answer. The web domain computes both from its URL. Delete address-split and page-word. |
| C2 | f/engine/automation/records/read/location.ts:10-15 | Falls back to `snapshot.url`, and accepts a location only if `URL.canParse`. | Read `holder.location` as an opaque string. The domain always sets it. |
| C3 | fas/summaries/extraction-summary.ts:118-170 (and 236-240) | Admits the web read's `paginationStop`, `listWait.stoppedOn`, continuation kinds and evidence as closed sets of web words. | Core contract: `stopClass: "source_ended" \| "bound_reached" \| "source_fault" \| "unknown"`, `continues: boolean`, and a bounded `said` sentence. The domain maps `control_disabled`, `scrolled_to_end` and the rest. |
| C4 | f/runtime/result-verification/read-account/stop.ts:29-36,50-58; pages-clause.ts:36-45; list-continues.ts:89-109; judge-paging.ts:48 | Turns those web words into judge sentences ("its pager showed no page after page N", "it scrolled to the end", "a scroll down it", "No next control was found on the first page"). | Core classifies by `stopClass` and prints the domain's `said`. The web sentences go downstream with C3. |
| C5 | fas/answer-first/task-key/task-key.ts:29-33 | The task key includes the page origin parsed from `startLocation`. | Port: the domain supplies an opaque `targetScope` (origin for the web), and Core hashes it. |
| C6 | fas/answer-first/caller/scope-rule.ts:55-73 | Walks any value for `http(s)://` strings and collects hosts to enforce scope. | Port: `scopeTargetsOf(value): string[]` from the domain. Core compares opaque targets against the grant. |
| C7 | f/runtime/conversations/site-name.ts:15-32; conversations/commands/page.ts:8-19 | Derives "amazon.com", "the page you had open" and "the website" for the person, and origin plus path for the model, from a URL. | Client request carries `targetLabel` (person words) and `targetShown` (model words), made by the extension. Core prints them. |
| C8 | f/runtime/project-parts/card/origins.ts:5-20, start-check.ts:39, types.ts:51 (`source: "navigate"`); fas/project-parts/list.ts:90-91 | Reads `step.params.url` of nodes whose kind matches `/navigate/` to compute a part's sites. | Node definitions declare an arrival parameter role. The domain supplies `targetScope(params)`, and Core aggregates opaque scopes. |
| C9 | contracts/src/fluxnode/spec/definition.ts:65,79-88; fluxnode/spec/scope.ts:16-30 | The public FluxNode spec validates a web start (http address) and `sites` host names. | The runtime registers its start and scope schema. Core's spec keeps `runtime`, an opaque `start` and runtime-validated `scope`. This is a public contract change and needs a compatibility note. |
| C10 | contracts/src/task-attempts/task-result.ts:72-76,108,194-196; task-attempts/subflow-card.ts:146-148 | The result says `{site, pages}` with a host check; the subflow card checks for an http origin. | `{ source: string; parts: string }` as person words from the domain, validated as words only. |
| C11 | fas/runtime-session/requirement-gate.ts:27-29; f/runtime/flow-authoring/bootstrap/plan/contracts.ts:34 | Core defines capability ids `web.facts@1` and `web.actions.reconcile@1`. | Neutral ids (`target.facts@1`, `actions.reconcile@1`) accepted beside the old ones for one release, or registered by the domain. |
| C12 | f/ui/activity-status/wording.ts:68,98-101,217; ui-components/src/chat/stream/step/words.ts:28-48 | Person words keyed by web tool ids, plus regexes that turn any click, type or scroll into "Clicking on the page" and similar. | Tool and node definitions carry `activity: {now, done}` words from the domain. Core and ui-components render them. |
| C13 | f/ui/activity-action/verb.ts:14-44, types.ts:6-176; f/runtime/automation-activity/wording/action.ts:62-99,232, act-words.ts:67-86, core-tool.ts:40-54, page-name.ts:17, call-context.ts:107, tool-call.ts:122 | Browser verb catalogue (navigate, back, next, click, check, scroll, tab) with gerunds and sentences ("Opening a page"). | Core keeps generic kinds (act, enter, move, read, look, wait) and icons. The domain declares its verb table through the activity wording port. |
| C14 | f/ui/activity-action/failure-reason.ts:16-200 | Maps the domain's result-code suffixes (`_dialog_`, `_refused_by_page_`, rate limited, not found) to sentences "on the page". | The failure carries a domain `personReason`. Core keeps generic fallbacks by failure class (the contracts failure taxonomy exists). |
| C15 | f/runtime/activity/text/reason-text.ts:27,29,48; f/runtime/automation-activity/candidate/trial-words.ts:53; f/runtime/flow-authoring/bootstrap/unfinished-build/judge-words.ts:32 | Hardcodes the web handle grammar `[tde]\d{1,6}` and the `web.` id prefix to screen text. | The domain declares its handle and id patterns at bind time, and Core screens with the declared patterns. |
| C16 | f/runtime/flow-authoring/bootstrap/plan/flow-script-format.ts:205-423 | The model's Flow script guidance: `url:` example, `extractList.*`, presses and consequences, cookie and consent banners, "on a real site", next-page loops, `done when: text t11`. | Core keeps the grammar (step, node, repeat, when, handlers, consequences) with neutral examples. The web guidance moves to the existing `runtime/llm/domain-instructions` binding. |
| C17 | f/runtime/flow-authoring/bootstrap/script-guidance/render-act.ts:9-10 | Guidance about cookie banners and popups, and "on a real site". | Same as C16. |
| C18 | f/runtime/flow-authoring/bootstrap/plan/required-terms.ts:16-25 | Instruction word groups of web UI acts (click, button, url, scroll, keypress) that gate a build. | Node definitions declare intent words, and Core matches against them. |
| C19 | f/runtime/flow-authoring/bootstrap/site-reset/words.ts:20-99 | Model text: "Name a list read on a page that loads at its own URL", "press its own control back", "left on the site". | Domain vocabulary port (see B14 for the structure). The URL-specific sentences go to the domain. |
| C20 | contracts/src/client-gateway/message/server-message.ts:18 | `server.set_active_tab { tabId }` on Core's public gateway. Already baselined by web-vocabulary. | `server.set_active_target { targetId }`, or the existing host lease (`client-gateway/action/host-lease.ts`) naming the domain's resource. |
| C21 | f/runtime/target-matching/fingerprinting/element-fingerprint.ts:19-95 (baselined 12) | Scores `tagName`, `selector`, `xpath`, `url`, `classNames` and `attributes` with default weights. This was kept by decision t842. | Fingerprint as keyed `signals: Record<string,string>` with weights the domain declares. Core scores generic signals. This revisits t842 and needs the lead's decision. |
| C22 | ui-components/src/screens/library/words/refusal-words.ts:12-42; screens/library/tree/filter-tree.ts:13-27; library/words/site-host.ts | The shared chat's library is grouped by site host, and its refusals say "Open X in this browser", "This page is not on a site it works on". | The client supplies grouping labels and refusal words through ports. ui-components is shared by other clients (AGENTS.md, 2026-11-02). |
| C23 | f/runtime/answer-first/act-record/identity/target-keys.ts:45,54; act-record/row-words.ts:15 | Decides which act parameters are identity versus plumbing by DOM-ish names (`tag.*`, `class.*`, `href`, `src`, `url`, `link`, `scroll.*`). | Node definitions declare parameter roles (identity, how-it-runs, plumbing). |
| C24 | Core test fixtures copied from web runs: f/runtime/conversations/instructions/tests/fixtures/run-*.json, f/runtime/models/providers/anthropic/tests/fixtures/*, f/runtime/result-verification/{run-trail,judge-evidence,cited-yes}/tests/fixtures/*, f/runtime/llm/decision-context/tests/recorded-runs.ts (776 lines) | Real recorded web runs (page views, web tool ids, scenario sites) drive Core's unit tests. | Replace with synthetic fixtures of a neutral domain in Core. Keep the recorded web runs as downstream tests. |

### (b) Web-shaped naming of a generic idea (27)

| # | Path and line | What it is | Rename or port |
| --- | --- | --- | --- |
| B1 | f/runtime/llm/view-channel/* (channel.ts:10, declaration.ts:13-18, view.ts:10, description.ts:9-15, tool-id.ts:4 `core.full_page`, window-tool-id.ts:4 `core.page_window`, projection.ts:66, budget.ts); harness-options/registry.ts:113-117,133,185-188,270-296; harness-options/binding.ts:215-231 | Generic keyed-view diffing of an opaque key, named and described as pages. | Phase 2 replaces it. Do not rename now; the replacement uses "view of the target" naming. |
| B2 | f/runtime/llm/evidence-loop/answered-request.ts:34,59-61,118-136 | `pageUnchanged`, `splitPage`, "Core looked again ... the page". | Becomes `viewUnchanged` with domain vocabulary. Most of it goes with phase 2. |
| B3 | f/runtime/result-verification/judge-evidence/page-views.ts:41-60, trail-pages.ts, page-of.ts (t1084) | Judge sees the target views. NOTE text: "one line per element, in page order". | "target views", with the noun from the domain vocabulary. |
| B4 | f/runtime/result-verification/result-evidence/types.ts:7 (`AutomationStudioResultEvidencePage`); fas/answer-first/result-feed/feed.ts:56-253, replacements.ts:6-33, source-state.ts:1-34, restore.ts:19-45, returned-pages.ts, left-reads.ts:26-51 | A "page" here is one contributing read batch. | Rename to `...EvidenceBatch` or `...Part`. |
| B5 | f/runtime/result-verification/contracts/read-account.ts:25-41,105-112 | `pagesRead`, `pageLimit`, `keptPerPage`, `paginates`: paging of a collection. | `partsRead`, `partLimit`. |
| B6 | fas/answer-first/result-feed/list-pager.ts:22-28, list-move.ts:1-60, result/header.ts:104 ("the list shows no pager"), result/types.ts:67 (`kind: "pager"`), result/ledger.ts:40 | Opaque `listKey`, `listMove` and `listPaging` declared by the domain. | `kind: "continuation"`, with person words from the domain. |
| B7 | f/runtime/automation-host/contracts/route-reach.ts:45 (`"pressed" \| "went"`); automation-host/route-state/*; fas/../route-state/signatures/index.ts (t1083) | Opaque host route state and effects. The words are web. | Answers `reached_by_act` and `reached_directly`; "route state", not "page". |
| B8 | f/engine/automation/state-routing/decision.ts:123-302 (`routeByPage`, "expected starting page"), announcement.ts:26-44, route-owed.ts, not-arisen.ts | Generic state routing, worded as pages and controls. | Domain vocabulary in announcements; `routeByState`. |
| B9 | f/runtime/llm/repeat-guard/loop-detection/detector.ts:92,133,355 (`NOTHING_NEW` "page", `judgesWithNoPage`); watch.ts (t1096) | Loop dimensions. | "view" or "target state". |
| B10 | f/runtime/llm/repeat-guard/feedback.ts:28-72; candidate-feedback.ts:66-90 | Model text: "on this exact page", "press", "something over the page covers its control". | Domain vocabulary port (target, element, act nouns). |
| B11 | f/runtime/llm/node-tools/step-place.ts:157-427 (`startPage`, "page put back") | Rerun from the step's recorded start state. | `startState`, plus vocabulary. |
| B12 | fas/candidate-trial/target-on-page.ts (t420), feedback.ts:12-69 | Near-miss target resolution. | `targetNearby`, plus vocabulary. |
| B13 | fas/candidate-trial/interruptions.ts; f/engine/automation/node-execution/cleared-layer.ts:48-50; f/engine/automation/recovery/run.ts:160 ("Close what was over the page") | Generic interruption or layer clearing. | Vocabulary. |
| B14 | f/runtime/flow-authoring/bootstrap/site-reset/* (contracts.ts:52 `Spot{page, place, resource}`, create-baselines.ts:31-124, control-witnesses.ts, start-check.ts:123-249), reset-settlement/*, reset-undo/*, reset-ledger/*; f/runtime/result-verification/site-change/* | Undo the build's own lasting acts on the external target. A generic mechanism, named as a site. | `target-reset`, `target-change`. Model words in C19. |
| B15 | f/ui/activity-status/steady/page-preparation.ts:24-27 ("Getting the page ready"), activity-status/steady/test-ending.ts, run-retry.ts:15-16 | t1099-era statuses. | Vocabulary port, under phase 6's text rule. |
| B16 | f/runtime/llm/diagnosis-instructions.ts:174-304 (string text: 37 "page", 10 "pages", 10 "site", 5 "press") | Judge instructions. Mostly generic rules in web words; the paging parts follow C3 and C4. | Vocabulary port. Paging rules take `stopClass`. |
| B17 | f/runtime/adaptation/recovery/refuted-result/step/failure-brief.ts:107; refuted-result/brief.ts; f/runtime/flow-authoring/bootstrap/subflow-candidate/disclosure-advice.ts:88; draft-amendment-feedback/row-act.ts:28-37 | Repair and amendment model text that says page, press and click. | Vocabulary port. |
| B18 | f/runtime/conversations/instructions/prompt.ts:38; conversations/commands/explore.ts:47; commands/improve.ts:34-68; conversations/assistant/loop/prompt.ts | Chat routing and command text: "on a website", "try it on the website". | Target noun from the client. |
| B19 | fas/summaries/host-target-resolution.ts:31 | Closed allow-list of host target strategies (`selector`, `coordinates`, `active-element`). Excepted by config. | Declared by the domain. |
| B20 | fas/evidence/state-elements.ts:117-135; contracts/src/automation.ts:24 (`StateElementKind` "selector", "url", "route"), :113 `selector`; f/flows/authoring/model/state.ts:23, actions.ts:58, action-element-target.ts:19-20 | An opaque carried locator and an inferred element kind from path words. Baselined or excepted. | Long term: `locator` (opaque) and kind supplied by `readKind`. Contract change. |
| B21 | f/runtime/flow-authoring/bootstrap/script-statements/fact-locator.ts:31; fact-condition.ts:69-85 | Flow facts by handle (`exists t5`, "the handle the page view printed"). | Keep handles. Neutral examples and vocabulary. |
| B22 | f/runtime/llm/resolved-control-intent/contracts.ts:4, read.ts:24 | Intent `dismiss \| neutral \| navigate`. | `move`. |
| B23 | f/engine/automation/target-reacquire/row-recheck.ts:85-137 (`frameLeftThePage`, `mayMoveThePage`) | Generic "an earlier step may have changed the target state". | `mayMoveTheTarget`. |
| B24 | f/platform/browser-trust/* (validate-client.ts:5-26, records.ts, create-sqlite-client-trust-repository.ts); f/client-gateway/service/project-focus/focus.ts:21-23; f/programs/automation-studio/api/handlers/client-gateway.ts:15-122, recordings.ts:129-294; contracts/src/program-api/automation-studio/projects/client-gateway.ts:19 | Client trust and recorder text says "browser" ("browser trust", "browser recorder", "trusted browser"). | "client". The types already say `ClientTrust`. |
| B25 | f/server/managed-hosts/start-managed-hosts.ts:50-85; f/server/cli/dev-arguments.ts:25-61 (`--browsers`, `--browser-host`, `FLUXIQ_BROWSER_HOST`); f/platform/iam/catalog/app-route-actions.ts:31-63; contracts/src/iam/actions.generated.ts:7-24; cloud/src/smoke/check/environment/journey.ts | Managed hosts and hosted "dedicated browser environments". | "client hosts" and "environments". The hosted product may keep the browser noun in product copy only. |
| B26 | contracts/src/program-api/automation-studio/runs/runtime-sessions.ts:35,43 | Describe text: "the run's page". | Vocabulary or "the run's target". |
| B27 | ui-components/src/chat/stream/step/recovery-words.ts:69-115; chat/controls/hold-control.ts:132 ("You have the page"); ui-components/src/testing/results/outcomes.ts:64-349 (`site: "shop.example"`, shipped test support) | Recovery and take-over words in the shared chat. | Vocabulary from the client. |

### (a) Generic, fine (12)

| # | Path and line | Why it is fine |
| --- | --- | --- |
| A1 | f/engine/automation/records/read/place.ts:13-20, list-key.ts:13-19 | Opaque strings compared for equality. Only the comments are web. |
| A2 | f/components/automation/name-match/synonyms.ts:55; f/runtime/flow-authoring/bootstrap/authoring/record-output.ts:57; contracts/src/record-sets/validate-records.ts:100-116 | `url` is a record value type, a generic data type. |
| A3 | f/runtime/answer-first/asked-count/read.ts:67; fas/project-build-ending/reason/nothing-changed.ts:12 | English verbs read from the person's own instruction. |
| A4 | contracts/src/actionability/record.ts:5 (`hidden \| disabled \| covered`) | UI-generic target actionability. |
| A5 | f/runtime/adaptation/recovery/context.ts:606; f/runtime/llm/screening/locator-text.ts; f/runtime/loop-limits/secret-named-key.ts:30; f/runtime/llm/harness/throw-screen.ts:33; reusable-llm-context-store.ts:23 | Safety deny-lists. They only deny. A domain-declared extension to the deny-list would be cleaner, but this is not contamination. |
| A6 | contracts/src/humanness/bounds.ts:1-7 | "Click points" and "typing" appear only in comments. The contract is a number. |
| A7 | Persistence and program pagination: `pageLimit`, `listPage`, `getRunDatasetPage`, `RepositoryListPage`, `DocumentationPage` (f/framework/persistence/**, programs/**) | Result paging. |
| A8 | f/programs/docs/runtime/service.ts:287-398 | Core's docs program renders and sanitises HTML (iframe, href). |
| A9 | apps/web/src/features/automation-studio/stores/* (`selector`) | Store selectors. A few UI strings in `ImproveFlowPanel.tsx:22,134` say "website" and "tab" (the same vocabulary note as B18). |
| A10 | contracts/src/fluxnode/data/sink.ts:16-33; contracts/src/platform/url/*; apps manifest URL checks | Webhook and service URLs. This is Core's own transport. |
| A11 | Comments naming web codes (`web.target.not_found`, `web.output.dom-click`) across f/engine, f/runtime and f/components/automation/name-match/* | Documentation. The rule deliberately does not read comments. |
| A12 | f/runtime/project-agents/dispatch/run-brief.ts:90-129 | Comments only. |

## Tests, fixtures and docs that carry web concepts

Test files in all Core packages: 3,465.
- **Web tool ids** (`web.output|dom|action|target|handle`, `web_*`, `dom-click`): 566 test files, 2,808 lines. The most are in f/runtime/flow-authoring (148 files), f/runtime/llm (119), f/framework/automation-service (92), f/runtime/result-verification (48) and f/engine/automation (38). Top files: f/ui/activity-action/tests/action-of.test.ts (76 lines), harness-options/tests/bootstrap-completion/tests/bootstrap-completion.test.ts (56), authoring/tests/draft-routing.test.ts (54), candidate-trial/tests/feedback.test.ts (52).
- **http URLs:** 482 files. **Shop words** (cart, checkout, product, shop): 474. **HTML or selectors:** 353. **Page view or `core.full_page`:** 17.
- **Recorded web runs as fixtures:** see C24, six fixture directories plus `recorded-runs.ts`. The `web-vocabulary` rule skips tests by design: Core tests must be able to say "a recorded click" to prove opaque carriage. That reason covers synthetic examples. It does not cover copies of real web runs.
- **Docs:** 18 of 42 files under `docs/architecture/` name web concepts. Among them: `automation-studio/evidence-window.md`, `failure-control.md`, `flow-authoring.md`, `llm-flow-bootstrap.md`, `client-gateway.md`, `current-system.md`, `package-boundaries.md` and `runtime-ownership.md`. Also 271 of 942 files under `docs/working/`. The architecture docs describe the moves above as Core behaviour, so they must change with each move.

## Existing guards and what they miss

1. **`scripts/structure-audit/rules/web-vocabulary.mjs`** (domainNeutralPaths = every package except `ui-components`; tests skipped). It counts names only: identifiers, property keys and string property keys. Terms: dom, css, query selector, xpath, iframe, cookie, browser, tab, click, scroll, inner/outer html, tag name, class name, aria, shadow root, user agent, and `selector` as a whole name. It also checks the reading terms against `domainReadingExceptions`. Today it passes with 6 baselined files (22 instances). It misses:
   - every string literal that is not a property key. That covers all model text, status text and closed sets of web words (C3, C4, C12-C17), and web ids in data (`"web.facts@1"`, C11);
   - `page`, `site`, `website`, `url` and `address` as names or words, by design, since Core owns `url`. Even a `URL` global call is not seen (C1, C2, C5-C10);
   - `press`, `navigate`, `pager`, `next page`, `load more` and `banner`;
   - regex sources in general: only reading terms are checked inside regexes, so `[tde]\d{1,6}` and `/navigate/iu` pass (C13, C15);
   - `ui-components`, which is excluded as "DOM as UI toolkit". It now holds the shared chat's web wording (C12, C22, B27);
   - JSON fixtures, which are never read (C24).
2. **`restricted-references`** reads strings, imports and property names, always fails, and has no baseline. Core configures none. It could ban a string but cannot ratchet the existing surface. It does not see a global identifier such as `URL` in `new URL(...)`, because `names` covers property access only.
3. **`reachBoundaries` "trace-free model guidance"** stops trace content reaching the model-text modules. Its `from` list is a ready-made list of Core's model-guidance files, but it checks imports, not words.
4. **Downstream `scripts/check/model-text.mjs`** scans Core's model-facing text for the ten scenarios' site, brand, product and person names. It guards against teaching to the test, not against domain vocabulary. "page", "press", "cookie banner" and "next page" all pass it.
5. **`imports` forbiddenImports** refuses an import of the downstream repository. A concept copied by hand passes.

## Proposed mechanical check

Add it to Core first (structure-audit is mirrored; `core-mirror.mjs` fails downstream on drift), as two rules plus a scope change. Ratchet per file like `web-vocabulary`, so existing findings are baselined, may only fall, and new files start at zero.

1. **`web-text` rule** (or a strings mode of `web-vocabulary`) over `domainNeutralPaths` plus `packages/ui-components` (strings only; its names stay exempt as DOM toolkit), non-test:
   - **Hard fail, no baseline beyond today's files.** These count in string or template text and in regex-literal sources:
     - a literal web id prefix: `/\b(web|dom)[._:-][a-z]/` and `web_[a-z]`;
     - the web handle grammar `[tde]\d` inside a regex source.
     Today's instances are C11, C12 and C15.
   - **Ratcheted term count.** These count in string text, template text and regex sources: `page`, `pages`, `site`, `sites`, `website`, `browser`, `tab`, `url`, `click`, `scroll`, `pager`, `next page`, `load more`, `cookie`, `banner`, `navigate`, `press` (as a verb before a noun phrase), `selector`, `xpath`. Split and matched the way the existing rule splits names.
   - Message remedy: use the domain vocabulary port (`{target}`, `{element}`, `{act}` filled from the bound domain's declaration), or move the text into the domain's instructions.
2. **`address-parsing` rule:** no `new URL`, `URL.canParse`, `URLSearchParams`, `.searchParams` or `.hostname` under these paths:
   - `packages/fluxiq/src/{runtime,engine,flows,components,framework/automation-service}`;
   - `packages/contracts/src/{task-attempts,fluxnode/spec}`;
   - `packages/ui-components/src`.

   Allowed: `platform/`, `server/`, `contracts/src/platform/`, `contracts/src/apps/`, `fluxnode/data/sink.ts` and `record-sets/validate-records.ts`. Core's own transport and data types stay allowed. This needs a small `globals` extension, in the style of restricted-references, that also reads `NewExpression` and `PropertyAccessExpression` on the identifier `URL`. Today's instances (C1, C2, C5-C10, B-list origins) are baselined per file.
3. **Fixture check:**
   - JSON and TS fixtures under Core `tests/` may not contain `"web.` ids or hosts other than `*.example` and `*.test`;
   - files named `run-*.json` are refused in Core.

   Ratcheted, so the C24 fixtures are listed and must shrink.
4. **Zero tolerance on model guidance.** Once C16 and C17 move, apply `web-text` with a limit of 0 and no baseline to the reachBoundaries "trace-free model guidance" `from` list. The model-guidance files then cannot regrow web words while other modules still ratchet down.

What this still misses, stated plainly: a web concept carried under a neutral word ("view", "place", "control"), web logic expressed through domain-supplied data, and wording in Markdown docs. Docs need review with each move, not a check.

## Generic ports Core would keep (summary of the moves)

- **Domain vocabulary:** the nouns and verbs a domain binds (target "page", element "control", act "press", source "site"), used by Core's model text and statuses (B2-B18, B26, B27, C19).
- **Read account classes:** `stopClass`, `continues`, an opaque `said`, `viewKey`, `place`, `location`, `listKey` (C1-C4, B5, B6).
- **Target scope:** `targetScope(location)` and `scopeTargetsOf(value)` for task keys, scope grants, part sites and the FluxNode spec (C5, C6, C8, C9).
- **Activity wording:** words carried by node and tool definitions, a domain verb table, and `personReason` on failures (C12-C14).
- **Handle and id patterns** declared at bind time (C15).
- **Parameter roles** on node definitions (identity, how-it-runs, plumbing, arrival) and intent words (C8, C18, C23).
- **Authoring guidance** through the existing domain-instructions binding (C16, C17).
- **Fingerprint signals** with domain weights (C21; revisits t842).
- **Gateway target selection** through the host lease (C20).

## Commands run and observed results

- `node scripts/structure-audit.mjs --rule web-vocabulary` in Core printed: `structure-audit: passed (0 warning(s), 6 baselined).`
- Baseline read from `.structure-baseline.json`, `web-vocabulary` section: element-fingerprint.ts 12, action-element-target.ts 4, scale-certification.ts 3, contracts automation.ts 1, server-message.ts 1, actions.ts 1.
- Counts come from a scratch Node scan, `scan.mjs` in the worker's scratchpad. It strips block comments, line comments and CRLF, and skips `tests/`, `e2e/` and `*.test.ts`, or scans only those in tests mode. Each count is a regex over code lines.
  - String-text web wording in `packages/fluxiq/src`: `FILES 287 LINES 816`.
  - Strong terms in code: `FILES 213 LINES 408`.
  - Test counts as listed above.
  - These are heuristic: not every one of the 287 files is contamination (the docs program says "site" legitimately). The 63 findings are the classified clusters.
- Everything else was Grep and Read over the files named.

## Not verified

- Every one of the 287 string-text files was not read. Classes are given per cluster from representative lines and module headers.
- No ownership or caller graph was run to prove each (c) move is complete. Each lists the callers found by grep.
- The cost of the moves was not checked, nor whether the domain already emits the opaque fields Core would need (`location`, `place`, `viewKey`, `stopClass`).
- Downstream code was not audited, except `scripts/check/model-text.mjs`.

## Open questions

- C21 (fingerprint scoring of DOM fields) and B20 (`selector` in `StateElementKind`) were kept in Core by recorded decisions t842 and Phase T. Moving them needs the lead's or the user's call.
- C9 and C10 change public contracts (`fluxnode`, `task-attempts`), and C20 changes the gateway protocol. Each needs a compatibility plan, and the user's notice under AGENTS.md's Core boundary rule.
- Whether the hosted product's "dedicated browser environments" (B25) should stay as product copy is a product decision, not a boundary one.
