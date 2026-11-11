# t905 p2: place on list reads

Outcome: Done (pnpm check red from another worker's domain type errors, not this change).

## What changed
- New X/list-place/ (barrel, place.ts type, read-place.ts, address-place.ts, appended-offset.ts, tests/read-place.test.ts).
  Order: numbered/next pager current page (`pageShownNow(undefined, item)`, no edit to shown-page.ts needed);
  else a page/offset/cursor parameter the pager's own Next link moves along (closed name list), read from the document address, only if clean;
  else, for load-more/infinite lists that grew by appending (items at read start kept in place, more after), the index of the first returned item (whole, unsorted, non-resumed reads only).
- list-reader.ts: `place` on the outcome, computed for single-page reads; extract-list.ts `summaryOf` sends `place`. The type comes from the domain summary (`ExtractionSummary["place"]`), so no separate declaration.
- page-advance/index.ts: exports pageShownNow (barrel only; no press code touched).
- To stay under the 800-line budget, rememberRejected moved to item-record/remember-rejected.ts.

## Commands and results
- extension tests `list-place list-reader read-coverage item-record extract-list page-advance pagination`: 292 pass, 0 fail.
- domain `summary-place extract-list/tests/answered`: 8 pass, 0 fail.
- structure audit: only FAIL left is domain/src/actions/extraction/request.ts exported-values 16 > 15 (not mine, another worker's file).
- `pnpm check` (heavy slot): only errors are TS2345 "Property 'shown' is missing" in domain/src/runtime/llm-evidence/plan-resolution/extraction/columns.ts (302, 339) and structure/packet.ts (494): another worker's new `shown` field in request/schema. None in my files.

## Not verified
- No live browser. Place check on a real pager rests on the fake-DOM tests. Revert-fails not run by hand (tests import the new module).
- pnpm check could not reach a clean pass because of the foreign errors.

## Open
- Offset for load-more is the first returned item's index in the list; with a fresh page that is usually 0.
