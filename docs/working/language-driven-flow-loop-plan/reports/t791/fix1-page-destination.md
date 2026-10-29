# t791 fix 1: page-level destination (report)

## Outcome

Done. A creation pressed on one page can now be witnessed by another page of the **same resource (tab)**, even when that
page has no list or table roles and even when it starts as an empty state. Core reads such a page as one list it builds
itself (a "page read whole"). The read issues a `destination-N` receipt marked `page: true`, the admission's rule 4 admits
an identified creation that names that ref when its subject was absent, and a trial's delta reports the subject
appearing, or a shown quantity changing, as `changed`. `proof.ts` already turns that into `shown`. The domain already
reported `scope` and `subjects` for every page, an empty page included, and a line's subject token already equals the item
page's. So the domain needed only tests, no code change.

## Design decisions

1. **The page travels as a Core-built list collection, not as a new witness kind.** `trial-change/{proof,packet,findings}.ts`
   are must-not-touch, and `site-reset/trial-change-port.ts` is not mine. All four only know `list` and `control`
   witnesses, and the port's `latest()` rebuilds readings from `collections` only. A new `page` kind would not compile in
   `packet.ts`, and it would lose its data in the port. A Core-built collection flows unchanged through receipts,
   observations and settlement, the read log, the port, delta, proof and packet.
2. **The tokens are Core's own and are kept per resource.**
   - The page's scope is `"\0page\0" + resource + "\0" + read.scope`, and its group is that scope plus `"\0group"`.
   - Domain tokens are `[A-Za-z0-9:_-]`, so neither can ever equal a domain list's or control's scope.
   - In particular, a control in no list (whose `control.scope` is the page scope) never gets an `own_list` witness from
     the page. Giving it one would make every modify press on any page "witnessed" by subject presence, and produce
     false `no_change` results.
   - A page read in tab A and the same page read in tab B are different groups.
3. **When a read is "paged".** `paged(read)` adds the page collection when the read names a trusted `resource`, a `scope`
   and a `subjects` array (possibly empty, all tokens, at most 2000), **and** either:
   - the read carries no list collection, or
   - that page already has an original.
   So a read that carries domain lists issues exactly the refs it did before, and no page ref is added beside them. Once
   a page has an original, it stays observed when lists later appear on it, which keeps its group valid and readable.
   A read with no `subjects` is never paged. Most existing fixtures have no `subjects`, so they are untouched.
4. **Rows are presence only.** Every subject's state is the constant `"present"`. So settlement restores when the page's
   subjects are back as the build found them, and a moving value on the page never blocks settlement.
5. **Quantity (t772) only in the trial delta.** The page collection carries `values`, a digest of the page's sorted
   `read.values` (`v:` plus 32 hex characters). The read log keeps it, and the port passes it through.
   - `delta.ts`: when the subjects held still on both sides and the digest changed, the status is `changed`, and every
     subject on both sides moves to `changed`. Core cannot tell which row a value belongs to.
   - When subjects came or went, the values add nothing.
   - Domain lists carry no `values`, so their deltas are unchanged.
6. **A page original witnesses only an identified creation that names its ref.** `destination()` returns undefined for a
   page original when `identifiedCreate(declared)` is undefined. That covers `modify_existing`, `delete`, mixed classes,
   and a creation that names no ref.
   - Reason: with presence-only rows, a `modify_existing` press witnessed by a page would settle `unchanged` at once,
     even though it changed a quantity. That is a false settle.
   - The existing checks still apply: same resource, a valid group, and subject absent (`control.subject` and, when the
     control sits in no item, `control.page`).
7. **Caps.** List originals keep their cap of 256. Page originals have their own cap of 512, so pages never use up the
   room for lists. Ref numbers are shared (`destination-${originals.size + 1}`) and stay at most 768, within the stamp
   pattern `destination-[1-9]\d{0,2}`.
8. **Every reader sees one read.** `ledger.observed` and `project-ledger.observed` page the read first. `createBaselines.observed`
   also pages it itself; paging is idempotent, and an already-paged read is returned as the same object. So the receipts,
   the observations and the read log all see the same collections.
9. **Words.** No model-facing words were added. `page-destination-words.ts` was not needed. The receipt carries `page: true`.

