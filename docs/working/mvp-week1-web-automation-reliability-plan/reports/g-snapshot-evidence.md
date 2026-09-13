# Report: g-snapshot-evidence (LR7, LR8)

## Outcome

**Done**, with one deliberate change from the inventory table's suggested fix
for LR7. The table's change on its own was measured to leave the defect half
open (see LR7 below). Both rows were confirmed open at `HEAD b43a46a` before any
edit: all four owned files were clean, `dom-snapshot.ts:156` fell back to
`topFallback`, `:187-189` passed the top frame's evidence only as `base`, and
`types.ts:59-70` declared no `evidence`.

## What changed and why

### LR7: the fallback merge path dropped the top frame

**The defect is wider than the table says.** When no listed frame is the top
one, `topSnapshot` comes from `topFallback`. That happens when the frame list
omits frame 0, or when frame 0 does not answer its second read within 150 ms.
`topFallback` was never an entry in `frameSnapshots`, so the loop never visited
it. The table names the lost additive evidence, but the top frame's own
**elements** were also dropped: the merged page kept the top frame's URL,
title and `readyState` and lost its buttons.

**The table's change alone is not enough.** I applied exactly
`const topContribution = topEvidence ?? pageEvidenceOf(topSnapshot)`, passed
into both arguments, as an experiment. The top frame's regions came back, but
the new test still failed:
`the top frame's own elements were dropped from the page`, expected
`['#pay', 'frame[2] >> #card', 'frame[2] >> #confirm']`, actual the two child
selectors only. With that change `evidence.elements.returned` would count 3
while `interactiveElements` holds 2. That breaks the rule stated in the file's
own header, that the element totals count the same frames the element list
spans.

**What I applied instead** (`apps/extension/src/background/connection/dom-snapshot.ts:147-155`):
- When no listed entry is the top frame, `topFallback` is spliced into
  `frameSnapshots` as `{ frameId: 0 }`. It goes after the seed if there is one,
  otherwise first. That is the order it answered in, and it keeps the
  pinned rule that the seed frame's elements lead.
- The existing loop then treats it as the top entry. Its elements go in
  untranslated, its evidence becomes `topEvidence` and leads the merged
  collections, and totals and list agree.
- Nothing changes when frame 0 is listed, which is every existing test.
- `topEvidence ?? pageEvidenceOf(topSnapshot)` at `:187` is now effectively
  redundant, because the top frame is always an entry. I left it alone to keep
  the diff narrow.

**Tests** (`apps/extension/src/background/connection/tests/dom-snapshot.test.ts`):
- `transportFor` (`:28`) takes an optional `listed` frame-id list.
- `:351` "a top frame the frame list omits still contributes its elements and
  its evidence": the list names only frame 2. Asserts the regions are
  `["main","form"]`, the top frame's `changed` total is present, the element
  order, `returned === interactiveElements.length`, and top-frame navigation
  and `documentState`.
- `:368` "a seeded merge whose frame list never arrived keeps the seed first
  and the top frame's evidence first": the list is empty and the seed is the
  child frame. Asserts the element order is seed first then `#pay`, the top
  frame's evidence leads the regions, and `returned` is 3.
- `:381` `mergeOfListed` helper.

### LR8: the page-evidence contract joined at its `evidence` key

- `domain/src/recording/web-state/types.ts:8,79`: `WebAutomationDomSnapshotInput`
  now declares `evidence?: WebAutomationPageEvidence | undefined`, imported
  from the `page-evidence` barrel, with a comment that the key is declared but
  its values are still read as untrusted wire data.
- `domain/src/recording/web-state/evidence/input.ts`: deleted
  `SnapshotCarryingEvidence` and its comment. `pageEvidenceOfSnapshot` (`:63-64`)
  now takes `WebAutomationDomSnapshotInput` and returns
  `record<WebAutomationPageEvidence>(snapshot.evidence)`. The value is still
  narrowed to the contract's key set. Only the snapshot-level narrowing, which
  existed because the type lacked the key, is gone. Its one caller,
  `snapshot.ts:34`, already passes that type.
- `apps/extension/src/background/connection/dom-snapshot.ts`: deleted
  `DomSnapshotPayloadWithEvidence` and its comment. `captureMergedTabSnapshot`
  returns `DomSnapshotPayload | undefined`, `merged` is a `DomSnapshotPayload`,
  and `pageEvidenceOf` (`:195-197`) reads `snapshot.evidence` with no cast. The
  `objectValue` guard stays.
- `connection/tests/dom-snapshot.test.ts`: every `DomSnapshotPayloadWithEvidence`
  became `DomSnapshotPayload`. This is the only test fixture that used either
  deleted type. No fixture under `domain/src/recording/` cast to either one, so
  none was edited; the casts that do exist are listed under Open questions.
