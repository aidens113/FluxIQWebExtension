# t1036 / b-keyed-view-handles (worker-heavy)

Brief: the domain's half of D1 (page key and keyed-line view), D2 (the same element keeps its handle across captures for the run), and the full capture for D5/D15.

## Outcome

Partial. All four build items are in the tree. The domain's tests for the owned and touched folders, both domain typechecks, the structure audit and model-text pass. Two things are not done:

- **Two tools.ts wiring blocks are for the sub-supervisor to add.** The exact text is below.
- **Tests in folders I must not touch read the old `page` string.** They need the line changes listed under "Open questions".

The official `pnpm --filter ... check` and `... test` commands were refused because Core's build is not current: another worker is editing Core. I ran the same compilers and tests directly instead (see "Commands").

## What changed and why

### 1. Published page: `pageView: { key, lines }` (D1, P-a, P-b)

- **Schema bumped to `web-llm-page.v4`.** `publishedWebLlmPage` now returns `pageView` and no longer returns `page` (`page-view/published-page.ts`, `schema-version.ts`). The shape changed, so readers can tell the two forms apart by version.
- **The lines' texts, joined by "\n", equal the old page string.** Tests check this.
- **Keys** (`page-view/keyed-line.ts`, `keyed-view.ts`, `written-lines.ts`, `line/render.ts`, `header.ts`):
  - a header line is keyed by its label (`PAGE`, `URL`, `VIEW`, `COVERING`, `DIALOG`, ...);
  - the blank separator is `-`;
  - an element line is keyed by its handle;
  - a marker line is keyed to the element after it, as `^tN`, then `^tN.2`.
  - Keys are unique per view. A repeat, which none of the writers can produce, would get `#2`.
- **Page key** (`page-view/location-key.ts`, `webLlmPageKey`), per P-a:
  - scheme and host lower-cased;
  - default port dropped;
  - trailing slash dropped, except on the root;
  - query parameters sorted by name, with each name's values kept in their own order; an empty query is dropped;
  - the fragment is dropped unless it is a route (`#/`, `#!`).
