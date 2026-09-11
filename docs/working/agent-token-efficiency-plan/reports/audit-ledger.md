# Worker report: audit-ledger

Agent: worker `audit-ledger` (Opus 5)
Date: 2026-09-10
Repository: FluxIQ Core, `F:\!FluxIQ` (branch `dev`)

## Outcome

Done. Both checks are implemented in the `working-docs` rule, tests exist and
pass, and the audit runs clean. Neither new check produces a finding against
Core's current working documents, so there is nothing for the supervisor to
baseline from this change.

## What changed and why

### `scripts/structure-audit/rules/working-docs.mjs` (220 -> 312 lines)

Added a shared `section(lines, heading)` helper that returns a `## <name>`
section's heading index and its lines up to the next `## ` heading (or end of
document). It tests `line.startsWith("## ")` with the trailing space, so an
H3 does not terminate a section. Both new checks are built on it, and both run
through the existing `splitLines()`, so CRLF documents parse identically.

1. **Current State budget** — `checkCurrentStateLength(ctx, file, lines)`.
   Counts the lines from `## Current State` to the next `## ` heading,
   inclusive of the heading. Emits one `fail`, `ratchet: true` finding with
   key `<file>#current-state`, `value` = measured line count, `limit` =
   `ctx.LIMITS.workingDocCurrentStateLines` (150, already set in
   `context.mjs`; I did not touch that file). Fires whenever the section
   exists, regardless of `Status` — the existing presence check is the one
   scoped to `Active`.

2. **Ledger validation** — `checkLedger(file, lines)`, with helpers
   `ledgerEntries()` and `validationText()`. Splits the `## Work Ledger`
   section on `### ` entries. An entry offends if it has no bullet starting
   `- Validation:`, or if that bullet — joined with its wrapped continuation
   lines (indented, non-blank; the block ends at a blank line, a non-indented
   line, or the end of the entry) — matches
   `/reported success|worker reported|workers? (said|claimed|reports?)/i`.
   Emits **one** `fail`, `ratchet: true` finding per file, key `<file>#ledger`,
   `value` = number of offending entries, `limit` = 0, message listing each
   offending entry title and why it offends. No `## Work Ledger` section means
   no finding.

Both are wired into `run()` after the existing `checkCurrentState` call. The
file's header comment was updated to describe both new checks. I also updated
the exported `title` string (it is printed by `--list` and was no longer
accurate); `title` is not part of the baseline, so this changes no keys.

### `scripts/structure-audit/rules/tests/working-docs.test.mjs` (new, 186 lines)

`node:test` + `node:assert/strict`. `context.mjs` is not imported; the tests
build a fake `ctx` by hand exposing only what the rule touches (`LIMITS`,
`CONFIG`, `trackedFiles`, `read`, `lineCount`, `basename`) over in-memory
fixture strings — no git, no filesystem. `run()` always reports the generated
index as out of date against an in-memory fixture set, so each assertion
filters findings to the document under test by key.

Eleven tests: conforming document (no findings at all); over-long Current
State (asserts severity, ratchet, limit, exact measured value 203, and
message); Current State exactly at the budget passes; an H3 inside Current
State does not end the section; missing `- Validation:` bullet (asserts the
entry title appears in the message); forbidden phrase on the bullet itself;
forbidden phrase split across a continuation line; two offending entries
collapsing into one finding with `value: 2`; an H3 in a later `## ` section
not counted as a ledger entry; document with no ledger; and CRLF endings
producing both the clean result and the same two keys as the LF equivalent.

## Commands run and observed results

- `node --test scripts/structure-audit/rules/tests/` (the command named in the
  brief) — **fails to discover the directory** on this machine:
  `Error: Cannot find module 'F:\!FluxIQ\scripts\structure-audit\rules\tests'`,
  `# tests 1 / # pass 0 / # fail 1`. Same failure without the trailing slash
  and from PowerShell. This is not specific to this directory or repository:
  the same `node --test <dir>` invocation fails on a throwaway directory in
  the scratchpad containing one trivial `*.test.mjs` file. Node is v22.11.0.
  The supervisor should use one of the working forms below in `package.json`.
