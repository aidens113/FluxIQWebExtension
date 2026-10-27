# t758/presence-wording-fix

## Outcome
Done. A held yes over Core-settled rows now gets a line chosen by the settled condition's kind, carried from where it is known. A presence exclusion worded "has no X" no longer asks for the request's "bound".

## What changed and why
All under `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/` in the Core t758 tree.
- `value-readings/settled-rows.ts`: the settled result now carries `settledKind` (`bound` | `presence` | `text`), set at the three places that settle rows.
- `read-condition.ts` (NOT in the owned list; a minimal optional field `settledKind` on the summary's condition type, needed to carry the kind. It sits outside `contracts/**`. Supervisor please confirm it is acceptable). It also appears on the judge's copy of the summary as a generic enum word.
- `request-rows/types.ts`, `request-rows/summary-reads.ts`: `settled.kind` carries it; `boundNames` now takes `unbounded` from the kind, not from re-matching the wording (removed the unused `TEXT_RELATION` regex). A missing kind defaults to `bound` (hand-built summaries).
- `request-rows/unquoted-rows.ts`: the unquoted entry carries `boundKind`.
- `verdict/unquoted-line.ts`: dropped the `PRESENCE_CONDITION` regex; the line is chosen by `boundKind`: presence (existing wording), new text-test wording (asks for the request's words asking for what the condition tests; no "bound"), numeric bound unchanged.
- `exclusion-evidence/recheck.ts`: the general recheck sentence said "failing its bound ... stating that bound"; now "failing it ... (stating its bound, or asking for what it tests)".
- Tests: new fixture `value-readings/tests/badge-catalogue.ts` (non-store trail directory, ".badge" read, "Promoted", "leaving out promoted items"); new describe at the end of `tests/judge-accounts-for-rows.test.ts` (kind is `presence`; unsure with the "asking for what that condition tests" line and no "bound"; compliant yes answers). `request-rows/tests/stored-though-left-out.test.ts`: two expectations gained `boundKind: "bound"` (numeric bound behaviour otherwise unchanged and still covered).
- Text-test rows shared the defect (they hit the bound line); fixed through the same kind, no separate test beyond the shared line logic (not independently tested).

## Commands run and observed results
- `pnpm test <judge-accounts-for-rows, request-rows/tests, value-readings/tests, exclusion-evidence/tests>` from packages/fluxiq: Test Files 25 passed, Tests 208 passed (after fixing the two expectations; first run had those 2 failing on the added `boundKind`).
- `pnpm test result-verification/ llm/tests/diagnosis-channel.test.ts llm/deepseek/tests/system-prompt.test.ts`: 140 files / 1247 tests passed; 1 file / 3 tests passed.
- `npx tsc --noEmit -p tsconfig.json` (src and tests are in one program): no output, exit clean.
- `node scripts/structure-audit.mjs`: first run failed (tests/ at 26 files); moved the fixture to `value-readings/tests/`; rerun "structure-audit: passed (443 warning(s), 1152 baselined)".

## Not verified
- Fail-first was not run against the old code (git stash/checkout forbidden); the old output ("state its bound") is as observed in store-refusal.md section 6.
- I found no dedicated "prompt-contract" test file; I ran the diagnosis-channel and deepseek system-prompt tests plus the whole result-verification directory.
- No live run, no model call, no Core dist build.

## Open questions
- `settledKind` on `read-condition.ts` (unowned file), as above.
