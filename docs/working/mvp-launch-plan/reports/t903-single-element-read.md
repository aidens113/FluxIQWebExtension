# t903: one element read as a one-row table, detection binding, whole search answers, hover

Lane t903, worktree `fxwork/t903/!FluxIQWebExtension` (Core worktree `fxwork/t903/!FluxIQ` untouched).
Source run: `run-mwbkuxqt-c57f42cb` (crossborder follow-official-store), traced in
`fxwork/t885/.../mvp-seal-plan/reports/live-checks-r3/one-row-table.md`.
Second round per the coordinator's message: F5 hover (grants: one branch in
`content/actions/execute.ts`, one entry in `panel/copy/step-copy.ts`), the list reader's
answer for a not-rendered element, and the close-match cap in page search.

## Round 3: the not-rendered rule re-proved on the ten sites

Requested: re-prove the ten realistic sites' honest browser paths and every content-harness read
spec, provider-free; fix any read that loses rows a person can see; build the domain dist and
get the extension check to exit 0.

### What changed in this round (uncommitted on top of a111d62cd)

Two would-be regressions of round 2's rule, both rows a person can see, fixed at the root:
- **A select's options.** `checkVisibility()` is false for an `<option>` (it has no box; its
  select draws it), so a read of `select option` rows read nothing. Found by
  `extract-list-sensitive.spec.ts` (bigbox account-recovery). An option now counts as shown when
  its select does.
- **Items with no box of their own** (`display: contents` wrappers, a `visibility: hidden` row
  whose cells say `visible`). The item counts as shown when it or anything inside it is rendered.
  No site in the specs hit this; fixed because a person sees such rows.