- `apps/extension/src/shared/protocol.ts` was not needed and not touched.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`. Output went to scratch files and exit status
was read with `echo $?`, not through a pipe.

| Step | Command | Observed |
| --- | --- | --- |
| LR7 test before the fix | `EXTENSION_TEST_BUILD_LABEL=g-snapshot-evidence node scripts/test-extension.mjs` (in `apps/extension`) | `exit=1`, `# tests 315`, `# pass 313`, `# fail 2`: `not ok 53 - a top frame the frame list omits …` with `the top frame's regions were dropped from the page`, actual `['form']`; `not ok 54 - a seeded merge …` with actual `['frame[2] >> #card','frame[2] >> #confirm']`, missing `'#pay'` |
| After the LR7 fix | same | `exit=0`, `# tests 315`, `# pass 315`, `# fail 0`; `ok 53`, `ok 54` |
| LR7 mutation proof: splice guard set to `false as boolean` | same | `exit=1`, `# fail 2`, the same two failures and messages as before the fix |
| Experiment: table's literal change, my splice still disabled | same | `exit=1`, `# fail 2`: `not ok 53` with `the top frame's own elements were dropped from the page`; `not ok 54` missing `'#pay'` |
| LR7 restore | `sha256sum …/dom-snapshot.ts` | `669a1703…efb14a6` before the mutation and after both restores: byte-identical |
| Domain check after LR8 | `pnpm check` (in `domain`) | `exit=0` |
| Domain tests after LR8 | `DOMAIN_TEST_BUILD_LABEL=g-snapshot-evidence node scripts/test-domain.mjs` | `exit=0`, `# tests 349`, `# pass 349`, `# fail 0` |
| Extension check after LR8 | `pnpm check` (in `apps/extension`) | `exit=0` |
| Extension tests after LR8 | `EXTENSION_TEST_BUILD_LABEL=g-snapshot-evidence node scripts/test-extension.mjs` | `exit=0`, `# tests 315`, `# pass 315`, `# fail 0` |
| LR8 mutation proof: `evidence` renamed to `evidenceRenamed` in `types.ts` | `npx tsc -p tsconfig.json --noEmit` in `domain`, then in `apps/extension` | domain `exit=2`: `src/recording/web-state/evidence/input.ts(64,53): error TS2339: Property 'evidence' does not exist on type 'WebAutomationDomSnapshotInput'.` Extension `exit=2`: `src/background/connection/dom-snapshot.ts(190,24): error TS2339: Property 'evidence' does not exist on type 'WebAutomationDomSnapshotInput'.`, `…dom-snapshot.ts(196,29): error TS2339: …` and the same `input.ts(64,53)` error |
| LR8 restore | `sha256sum domain/src/recording/web-state/types.ts` | `425e69cd…d4062d1` before the mutation and after the restore: byte-identical |
| Structure audit | `node scripts/structure-audit.mjs` | `exit=1`, `3 violation(s) across 1 rule(s)`, all `[working-docs]` on the supervisor's plan document and `docs/working/README.md`, none on my files. My files: advisory `warn [file-lines] …/dom-snapshot.ts: 417 lines` (420 at HEAD) |

Final line counts: `dom-snapshot.ts` 417 (from 420), `dom-snapshot.test.ts`
385 (from 342), `types.ts` 94, `input.ts` 78. None has a
`.structure-baseline.json` entry and none is near the 800-line limit. No
baseline change is needed.

Each figure above is a single observation. No uniform or impossible failures
appeared, so nothing was rerun.

## Not verified

- **Lab.** None was run, per the dispatch rules. What a Lab run must show:
  - On the two-frame fixture, a recording event's merged snapshot still carries
    the top frame's regions and dialogs first, and
    `evidence.elements.returned` equals the merged `interactiveElements` length.
    That is the ordinary path and should be unchanged.
  - No regression in the recording-evidence rows.
  - The fallback path itself is probably unreachable on demand in Chromium,
    where `webNavigation.getAllFrames` always lists frame 0. It needs frame 0's
    second read or `allTabFrames` to miss the 150 ms timeout. Its only proof is
    the unit tests above, and a Lab run is not expected to exercise it.
  - LR8 changes types only. The one runtime difference is that
    `pageEvidenceOfSnapshot` no longer checks the snapshot itself is an object,
    and a non-object snapshot already throws earlier at `snapshot.url`
    (`snapshot.ts:19`).
- Content harness, root `pnpm check` and `pnpm test`, test-runner and
  scenario-lab were not run. No content script changed. Whether test-runner or
  scenario-lab type-check against the widened domain type was not checked.
- `docs/architecture/` was searched only for the two deleted type names, with
  no hits. I did not check whether any page describes the merge's fallback path.

## Open questions or contradictions found

1. **LR7 changed from the table**, for the reason and with the measurement
   above. The supervisor should confirm that bringing the top frame's elements
   into the list on this path, placed after the seed, is wanted. The table's
   literal change would leave `returned` counting elements the list does not
   hold.
2. **A comment and some casts are now stale, outside my ownership.** None of
   these cast to the two deleted types, so I left them.
   - `domain/src/recording/tests/domain.test.ts:99-104` says
     `WebAutomationDomSnapshotInput` "declares only the fields that predate
     `web-state/evidence/`", which is now false, and casts
     `as unknown as Parameters<typeof createWebAutomationStateFromSnapshot>[0]`.
     The cast may now be removable.
   - `domain/src/recording/web-state/evidence/tests/project.test.ts:47` and
     `apps/extension/src/content/evidence/tests/forms.test.ts:151` use the same
     cast. It may be removable, not tried.
   - `domain/src/recording/web-state/tests/evidence.test.ts:88` uses the same
     cast but feeds deliberately malformed evidence, so it must stay.
3. **The producer is still not joined at the key.**
   `apps/extension/src/shared/protocol.ts:328` `DomSnapshot.evidence` remains a
   separate declaration of the same key, the one the table leaves as the third.
   It is owned by `g-recorder-signals`. Deriving that snapshot type from
   `WebAutomationDomSnapshotInput` would close it, and would be a change to
   `protocol.ts`.
4. The redundant `topEvidence ?? pageEvidenceOf(topSnapshot)` at
   `dom-snapshot.ts:187` could become `topEvidence`. Left for the supervisor.
