# Lane S-C (t728): Core record-process re-exports for browser code

## Outcome

Done. Core is now the one browser-reachable source of `where`-condition judging, number and date
reading, row identity (dedupe) and sorting, through `fluxiq/automation-studio/nodes`. Core side
only; nothing downstream was edited.

## What changed and why

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t728/!FluxIQ`.

- `packages/fluxiq/src/programs/automation-studio/nodes/record-process.ts` (new): re-exports by name
  from `@fluxiq/contracts/automation-studio`, following the `record-output.ts` pattern. It is added
  to `nodes/index.ts`, so it is reachable as `fluxiq/automation-studio/nodes`.
- `nodes/tests/record-process.test.ts` (new): the browser-safety test, modelled on
  `runtime/action-permissions/client/tests/index.test.ts`. It checks that the module's value exports
  are exactly the list below and are the same objects as Core's (from both the module and the nodes
  barrel). It checks that `record-process.ts` imports only `@fluxiq/contracts/automation-studio`, and
  that every file in `contracts/src/record-sets/process/` imports only relative paths (no `node:`
  and no bare packages, type-only imports excepted). It also judges a field-less condition and
  reads one magnitude through the barrel.
- `contracts/.../process/types.ts`: new type `AutomationStudioRecordConditionTest` (below).
- `contracts/.../process/condition-holds.ts`: `automationStudioRecordConditionHolds` now takes an
  `AutomationStudioRecordConditionTest`. The body is unchanged, because it never read `field`.
  Every existing caller's `AutomationStudioRecordCondition` is assignable to the new type, so no
  existing result changes. The doc comment states the blank-is-absent rule.
- `contracts/.../process/count-unsortable-rows.ts` (new) plus its barrel line: Core had no export
  that counts unreadable rows (`sortAutomationStudioRecordRows` returns only the rows). The new
  function counts as the downstream `order-rows.ts` `unsortable` does: a row counts once if at least
  one key's value is missing, blank or not of the key's kind. An `auto` kind is decided over the
  rows given, the same way the sort decides it.
- `contracts/.../process/value-reading-cases.ts`: the shared parity table now includes every
  downstream number case it lacked: continental forms, "N others", letter-m magnitudes and ranges
  ("1,5m", "10M followers", "£60-72k", "€85 k", "3 million-ish", ...), plus "4.0",
  "$39.99$39.99", "" and "Free". It also gains five date cases from order-rows ("5 hours ago",
  "a week ago", "Posted 3 Sep 2026", "Aug 30, 2026", "25/09/2026") and one auto case
  (["item 10","Item 9","apple"] → number).
- Tests added in `contracts/.../process/tests/`:
  - `condition-holds.test.ts`: field-less conditions, the blank-is-absent pin, and every
    condition-match case Core lacked (bounds and ranges, equals lists, startsWith/endsWith
    negatives, delimited flags, a stateful flag run twice, combined comparisons with `not`, pattern
    length 200, `/x/z`, a `(unclosed` match).
  - `sort-rows.test.ts` (new): relative dates newest first, salary numbers, numeric text collation
    and `auto` choosing numbers, unreadable values last in both directions, ties to the next key
    and then incoming order.
  - `row-identity.test.ts` (new): layout and case folding, null/missing/blank meaning no identity,
    partial values, own properties only.
  - `count-unsortable-rows.test.ts` (new).

## Exported names and signatures (all from `fluxiq/automation-studio/nodes`)

Values:

```ts
AUTOMATION_STUDIO_RECORD_CONDITION_BOUNDS: readonly ["atLeast", "atMost", "lessThan", "greaterThan"]
AUTOMATION_STUDIO_RECORD_CONDITION_TEXTS: readonly ["matches", "contains", "startsWith", "endsWith"]
AUTOMATION_STUDIO_RECORD_CONDITION_PRESENCES: readonly ["present", "absent"]
AUTOMATION_STUDIO_RECORD_SORT_ORDERS: readonly ["asc", "desc"]
AUTOMATION_STUDIO_RECORD_SORT_TYPES: readonly ["auto", "number", "date", "text"]
AUTOMATION_STUDIO_RECORD_VALUE_READING_CASES: readonly AutomationStudioRecordValueReadingCase[]

automationStudioRecordConditionHolds(condition: AutomationStudioRecordConditionTest, cell: unknown): boolean
automationStudioRecordConditionPattern(written: string): RegExp | undefined
readAutomationStudioRecordNumber(value: string): number | undefined
readAutomationStudioRecordDate(text: string, now: number): number | undefined
readAutomationStudioRecordSortValue(cell: unknown, kind: AutomationStudioRecordSortReading, now: number): number | string | undefined
automationStudioRecordAutoSortKind(cells: readonly unknown[], now: number): AutomationStudioRecordSortReading
automationStudioRecordRowIdentity(values: Readonly<Record<string, unknown>>, by: readonly string[]): string | undefined
sortAutomationStudioRecordRows<T extends { readonly values: Readonly<Record<string, unknown>> }>(rows: readonly T[], keys: readonly AutomationStudioRecordSortKey[], now: number): T[]
countAutomationStudioRecordUnsortableRows(rows: readonly { readonly values: Readonly<Record<string, unknown>> }[], keys: readonly AutomationStudioRecordSortKey[], now: number): number
```

Types: `AutomationStudioRecordCondition` (`field: string` required),
`AutomationStudioRecordConditionTest` (every key of `AutomationStudioRecordCondition`, `field`
included, optional and `| undefined`), `AutomationStudioRecordConditionValue` (`string | number`),
`AutomationStudioRecordSortKey` (`{ field: string; order: "asc" | "desc"; as?: "auto" | "number" | "date" | "text" }`),
`AutomationStudioRecordSortOrder`, `AutomationStudioRecordSortType`,
`AutomationStudioRecordSortReading` (`"number" | "date" | "text"`),
`AutomationStudioRecordValueReadingCase`.

`AutomationStudioRecordConditionTest` allows `| undefined` on every key because both repositories
use `exactOptionalPropertyTypes`. The downstream `WebAutomationExtractItemCondition` writes
`?: X | undefined` on every key and has an extra `read` key; it should pass as a variable. I checked
this by reading both types, not by compiling against the downstream.

## Semantic changes the downstream will see

1. **A blank string is absent.** Core reads `""` and whitespace-only strings as not there. With
   `{}` or `{ is: "present" }` they now fail; with `{ is: "absent" }` they hold; every comparison
   fails on them, so `not` keeps them. The downstream's `webAutomationExtractConditionHolds(c, "")`
   treated `""` as present. Pinned in Core's `condition-holds.test.ts`.
2. **Dates (sort only):** Core's `readAutomationStudioRecordDate` differs from `order-rows.ts`'s
   private `dateValue` in three ways:
   - It keeps the time of day ("22 Sep, 14:00"; "Today 14:00").
   - It reads a time left as `now` plus the remaining time ("5h 12m left", "Ends in 45 min"). The
     downstream read no date there, so `auto` may now pick `date` for such columns.
   - A date with no year is the occurrence nearest `now`, within six months either way. The
     downstream used the latest one not after `now` plus a day.

   This breaks the downstream test "absolute dates ... a missing year meaning the latest such
   date": with now = 2026-09-28, "Dec 1" now reads as 2026-12-01, not 2025-12-01. That case
   conflicts with Core's t510 rule and was not moved; it must be dropped or rewritten downstream.
3. **Row shape:** `sortAutomationStudioRecordRows` and `countAutomationStudioRecordUnsortableRows`
   take rows wrapped as `{ values }`. The downstream will wrap its flat `Record<string, string | null>`
   rows. `automationStudioRecordRowIdentity` takes the flat record directly. A non-string cell is
   compared by its JSON; downstream rows hold only strings and null, so nothing changes there.
4. Numbers, patterns, text comparisons, identity and the unsortable rule match the downstream
   exactly on every downstream case. All downstream number cases are now in Core's table and pass.

## Commands run and observed results

- `npx vitest run src/record-sets/process/tests` (in `packages/contracts`): first run, before
  implementing, `count-unsortable-rows` failed with "is not a function", and an escaping slip in
  `condition-holds.test.ts` was fixed. After implementing: `Test Files 7 passed (7)`,
  `Tests 169 passed (169)`.
- `npx vitest run src/programs/automation-studio/nodes/tests` (in `packages/fluxiq`): before the
  module existed, it failed with "Failed to load url ../record-process.ts". After:
  `Test Files 4 passed (4)`, `Tests 36 passed (36)`.
- `pnpm --filter @fluxiq/contracts check`: exit 0, no errors.
- `pnpm --filter fluxiq check`: exit 0, no errors. The first run reported "inputs changed while it
  ran (packages/fluxiq)" because other agents were editing the same Core tree; the re-run also
  exited 0.
- `pnpm structure:check`: `structure-audit: passed (411 warning(s), 1152 baselined)`, exit 0. None of
  the warnings name a file I touched.

## Not verified

- I did not compile or run anything downstream: the new types against
  `WebAutomationExtractItemCondition`, and the downstream switch itself.
- No dist was built (as the brief says). The downstream reaches these exports only after Core's
  `fluxiq` and `contracts` dist is rebuilt.
- I did not run the downstream `value-reading-parity` test against the extended table. The new
  date cases ("a week ago" and the others) are ones the old downstream date reader also reads as
  expected, but I did not run them there.

## Open questions or contradictions found

- The Core tree is shared. While I worked, uncommitted edits by other agents were present in
  `packages/fluxiq/src/programs/automation-studio/runtime/**`, `packages/fluxiq/src/ui/**` and
  `apps/web/**`. None of them are mine. My files are the eleven listed in the return contract.
- The downstream "lastyear" date case conflicts with Core's t510 rule for a date with no year, as
  described under semantic change 2.