- **Hidden items are no longer read as empty records.** Round 2 made an unrendered item a record
  of nulls and marked it read, so if it showed later in the same read (a list behind a passing
  check) it was never read again. Now the reader skips it unread
  (`content/extraction/list-reader.ts`), its "has an unread item" waits ignore it, and it is
  counted (`notRenderedItems`). `item-record/read-record.ts` is back to the dev base exactly. A
  read that took no row while the list's items are there but hidden says so
  (`items_not_rendered`, with "a hover or a click" next; `domain/.../read-shortfall.ts`, and the
  content validation's shortfall line).
- Tests: `item-record/tests/rendered-item.test.ts` (option, no-box item, browser's word),
  `extraction/tests/list-reader.test.ts` (a hidden item is not read, not answered empty, and is
  counted), `domain/.../read-shortfall-not-rendered.test.ts` (reason on zero rows only).

### Per-site table

The breadth proofs (t885's `breadth-prep.md`, same patterns and files) read with Playwright's
own `textContent` in scenario-lab's step runner, never the extension, so they prove the sites
and oracles but cannot show this rule. The product's reader is exercised by the content-harness
specs, all of which were run (255 tests).

| site | breadth proof (pattern -> result) | content-harness read specs (final run) | rows a person can't see met |
| --- | --- | --- | --- |
| everything-store | "sweeps all five pages" -> pass 1, fail 0 | extraction specs (cart, cart names, extraction, next page, catalog, item conditions, list completeness, pagination, record schema, structure detection, continuation) -> all pass | none |
| crossborder-marketplace | "follow-official-store" -> pass 3, fail 0 | crossborder-next-page-person, spain-hubs live task, one-element-read (follow-official-store, oracle reached via hover), hover x2 -> pass; answer-real-rows -> fail at the chat after its row read passed (chat UI, not a read) | yes, intended: the account menu's "Followed stores" line (CSS-hover flyout) is not read until a hover opens it |
| bigbox-retail | "checkout quote" -> pass 2, fail 0 | extract-list-sensitive (5) -> pass after the option fix; cart column labels -> pass | none hidden; the select-option rows were the regression found and fixed |
| job-board | "recorded remote search" -> pass 1, fail 0 (t885 recorded 3 for this pattern; I did not trace the difference, and this proof does not touch the reader) | job-board-listing, part-run (5, after the e2e build) -> pass | none |
| local-classifieds | "test-ride question" -> pass 2, fail 0 | bike-search live task -> pass | none |
| auction-marketplace | "Mark II sellers" -> pass 3, fail 0 | kestrel-auctions live task -> pass | none |
| photo-social | "priya-tags" -> pass 2, fail 0 | photo-social grid-paused, unopened-replies -> pass; thread-load-more 2 of 4 fail (Next page ends `list_unchanged`) -> **fail identically on the dev base** | none |
| social-network-feed | "suggested" -> pass 2, fail 0 | social-kept-row-disclosure, social-read-completion, social-read-discloses-kept -> pass | none |
| company-website | "saturday-certificate" -> pass 3, fail 0 | company-definition-fields -> pass; answer-kinds-company-website -> fail on Core's "Run again" chat wording (chat UI, not a read) | none |
| professional-network | "contact" -> pass 2, fail 0 | rotterdam live task: 7 of 9 pass; the security-check page-2 read (stops at page 1, 10 rows) and the upsell-still-open check -> **fail identically on the dev base** | none |

Baseline proof: `t903-baseline.sh` swapped every extension source file this lane changed back to
the dev base (`HEAD~1`; "0 files differ from base"), ran
`photo-social-thread-load-more` and `professional-network-rotterdam` inside one slot hold, and
restored. Result on the base: the same 4 tests fail, 8 pass. **Incident:** the script's restore ran
after a `cd`, so its relative paths wrote into a stray `apps/extension/apps/`. I stopped the queued
suite before it built, restored every file from the saved copies, deleted the stray directory,
and re-verified (typecheck clean, 890 unit tests pass, audit passes) before the final suite ran.

### Commands and results (round 3)

- `heavy-slot run t903 -- pnpm --filter @fluxiq-web-extension/domain build` -> exit 0.
- `heavy-slot run t903 -- pnpm --filter @fluxiq-web-extension/extension check` -> **exit 0** with
  the dist built (`extension:check` stored, no TS errors). Final re-run after round 3 -> **exit 0**.
- `heavy-slot run t903 -- pnpm --filter @fluxiq-web-extension/domain check` (after round 3) -> exit 0.
- `heavy-slot run t903 -- sh t903-breadth.sh` (scenario-lab:build restored from cache, then the ten
  breadth proofs) -> every proof `# fail 0`, per the table.
- `heavy-slot run t903 -- pnpm test:e2e:build` -> exit 0; then `pnpm test:content -- e2e/content/tests/part-run` -> 5 passed.
- `heavy-slot run t903 -- pnpm test:content -- <extraction, list-states, live-tasks, offline-reads,
  one-element-read, part-run, answer-turn, hover, actions.spec, identity, large-page-resolution,
  actionability, selectors>` -> first run 243 passed, 12 failed (5 part-run without the e2e build,
  the option regression, 4 base failures, 2 chat UI); final run after the fixes **249 passed, 6
  failed**: the 4 that fail on the base and the 2 chat-UI assertions.
- Narrow: extension `src/content/extraction src/content/actions/tests src/content/action-runtime/tests`
  -> 890 pass; domain `actions/extraction llm-evidence/action-failure llm-evidence/rejection-next
  llm-evidence/tests` -> 362 pass; structure audit -> passed.

## Core files edited

None. Web nodes are declared by the domain's registry, so hover needed no Core change, and
Core's `rows/found-rows.ts` already takes the array F1 answers. (Core's
`flow-authoring/bootstrap/plan/tests/web-domain-definitions-fixture.ts` is a stale test fixture
of the web nodes; nothing reads it at run time.)

## Outcome

Done. The crossborder follow-official-store browser path, provider-free, reaches its oracle:
the content script's own actions follow Voltbay Official Store, a read of the closed menu's line
answers `items_not_rendered` with "a hover or a click", the `web.output.dom-hover` node opens the
account flyout, and Extract List names the line's own handle and stores
`[{following: "Followed stores: Hubsmith Global Store; Mirafone Accessories; Qinport Official Store; Voltbay Official Store"}]`,
the manifest's own record. The hover spec on the CSS-hover menu passes: open, kept through a
look, closed by the next action that acts, stylesheets exactly as before.

**The first round's diagnosis was wrong in part, and is corrected here.** The empty record was not
caused by visibility. The content field reader ran `item.querySelector(":scope")`, which only
searches descendants and so never returns the item itself. It is fixed in
`content/extraction/field-reader.ts` (the item itself for `:scope`, as the definition reader
already did). Separately, per the coordinator's decision, an item the browser does not render
yields no values (`content/extraction/item-record/rendered-item.ts`), so the hidden line is
opened by a hover before it is read, rather than read unseen.

## What changed and why

### F1: one element read as a one-row table (domain)

Route chosen: **Extract List accepts an element's own `tN` in place of `extraction.N`**:
`extractList: {handle: "tN", fields: {yourKey: "text"}}`. Row-making (the rows key Core
reads, the dataset, the saved binding a replay runs, the list code Core refuses a second
kept copy of) already lives in Extract List end to end, and a one-record list is already a
list it reads; a column on Extract would have had to repeat all of it.

- `plan-resolution/extraction/element-record.ts` (new): binds the `tN` as the node's target
  slot would (the same store presses and reads use) and issues a one-record extraction
  binding: item = the element's selector, columns `text` (`:scope` text, always), `value`
  (fields), `link` (links). The read then runs as any detected list's (`maxItems: 1`).
- `structure/handles.ts`: `elementRecord` issues that binding once per identical binding (no
  eviction of detected lists by re-reads); `elementRecordOf` for the saved step.
- `plan-resolution/resolve-plan-node.ts`: extraction branch runs the element record first; a
  `tN` that names nothing is refused at `extractList.handle`.
- `plan-resolution/extraction/saved-list.ts`: the step keeps `extraction.N` and its binding,
  never the `tN`, so it replays with no memory.
- Catalog text: Extract List's description adds "One element is a one-row table: handle tN,
  fields {yourKey: "text"}." (237 of Core's 240); Extract's says "For rows, even one row, use
  Extract List." Generic, nothing of a scenario.
- Second root cause found testing F1: `plan-resolution/target-packets.ts` let any whole look
  drop handles it did not list, but only a search's capture lists hidden elements, so the
  look a node run takes before acting dropped the hidden line's handle. A view listing no
  hidden element now keeps earlier hidden handles (`plan-resolution/view-merge/`, new; moved
  out of `target-packets.ts` to keep it under 800 lines).

### F2: detection binds handles as presses do, and names a target only around it (domain)

- `structure/detect.ts`, `tools.ts`: a handle the last shown view lacks binds through the target
  store's views and looks of this same page (`targetPackets.resolve(scope, handle, location)`),
  never another page's, so the stale-page refusals (t477) are unchanged.
- `structure/target-around.ts` (new): the packet names `target` only when the detection's own
  capture does not show the list elsewhere (target = container, an item, or inside the
  container); undecidable cases keep the old behaviour.

### F4a and the close-match cap: page search answers whole (domain)

- `page-find/search.ts`: no 80-character cut of words, no 60-character window of a matching value.
- `page-find/near.ts` + `search.ts`: the ten-close-match cap is gone at its root. Close matches
  follow the exact ones in the same pages of fifty, `after` reaching every one; the page that
  starts inside them says "N close matches, continued". `tools.ts`'s find_on_page description
  now says "After the exact matches come the close ones, on the same pages".

### F5: hover (domain, content, the two granted lines)

- Domain: `web.dom.hover` in `actions/types.ts` (union, list, legacy map), `schemas.ts`
  (selector schema, so element-targeted), `safety.ts` (`review`), `consequence-declaration.ts`
  (`not_required`), `action-effect/table.ts` (`observe`), `output-nodes/definitions.ts` (effect
  `observe`, catalog text and tags from the new `output-nodes/hover/`, icon), `payloads.ts`,
  `repairable-parameters.ts` (`observable`), `step-permission.ts` VERBS ("point at"),
  `step-views/move.ts` (in place). Node id `web.output.dom-hover`.
- Content verb `content/actions/hover.ts` (new): resolve; `checkActionability` refuses a hidden,
  covered or disabled target before anything is dispatched, as a click; `watchRobotCheck`
  settled as a press is (needs-person on a standing check); then the pointer comes to rest:
  - `action-runtime/hover-state/gesture.ts`: `pointerover`/`mouseover`, `pointerenter`/
    `mouseenter` on every element of the chain outermost first, `pointermove`/`mousemove`;
    no press. For menus a script opens.
  - `action-runtime/hover-state/emulation.ts`: for each same-origin stylesheet rule holding
    `:hover`, a copy inserted beside it (same sheet, next index, cascade order kept) with
    `:hover` replaced by `:is(<:nth-child paths of the hovered element and its ancestors>)`.
    It matches only what the original would with a pointer there, so no other style changes.
    Temporary: removed when the pointer goes over anything outside the hovered element (any
    later gesture or a person's mouse), when the next action that acts begins
    (`action-runtime/execute-action.ts` calls `hoverState.releaseFor`; looks and reads leave
    it, as a person reads an open menu without moving the mouse), on another hover, and on
    `pagehide`. Cross-origin sheets (`cssRules` throws) and sheets in shadow roots are skipped.
    No debugger API.
  - Judged by what appeared (`action-runtime/hover-state/appeared.ts`): elements rendered after
    the hover that were not before, polled for up to 800 ms. Nothing new is a failed validation,
    reported `web.validation.output_not_observed`.
- Wiring as granted: one routing branch in `content/actions/execute.ts`; one entry in
  `panel/copy/step-copy.ts` ("Pointing at" / "Pointed at"). Also `background/connection/
  runtime-status.ts` label "Hover" (its test requires every type to have one), and the
  `runtime-status.test.ts` table classifies hover as making no recorded input.

### The list reader: `:scope` reads the item, and an unrendered item yields nothing (content + domain)

- `content/extraction/field-reader.ts`: a field whose selector is `:scope` reads the item
  itself. `querySelector(":scope")` never matches the element it is called on, so every
  one-element read came back as one empty record (the real cause of the first round's failure).
- `content/extraction/item-record/rendered-item.ts` (new) + `read-record.ts`: an item the browser
  does not render (`checkVisibility` false) reads no field (optional `null`, required missing).
  An element offering no measure counts as shown. Hidden words inside a shown item (collapsed
  "Read more") are unchanged; that is the disclosure check's business.

- `content/extraction/list-reader.ts`: counts the items it named that the browser does not
  render (`checkVisibility`; an element offering no measure counts as rendered, so an item is
  called hidden only when the browser says so) and sends `notRenderedItems`.
- `content/actions/extract-list.ts`: the summary carries it, and the failed validation now says
  "every returned record is empty because its item is not shown on the page: it sits inside
  something closed, and a hover or a click on what opens it may show it" instead of "the fields
  were read off the wrong element".
- Domain: `actions/extraction/summary.ts` reads the count; `action-failure/read-shortfall.ts`
  answers the new reason `items_not_rendered` (in `tool-rejection.ts`'s vocabulary) when every
  record is empty and every one of its items is not rendered; `rejection-next/next-sentence.ts`
  says: "The read found its items, but the page does not show them: they sit inside something
  closed, such as a menu, a panel or a tab. Show them first, by a hover or a click on the
  control that opens what holds them, then run the same read again."

## Commands run and observed results

Narrow tests (no slot):
- Domain, every changed directory: `DOMAIN_TEST_BUILD_LABEL=t903 node scripts/test-domain.mjs actions/ output-nodes client/ io/ llm-evidence/ src/tests`
  -> 2345 pass, 1 fail: `native-runtime.test.ts` "each of the seven new action types" (`checkWaitMs`, t904's).
- Extension, touched directories: `EXTENSION_TEST_BUILD_LABEL=t903 node scripts/test-extension.mjs src/content/extraction/tests src/background/connection/tests src/content/actions/tests src/content/action-runtime/tests src/panel/copy`
  -> 973 pass, 0 fail; then `src/content/extraction/tests src/content/actions/tests` after the
  unrendered-item change -> 496 pass, 0 fail; `item-record/tests/rendered-item` -> 2 pass.
- Against HEAD: first round, 8 of the new or changed domain tests fail at HEAD (see the incident
  below). Second round, the `:scope` field test was run against HEAD's `field-reader.ts`
  (copied aside, swapped, restored with `cp`) -> fails at HEAD, passes now. The hover node test,
  the `items_not_rendered` tests, the rendered-item test and the close-match paging test assert
  a type, reason, file or behaviour HEAD does not have. They were not re-run against HEAD.

Through the slot (`node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t903 -- ...`):
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0 (after the hover registration and
  the new reason).
- `pnpm test:content -- e2e/content/tests/hover e2e/content/tests/one-element-read` -> 3 passed (4.6 m):
  `css-hover-menu.spec.ts` x2 (opens the CSS-hover menu, kept through a look, closed by the next
  click with sheets exactly as before; a hover that shows nothing is `web.validation.output_not_observed`),
  and `crossborder-marketplace-follow-official-store.spec.ts` (oracle reached as above). The runs
  before it found the two spec bugs and the `:scope` cause; each is recorded in this report.
- `pnpm --filter @fluxiq-web-extension/extension check` -> exit 1, with only the 14 errors already present before this lane's work, in
  `e2e/content/tests/offline-reads/**` (7) and `packages/test-runner/src/offline-snapshot-page/**` (7):
  `Cannot find module '@fluxiq-web-extension/domain/node'` and the implicit `any` that follows
  (the domain's `dist` is not built in this worktree). None of the errors is in `src/`, in the
  new specs or in any file of this lane (Open questions 5).
- Structure audit (`node scripts/structure-audit.mjs`) -> `passed (246 warning(s), 552 baselined)`.
  Core audit (first round) -> passed; no Core edit since.

Rule note: I ran `npx tsc --noEmit` on the domain and extension sources outside the slot a few
times to read type errors quickly; the recorded checks above went through the slot.

## Not verified

- No live or paid run. The proof drives the domain runtime over the content script with
  scripted decisions, not a model.
- The hover in a real extension build in Chrome/Edge or Firefox (the content harness injects
  the bundle into Playwright's Chromium). The CSS emulation uses the CSSOM, `:is()` and
  `checkVisibility`, which current Chrome and Firefox both support.
- A hover on a menu a script opens on `mouseenter`: the gesture dispatches it, but no realistic
  scenario page with such a menu was exercised.
- Lists whose items are hidden by `visibility:hidden` templates or `content-visibility`: an
  unrendered item now reads nothing. No read of the ten scenarios was re-run beyond crossborder.
- Frame targets bound through the target store are held to the top page's origin.

## Open questions or contradictions found

1. **F3/F4b (the judge's looks) are not in this lane.** Core still cuts a look to 600 characters
   and skips `read.extracted`. With F1 the asked row is now stored, which is what the run's
   judges said was missing.
2. `output-nodes/tests/native-runtime.test.ts` (`web.dom.check` gaining `checkWaitMs`) fails in
   this tree; t904's per the coordinator. Not touched.
3. Detection still names its target when its capture cannot settle the question (a hidden
   target is not in the detection's capture). Saying "outside the run" on the wire would be a
   content-extraction change.
4. The hover emulation skips stylesheets inside shadow roots and cross-origin sheets (the
   latter as the coordinator required). A CSS-hover menu styled only by either still needs a
   person or a click; the hover then fails as `output_not_observed`, saying nothing appeared.
5. The extension check's remaining errors are `Cannot find module '@fluxiq-web-extension/domain/node'`
   in `e2e/content/tests/offline-reads/**` and `packages/test-runner/src/offline-snapshot-page/**`
   (the domain's `dist` is not built in this worktree), not in any file of this lane.
6. **Incident (first round):** my against-HEAD check's `tar` restore failed (Git Bash read `C:`
   as a remote host); I re-applied every edit from this session's own scripts. The coordinator
   will review the whole diff at commit.
