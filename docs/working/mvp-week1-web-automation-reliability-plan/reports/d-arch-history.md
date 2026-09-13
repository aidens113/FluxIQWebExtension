# d-arch-history — the architecture pages describe current design only

Worker report, 2026-09-13. Brief: `briefs/finish-week1.md`, section
"d-arch-history". Docs only; nothing committed.

## Outcome

Done. Every plan-history line that `i-leftover-sizing` section 4 lists, plus the
other history found by the wider search, is rewritten in the present tense or
removed. Each rewritten claim was checked against the code it names. Two
claims were contradicted by the code and are corrected (listed below). The
"Changed by (Phase 1.2)" column and its legend are gone from
`web-capabilities.md`, every row is kept, and the table has six columns on all
26 lines.

## What changed and why

### Claims the code contradicted, corrected

1. **`element-identity.md`, "What A Resolution Reports".** The page said an exact
   resolution reports "no scores", because the veto returns a measurement only
   when it refuses, and called that "the last piece of decision D1 still open".
   The code does the opposite. `vetoCandidate` returns `{ measurement }` on
   accept (`apps/extension/src/content/identity/veto.ts:196-203`), and
   `resolveTarget` passes it to `exactResolution`, which writes `bestScore` and
   `confidence` (`content/action-runtime/resolve-target.ts:238`, `:288-293`).
   The page now says so, and the field list above it now says `bestScore` and
   `confidence` appear whenever the element was scored, with `runnerUpScore`
   only for a scored win with a runner-up (`resolve-target.ts:297-307`).
2. **`failure-taxonomy.md:17-18`.** The page said the key of
   `WEB_AUTOMATION_FAILURE_CODES` is "what the plan, the scenario manifests and
   the briefs call it". The scenario manifests use the code value instead, for
   example `code: "web.target.not_found"` in
   `apps/scenario-lab/src/scenarios/failure-surfaces/manifest.ts:97` and
   `identity-drift/manifest.ts:44`. The page now says the key is the name used in
   source code and on the page, and the value is what Core stores and what a
   manifest's expected failure names.

A smaller figure was also out of date. `repository-layout.md:95` said each
`.script-build` rebuild was "~22 MB". The directory measures 44M today
(`du -sh`). The row now says "tens of megabytes" and keeps its reason.

### Section 4 lines, rewritten

- **`web-capabilities.md` header (`:3-13`).** The dated narrative, the audit link,
  "Wave 2 of Phase 1.2", "after Wave 3", and "updated at the close of every
  Week 1 phase" are all gone. The header now says it is current-state design.
  The dated "verified" stamp was dropped rather than moved to 2026-09-13,
  because the old text said only some rows were checked that day. See Open
  questions.
- **`web-capabilities.md:23`.** "One of the 24 capabilities in the 30-day plan's
  Phase 1.2 list" became "The matrix has 24 rows, one per browser capability."
- **The "Changed by" column.** The legend (`:38-45`), the header cell and all 24
  cells are removed. The legend is replaced by one line saying that "Why this
  state" gives, for a partial row, what the row lacks. What each of the 10
  partial rows' cells said was missing was already in its "Why this state";
  those sentences are now in the present tense:
  - clear: `contenteditable` and keyboard deletion (`content/actions/clear.ts:41-48`);
  - keypress: defaults beyond Enter, Tab and printable characters
    (`keyboard/press-key.ts:73`);
  - select: multiple and custom dropdowns;
  - scroll: window only, absolute replay (`content/actions/scroll.ts:81,122`,
    `domain/src/output-nodes/payloads.ts:76-78`);
  - wait: network idle;
  - extract attribute: unauthorable;
  - download: cannot start or read;
  - form: no submit, no validation errors;
  - dynamic elements: no wait inside acting verbs, and the recorded wait is
    click-only (`domain/src/recording/proposals/late-target-wait.ts:33,89-90`);
  - dialog: `beforeunload`, and Firefox 109-127 (`manifest.firefox.json:43`
    `strict_min_version: "109.0"`).
- **`web-capabilities.md` "Before Phase 1.1" (`:173`).** Dropped. The rejection it
  sits under was checked: `normalizeWebAutomationActionType` rejects anything
  neither canonical nor aliased (`domain/src/client/gateway-mapping.ts:334-337`).
- **`failure-taxonomy.md:105-109`.** The "removed on 2026-09-12" paragraph now says
  there is deliberately no shared error class and the carried record takes its
  place. No class exists: `WebAutomationRuntimeError` appears in `domain/src`
  only in a comment in `runtime/failure/carrier.ts:5` and in its test.
- **`sensitive-values.md:22`.** "Leaked in Wave 2" became "matching the whole
  attribute instead of its tokens would miss it". Checked:
  `domain/src/sensitivity/signature.ts:63-66` splits `autocomplete` on
  whitespace and checks each token.
