# t343 report: structure audit refuses new `as never` casts

## Outcome

Done. A new structure-audit rule, `as-never`, fails on any `as never` (or `<never>x`) cast beyond the per-file baseline, in source and tests alike. Authored in Core, mirrored byte-for-byte (line endings aside) into this repository, adopted into both baselines. Both audits pass on the t343 trees; nothing on dev fails.

## What changed and why

Core (`C:\Users\osrs_\FluxStuff\fxwork\t343\!FluxIQ`):
- `scripts/structure-audit/rules/as-never.mjs` (new). Walks each script file's TypeScript AST and counts `AsExpression` / `TypeAssertionExpression` nodes whose target type is the `never` keyword. One ratcheted `fail` finding per file (key = path, value = cast count, limit 0, line = first cast). Because it reads the syntax tree, words in comments, strings and template literals never count, and `never` annotations/return types (which the compiler checks) are not casts. `as unknown as never` counts once. Message says why (never is assignable to everything; the t341 stale-stub incident) and what to write instead (typed stub, `satisfies T`, helper returning the real type).
- `scripts/structure-audit/rules/tests/as-never.test.mjs` (new). 10 tests: finding shape, message content, both spellings and positions, .ts/.tsx/.mjs and test files audited, comments/strings/template literals not counted, checked `never` uses not counted, and ratchet cases through the real `applyRatchet` (new file fails; one more than baseline fails with the "may shrink, never grow" message; at baseline passes; below baseline is lowerable).
- `.structure-baseline.json`: `pnpm structure:baseline --adopt as-never` equivalent (`node scripts/structure-audit.mjs --adopt as-never`): 160 entries summing to 381 casts. Diff is additions only (162 lines), other rules untouched.
- `docs/architecture/code-structure.md`: one bullet "Casting `as never`" in the anti-pattern list beside `contract-spread` / `swallowed-failure`, naming the rule.

Downstream (`C:\Users\osrs_\FluxStuff\fxwork\t343\!FluxIQWebExtension`):
- `scripts/structure-audit/rules/as-never.mjs` and `rules/tests/as-never.test.mjs`: copies of Core's (CR stripped, matching this repo's LF mirror files). `diff -r --strip-trailing-cr` of the two audit directories now differs only in `config.mjs`, as before.
- `.structure-baseline.json`: adopted 65 entries summing to 136 casts; additions only (67 lines).

Counts differ from the brief's grep figures (Core 372/167, downstream 129/69) because grep counts matching lines including comments/strings and unaudited files; the rule counts real casts (several lines hold two) in audited script files.

## Commands run and observed results

- Core `node --test scripts/structure-audit/rules/tests/as-never.test.mjs` -> `# pass 10 # fail 0`.
- Fail-first: with `run()` temporarily returning `[]`, the same file -> `# pass 3 # fail 7` (the three "not flagged" tests pass, every flagging and ratchet test fails). Rule restored and re-run -> `# pass 10 # fail 0`.
- Core `node scripts/structure-audit.mjs --rule as-never` before adoption -> `structure-audit: 160 violation(s) across 1 rule(s).`
- Core `node scripts/structure-audit.mjs --adopt as-never` -> `baseline written: adopted 160 as-never entries, values summing to 381; other rules' entries kept.`
- Core `node --test "scripts/structure-audit/rules/tests/*.test.mjs" "scripts/structure-audit/tests/*.test.mjs"` -> `# tests 210 # pass 210 # fail 0`.
- Core `node scripts/structure-audit.mjs` -> `structure-audit: passed (285 warning(s), 509 baselined).`
- Downstream `node scripts/structure-audit.mjs` before adoption -> `65 violation(s) across 1 rule(s).`; `--adopt as-never` -> `adopted 65 as-never entries, values summing to 136`.
- Downstream audit tests (same glob) -> `# tests 210 # pass 210 # fail 0`; `node scripts/structure-audit.mjs` -> `structure-audit: passed (176 warning(s), 182 baselined).`

## Not verified

- `pnpm check` / full suites not run (narrow-check policy). Nothing outside the audit was touched.
- Baselines reflect the t343 trees (Core `ca978fd9`, downstream `7f17acd2`). Not checked against other in-flight worktrees.

## Open questions or contradictions found

- Merge-order risk: any concurrent task (t340, etc.) that adds an `as never` cast in a file will fail the audit after this lands, and a brand-new file with one fails outright (no entry). That is the intent, but the supervisor should expect it when merging dev into those branches; the fix is a typed stub, not a baseline raise. Files where other tasks removed casts just become lowerable.
- No downstream doc lists audit rules (downstream defers to Core's `code-structure.md`), so no downstream doc edit was made.