- `node --test "scripts/structure-audit/rules/tests/*.test.mjs"` (quoted glob,
  Node's own expansion) — `# tests 11 / # suites 0 / # pass 11 / # fail 0 /
  # duration_ms 68.9745`.
- `node --test scripts/structure-audit/rules/tests/working-docs.test.mjs` —
  all 11 subtests `ok`, `# pass 11 / # fail 0`.
- `node scripts/structure-audit.mjs --rule working-docs` —
  `structure-audit: passed (0 warning(s), 16 baselined).`, exit 0.
  **No new findings.** A direct probe of `run(ctx)` printed all 16 findings:
  every one is a pre-existing `workingDocLines` finding keyed on a bare file
  path (969 to 6007 lines). No `#current-state` and no `#ledger` key appears,
  so there is nothing new for `pnpm structure:baseline` to record.
- `node scripts/structure-audit.mjs` (all rules) —
  `structure-audit: passed (110 warning(s), 402 baselined).`, exit 0.
- Probe over the real documents to prove the checks are not silently no-op:
  `## Current State` is found in 12 of 26 documents (longest 144 lines in
  `automation-studio-scalable-data-architecture-plan.md`, then 140 in
  `adaptive-flow-training-roadmap.md`, then 112) and `## Work Ledger` in 3
  documents holding 11 `### ` entries in total. Every one of those 11 entries
  has a conforming `- Validation:` bullet with no forbidden phrase, which is
  why the ledger check is silent.
- Probe running **all** rules twice, once with
  `scripts/structure-audit/rules/tests/working-docs.test.mjs` injected into
  `trackedFiles`/`sourceFiles`/`scriptFiles`: the finding sets are identical
  — `only without new file: []`, `only with new file: []`. The new test file
  and the new `tests/` directory introduce no finding under `test-placement`,
  `naming`, `directory-files`, `file-lines`, or any other rule once the
  supervisor tracks them. The edited rule file is 312 lines, under the
  400-line advisory threshold.

## Not verified

- The new test file is **untracked**, so the audit's own `git ls-files` view
  does not include it yet. The "identical finding sets" result above comes
  from injecting it into the context by hand, not from a tracked run. Worth a
  re-run of `pnpm check` after `git add`.
- I did not verify how these tests reach CI beyond running the
  `structure:test` script another agent added mid-task (see open question 2);
  `package.json` is off-limits to me and its `"test": "pnpm -r test"` does not
  reach `scripts/`.
- The working tree changed underneath me during this task: `AGENTS.md`,
  `docs/working/agent-working-doc-protocol.md`, and `package.json` all went
  from clean to modified by another agent while I worked. My audit runs above
  predate those edits and may not reflect the current tree.
- Neither new check has been observed **failing** against a real repository
  document, only against fixtures, because no current Core document violates
  either rule.
- The downstream `F:\!FluxIQWebExtension` repository was not touched or
  audited. Its working documents may violate either check; the plan document
  itself has a `## Current State` of 28 lines and one ledger entry with a
  conforming `- Validation:` bullet, but the other documents there were not
  measured.
- `git status` in Core shows an untracked `CLAUDE.md` at the repository root
  that I did not create and did not touch.

## Open questions or contradictions found

1. **`node --test <dir>` does not work here**, so the brief's definition-of-
   done command cannot be used verbatim, and whatever `package.json` script
   the supervisor adds must use the quoted-glob form
   (`node --test "scripts/structure-audit/rules/tests/*.test.mjs"`) or name
   files explicitly. Flagging it because the tests-subfolder convention means
   future rule tests will land in sibling `tests/` directories and a
   directory-walking command will silently run nothing — or, as here, fail
   confusingly.
2. **The `structure:test` script added in parallel is broken.** While I was
   writing this report, someone else added
   `"structure:test": "node --test scripts/structure-audit/rules/tests/"` to
   `package.json` — the directory form that does not work on this machine.
   Observed: `pnpm structure:test` -> `# pass 0 / # fail 1`,
   `ELIFECYCLE Command failed with exit code 1`. `package.json` is off-limits
   to me, so I did not fix it. It needs the quoted-glob form:
   `node --test "scripts/structure-audit/rules/tests/*.test.mjs"`. Note the
   quotes matter — Node does its own glob expansion here.
3. **Two documents sit within 10 lines of the Current State budget** (144 and
   140 against the 150 limit) and, producing no finding, get **no baseline
   entry**. The ratchet fails outright on an unbaselined key, so the first
   edit that pushes either past 150 fails `pnpm check` hard rather than being
   grandfathered. That is the intended design, but it is a trap the next agent
   to edit those two documents will hit, so it belongs in `Current State`.
4. **Fenced code blocks are not tracked.** A ```` ```text ```` fence
   containing a line starting `## ` or `### ` inside Current State or inside
   the ledger would be read as a real heading and skew both checks. No Core
   working document does this today (I checked all three ledger sections), and
   the existing header/index code has the same blind spot, so I matched it
   rather than adding a fence state machine. `agent-working-doc-protocol.md`
   is the document most at risk, since it documents the ledger entry format in
   a fence — that fence currently sits under `### Work Ledger entries`, well
   before its own `## Work Ledger` section, so it is not picked up.
5. **The hearsay regex can fire on an honest line.** `workers? (said|claimed|
   reports?)` matches, for example, "the report says 3 of 3 workers reported
   in". The brief specified the pattern exactly, so I implemented it as
   written; noting it because the finding is ratcheted per file, and a false
   positive would have to be reworded rather than suppressed.
6. **Current State length is checked for every status, not just `Active`.**
   The brief did not scope it, and the cost the check exists to control is
   paid whenever a document is read. If the intent was `Active`-only, the
   guard is a one-line change.