- **`sensitive-values.md:30`.** "Before Wave 3 the rule existed in four places"
  became "Every caller asks this one function". Checked: both adapters call it
  (`sensitivity/descriptor.ts:39`, `content/element-traits.ts:112`).
- **`page-evidence.md:24`.** "Until Wave 3" and the "three times in one plan"
  history became the present-tense reason for declaring the contract once.
- **`page-evidence.md:72-75`.** "Before Phase 1.4" was pure history and is
  removed.
- **`element-identity.md:26`.** "What changed in Week 1 Phase 1.3" became "Level 1
  takes precedence, and its answer is gated, counted, and vetoed". Checked:
  `resolve-target.ts:214-238` (`gatedPool`, `pool.length === 1`,
  `vetoExactMatch`).
- **`repository-layout.md:95`.** The dated narrative is dropped. "Never commit it"
  and its reason stay. Checked: ignored by `.gitignore:23` (`.script-build/`,
  confirmed with `git check-ignore`), written by
  `domain/scripts/setup-fluxiq.mjs:15`, and run by `pnpm dev` through
  `scripts/run-fluxiq-web.mjs:29`.

### Other history found by the wider search (item 4), rewritten

- **`web-capabilities.md`, "now" and "still" meaning "since a change":**
  - "Every result now carries" and "No row can now complete";
  - the navigate row's "now fails";
  - the clear row's "still missing / now fail honestly";
  - the select row's "where before it assigned the unmatched value"
    (`select.ts:87-95` returns before any change);
  - "Still missing", "still yields" (`action-runtime/extract.ts:9`
    `?? ""`), "still resolve", "can now be set", "still no submit";
  - "still needs a wait", "still admits 109", "Absence is now";
  - "The record now survives";
  - `set_active_tab` "still exists" became "also activates a tab"
    (`background/connection/server-command-channel.ts:94-95,136`).
- **`web-capabilities.md`, the legacy-alias bullet.** "The seven added in Week 1"
  now names the seven types
  (`domain/src/actions/types.ts:437-443`). The safety paragraph's "the two added
  in Week 1" is also dropped (`domain/src/actions/safety.ts:27-33`).
- **`web-capabilities.md`, `cancelled`.** "Still declared ... and nothing produces
  it" became "declared ..., and nothing in this repository produces it". A grep
  over the non-test files in `apps/extension/src` and `domain/src` finds
  `"cancelled"` only in `domain/src/actions/types.ts:274`.
- **`sensitive-values.md`:**
  - "legacy spellings a caller once used" (`signature.ts:40`);
  - "no longer holds a rule" (`shared/sensitive-field.ts:18`);
  - "used to put its value in every snapshot" (`content/dom-snapshot.ts:98-104`,
    `:126-146`), now also attributed to Chromium's `getSelection()` as the source
    comment does;
  - "What still travels";
  - the `web.dom.type` leak anecdote;
  - "every leak in this plan";
  - "withheld exactly as before" (`sensitivity/redaction.ts:58-60`,
    `=== true`);
  - "stamping it ... was read downstream" became a present-tense conditional.
    Checked: `webAutomationSecretSafeValidation` returns no flag
    (`client/gateway-mapping.ts:326`), and the adapter strips a flag it did not
    honour (`runtime/adapter.ts:296-311`). That last fact is added to the
    sentence.
  - "ranked with the Week 1 blockers in the Week 1 plan" is dropped; "not built"
    stays. Checked: `content/describe-element.ts:49-55` writes `visibleText` with
    no sensitivity test.
- **`page-evidence.md`.** "Before that, a key ... was produced per frame and then
  silently dropped" became "Without that, ... would be". Checked: the merge
  builds every object with `present<PageEvidence>()`
  (`background/connection/dom-snapshot.ts:228`, `:341-344`). "Three workers
  independently added a flag ... in one wave" became "Four caps can cut
  evidence short". Checked: four rows in the canonical table,
  `domain/src/recording/web-state/evidence/input.ts:25-30`.
- **`element-identity.md`:**
  - "until decision D14 a match ... was acted on" is now a present-tense
    counterfactual. Checked: `identity/veto.ts:8-12`.
  - "Core used to charge a missing stable identifier nearly as heavily ...
    Decision D13 changed that constant" now states Core's two constants.
    Checked in Core, read only:
    `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\fingerprinting\element-fingerprint.ts:282-283`,
    `MISSING_STABLE_IDENTIFIER_SIMILARITY = -0.1`,
    `CONTRADICTED_STABLE_IDENTIFIER_SIMILARITY = -0.8`.
