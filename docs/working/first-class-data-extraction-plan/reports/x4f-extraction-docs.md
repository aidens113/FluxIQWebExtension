# X4.5 — Extraction architecture documentation

## Outcome

Done. The three authored architecture documents now describe extraction as it is
built: the on-page picker, the background session and confirm path, the panel,
the message contract, the control-page gate, the recorded event and its inputs,
and the page-scaled timeout. Every claim was written from the shipped source,
not from the plan.

## What changed and why

### `docs/architecture/extension-client.md` (+~290 lines)

- **New `## Defining An Extraction` section**, placed between `Recording
  Evidence` and `Recording Proposals`, with subsections:
  - *The Pick Is Not An Action.* The picker's listeners are on `window` in the
    capture phase and the recorder's are on `document` in the capture phase, so
    `stopImmediatePropagation()` runs first and the press is not recorded as a
    click; `preventDefault()` stops the press activating what it landed on. The
    whole press sequence (`pointerdown`, `mousedown`, `pointerup`, `mouseup`,
    `click`, `auxclick`, `contextmenu`) is swallowed, the pick taken on
    `pointerdown`, the listeners drained until `click`/`auxclick` with a 10 s
    backstop, and Escape swallowed likewise. The section states plainly that the
    ordering is **observed, not assumed**, naming
    `apps/extension/e2e/content/tests/extraction/tests/extraction-picker.spec.ts`
    and the two mutations that were used to prove it (listeners moved to
    `document` → the pick is recorded as a second `dom.click`; recorder's overlay
    filter removed → the highlight counts as a page change).
  - Overlay properties: `pointer-events: none`, shadow root, `data-fluxiq-picker`
    skipped by the recorder's mutation counter, CSSOM styling because of
    `style-src` policies, no `innerHTML` because of Trusted Types.
  - *What Crosses The Channel.* A proposal carries selectors, names and counts
    only; a proposed field spec cannot carry an element fingerprint at all,
    because the fingerprint normalizer records text, value and link target; a
    refusal names a word from a closed vocabulary; the confirmation preview
    (≤ 20 rows, `minItems: 0`, no pagination) is the one payload carrying page
    values and goes only to the extension's own UI.
  - *An Excluded Column Is Never Read.* Three enforcement points (inference
    pre-selection, the panel-driven re-read rather than a filter, and
    `normalizeExtractField` dropping the field before the page is touched), plus
    why the *declaration* is still recorded and what Core does with it.
  - *Who May Drive It.* `isControlPage` and its three checks, with the exact-URL
    reason spelled out (`popup/index.html.evil`), and why
    `fluxiq.test.defineExtraction` is the sharpest case; the pick is accepted
    only from frame 0 of the session's own tab.
  - *The Session.* Memory-only, one per tab, cleared on tab close or top-frame
    navigation, why `chrome.storage` is excluded, why the panel re-reads the
    session (Firefox destroys the popup on a page click), and why a refused pick
    is re-armed.
  - *Confirm: Record First, Then Read.* The ordering and its reason; nothing the
    read returns is stored; the definition is rebuilt through
    `webAutomationRecordedAction`; the timeout is the domain's
    `webAutomationExtractListTimeoutMs`, including the flat 60,000 ms ceiling
    that truncated reads past six pages before the function was exported.
  - *What The Recording Holds.* Why the frame records the event, why no element
    descriptor is attached, the field-by-field rebuild by
    `webAutomationRecordedExtraction`, the two inputs, and why nothing records a
    `value` extraction today.
- **New `### An Extraction's Dataset And Budget`** under `Recording Proposals`:
  no `expectedConfirmation`, the `recordOutput` (dataset id, schema over every
  declared field including the excluded ones, `writeMode: "append"`), and the
  scaled `timeoutMs`.
- Smaller corrections: a responsibilities bullet; the action-input prose now
  names extraction; `eleven` → `thirteen` inputs (twice); a paragraph naming the
  two extraction inputs; `data.extract` added to the executable kinds that flush
  a pending mutation batch; a new bullet stating that the picker's overlay is not
  counted as a page change.

### `docs/architecture/web-capabilities.md` (+~45 lines)

- `Extract text` row: `no action input` → `web.user.value_extraction_defined`,
  with the note that nothing records one today because a single-value pick is
  refused.
- `Structured extraction` row: the action input added, plus a sentence that a
  recorded extraction replays as this verb carrying its dataset and page-scaled
  timeout.
- `Repeating/list elements` row: the picker asks the same inference the
  `extraction.propose` message answers, so a pick and the message are one
  inference.
- `Recorded Actions`: `Eleven … bound to ten outputs` → `Thirteen … twelve`; two
  rows added to the input/output table; the dispatch-only sentence corrected (the
  two extract verbs are no longer dispatch-only); a new bullet describing how a
  picked extraction replays, including that an excluded column stays declared but
  is never read.
- `Recorder Trust And Runtime Confirmations`: `Every recorded executable verb has
  a confirmation` → `… but the two extract verbs`, with the reason a recorded
  extraction's node declares no expected confirmation.

### `docs/architecture/sensitive-values.md` (+~65 lines)

- Verification date `2026-09-13` → `2026-09-15`.
- **New `## Extraction: Structure Crosses, Values Are Not Kept`** between
  `Readers` and `Run Time`: a sensitive control is refused rather than redacted
  (the whole read fails, naming the field key only); a proposal carries no value
  and no fingerprint; a refusal is a closed vocabulary; the preview is the only
  extraction payload with page values and is memory-only. Then the exclusion
  rules: where the three enforcement points are, why the declaration survives,
  what Core's allowlist copy does, and the distinction the brief asked for —
  what the promise covers is what FluxIQ *keeps*; a run may hold a secret in
  memory while it types one, which is exactly why exclusion is decided before the
  read rather than applied as a mask afterwards, and why on this path there is no
  in-memory copy at all.
