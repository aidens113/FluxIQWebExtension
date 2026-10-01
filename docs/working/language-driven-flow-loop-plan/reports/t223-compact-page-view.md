# t223: the compact page view and page search

Lane report, written as the work lands. The format is the one the user
approved on 2026-10-01 ("The format you sent me looks perfect. Its very
small"), shown in `t223-format-example.md`. This report states it as rules
rather than as a hand-tidied page.

## State at stop (2026-10-01, the user's order)

No worker is running. Nothing is committed, stashed or reset. Both trees are on `task/t223-compact-page-view`.

**The model still receives today's v2 packets.** The compact view is built and tested, but nothing sends it yet.

### Implemented

1. **The capture (W2), in `apps/extension/src/`.** Report: `t223-w2-capture.md`.
   - Elements carry three new fields:
     - `ownText`: the element's direct text;
     - `parent`: the index of its nearest listed ancestor in the composed tree, offset per frame block by the merge;
     - `hidden`: set only when `web.dom.capture_snapshot` is called with `{ includeHidden: true }`.
   - Changed files:
     - `content/` `rendered-elements.ts`, `dom-snapshot.ts`, `describe-element.ts` and `message-handler.ts`;
     - `content/actions/` `capture-snapshot.ts` and `types.ts`;
     - `content/action-runtime/capture-snapshot-for-response.ts`;
     - `background/connection/` `dom-snapshot.ts` and `server-command-channel.ts`;
     - `runtime/look-across-frames.ts` and `shared/protocol.ts`.
   - New files: `content/listed-parents.ts`, `shared/dom-element.ts` (the descriptor types moved out of `protocol.ts`, which was at 793 of 800 lines) and `shared/snapshot-capture-options.ts`, plus tests.
2. **Handles are `tN` everywhere (W3).** Report: `t223-w3-handles.md`.
   - The domain mints `tN` in `sanitize.ts` and `stable-handles.ts`.
   - `WEB_LLM_TARGET_HANDLE_PATTERN` accepts `tN` and `target.N`. The new canonicaliser `domain/src/runtime/llm-evidence/handle-spelling/` is applied at every input site.
   - 42 domain test files were updated, along with `docs/architecture/page-evidence.md` and `testing-facility.md`.
   - Core changes example text only, in six files: `flow-script-format.ts`, `deepseek/system-prompt.ts`, `harness/explored-evidence-label.ts` and `harness/task-request.ts`, plus `llm/tests/harness.test.ts` and `harness/tests/explored-evidence-label.test.ts`.
   - Core compatibility impact: none. Core's handle grammar is generic and unchanged.
3. **The element fields and the page view (W4), in `domain/src/runtime/llm-evidence/`.** Report: `t223-w4-page-view.md`.
   - **Element fields.** `elements.ts` adds `ownText`, `parent` (a handle) and `hidden`. `sanitize.ts` maps `parent` indexes to handles. `page-evidence.ts` adds `viewport`.
   - **Stable handles.** `stable-handles.ts` now renames `parent`, and a hidden element cannot move a visible element's handle.
   - **State digest.** `state-digest/state-digest.ts` is now `web-state.v3` and ignores hidden elements; `runtime/route-state/project.ts` ignores them too.
   - **Small follow-on edits.** `look-alikes.ts` and `tests/present.test.ts` each gained three keys.
   - **New `page-view/`.** It implements every rule of "The format":
     - the published page `web-llm-page.v3`;
     - the header lines;
     - which elements get a line, with F1–F4 and the image rule;
     - words (W1), kinds and states;
     - the structure markers;
     - the `~` base and the repeated-href forms;
     - the retention key.

### Validated

Run by the lead, with observed output:

- **Baseline.** `node <scratch>/t223-measure.mjs` → `TOTAL (excl. recorded) | 20 pages | ... | bytes 2174142 | tokens 724720`.
- **Extension.** `heavy.sh pnpm --filter @fluxiq-web-extension/extension test`, after W2 and W3 → `# tests 1692 # pass 1692 # fail 0`.
- **The view.** `node <scratch>/t223-measure.mjs --corpus <scratch>/t223-corpus-v2 --view <scratch>/t223-w4-view.ts#view` →
  - everything-store start: 2,791 B raw, 2,985 B as JSON, 995 tokens;
  - bigbox start: 5,927 B, 6,513 B, 2,171 tokens;
  - everything-store results: 13,754 B, 14,653 B, 4,885 tokens;
  - all 20 pages: `view json bytes 116258 | view tokens 38759`.

  That is 5.3% of the 2,174,142 B baseline. Every page beats the supervisor's targets (3,544, 7,086 and 22,307 B).
- **Core structure audit.** `node scripts/structure-audit.mjs` in Core shows one FAIL: `runtime/service.ts` at 4,506 lines against a baseline of 4,505. That predates t223: the file has 4,506 lines at `e5b8f015`, and t223 does not touch it.

Reported by workers and **not yet re-run by the lead**:

- **W4:** `pnpm --filter @fluxiq-web-extension/domain check` exit 0; unlabelled domain `test` → `# tests 1130 # pass 1130 # fail 0`; structure audit → `passed (136 warning(s), 119 baselined)`.
- **W3:** Core `npx tsc --noEmit -p .` exit 0; `npx vitest run` over `runtime/flow-bootstrap` and `runtime/llm` → 134 files, 1,597 tests passed.
- **W8:** the whole decide request today, decision 9 of the t194 everything-store build, made on the results page, rebuilt with Core's own builder:
  - 1,413,957 B, 471,335 tokens. The provider recorded 477,506 input tokens.
  - 4 earlier pages, 547,498 B (38.7%), plus the newest page, 803,550 B.
  - Pages are 95.6% of the request; the constant prefix is 3.7%.
  - Report: `t223-w8-request-measure.md`. Script: `<scratch>/t223-request-measure.mjs`.

### Half-done or not started

- **W5, the wiring, is not started.** No exit sends `publishedWebLlmPage` yet. The exits are listed in the table "Every path an element reaches a model" below.
- **W8 found one more path that must be closed.** A node run's outcome carries `read.snapshot`: a raw copy of the page, with xpath, classNames and id, which is the client's capture result. It is 41% (580 KB) of today's request, and xpath is not a denied key.
- **`page-view/` is not exported** from `llm-evidence/index.ts`. It needs `export * from "./page-view"`.
- **Not started:**
  - W6: `web.find_on_page` and `web.describe_element`, the domain's `includeHidden` capture option and the action schema parameter.
  - W7: tool registration, the recovery options and the model-facing descriptions.
  - The "after" measurement of the whole request.
  - The host runtime's state diff and summary.
  - `docs/architecture/page-evidence.md:317`, which still says `web-state.v2`.
- **W4's deviations from the spec**, its report items 3–6, are to be reviewed:
  - a guard on W1;
  - the repeat forms only when shorter;
  - a whole-word image rule;
  - F4's "every line under A".
- **Fallback mode misses its targets.** A recorded packet has no `parent` and no `ownText`, and there two pages miss: everything-store start at 3,824 B (target 3,544) and bigbox start at 9,502 B (target 7,086). The cost is F1 and F4 not applying. Current captures carry both fields.

### Next step

1. Re-run `domain check`, the domain `test` and the structure audit to confirm W4's claims.
2. Dispatch W5: publish the v3 page at every exit in the table below. Remove or render `read.snapshot` from node-run outcomes, and add the `page-view` barrel export.
3. Then W6 (find and describe) and W7 (registration, descriptions).
4. Then measure the whole request after: `node <scratch>/t223-request-measure.mjs --publish <adapter>`. Finish with the full validation listed in the brief.

## Phase A: re-validation on the merged base (2026-10-01)

The supervisor committed W1–W4 (downstream `303bb5fd`, Core `776377d0`) and merged dev into both trees: downstream `f1fa3dd1`, Core `3e3df9ee`. Dev carried integration round 4. Phase A re-runs W3's and W4's claims on that base and fixes what the merge broke. Wiring (W5) waits for integration round 5.

**What the merge broke: t220's refusal diagnostic spells handles `target.N`.**

- `refusal-diagnostic/from-page.ts` and `screen.ts` each define a private `/^target\.[1-9][0-9]{0,15}$/u`. The domain now mints `t1`, so the producer drops the target (`diagnostic.target` is `undefined`). That fails `node-run/tests/run.test.ts` "a declared consequence nobody permitted refuses the run", 1 of 1,135 tests.
- `run.test.ts:124-129` (t220) passes only because of the same pattern: a model-written `target.1` is echoed back as `target.1`, which is a second spelling.
- Readers:
  - test-runner's `publishable-step-value.ts` re-screens with the domain's `screenWebBuildRefusalDiagnostic`.
  - Its fixtures, test-runner's `build-proposal.test.ts` and the Lab's `scripts/lab/live-campaign/row/tests/bundle.test.mjs` all spell `target.1`. The bundle reader itself passes diagnostics through unscreened.
- **Core is unaffected.** `evidence-diagnostic/diagnostic.ts` accepts any `^[A-Za-z0-9_.:-]{1,128}$` string.
- **No other `target.N` in the merged base.** Everything else in the domain, the extension, packages, scripts, Core source and both trees' architecture docs is a comment about the legacy spelling. Core's `target.N` test fixtures are generic handle strings, as W3 decided.
- **Fix (A1, `worker-high`, report `t223-a1-diagnostic-handles.md`; diff reviewed and re-run by the lead).**
  - `from-page.ts` and `screen.ts` now use `canonicalWebLlmTargetHandle`:
    - the producer records the requested handle and the covering targets as `tN`;
    - the screen admits either spelling and returns `tN`.
  - Tests:
    - `diagnostic.test.ts` is re-spelled, with three new tests: legacy input becomes `tN`; a legacy record is screened to `tN` and a `tN` record round-trips; `t0`, `t1234567` and `target.0` are rejected.
    - `run.test.ts:129` now expects `t1` for a model-written `target.1`.
    - The three downstream fixtures are re-spelled.
  - **Narrowing.** Handles now allow at most 6 digits; the old regex allowed 16. A stored diagnostic with a longer handle is rejected, but the domain never mints one.

## Current state

- **Phase A is done and checkpointed** for integration round 5. On the merged base, every suite the brief names passes, and so does the root `pnpm check`. W3's and W4's claims are confirmed.
- W1, W2, W3, W4 and W8 are done. W5, W6 and W7 have not been dispatched. W5 waits for the supervisor to merge round 5 (lane B's W1 removes `read.snapshot` from press outcomes).

## Baseline (W1, verified by re-running the script)

`node <scratch>/t223-measure.mjs` over 20 pages (each scenario's start page and one deeper page, generated in jsdom by the extension's own capture) reproduced:

`TOTAL (excl. recorded) | 20 pages | raw els 6498 | packet els 6498 | visible 5665 | qualifying 3357 | q on viewport 662 | bytes 2174142 | tokens 724720`

- **Largest pages:** everything-store results at 354,911 B (about 118k tokens), and auction results at 315,963 B.
- **Recorded packets** from lane C's run (decision dumps, t194):
  - everything-store start: 32,219 B;
  - bigbox start: 123,146 B;
  - everything-store results: 340,028 B.
- **Where the bytes go:** attributes 22%, box 13%, `within` 12% and `heading` 10%. The words themselves are about 7%.

A prototype line view (`<scratch>/t223-view-proto.mjs`, before the approved format) cut the 20 pages to 227,607 B, 10.5% of the original. The approved format below is smaller still.

## Decisions

1. **What the model is shown changes; what the domain holds does not.**
   - The structured packet `WebLlmPageEvidence` (`web-llm-evidence.v2`) stays the binding's in-domain form. Every domain consumer keeps reading it: plan resolution, stable handles, look-alikes, state digest, route state, repair override checks and shown addresses.
   - Wherever a page leaves the domain for a model, a published page (`web-llm-page.v3`, below) is sent in its place. Those exits are:
     - a node run's result;
     - a refusal's `page`;
     - a replay or verify answer;
     - every recovery harness option;
     - the failure evidence.
   - Two structured copies leave unchanged, because no model reads them: the host runtime's state summary and the adapter's `metadata.failureEvidence`.
2. **Handles are `tN`, one canonical form.**
   - The approved format prints `t267`. The domain mints `tN` everywhere, in packets, refusals, failure packets and repair candidates, so the model never sees two spellings.
   - Input accepts `tN` and the old `target.N`, and canonicalises to `tN`.
   - Core's handle grammar is generic (`^[A-Za-z0-9](?:[A-Za-z0-9_.:-]*[A-Za-z0-9])?$`) and needs no change. Only its example text changes: `flow-script-format.ts` `target: target.7` and `system-prompt.ts` `explored.2:target.3`.
3. **The capture reports structure, so the duplicate rules are exact rather than guessed.** The extension's capture adds three element fields:
   - `ownText`: the element's direct visible text, where `text` is all its descendants' words;
   - `parent`: the index of its nearest listed ancestor in the composed tree, made an index into the merged list by the frame merge;
   - `hidden`: set only on elements an `includeHidden` capture adds.
   Without them (older snapshots, recorded packets) the rules fall back as stated and degrade to printing a duplicate, never to dropping words.
4. **Search sees hidden elements through its own capture.**
   - `web.find_on_page` and `web.describe_element` capture with `includeHidden: true`. The looks the model gets by default are unchanged.
   - Hidden elements must not move any visible element's handle.
   - The state digest and route state are computed without hidden elements, so a search reads as the same state as a look of the same page.

## The format (authoritative for every worker)

### Published page

```text
{ schemaVersion: "web-llm-page.v3", trust: "untrusted-page-evidence",
  location,            // exact, screened, as today: plan resolution compares it
  truncated,           // as today; Core reads it for provenance
  failedTarget?, failedTargetMissing?, failedTargetUnknown?, repairParameters?, repairCandidates?,   // failure packets only, as today
  page }               // one string: header lines, a blank line, element lines, joined by "\n"
```

- **Dropped keys.** `title`, `frame`, `loading`, `navigation`, `dialogs`, `blockedBy`, `selectedText`, `captureTruncated` and `elements` are no longer keys. What they said is now in header lines.
- **Retention key.** The published page's key for retention is `location + " " + page`. `validateTargetOverrideEvidence` looks the structured binding up by that key, which replaces `packetKey(elements)`.

### Header lines (each only when it has something to say, in this order)

- `PAGE "<title>"`
- `URL <location written with ~>   (~ = <base>)`
- `VIEW <w>x<h> at the top · <n> elements with visible words or a control, in page order · find_on_page searches the rest`
  - `at the top` becomes `scrolled to y=<scrollY>` when the page is scrolled.
  - The size and scroll come from the snapshot's `viewport`. Without one, the line starts `VIEW · <n> elements ...`.
  - `<n>` counts element lines, not markers.
- `COVERING <handle> "<name>" <kind> covers <n> · ...`, one entry per blocker.
- `DIALOG <handle> "<name>" modal <kind> · ...`, one entry per open dialog.
- `LOADING <readyState> busy <kind> "<label>" ... pending-navigation`
- `FRAMES <ids> did not answer`
- `ARRIVED <type> <n> redirects from <referrer>`, which also says `at <url>` when that URL differs from the location.
- `SELECTED "<text>"`
- `CAPTURE incomplete: the browser left elements out`

Then one blank line, then the element lines.

### Which elements get a line (document order)

For each element `e`:

- **`visible(e)`:**
  - `e.box` exists;
  - `box.x + box.width > 0` and `box.y + box.height > 0`, so the honeypot at x = -9768 is out;
  - `e.hidden !== true`.
- **`control(e)`:** any of:
  - `a[href]` or role `link`;
  - `button`, `select`, `textarea`, `summary`;
  - `input` other than `hidden`;
  - role in button, link, checkbox, radio, switch, tab, menuitem, menuitemcheckbox, menuitemradio, option, combobox, textbox, searchbox, slider, spinbutton, listbox, treeitem;
  - `hasClickHandler`;
  - `contenteditable` not `false`.

  This is the view's own predicate. `actionableEvidenceElement` is unchanged for its existing callers.
- **`layer(e)`:** `e.isDialog`, or `e.covers`/`e.coversCount`.
- **`semantic(e)`:** the tag is p, li, td, th, dt, dd, figcaption, blockquote or h1–h6. The capture's `text` for these is all their descendants' words.
- **`ownWords(e)`:** `e.ownText` if present. Otherwise `e.text`. Otherwise, for semantic tags only, `e.name`.
- **`meaningful(s)`:** has a letter, digit, other symbol or currency symbol (`\p{L}\p{N}\p{So}\p{Sc}`).

The rules, in order:

1. A visible control gets a line.
2. A visible layer gets a line, with words or without.
3. A visible non-control with meaningful `ownWords` gets a text line, unless it is folded:
   - **F1.** The nearest ancestor with a line (walk `parent`) is a control or a semantic element. Its line already shows these words.
   - **F2.** It is a `label` whose normalised words equal the words of the control line immediately before or after it.
   - **F3.** Its normalised words equal the previous line's.
4. A visible non-control `img` with a meaningful alt (`name`) gets a line `img "<alt>"`, unless:
   - F1 applies; or
   - its normalised alt contains, or is contained in, the words of another line of the same list item (or of the adjacent lines outside an item). This is the title already printed by the heading or link.
5. **F4, letterless fragments.**
   - **Trigger.** A maximal run of two or more consecutive text lines whose words have no letter. Price fragments `$`, `39.`, `99` are the case.
   - **Merge.** The run becomes one line for their nearest common ancestor `A`, whose words are the pieces concatenated with no separator. The merge happens only when all three hold:
     - `A` has no line of its own;
     - `A` holds no control;
     - every visible meaningful-text element under `A` is in the run.
   - **Otherwise** the run stays as it is.

"Normalised" means whitespace collapsed, trimmed and compared case-insensitively. Folding needs `parent`. Without it, F1 and F4 do not apply.

### Words

- **A control** uses the first non-empty of `name`, `text`, `label`, `placeholder` (attribute), `title` (attribute).
- **A semantic text line** uses `text`, else `name`.
- **Another text line** uses `ownWords`.
- **An image** uses its alt. **A layer** uses its name.
- **W1, doubling.** Words that are exactly `X X` or `XX` print as `X`. This handles screen-reader text inside a control, such as `$39.99$39.99`.
- **Quoting.** Words are printed in double quotes, with an inner `"` written `\"`.
- **No cutting.** Nothing is cut in the view.

### Kinds (omitted for plain text)

- `link`
- `button`: `button`, role button, or `input` of type submit, button, reset or image.
- `field`, written `field:<type>` when the input type is not text or search. Textareas, role textbox or searchbox, and contenteditable elements are `field` too.
- `select`
- `checkbox`, `radio`, `switch`
- `toggle` (`summary`)
- `tab`, `menuitem`, `option`, `slider`, `treeitem`
- `h1`–`h6`
- `img`
- `clickable`: a click handler and no other kind.
- `dialog`, `layer`

A line whose element sits under a heading that has no line of its own gets that heading's tag before its kind: `t246 h2 link "..."`.

### State tokens (only when they apply, in this order)

- `="<value>"`, or `=""` for an empty field.
- For a select, `="<selected label>"` then `[label|label|...]`.
- `checked` / `unchecked`, from `checked` or `aria-checked`.
- `open` / `closed`, from `expanded`.
- `disabled`, from the `disabled` attribute or `aria-disabled="true"`.
- `@<column header>`, or `@c<n>`, for a table cell.
- The link target (see below).
- `covered-by tA,tB`
- `focused`
- On a layer line: `modal`, its kind, and `covers <n>`.

### Structure markers (own lines)

- **Region.** `[<landmark>]` when the region changes. The region also says `frame <id>`, `dialog <handle>` for a modal dialog's members, and `form <id or name>`. For example `[frame 2 main]` or `[main form checkout]`. `[page]` means no landmark, after a region was named.
- **Items.** `- i/n` when the list item changes and `n > 1`.
- **Rows.** `- row r` when a table row changes.
- **Screen.** `--- below the fold ---`, `--- above the screen ---`, `--- off screen ---` and `--- on screen ---` mark where the screen zone changes. Lines start "on screen".
  - **Below:** `onViewport === false` and the box starts below the viewport.
  - **Above:** the box ends above the scroll position.
  - **Off screen:** any other position outside the viewport.
  - Without viewport data, every `onViewport === false` line reads as "below".

### Links

- **Base `~`.** Write the location's own path as whole-segment prefixes `P`, longest first. `~` is the origin plus the longest `P` that at least half of the same-origin link lines start with. When no `P` qualifies, `~` is the origin.
- **Paths.**
  - Another origin prints the full URL.
  - A link under the base prints `~` followed by the rest of the path, query and hash.
  - Any other same-origin link prints its path, query and hash.
- **Repeats** (the target stays exact):
  - the same href as the previous link line prints `same href`;
  - the same href with only a `#fragment` added prints `same href#fragment`;
  - an href an earlier link line printed in full prints `same href as tN`, naming that earlier line.

### `web.find_on_page`

- **Call.** `{"query": "<1-200 chars>", "after"?: <n ≥ 0>}`
- **Capture.** A fresh `includeHidden` capture, restamped and kept like a look, so every handle in it resolves.
- **Matching.** A case-insensitive substring of the whitespace-normalised query is checked against:
  - `name`, `text`, `ownText`, `label`, `value`, `selectedValue`, option labels and `href`;
  - every attribute's name and value, as screened in the packet.

  Every element is searched: hidden, off-page and text-less ones too.
- **Result.** `{schemaVersion: "web-llm-find.v1", trust, location, found: "<text>"}`, where `found` is:

  ```text
  <total> matches for "<query>"
  <handle> <kind or tag> "<words, up to 80 chars, then …>" (<attr>="<value, a window of about 60 chars around the match, … at each cut>") <where>
  ...
  … <k> more: web.find_on_page {"query":"<query>","after":<n>}
  ```

  - The attribute part appears only when the words did not match.
  - `<where>` is one of `on screen`, `above`, `below`, `off-page` or `not rendered`.
  - A page holds 50 results.

### `web.describe_element`

- **Call.** `{"target": "tN"}`. It also accepts `target.N`.
- **Capture.** A fresh `includeHidden` capture.
- **Result.** `{schemaVersion: "web-llm-describe.v1", trust, location, element: "<text>"}`:

  ```text
  t155 <input> field "Search in"
  attributes: name="value" ... (every attribute, whole, as screened)
  box: x=.. y=.. WxH (off-page | not rendered)
  context: key=value ... (every other element field; objects as compact JSON)
  ```

- **Refusal.** A handle not on the page is refused with the domain's existing unobserved-target code.

## Workers

| Id | Effort | Owns | Status |
| --- | --- | --- | --- |
| W1 | high | scratch corpus and measure script | Done; verified by re-run |
| W2 | high | extension capture: `ownText`, `parent`, `includeHidden`/`hidden`, merge offset, protocol; corpus v2 | Done; extension test re-run by lead |
| W3 | high | handle form `tN` across the domain and its tests; Core example text | Done; diff reviewed |
| W4 | high | `elements.ts`, `sanitize.ts` (parent, ownText, hidden, viewport), `stable-handles.ts` rewrite of `parent` and hidden-safe addresses, state digest without hidden elements, the new `page-view/` | Done; view bytes re-measured by lead, tests not yet re-run |
| W5 | high | publish wiring: `tools.ts`, `tool-rejection.ts`, `node-run/run.ts`, `node-run/replay-answer.ts`, `harness-options/execute.ts`, `read.snapshot`, adapter, host runtime | not started (stop) |
| W6 | high | new `page-find/` (find, describe), `capture.ts` capture options, capture action schema | not started (stop) |
| W7 | high | tool registration, recovery options, model-facing descriptions | not started (stop) |
| W8 | high | whole decide request measured before, with a `--publish` hook for after | Done; not re-run by lead |
| A1 | high | `refusal-diagnostic/` `from-page.ts`, `screen.ts` and its test; `run.test.ts:129`; three downstream diagnostic fixtures | Done; diff reviewed, suites re-run by lead |

## Every path an element reaches a model (supervisor's requirement, 2026-10-01)

No element JSON with attributes or boxes may reach a model anywhere. The table below lists every path found, and becomes "how it is rendered now" as each path lands.

| Path | Today | Rendered as |
| --- | --- | --- |
| A node run's look or action result (`node-run/run.ts` `nodeEvidence`) | v2 packet with the outcome spread in | v3 page plus outcome (W5) |
| A refusal's `page` (`tool-rejection.ts` `toolRejection`) | v2 packet | v3 page (W5) |
| A replay or verify answer with a page (`node-run/replay-answer.ts`) | v2 packet with the verdict spread in | v3 page plus verdict (W5) |
| Recovery options inspect, press, enter_field, wait and navigate (`harness-options/execute.ts`) | v2 packet | v3 page (W5) |
| Failure evidence (`tools.ts` `captureSanitizedFailureEvidence`) | v2 packet with `repairCandidates` | v3 page; candidates stay handle-only (W5) |
| The runtime adapter's `metadata.failureEvidence` (`runtime/adapter.ts`) | v2 packet; no Core reader found | v3 page, so nothing structured leaves (W5) |
| The host runtime's state summary (`runtime/host-runtime.ts` `captureStateSnapshot`) | v2 packet as `summary` in attempt `stateRefs` | **open**: the summary must stay readable for `inspectStateDiff`; checked in W5 |
| State diff (`host-runtime.ts` `inspectStateDiff` → Core `recovery/context.ts` `state_diff`) | element JSON `{tag, role, name, text, form}` | compact lines (W5) |
| Refusal details carrying handle hints (`detail.instead`, structure refusals) | handles and counts | unchanged; checked for element objects in W5 |
| A node run outcome's `read.snapshot`, the client's raw capture result (found by W8) | raw snapshot: xpath, classNames, id; 41% of a request | to be removed or rendered (W5) |
| Earlier pages in Core's decision history | every evidence entry kept whole (`context-window.ts`) | each is a v3 page once its producer is; measured in W8 |

Core's own recovery context is metadata only: `targetResolutionSection` and `recoveryCandidatesSection`.

## Validation log

- W1 baseline: re-ran `node <scratch>/t223-measure.mjs`; observed the TOTAL line quoted above.
- W2: re-ran `heavy.sh pnpm --filter @fluxiq-web-extension/extension test` → `# tests 1692 # pass 1692 # fail 0`.
- W3: changed files reviewed. The canonicaliser `handle-spelling/canonical-target-handle.ts` is used at the input sites in `run.ts`, `execute.ts`, `detect.ts`, `press.ts`, `target-packets.ts`, `resolve-plan-node.ts` and `override.ts`.
- The Core structure audit fails on `runtime/service.ts` at 4,506 lines against a baseline of 4,505. This predates t223: `git show e5b8f015:.../service.ts | wc -l` → 4506, and t223 does not touch the file.
- Phase A on the merged base (downstream `f1fa3dd1`, Core `3e3df9ee`), run by the lead through `heavy.sh`:
  - Core `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` → exit 0 (fluxiq rebuilt, 39,958 ms).
  - `pnpm --filter @fluxiq-web-extension/domain build` → exit 0 (`rewrite-dist-specifiers: 1049 specifier(s) in 318 file(s)`).
  - `pnpm --filter @fluxiq-web-extension/domain check` → exit 0.
  - `pnpm --filter @fluxiq-web-extension/extension check` → exit 0.
  - Core `packages/fluxiq` `npx tsc --noEmit -p .` → exit 0, no output. This confirms W3's claim.
  - Core `npx vitest run src/programs/automation-studio/runtime/llm src/programs/automation-studio/runtime/flow-bootstrap` → `Test Files 136 passed (136)`, `Tests 1615 passed (1615)`. This confirms W3's claim on the merged base, which has two more files than W3's 134.
  - `pnpm --filter @fluxiq-web-extension/extension test` → `# tests 1728 # pass 1728 # fail 0`.
  - `pnpm --filter @fluxiq-web-extension/domain test` (unlabelled) → `# tests 1135 # pass 1134 # fail 1`. The failure is `not ok 599 - a declared consequence nobody permitted refuses the run`, `undefined !== 't1'` at `run.test.mjs:7237`. That is the t220 diagnostic defect above, and A1 fixes it.
- After A1, re-run by the lead:
  - `pnpm --filter @fluxiq-web-extension/domain build` → exit 0.
  - `pnpm --filter @fluxiq-web-extension/domain check` → exit 0.
  - `pnpm --filter @fluxiq-web-extension/domain test` → `# tests 1138 # pass 1138 # fail 0`. These pass: `ok 598`, `ok 599` ("a declared consequence nobody permitted ...") and `ok 747`–`749`, the new diagnostic tests.
  - `pnpm --filter @fluxiq-web-extension/test-runner test` → `# tests 1731 # pass 1731 # fail 0`.
  - `node --test scripts/lab/live-campaign/row/tests/bundle.test.mjs` → `# tests 1 # pass 1 # fail 0`. This is a unit test, not a Lab run.
  - `node scripts/structure-audit.mjs` → `structure-audit: passed (137 warning(s), 118 baselined).`
  - Root `pnpm check` → exit 0. Its scripts tests gave `# tests 549 # pass 548 # fail 0 # skipped 1`. The skip is the environmental Core-probe test (`no FluxIQ Core build output under ...\t223\!FluxIQWebExtension\scripts\!FluxIQ`). Every package check printed `Done`, the domain, extension and test-runner included.
  - The extension and Core suites above were not re-run after A1, which touched neither.

## Not verified

- No page here comes from a live browser. The corpus is jsdom with a synthetic layout, which underestimates `onViewport`. NO LAB of any kind was run, by order.