## Exported names a later worker needs

- `site-reset/page-collection.ts` exports `automationStudioSiteResetPageCollection(read)`, which returns an
  `AutomationStudioTrialCollection` or undefined. It is not in the site-reset barrel: `index.ts` is shared with the other
  worker, and the audit did not require it. Import it by file.
- `AutomationStudioSiteResetCreateBaselines` (`site-reset/create-baselines.ts`):
  - `paged(read)`: the read with its page among its lists, as in decision 3.
  - `observed(read, original?)`: now pages internally.
  - `receipts()`: entries are `{ ref, ordinal, count, page?: true }`. A page's ordinal is its position after the lists.
  - `issuedRefs()`: **unchanged in shape**. It lists page refs too, as `{ ref, count, location }`, with no page marker.
    The issued-ref type lives in reset-settlement, which I did not change. Filtering refs by resource (fix 2) applies to
    page refs exactly as it does to list refs, since every original keeps its `resource`.
  - `destination(declared, ref)` and `known().destination`: resolve a page ref only for an identified creation in the same
    resource with its subject absent. They answer `{ ref, scope, group }`, and the witness is `{ via: "destination", ... }`.
  - `retained(ref)` and `named(ref)`: resolve page refs like list refs, so `trial-change-port.places()` builds a list place
    at the page's location.
- `trial-change/contracts.ts` exports `AutomationStudioTrialCollection = AutomationStudioSiteResetCollection & { values?: string }`.
  `AutomationStudioTrialReading.collections` and `AutomationStudioTrialLoggedRead.collections` now use it.
- `site-reset/contracts.ts`: `AutomationStudioSiteResetCalls.destinationReceipts` returns entries with `page?: true`.
- Plan-step path: an explored creation that names a page ref gets `destinations: [page]` and `witnessed: true`. So
  `admitStep` answers `{ via: "repeats", act }` for the plan step that repeats it, and `stepWitnessResolves` accepts that
  stamp, because the act has destinations.

## Files

Core (`C:/Users/osrs_/FluxStuff/fxwork/t791/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/`):

- New: `site-reset/page-collection.ts`.
- Edited:
  - `site-reset/create-baselines.ts`: `paged`, the page originals, the caps, `page` receipts, and the creation-only rule.
  - `site-reset/ledger.ts`: pages each read in `observed`, plus a 2-line header note. **The file is now exactly at the
    800-line limit.**
  - `site-reset/project-ledger.ts`: pages each read in `observed`.
  - `site-reset/contracts.ts`: the receipt type and the `subjects` documentation.
  - `trial-change/contracts.ts`, `trial-change/read-log.ts` (copies `values`), `trial-change/delta.ts` (values move).
  - `reset-admission/admission.ts` and `reset-admission/witness.ts`: header comments only.
- Tests:
  - `site-reset/tests/create-baselines.test.ts`: 8 page tests appended. A separate file would have taken the directory to
    26 files, over the audit's 25-file limit.
  - New `reset-admission/tests/page-destination.test.ts` (4 tests).
  - New `trial-change/tests/page-witness.test.ts`: 3 delta tests and 3 ledger trials, including the cross-tab case and an
    undo that settles `restored`.

Downstream: new `domain/src/runtime/llm-evidence/start-state/tests/observe-page-reading.test.ts` (3 tests). No domain
source changed.

Test fixtures use a library reading shelf (not a store), and only opaque tokens.

## Commands run and observed results

- New Core test files, run directly with `npx vitest run` (single files): 3 files, 18 tests, all passed.
- After merging the page tests and trimming `ledger.ts`, I ran
  `npx vitest run` on `create-baselines`, `admission/page-destination`, `page-witness`, `ledger`, `ledger-trials` and
  `delta`: **6 files, 91 passed**.
- Core `pnpm test` on `site-reset`, `reset-admission`, `trial-change` and `reset-settlement`, under the lock:
  **584 passed, 1 failed**.
  - The failure is `site-reset/tests/project-reset.test.ts:113`, in the other worker's new
    "a trial with a step that has no witness (t791 fix 4)" test. It contains `console.log("DBG", ...)`.
  - Its reads carry no `subjects`, so `paged` returns them unchanged and none of my code runs.
