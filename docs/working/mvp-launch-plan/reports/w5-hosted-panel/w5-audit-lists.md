# W5 audit lists (lane t901, W5, the lead's decision 3): worker report

Worker: w5-audit-lists (Opus). Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`, branch `task/t901-hosted-panel`. Nothing committed, no branch switched, no server started.

## Outcome

Done.
- A list request that hides items now writes exactly one audit row, carrying the action and the number of items hidden.
- Visibility is still decided item by item, exactly as before.
- The stored row gains a nullable count. Old files and rows still read.
- Activity shows "N items hidden".
- All three acceptance commands pass.
- I broke the memory rule once (see Commands).

## Where the rows came from

- **One producer.** `IamRequestAuthorizer.filter` (`packages/fluxiq/src/platform/iam/authorize/request-authorizer.ts`) is the only place a list is filtered by per-item IAM decisions. Its only caller is `filterProgramList` (`programs/_shared/iam/filter-program-list.ts`), which `GlobalProgramApiRegistry.afterSuccess` runs on every registered endpoint that declares `list`.
  - No web code filters lists per item: `apps/web` calls only `decide` (one row per call).
- **The old behaviour.** `filter` first decided the list scope.
  - Full access covering every item, or an empty list: one row for the scope.
  - Otherwise: `items.filter((item) => this.decide(...))`, and `decide` records one row per item. That meant one `deny` row for each hidden item, plus one `allow` row for each visible one.
- **Which profiles produce hidden items.**
  - **`service`:** a member sees only their own items, so hidden items happen there.
  - **`local` and `self-hosted`:** the permission policy allows held actions on the whole workspace, so items are never hidden. Their per-item path still wrote one `allow` row per item for anyone off the full-access fast path, such as a viewer.
  - The fix lives in the authorizer, so it applies on every profile.

## The fix

**`IamRequestAuthorizer.filter` now writes exactly one row per list request.**
- **Fast path:** when full access covers every item, or the list is empty, it writes the scope's own row, as before.
- **Otherwise:** it still evaluates each item on its own, through the same `evaluate` that `decide` uses, and returns only the allowed items. Visibility is therefore unchanged. Only the recording changed:
  - **k > 0 items hidden:** one `deny` row.
    - Category `deny`, decision `deny`.
    - It names the list's action and `listScope`, not the hidden items.
    - `matched` is the statement that denied the first hidden item.
    - It carries `hidden: k`.
    - It shares the request id of the call's own decision.
  - **None hidden:** one `allow` row on the scope, with no count. `IamDecisionAuditFilter` drops it for a read, so nothing is persisted.
  - **A store failure (compiled set null):** every item is denied, so one `deny` row with `hidden` equal to the list's length.

**Where the count is carried:**
- `recordIamDecision` takes an optional `hidden` and writes it only when it is at least 1.
- `filterProgramList` is unchanged in behaviour; only its doc comment changed.

**No row is dropped in a sink.** `IamDecisionAuditFilter`, `DeferredIamAuditSink`, `WorkspaceDecisionAudit` and `BufferedIamAuditSink` are untouched, so the compact row and the buffered sink stay as they were.

## Row format change

- **`IamAuditRecord.hidden?: number`** (`platform/iam/types.ts`). It is present only on a list's `deny` row that hid items.
- **Store (`platform/iam/audit/store.ts`).**
  - `long` gains a nullable `hid INTEGER` column, appended last.
  - New files create it. A file made before it existed gains it at open: `PRAGMA table_info(long)` is checked, then `ALTER TABLE long ADD COLUMN hid INTEGER`.
  - If another process added the column first and the `ALTER` fails, the column is re-checked and the error is thrown only if it is still missing.
  - Old rows read `hid` as NULL and come back without `hidden`.
  - Allow-day tables are unchanged: an `allow` row never carries a count.
  - Inserts and selects name their columns, so an older binary reading a newer file still works.
  - Cost: one NULL byte per `long` row.
  - A stored or recorded count is kept only when it is a positive safe integer.
- **Activity endpoint (`apps/web/src/app/api/security/server/shape-activity-entry.ts`).** The field allow-list gains `hidden`, copied only when it is a positive safe integer. Nothing else of the record is read.
- **Activity model (`features/security/activity/model/{types,shape-activity-page}.ts`).**
  - `ActivityEntry.hidden?: number`.
  - The client-side rebuild keeps it only when it is a positive whole number.
- **Activity view (`features/security/activity/ActivityList.tsx`).** It shows "N items hidden" ("1 item hidden" for one) in the muted line, between the resources and the time.

## Tests

### Core
- **`platform/iam/authorize/tests/request-authorizer.test.ts`.** One old test was rewritten and five were added:
  - 3 items, 1 hidden: one `deny` row on the scope with `hidden: 1`. It keeps `via`, and the kept items are `p1, p3`.
  - 40 items, 20 hidden: one row with `hidden: 20`, and the kept items are exactly the even ones.
  - The row cites the statement that denied the first hidden item (`Guarded`/`NoP2`).
  - An item-by-item list that hides nothing: one `allow` row with no `hidden` property.
  - Behind `IamDecisionAuditFilter` (the list is a read), a list that hides nothing persists no row at all.
  - `filter` keeps exactly the items that single `decide` calls allow.
  - A store failure gives one `deny` row with `hidden: 3`. Before, it gave three rows.
- **`programs/_shared/iam/tests/filter-program-list.test.ts`** (new). This goes through the real `GlobalProgramApiRegistry` and `filterProgramList`.
  - `service` member bob:
    - he sees only `b-1` and `b-2` of 6 items;
    - the rows are the call's `allow` plus one `deny` with `hidden: 4`, all with one request id;
    - no item FRN appears in any row.
  - Behind the decision filter:
    - only that `deny` row persists;
    - the owner's full list, which runs item by item under the guardrail, persists nothing.
  - `local` and `self-hosted` viewer: every item is shown, with one `allow` row for the call and one for the list, and no count.
- **`platform/iam/audit/tests/store.test.ts`** (real-SQL, already marked):
  - `hidden: 7` round-trips;
  - `deny` and `allow` rows without a count come back with no `hidden` property;
  - an old-format file made by hand (a `long` table with no `hid`) behaves correctly:
    - its row reads back exactly, with no `hidden`;
    - opening it adds the column;
    - a new row with `hidden: 2` is written beside it;
    - after reopening, the reads are `[2, null]`.

### Web
- **`app/api/security/server/tests/read-activity.test.ts`:**
  - a row with `hidden: 12` becomes an entry with `hidden: 12`, and its keys are exactly the allow-list plus `hidden`;
  - an old per-item row, and rows with `hidden` 0 or 1.5, become entries without it.
- **`app/api/security/server/tests/registry-decisions.test.ts`.** The real registry under `service` runs with `WorkspaceDecisionAudit` (the web's filter):
  - member Bo lists 5 projects and sees 2;
  - the sink holds exactly one row: `deny studio:Projects [workspace] hidden 3`;
  - `readActivity` shows one entry: `{who: "Bo", action: "studio:Projects", outcome: "denied", resources: ["This workspace"], hidden: 3}`.
- **`features/security/activity/model/tests/model.test.ts`:** `shapeActivityPage` keeps `hidden: 3` and drops 0, -2, 1.5, "3", and a missing count.
- **`features/security/activity/tests/activity-section.test.tsx`:** `ActivityList` renders "This workspace · 4 items hidden · " and "1 item hidden", and nothing for an entry without a count.

## Commands run and observed results

All commands ran from the Core worktree root.

**Core**
- `pnpm --filter fluxiq exec vitest run src/platform/iam/authorize src/platform/iam/audit src/programs/_shared/iam`, first run, at 2443 MB free:
  - 67 passed and 1 failed: `store.test.ts` "keeps 10,000 polling-like allow rows under 80 bytes each" timed out at 60 s (it took 95 s).
  - CPU load was 100% at the time. That test writes only `allow` day-table rows, a path my change does not touch.
- Re-run of `src/platform/iam/audit/tests/store.test.ts` alone, at 3236 MB free: 11 passed. The 10,000-row test took 8.2 s. No timeout was changed.
- **Acceptance:** `pnpm --filter fluxiq exec vitest run src/programs/_shared/iam src/platform/iam`, at 3028 MB: exit 0, `Test Files 29 passed (29)`, `Tests 267 passed (267)`.
- **Extra:** `pnpm --filter fluxiq exec vitest run src/programs/_shared/tests/api-iam`, at 2415 MB: `4 passed`, `28 passed`. These are the registry IAM, parity, completeness and escalation tests; I ran them unchanged.

**Library build**
- Took the lock with `mkdir .lib-build.lock`, then ran `node .../heavy-slot.mjs run t901 -- pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build`, then `rmdir`.
- The build waited about 20 minutes for a heavy slot.
- Result: `exit 0`. contracts, fluxiq (tsc) and ui-components each printed `Done`, with 0 `error TS` in the log.
- The lock is gone afterwards, and `dist/platform/iam/authorize/request-authorizer.js` contains the new code.

**Web**
- **Acceptance:** `pnpm --filter @fluxiq/web exec vitest run src/lib/workspaces src/lib/app-route-iam src/app/api/security src/features/security/activity`: exit 0, `Test Files 13 passed (13)`, `Tests 103 passed (103)`.
  - **Memory rule breach:** this run started at 1405 MB free, because the check and the run were in one command.
- After waiting for free memory to reach 2000 MB (it reached 3258), I re-ran the four changed web test files with `--reporter=verbose`: `4 passed`, `29 passed`. All four new tests are listed as passed.

**Structure audit**
- `pnpm structure:check`: `structure-audit: passed (538 warning(s), 917 baselined).`
- None of the warnings names a file I changed. The earlier report saw 534 warnings; the difference is not from my files.

## Not verified

- No whole-package typecheck, per the brief. The tsc library build covered the Core changes. The web files were checked only by vitest's transform.
- I did not run the `ALTER TABLE` migration against a real `iam-audit.sqlite` from a running host. I tested it only against a file made by hand in the old schema.
- No two processes opened the same old file at once, so the race guard in `addHiddenColumn` is untested.
- No live server or browser. I did not see the Activity screen styled.
- Unchanged and unrun: `apps/web/src/lib/tests/fluxiq.test.ts` (the real-runtime wiring tests). They involve no list endpoint.

## Open questions or contradictions found

1. **Which items were hidden.** The one row does not say which items were hidden: it names the list scope, the count, and the first deciding statement. I chose this to keep the row compact; a resource list per row would also add a dictionary entry per distinct set.
   - If forensics needs the item FRNs, they could go in `resources`. That makes the row size grow with the list.
2. **An allowed write in a list that hides items.** When a list hides some items and the item action is a write-level action (`list.itemAction`), the allowed items no longer get their own `allow` rows. Only the one `deny` row is written. All current list endpoints use read actions.
3. **The row's outcome reads "Denied".** A partly hidden list is a `deny` row, so Activity shows "Denied", plus "N items hidden", even though the call returned the visible items. A separate outcome such as "Partly hidden" would need a new `outcome` value. I did not add one.
4. **Stale text in `docs/architecture/platform.md` outside the Audit section.** The brief limited me to the Audit section, so I did not edit these:
   - **The Authorizer section, the "`filter` decides on the list's scope first..." paragraph** (around line 330). It says "Otherwise each item is decided and gets a row".
   - **The Known gaps "Audit" bullet** (around line 1207). It says a partly visible list "still persists one deny row per hidden item".

   Both should say "one row per list, a `deny` carrying `hidden` when any item was hidden".
5. **`docs/operations/data-and-state.md`** (not mine). If it describes the `iam-audit.sqlite` schema, it could mention `long.hid`. I did not check it.

## Files

Core, `packages/fluxiq/src`:
- `platform/iam/types.ts`
- `platform/iam/authorize/{record-decision,request-authorizer}.ts`
- `platform/iam/authorize/tests/request-authorizer.test.ts`
- `platform/iam/audit/store.ts`
- `platform/iam/audit/tests/store.test.ts`
- `programs/_shared/iam/filter-program-list.ts` (doc comment only)
- `programs/_shared/iam/tests/filter-program-list.test.ts` (new)

Web, `apps/web/src`:
- `app/api/security/server/shape-activity-entry.ts`
- `app/api/security/server/tests/{read-activity,registry-decisions}.test.ts`
- `features/security/activity/ActivityList.tsx`
- `features/security/activity/model/{types,shape-activity-page}.ts`
- `features/security/activity/model/tests/model.test.ts`
- `features/security/activity/tests/activity-section.test.tsx`

Docs:
- `docs/architecture/platform.md`: the Audit section only. The `long` row of the table, and a new "A list is one row" paragraph.

```text
Outcome: Done
Changed: Core packages/fluxiq/src/platform/iam/{types.ts,authorize/record-decision.ts,authorize/request-authorizer.ts,authorize/tests/request-authorizer.test.ts,audit/store.ts,audit/tests/store.test.ts}; packages/fluxiq/src/programs/_shared/iam/{filter-program-list.ts,tests/filter-program-list.test.ts}; apps/web/src/app/api/security/server/{shape-activity-entry.ts,tests/read-activity.test.ts,tests/registry-decisions.test.ts}; apps/web/src/features/security/activity/{ActivityList.tsx,model/types.ts,model/shape-activity-page.ts,model/tests/model.test.ts,tests/activity-section.test.tsx}; docs/architecture/platform.md (Audit section)
Validation: Core acceptance vitest -> 29 files / 267 tests passed; web acceptance vitest -> 13 files / 103 tests passed; `pnpm structure:check` -> passed (538 warnings, 917 baselined); lib build exit 0, no error TS
Not verified: whole-package typechecks (per brief); ALTER migration on a real host file and under two processes; live Activity screen
Report: C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/w5-hosted-panel/w5-audit-lists.md
Notes: IamRequestAuthorizer.filter now writes one row per list (a deny with `hidden: k`, or an allow the read filter drops); long gains nullable `hid`, added at open.
One memory-rule breach (the web acceptance run started at 1405 MB); I re-ran its new tests after waiting for 3258 MB.
platform.md's Authorizer `filter` paragraph and its Known-gaps audit bullet are stale and outside my section.
```