- **No page-search words.** The VIEW header no longer says "find_on_page searches the rest", and the comment in `page-view/element/index.ts` no longer mentions page search.
- **One reader for the page text.** `webLlmShownPageText` (`llm-evidence/shown-page/`) reads `pageView`, or the `page` string of a v3 page from a stored summary or recording. It imports nothing, because the extension side panel bundles it through `evidence-summary/` (see the "Problem found" note below). Readers moved to it:
  - `page-view/result-retention-key.ts`, and `retention-key.ts` (which now keys on the view's text);
  - `evidence-summary/page-text.ts` (Core's `page.txt`);
  - `state-diff/summary-lines.ts`;
  - `judge-evidence/project.ts`;
  - `result-observation/observe.ts`: its hidden rows are now `extra` lines keyed `PASSIVE-`, `PASSIVE` and `PASSIVE.N`, with the same text as before;
  - test-runner: `loop-replay/read-steps.ts`, `lab-runs/write-playback-steps.ts`, `attempt-lane/scripted-model/scripts/evidence.ts`;
  - e2e: `site-reset/scripted-provider.ts` and three specs;
  - every test helper and test in the folders I may edit (`page-view/tests/shown-page-lines.ts` serves most of them).
- **`page` removed from `WEB_LLM_OBSERVED_STATE_KEYS`.** `pageView` was not added: Core's page channel owns it.
- **Runtime contract** (`runtime-contract/runtime.ts`): optional `pageChannel?: { member; budgetChars? }` and `fullPage?(input)` were added, so the tools.ts lines below compile.

**Problem found: the side-panel bundle broke.** After the first cut, `evidence-summary/page-text.ts` imported the page-view barrel. That barrel reaches `node:crypto`, so the extension's `sidepanel` bundle failed to build (`node-only-import-guard`). Moving the reader into the import-free `shown-page/` fixed it.

### 2. D2: the same element keeps its `tN` for the run (`stable-handles.ts`)

- **Tier 0, new: within one document, by the element itself.** The content script already sends every element's node serial (`nodeToken`, a WeakMap counter per document in `apps/extension/src/content/dom-snapshot.ts`), so no content-script change was needed. In the same document (`navigation.timeOrigin`), an element keeps the number last seen with its serial while it is still at the same loose address. The loose address is the selector with positions removed, plus tag, record, frame and page path. Because the record is included, a node a list recycles for another item gets a new number. This applies to the top frame only: the capture names only the top document, and a child frame's serials are its own.
- **Loose address and place now name the page by its path** (origin, path, route fragment), not its full address.
  - Tiers 2, 3 and 4 still match only numbers last seen at the same exact address. A new `Seen.at` field records it, so their behaviour is unchanged.
  - **Tier 2b, new: across queries of the same path.** It matches by loose address and words, only where exactly one rendered element of the capture and exactly one number last seen under another query have them. Look-alikes, or two candidate numbers, get new handles; nothing is paired by order. Hidden elements are left out, so a capture that includes them never moves a visible element's handle.
  - A control on another path still gets its own number.
- **Plan resolution** (`plan-resolution/target-packets.ts`, plus the new `plan-resolution/view-merge/moved-target.ts`): a bare handle whose remembered pages give selectors differing only in positions resolves to its newest view. That case is now normal: the same card after a filter. Before, it was `ambiguous`. Any other difference in the selector is still `ambiguous`. If the views classify the control differently, it is marked as a cross-page conflict.

### 3. Full capture (D5/D15)

- **`webLlmFullPage(run)`** (`llm-evidence/full-page/full-page.ts`) returns Core's hook: `(input: { projectId, flowId, callId, permission?, signal? }) => Promise<JsonObject | undefined>`.
  - It captures with `includeHidden`, restamps, and publishes with `webLlmFullPageView` (`page-view/full-view.ts`).
  - It returns `undefined` when the capture is refused as unreadable or needing a person. Any other error is rethrown, as is an abort.
- **What `webLlmFullPageView` adds.** The lines that are not extra are exactly the ordinary view (same keys, same order). The extra lines are:
  - a `FULL` header line;
  - `tN hidden <kind> "<words>"`, keyed `tN`;
  - `tN attributes: name="value" ...`, keyed `tN.attributes`, for each element with a line and each hidden element, in page order.

### 4. Docs

- `docs/architecture/page-evidence.md`: v4 shape, keys, page key, the full page, and the D2 handle bullet.
- `docs/architecture/testing-facility.md`: v4, and the full page on request.

## Exact tools.ts lines (for the sub-supervisor)

Import, beside the other `./` imports:

```ts
import { webLlmFullPage } from "./full-page";
```

In the returned runtime object, for example after `observeResult`:

```ts
    // The page's keyed view, which Core's page channel delivers whole once per page key in a run and then as the lines that changed (t1036, D1).
    pageChannel: { member: "pageView" },
    // The whole page on request (t1036, D5): the capture that also lists hidden elements, restamped, kept as a look under the result it showed, with the handles it printed.
    fullPage: webLlmFullPage({
      capture: (request) => captureEvidence(gateway, selectSession(gateway.eligibleSessionIds()), { ...request, toolId: "core.full_page", value: {} }, request.signal, undefined, { includeHidden: true }),
      restamp: (request, binding) => stable({ ...request, toolId: "core.full_page", value: {} }, binding),
      keep: (request, binding, shownPage) => {
        retain(binding, shownPage);
        looked({ ...request, toolId: "core.full_page", value: {} }, binding);
        targetPackets.printed({ projectId: request.projectId, flowId: request.flowId }, shownPage);
      }
    }),
```

Notes on these lines:

- `retain(binding, shownPage)` keys the packet by the full view's text, so a repair that names a hidden handle finds it.
- `looked` uses `rememberLook`, as find_on_page's capture with hidden elements did.
- `printed` records the hidden handles the extra lines printed.
- Rename `pageChannel` and `fullPage` if Core's contract chooses other names.

## Commands run and observed results

All commands ran in `fxwork/t1036/!FluxIQWebExtension`. The logs are in `test-runs/t1036b/`, which is ignored.

**Typechecks**
- `domain/node_modules/.bin/tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json --noEmit`: no output, exit 0. Last run was after every source change.
- `pnpm --filter @fluxiq-web-extension/domain check`: refused, as the brief anticipated: "FluxIQ Core's build at ...\t1036\!FluxIQ is not current with its source. Stale: Core's build cache would rebuild fluxiq:build".
- `pnpm --filter @fluxiq-web-extension/extension check`: refused the same way.
- So I ran its steps directly:
  - `node ../../scripts/build-cache/cli.mjs domain:build browser-host:build`, under the heavy gate: `build-exit 0`.
  - `node scripts/check-extension.mjs`: `check-exit 0`. The earlier run of the same script found the sidepanel bundle failure, which is fixed (see "What changed").

**Domain tests**
- Owned and touched folders: `DOMAIN_TEST_BUILD_LABEL=t1036b node .../heavy-slot.mjs run t1036-b -- node scripts/test-domain.mjs llm-evidence/page-view llm-evidence/observed-state llm-evidence/full-page llm-evidence/shown-page llm-evidence/evidence-summary llm-evidence/result-observation llm-evidence/tests llm-evidence/plan-resolution llm-evidence/judge-evidence llm-evidence/state-digest llm-evidence/start-state llm-evidence/control-spot state-diff element-fingerprint target-reacquire runtime/tests`
  - Result: `# tests 1121`, `# pass 1114`, `# fail 7`.
  - **`a stale handle whose address the acted-on page gives to several controls, or that another document showed, records no witness`**: fixed afterwards. The rerun of `plan-resolution/tests/target-packets` and `llm-evidence/tests/stable-handles` gave `# tests 69`, `# pass 69`, `# fail 0`.
  - **`a repair naming a handle a recovery search printed resolves with the selector behind it`** (`llm-evidence/tests/recovery-selector-hints.test.ts`): error `Automation Studio harness option "web.recovery.find_on_page" is not offered in this scope.` This comes from another worker removing find_on_page in harness-options, not from my change.
  - **Five carried-repair tests fail because Core's page channel is not built yet.** They are in `runtime/tests/carried-service-repair.test.ts` and `carried-row-service-repair.test.ts`:
    - `actual saved row repair retains fresh listing and per-row mapping before judgement`
    - `ordinary repair freshly tests the untouched carried selector through real web dispatch`
    - `actual saved repair refuses a missing declaration before full-test actions`
    - `actual saved repair without a captured start tests the carried Flow where it stands`
    - `actual saved repair refuses an unresolved current binding before mutation`

    Their scripted model reads the page from Core's `core.current_view` "top" group, which Core builds from the declared observed-state keys. With `page` removed (as briefed), that group carries no page until Core reads `pageView` through its channel.

    To confirm, I declared `pageView` temporarily and ran `test-domain.mjs runtime/tests/carried plan-resolution/tests/target-packets`: `# tests 37`, `# pass 36`, `# fail 1`, and the one failure was the t877 test, since fixed. All five carried tests passed, and I reverted the key.

**Extension tests**
- `EXTENSION_TEST_BUILD_LABEL=t1036b ... node scripts/test-extension.mjs`, under the gate, run directly because the `pnpm test` wrapper is refused for the same Core-build reason: `# tests 4168`, `# pass 4153`, `# fail 15`.
  - All failures were in `content/action-runtime/tests/store-chooser-replay.test.ts` (7 top-level `not ok`, starting with `what the draft kept: the chip by its root and its whole name, ...`). The test read `evidence.page`.
  - After moving it to `webLlmShownPageText`, `test-extension.mjs store-chooser-replay` gave `# tests 15`, `# pass 15`, `# fail 0`.

**Audits**
- `node scripts/structure-audit.mjs`: `structure-audit: passed (262 warning(s), 551 baselined)`.
- `node scripts/check/model-text.mjs`: `model-text: ok (203 scenario tokens, 562 model-facing Core files, 14324 string literals)`.

## Not verified

- The official `pnpm --filter @fluxiq-web-extension/domain check` and `pnpm --filter @fluxiq-web-extension/extension check` / `test`. Each was refused: "FluxIQ Core's build at ...\t1036\!FluxIQ is not current with its source" (Core is being edited concurrently).
- The extension unit tests (`EXTENSION_TEST_BUILD_LABEL=t1036b pnpm --filter ... test`), which hit the same refusal. No `apps/extension/src` source changed; only e2e specs and the e2e helper did.
- Tests in folders I must not touch (node-run, harness-options, page-find, structure). They were not run as acceptance, and the ones that read the old `page` string will fail until edited (list below).
- The P4 offline replay of the five bigbox recordings. My brief's acceptance does not list it. Handle stability on those recordings (for example `t1446` in `run-mwuuo3zk`) is the measurement that would confirm D2 on real data.
- Live browser behaviour.
- Core's channel consuming `pageView`: Core is not built yet. Until Core reads `pageView`, older page copies are no longer replaced through `observedStateKeys`.

## Open questions or contradictions found

- **Gap until Core's channel lands.** Removing `page` from the observed-state keys, as briefed, leaves Core's `core.current_view` with no page until Core reads `pageView`. That breaks the five carried-repair tests above, and would break a live build loop in the meantime. If the domain must merge before Core W1, the interim fix is to add `"pageView"` to `WEB_LLM_OBSERVED_STATE_KEYS`. I tested it and the tests pass. Remove it once Core declares the channel. This is the sub-supervisor's decision; I followed the brief.

- **Lines for must-not-touch tests that read the `page` string.** Each needs the published page's text read through `webLlmShownPageText` (exported from `llm-evidence`/`page-view`), or `shownPageText` from `page-view/tests/shown-page-lines.ts`. Known so far:
  - `node-run/tests/covered-press.test.ts`: lines 142, 143, 175 (`evidence.page.page` should become `shownPageText(evidence.page)`) and 261, 262 (`evidence.page` should become `shownPageText(evidence)`). Lines 140 and 197 assert `"web-llm-page.v3"`, which should become `"web-llm-page.v4"`.
  - `node-run/tests/press-raw-read.test.ts:149`: `"web-llm-page.v3"` should become `"web-llm-page.v4"`.
  - `node-run/tests/arrival.test.ts:428-429`: `String((looked.evidence as JsonObject).page)` should become `String(webLlmShownPageText(looked.evidence))`.
  - `page-find/tests/run.test.ts:63`: the same change. This may be moot if page-find is removed.
  - `harness-options/tests/options.test.ts:111`: `"web-llm-page.v3"` should become `"web-llm-page.v4"`.
- **D2 changes the precondition of two tests, and I adapted them.** The two t877 witness tests in `plan-resolution/tests/target-packets.test.ts` assumed that a reload under another query renumbers an unchanged control. Under D2 that control keeps its handle, which is the point of D2. The tests now give the reloaded control changed words (`RELOADED_SORT`), so the witness logic is still tested. No assertion was weakened.
- **Bare-handle resolution semantics changed** (positions-only means the newest view). I judged this necessary because D2 makes cross-query sharing normal. The lead should confirm it fits the plan.
- **Concurrency hazard I caused.** A broad `perl -pi` pass rewrote, with identical content, some test files in node-run, harness-options and structure while their owners were editing them. `git diff` afterwards showed their edits intact, but a write that landed in between cannot be ruled out. The owners should re-check their files.
- **`vocabulary.ts` and the other `harness-options` and `node-run` diffs in the tree are other workers' changes, not mine.**

## Return contract

```text
Outcome: Partial
Changed: domain llm-evidence page-view/** (keyed view, page key, full view), shown-page/ (new), full-page/ (new), stable-handles.ts, observed-state/**, plan-resolution/target-packets.ts + view-merge/moved-target.ts, result-observation/observe.ts, evidence-summary/page-text.ts, judge-evidence/project.ts, runtime-contract/runtime.ts, index.ts; state-diff/summary-lines.ts; tests beside each; test-runner readers (3); e2e specs and helper (4); extension store-chooser test; docs/architecture page-evidence.md, testing-facility.md
Validation: domain tsc (src + test) -> clean; test-domain owned folders -> 1114/1121 pass (7 fail: 1 fixed and rerun 69/69, 1 from another worker's find_on_page removal, 5 from the Core channel gap, confirmed); check-extension.mjs -> exit 0; extension tests -> store-chooser fixed and rerun 15/15; structure-audit passed; model-text ok
Not verified: official pnpm check/test (refused: Core build not current); must-not-touch tests (lines listed); P4 recording replay; live browser
Report: docs/working/page-diff-delivery-plan/reports/t1036/b-keyed-view-handles.md
Notes: tools.ts needs the pageChannel + fullPage lines above; consider an interim "pageView" observed key until Core's channel lands; bare positions-only handles now resolve to the newest view
```