- Neighbouring consumers, under the lock: 11 test files from outside my directories whose fixtures carry `subjects`
  (`candidate`, `subflow-candidate`, `action-permissions`, `landed-acts`, `project-build/*`).
  - Result: 9 files passed and 2 tests failed.
  - `project-build-brief-ports.test.ts:190` failed. It contains the other worker's `console.log("DBG5", ...)`.
  - `project-build-reset.test.ts:658` failed: a trial it expects to be refused as unwitnessed was judged. The shop
    fixture's reads (lines 448 to 459) have **no top-level `subjects`**, so my paging is inert there. This matches the
    other worker's fix 4 (running a trial with no witness), which is in flight in `project-reset.ts`.
- `npx tsc --noEmit -p .` for `packages/fluxiq`, under the lock:
  - The first run hit node's default heap limit (exit 134, out of memory at about 2 GB).
  - Rerun with `--max-old-space-size=4096`, as the package's own `check` script does: 3 errors in my test
    (`exactOptionalPropertyTypes`) and 2 in the other worker's `candidate/tests/reset-witness`.
  - After I fixed mine: **rc=0**.
- Domain `tsc --noEmit -p .`, under the lock: **rc=0**. That tsconfig excludes `tests/`, so I also ran
  `tsc --noEmit -p tsconfig.test.json` under the lock: **rc=0, 0 errors**.
- Domain tests, with `DOMAIN_TEST_BUILD_LABEL=t791-fix1 node scripts/test-domain.mjs` on `start-state/tests/*` and
  `control-spot/tests`: **48 passed, 0 failed**, including the 3 new tests.
- Core `node scripts/structure-audit.mjs`:
  - First run: 2 failures, both mine (the `site-reset/tests` directory at 26 files, `ledger.ts` at 811 lines).
  - After fixing both: **rc=0**.
- Downstream `node scripts/structure-audit.mjs`: **rc=0**.

## Not verified

- No live or browser run, and no Lab run. I did not check that the real extension gives crossborder's `.cartLine` link
  the same subject words as the item page's `h1`. The domain test shows that equal words, whatever their spacing, give
  equal tokens. Whether the extension gives the link a subject depends on `recordSubject` and `controlRow` for
  `div.cartLine`, which is extension code.
- The directory-level Core `pnpm test` ran before I moved the page tests into `create-baselines.test.ts` and trimmed
  comments in `ledger.ts`. Those files were re-run directly afterwards (91 passed). The whole directory set was not
  re-run.
- No full suites (`pnpm check`, the whole Core vitest run, builds), per the twice-a-day rule.
- I did not re-run the 2 neighbouring failures with the other worker's changes removed; stashing is not allowed. That
  they are not mine is an inference from the fixtures having no `subjects`.

## Open questions or contradictions found

1. **Receipts on almost every page.** Every list-less page with subjects now prints a `page: true` receipt in
   `resetDestinations`, which most exploration calls will see. That costs tokens, and `issuedRefs` grows (so do the
   refusal words that list it, until fix 2 filters by resource). The model's own words (`undoes-tool.ts`, `words.ts`)
   still say refs come from "a complete observation of a list". Neither file is mine. Someone should add a sentence that
   a `page: true` ref names the whole page, for a creation whose item will appear there.
2. **A page ref named by a non-creation press, or by a creation whose subject is present, is still dropped silently.**
   That is fix 3's note, not mine.
3. **Values carry a false-positive risk.** A page whose shown values change by themselves (a countdown, a rotating
   banner) makes a page witness `changed`, and so `shown`, with no real change. The brief asked for the values-based
   quantity. The packet's lines are the judge's check on it.
4. **Packet row counts.** For a page witness, `rows` counts every subject on the page (navigation and headings
   included), not just its item lines. `packet.ts` is not mine.
5. **Trials in another tab.** A trial whose looks run in another tab than the page ref's reads that witness as `unread`.
   Domain list groups behave the same way, because they include the resource too. "Per tab" is consistent, but a
   page-witnessed step is only judged when the trial runs in the same resource.
6. **`ledger.ts` has no headroom left** (800 of 800 lines). The next edit there needs a split.