- **`repository-layout.md`:**
  - "every path is exactly what it was before instances existed" became "every
    output goes to the path in the Default column". Checked:
    `scripts/lab/lab-instance.mjs:41-53`.
  - "still serialized" became "serialized" (`scripts/lab/build-lock.mjs`
    exists).
  - "two hand-maintained copies had silently drifted before it could" became
    "because hand-maintained copies drift silently". Checked:
    `packages/test-runner/src/demo-llm-create-ui/generation-failure.ts:13`
    imports from `@fluxiq-web-extension/domain/node`.

## Commands run and observed results

- The link checker over the six final pages:
  `node C:/Users/mrjoh/AppData/Local/Temp/claude/f---FluxIQWebExtension/4f264c80-323b-4673-a09a-bde5851669f3/scratchpad/dcd-check-links.mjs docs/architecture/web-capabilities.md docs/architecture/failure-taxonomy.md docs/architecture/sensitive-values.md docs/architecture/page-evidence.md docs/architecture/element-identity.md docs/architecture/repository-layout.md`
  -> `exit=0`, `checked 72 relative links in 6 page(s), 0 unresolved`. It ran
  once before and once after the last whitespace reflow, with the same output.
- The brief's grep, `Wave [0-9]|Phase 1\.[0-9]|Step [0-9]+, landed|Before Phase|until Wave`,
  over `docs/architecture` -> `No matches found`, `0 total occurrences`. It found
  34 matching lines in the six files before the edits.
- A wider case-insensitive grep over the six pages, for full dates,
  `until|used to|no longer|waves?|phases?|steps? N|landed|now|Week 1|briefs?|workers|this plan|exactly as before|once used|leaked`.
  Every remaining match is present tense or a verification stamp:
  - "the landed URL", "until its claim holds", "the frame now at that path",
    "now selected";
  - `.lab-locks` "build phase";
  - Playwright `--workers`;
  - "verified against source on 2026-09-13" on four pages;
  - `element-identity.md:156`, the `[Week 1 plan]` link for D13's measurements.
- A table column count, using `awk` over the capability matrix: all 26 lines
  (header, separator, 24 rows) have 7 pipes, which is 6 columns.
- `git diff --stat -- docs/architecture/` -> exactly the six owned pages, with
  113 insertions and 131 deletions.
- `git ls-files --eol` -> all six pages are `i/lf w/lf`, the same as the
  untouched `testing-facility.md`. The edits did not change line endings.

## Not verified

- **Rendering.** I did not look at the rendered markdown. Only the link checker
  and the column count ran.
- **Row wording I did not rewrite.** For the 24 capability rows I removed only
  the column and history words. I did not re-verify the rest of each "Why this
  state" cell against the code.
- **Tab confirmation not re-checked.** The Current State and the brief list
  mention a pending "a tab confirmation carries its tab" amendment. I did not
  re-check the confirmation section against it, since it contains no history
  line.
- **Chromium behaviour.** "Chromium returns nothing for `type="password"`" and
  "`getSelection()` returns text inside a focused input" rest on the source
  comment in `content/dom-snapshot.ts:98-104`, not on a browser run.
- **Other docs.** `extension-client.md`, `testing-facility.md` and other
  `docs/architecture` pages are outside my ownership and were not searched for
  history beyond the brief's grep, which found nothing in them.
- **Gates.** No `pnpm check`, `pnpm test` or build ran, as the brief says. No Lab
  run is needed for a docs-only change.

## Open questions or contradictions found

1. **Dated verification stamps.** Four pages keep "verified against source on
   2026-09-13", and `web-capabilities.md` now has none. The old header said only
   some of its sections were checked on 2026-09-13, so stamping the whole page
   with that date would overclaim. Decide whether architecture pages should
   carry such a stamp at all. It is a freshness marker, not plan history.
2. **Plan references left on the pages.** Decision IDs (D1, D4, D6, D11, D13,
   D14) and one link to the Week 1 plan for D13's measurements
   (`element-identity.md:156`) remain. They point at a decision record rather
   than narrating history, and the brief's "no working-document vocabulary"
   names waves, phases and brief or worker names, not decision IDs. Say if they
   should go too.
3. **History in code comments.** Many source comments carry the same history the
   pages no longer do: "Before Wave 2" (`content/actions/select.ts:7`,
   `keypress.ts:4`), "Before Wave 3" (`sensitivity/signature.ts:7-12`), "until
   2026-09-12" (`identity/veto.ts:102,160`, `resolve-target.ts:81,484`), "three
   workers ... in one wave" (`recording/web-state/evidence/input.ts:15`), and
   "used to" (`runtime/navigation-outcome.ts:3`, `content/evidence/types.ts:7`).
   These are outside this brief. Name a brief if they should be cleaned.
4. **A stale code comment.** `content/actions/select.ts:46-49` calls the
   missing `redacted` flag on the `:disabled` rejection "a live gap". I did not
   check whether it still is; it is not on any owned page.
