# w2-store-scan: no size ceiling on a SQLite store

Worktree `F:\fxwork\t023-store-scan`, branch `task/t023-store-scan`. Not committed.

## Outcome

Done for the core deliverable. A store of any size is now scanned instead of being
refused. The check still fails closed on a store it cannot read. The planted-secret
test still catches a secret in an uncheckpointed write-ahead log, and it now does
so in a store larger than 85.5 MiB.

## What fills the store (finding for Core; Core not changed)

Almost all of `.fluxiq/global.sqlite` is **one runtime session document**,
`automation.state` row `projects/<p>/runtime/sessions/<s>`, plus the **free pages
left behind when that document is rewritten**. Each action's full page snapshot
(`result.result.snapshot.interactiveElements`) is written four to five times inside
that one document:
- in `session.trace.attempts[].inputs`
- in `attempts[].outputs`
- in `attempts[].transitionComparison.actual.outputs`, a copy of `outputs`
- in `session.trace.values`

The whole document is then rewritten after every step. The `transitionComparison`
copy is added in Core at
`packages/fluxiq/src/programs/automation-studio/runtime/executor/attempt-trace.ts:38`
and `executor/transition-comparison.ts:124,135`.

Measured on a live `social-scheduler-week-ahead` run with 4 actions (`run-mu7g7qdp-45230c1e`,
workspace kept at `F:\r23\persistent-isolated\t023-week`):

| Part of the store | Size |
|---|---|
| Whole file | 10,506,240 B |
| Free pages | 1,271 pages, 5.2 MB (about half the file) |
| Live data | 5,239,904 B |
| The one session document | 5,204,221 B (99.3% of live data) |
| Inside it: `trace.attempts` | 3,989,907 B |
| Inside it: `trace.values` | 1,211,063 B |

This is my explanation for the 85.5 MiB, not a measurement of that store. The
state-changing runs have 8–10 actions on a 280-row page, which means larger
snapshots and more rewrites. I could not open an 85.5 MiB store: every sibling
workspace was deleted, and `schedule-post` on dev failed before playback in my run
(`run-mu7g20ej-0953639f`, `runtime.behavior`, $0.038).

## The change

- **`secret-leak-attestation.ts`**
  - `maxStoreBytes` is removed. A store has no byte ceiling.
  - Store bytes are searched 1 MiB at a time, with an overlap of the longest
    encoded literal minus one byte (`searchStoreFile`).
  - A file is checked for a SQLite header before any text ceiling applies.
  - Staging uses `copyFile`.
  - `maxFileBytes` and `maxTotalBytes` now apply to text only.
- **`sqlite-store-reader/read-sqlite-stores.ts`**
  - The cell read runs inside SQLite: `instr(CAST(col AS BLOB), literal)` over
    every column (`table_xinfo`) of every table, in UTF-8, UTF-16LE and UTF-16BE.
  - No row reaches JavaScript, so memory does not grow with the store.
  - The old `SELECT *` with `.all()` loaded every row into memory. Node 22.11 has
    no `iterate()` to stream rows instead.
- **Still fails closed** as `unscanned-store`: a store that cannot be opened, a
  malformed store, an orphan log, a link, a failed copy, and a read that runs past
  the reader's 120-second limit.
- **`attest-run-redaction.ts`**: `ENTRIES_PER_BOUNDED_SCAN` goes back to 8.
- **Tests and docs**: `secret-leak-attestation.test.ts`,
  `demo-llm-attestation.test.ts` and `docs/architecture/testing-facility.md`.

## Evidence

- **Real store, new scan**: the kept week-ahead store was scanned with the live
  DeepSeek key, held in memory and never printed. The key is absent in all three
  encodings, the cell read is `clean`, and the workspace scan is `passed` with 19
  files and 13,300,560 bytes.
- **Targeted tests**: 28 of 28 pass across `secret-leak-attestation`,
  `read-sqlite-stores`, `attest-run-redaction` and `demo-llm-attestation`. Among
  them:
  - the planted secret is found in a store of more than 89,636,864 B, placed only
    in an uncheckpointed `-wal`;
  - a truncated (malformed) database, a zero-filled file, a file that is not a
    database, and an orphan log are each still `unscanned-store`.
- **Mutation**: I made the in-SQLite search never match. Three tests failed,
  including the planted-secret test. I then restored the file.
- **Structure audit**: `structure-audit: passed (78 warning(s), 122 baselined)`.

## Not verified

- **No completed state-changing run was scanned live.** `schedule-post` fails on
  dev before playback, so the proof for a large store is the >85.5 MiB unit test,
  not a live run.
- **The week-ahead live run used the old build**: I edited the code after it
  started. The new scan was run offline against that run's kept store.
- **I did not run** `pnpm check`, the full `test-runner` suite, or a new live Lab
  run, to save quota.
- **Two workspaces I created are still on disk**:
  `F:\r23\persistent-isolated\t023-week` and `t023-post`.
- **I did not update the comment in `demo-llm-attestation.ts`**. It still
  describes size ceilings.