- The existing excluded-column paragraph under `Not a rule about page text` was
  shortened at its tail and now links to the new section instead of restating the
  pre-selection rule.

## Commands run and observed results

- `node scripts/structure-audit.mjs` (the repository's only markdown-aware check;
  it runs first in `pnpm check`) — run twice, before and after the final edits.
  Observed both times:
  `structure-audit: passed (56 warning(s), 17 baselined).`
  All 56 warnings are pre-existing advisory `file-lines` / `exported-values`
  warnings on source files; none names a file under `docs/architecture/`.
- Link and anchor check over the three documents (ad-hoc Python, scratchpad):
  `links checked: 120 problems: 0` — every relative link resolves to a real file
  and every `#fragment` matches a heading in the target document.
- Existence check on the 14 source paths newly cited in prose: all `OK`.
- `git status --porcelain docs/architecture/` — exactly the three files I own are
  modified:
  `M docs/architecture/extension-client.md`,
  `M docs/architecture/sensitive-values.md`,
  `M docs/architecture/web-capabilities.md`.

`node scripts/validate-docs.mjs` does not exist in this repository — `ls` reports
`No such file or directory`, and `package.json` declares no docs script. The
structure audit's `working-docs` rule is the only markdown rule, and it covers
`docs/working/` only, so it does not inspect these three files beyond passing.

## Sources read (shipped code, not the plan)

`apps/extension/src/content/picker/{index,session,messages,overlay,preview,recorded-event}.ts`,
`content/picker-host.ts`, `content/message-handler.ts`, `content/recorder.ts`
(mutation tally), `content/extraction/{field-spec,field-reader,infer-fields,infer-list}.ts`,
`apps/extension/src/background/extraction/{control,confirm,definition,deps,session-store,index}.ts`,
`background/control-page.ts`, `background/connection/{gateway-payloads,runtime-status}.ts`,
`apps/extension/src/popup/extraction/{panel,view-model,preview,client,confirm-payload}.ts`,
`popup/index.ts`, `sidepanel/index.ts`, `shared/extraction-messages.ts`,
`domain/src/actions/extraction/{request,read-request,recorded-definition,summary}.ts`,
`domain/src/extraction/{proposal,signature,dataset-id,label-key}.ts`,
`domain/src/io/input-model.ts`, `domain/src/web-panel-host.ts`,
`domain/src/recording/proposals/record-output.ts`,
`apps/extension/e2e/content/tests/extraction/tests/extraction-picker.spec.ts`,
`apps/extension/src/background/tests/extraction-control.test.ts`,
`apps/extension/src/content/tests/recorder.test.ts`, the two shipping manifests,
and FluxIQ Core's `runtime/executor/record-capture.ts` header plus
`docs/architecture/automation-studio-native-nodes.md` (read only, to state what
Core does with an excluded field). No file outside my three was modified.

## Not verified

- I did not run `pnpm check`, `pnpm test`, or any package test suite. The brief
  said `pnpm check` is currently red from other workers' in-flight code.
- I did not re-run the Chromium content harness. The claim that the capture-order
  mutation makes the `dom.click` row fail is taken from commit `ed7db33`'s message
  and from the spec's own assertions, which I read; I confirmed the spec contains
  the rows I describe (no `dom.click`, URL unchanged, no `dom.mutation`, Escape
  hands the page back) but did not execute it.
- No markdown linter or prose-style check exists in this repository, so
  formatting consistency (line width, heading style) was checked by eye and by a
  line-length scan against the documents' existing norms rather than by a tool.
- I did not verify Core's behaviour by running Core; the statement that an
  excluded field reaches neither the values map, a later node's inputs, nor the
  saved trace is quoted from the header of Core's own
  `record-capture.ts`.

## Open questions or contradictions found

1. **`scripts/validate-docs.mjs` does not exist.** The brief named it. The repo's
   only docs-related gate is the structure audit's `working-docs` rule, which
   covers `docs/working/` alone. Nothing mechanically checks that a link in
   `docs/architecture/` resolves — the check I ran was ad-hoc. If the standard is
   to be enforced mechanically rather than by guidance, a small link/anchor rule
   in `scripts/structure-audit/rules/` would be the place; that is outside my
   brief and I did not add it.
2. **Stale counts I corrected, and one I could not.** `extension-client.md` and
   `web-capabilities.md` both said eleven action inputs bound to ten outputs;
   with the two extraction inputs it is thirteen bound to twelve, and I fixed
   both. I did **not** touch `docs/architecture/testing-facility.md` or
   `page-evidence.md`, which I do not own — a grep suggests neither restates the
   input counts, but I did not read them in full.
3. **`web.user.value_extraction_defined` is registered but unreachable.** The
   domain maps it and `web.dom.extract` is bound to it, yet the worker refuses to
   start a `value` pick and refuses one that arrives anyway
   (`background/extraction/control.ts`), and `content/picker/recorded-event.ts`
   attaches no element target for one. I documented it as registered-but-never-
   produced rather than as a capability. If X-series work later lands the value
   form, the `Extract text` row and the `What The Recording Holds` subsection are
   the two places to update.
4. **Naming inconsistency in the preview bound.** `PICKER_PREVIEW_MAX_ROWS`
   (content) and `EXTRACTION_PREVIEW_MAX_ROWS` (worker) are two constants both
   equal to 20, each documented in its own comment as "the same number", with no
   test holding them equal. I documented the behaviour (at most 20 rows) and did
   not mention the duplication in the architecture docs; it is a source concern,
   not a documentation one, but it is the sort of pair that drifts.
