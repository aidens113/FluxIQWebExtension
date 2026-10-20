# Lane S-D2 (t728): domain and content script switched to Core's record-process functions

## Outcome

Done. The domain and the content script now use Core's `where` judge, number reader, row identity,
sort and unsortable count from `fluxiq/automation-studio/nodes`. The hand-synced copies and the
parity tests are deleted, not extracted and dropped: every caller now calls the Core function.

## What changed and why

Domain (`domain/src`):
- Deleted `actions/extraction/condition-match.ts`, `actions/extraction/tests/condition-match.test.ts`
  and `actions/extraction/tests/value-reading-parity.test.ts`. I relied on the S-C report's claim
  that the cases moved to Core's tests and did not re-check it case by case. Removed the
  `./condition-match` line from `actions/extraction/index.ts`.
- `actions/extraction/condition-grammar.ts` keeps its lenient alias reading. It now imports
  `AUTOMATION_STUDIO_RECORD_CONDITION_BOUNDS/TEXTS/PRESENCES` and
  `automationStudioRecordConditionPattern` from Core. I added one comment paragraph that says the
  meaning of each phrase belongs to Core. `WebAutomationExtractConditionValue` and
  `WebAutomationExtractItemCondition` stay local types, because they are wire types with `read`.
  `request.ts` still exports `WEB_AUTOMATION_EXTRACT_CONDITION_PRESENCE`, because `schema.ts`
  uses it.
- `actions/extraction/field-match.ts`, `output-nodes/extract-list/column-match.ts`,
  `runtime/llm-evidence/node-run/numeric-text-filter.ts`: these now use Core's
  `AUTOMATION_STUDIO_RECORD_CONDITION_BOUNDS`. `numeric-text-filter.ts` also uses
  `readAutomationStudioRecordNumber`, and its comment reference is updated.
- `actions/types.ts`: `domain/client` still exports the names `webAutomationExtractConditionHolds`
  and `webAutomationExtractConditionNumber`. They are now renamed re-exports of
  `automationStudioRecordConditionHolds` and `readAutomationStudioRecordNumber`, so they are the
  Core functions, not wrappers. The client barrel re-exports `actions/types` and the e2e kestrel
  spec imports the number name, so both names had to stay.
- `actions/extraction/request.ts`: one doc-comment line now names Core's judge instead of the
  deleted file. This edits a file outside the brief's list, but only by one comment line.
- Two tests outside the listed folders imported `webAutomationExtractConditionHolds` through the
  `actions/extraction` barrel. They had to switch when the file went, and now import
  `automationStudioRecordConditionHolds` from Core:
  `runtime/llm-evidence/node-run/tests/rejected-rows.test.ts` and
  `runtime/llm-evidence/structure/tests/badge-column.test.ts`. Their assertions are unchanged.

Extension (`apps/extension`):
- `src/content/extraction/order-rows.ts` is cut from 257 lines to about 135. It keeps the request
  binding: filtering to readable columns, the whole-row dedupe fallback, `ListRowOrder`, the
  bound cut, and the duplicates and unsortable report. It runs on
  `automationStudioRecordRowIdentity`, `sortAutomationStudioRecordRows` and
  `countAutomationStudioRecordUnsortableRows`, with rows wrapped as `{ values }`. Sort keys are
  converted so an undefined `as` is left out, which `exactOptionalPropertyTypes` requires. The
  local `dateValue`, `compare`, `identityOf`, the readers, the collator and the date regexes are
  deleted, and the header comment is rewritten.
- `src/content/extraction/item-filter.ts` imports `automationStudioRecordConditionHolds` from
  `fluxiq/automation-studio/nodes`, not the barrel. Its comment now names Core and the
  blank-is-absent rule.
- `src/content/extraction/tests/order-rows.test.ts`:
  - Deleted: the Core parity block (table loader and letter-m cases) and the tests Core covers:
    relative dates newest first; numbers, text collation and `auto`; `auto` with "competitive";
    ties to the next key.
  - Kept: the binding and report tests (no order, dedupe count, no identity, whole-row fallback,
    unreadable last and counted, dedupe then sort then bound). The `sorts: true` assertion moved
    into the bound test.
  - Rewritten deliberately: "Dec 1" now follows Core's nearest-year rule. It is renamed `nextdec`,
    reads as 2026-12-01 from NOW = 2026-09-28, and sorts last ascending.
- `e2e/.../auction-marketplace-kestrel-auctions.spec.ts`: comment reference only.

Blank-is-absent: no downstream test asserted that a blank value is present, so no assertion needed
changing for it. `item-filter.test.ts` "present-empty values" checks the observation's
`state: "present", value: ""` and the membership. Membership is unchanged under Core (contains on
"" fails either way). The observation still records `present` for "", because `item-filter.ts`
decides that, not the judge. I left that as it is.

## Commands run and observed results

- `cd domain && DOMAIN_TEST_BUILD_LABEL=lane-s-d2 node scripts/test-domain.mjs actions/extraction output-nodes/extract-list node-run/tests structure/tests`
  printed `# tests 464`, `# pass 464`, `# fail 0`.
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=lane-s-d2 node scripts/test-extension.mjs content/extraction/tests`
  printed `# tests 242`, `# pass 242`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/domain check` exited 0. It reported "Core's build ... is
  current with its source".
- `pnpm --filter @fluxiq-web-extension/extension check` exited 0.
- `pnpm --filter @fluxiq-web-extension/extension build` exited 0, with chrome, firefox and
  e2e-chromium each "verified 22 files". The build cache noted "inputs changed while it ran
  (apps/extension)", which comes from other workers editing in parallel.
- `build/content/index.js` has 0 occurrences of `node:crypto`. It contains
  `automationStudioRecordConditionHolds`, `automationStudioRecordRowIdentity`,
  `sortAutomationStudioRecordRows`, `countAutomationStudioRecordUnsortableRows` and
  `readAutomationStudioRecordDate`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (209 warning(s), 638 baselined)`.

## Not verified

- I did not open the test output to confirm that `rejected-rows.test.ts` and
  `badge-column.test.ts` ran. Their fragments were passed and the 464 tests passed. Both files
  compile under `domain check`.
- No e2e or Playwright run, and no live browser validation of content-script filtering or sorting.
- I did not check one by one that every deleted `condition-match.test.ts` case is in Core.
- Core's other date differences (it keeps time of day and reads "5h left" as a date) can now make
  `auto` choose `date` for countdown columns. This is not exercised downstream.

## Open questions or contradictions found

- `item-filter.ts` still labels a blank value as `state: "present"` in rejection observations,
  while Core's judge treats it as absent. Aligning the label is a small follow-up if wanted.
- When I ran `git rm`, it briefly staged the three deletions. I unstaged them with
  `git restore --staged`, so the index is as I found it and all my changes are unstaged.
