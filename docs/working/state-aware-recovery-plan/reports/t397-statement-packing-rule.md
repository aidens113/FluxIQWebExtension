# t397 statement-packing rule — worker report

## Outcome

Done. A new structure-audit rule, `statement-packing`, fails any line on which
one statement ends and the next statement in the same statement list begins.
It is in Core and mirrored downstream, existing occurrences are baselined per
file (may only shrink), and both audits pass.

Baselined occurrences:

| Repository | Files | Packed lines |
| --- | --- | --- |
| Core (`!FluxIQ`) | 455 | 3,804 |
| Downstream (`!FluxIQWebExtension`) | 394 | 2,499 |

The two files named in the brief are among them: Core
`packages/fluxiq/src/programs/automation-studio/runtime/service.ts` at 44
lines, and downstream `packages/test-runner/src/run-scenario.ts` at 32.

## What changed and why

Core tree `C:/Users/osrs_/FluxStuff/fxwork/t397/!FluxIQ`:

- `scripts/structure-audit/rules/statement-packing.mjs` (new). The audit
  already parses every script file with TypeScript (`ctx.parse`, used by
  `as-never`), so the rule uses the syntax tree rather than a tokenizer. It
  walks every statement list (source file top level, `Block`, `ModuleBlock`,
  `CaseClause`, `DefaultClause`), skips `EmptyStatement`, and records the line
  where statement *i* starts if it equals the line where statement *i-1*
  ends. It counts each line once, even if the line holds more than two
  statements. Finding: key = file, value = packed-line count, limit 0,
  `severity: "fail"`, `ratchet: true`, the same shape as `as-never`. Scope is
  `ctx.scriptFiles` (`.ts .tsx .js .jsx .mjs .cjs`, tests included). That is
  slightly wider than the brief's four extensions; it matches every other
  syntax-tree rule.
- `scripts/structure-audit/rules/tests/statement-packing.test.mjs` (new), 14
  tests. Reported: both shapes from the brief (`let …; if (…) doThing(…); //
  comment`, two imports on one line), declarations, calls, `if`, `return`,
  `await`, `export`, `throw`, type/interface declarations, `if (a) {} b();`,
  `case` clauses, namespace bodies, multi-statement one-line arrow bodies, a
  statement after a multi-line one, one count per line, and `.tsx`/`.mjs`/`.js`.
  Ignored: `for (…;…;…)` and `for (;;)` headers, `;` inside strings, template
  literals, regular expressions, and line and block comments, type-literal,
  interface and inline parameter/return type-literal members, single-statement
  one-line arrow and function bodies, `if/else`, `try/catch/finally`,
  `case 1: case 2: return`, and empty statements (`class A {};`, `run();;`).
  Ratchet: an unbaselined file fails, one more line than baselined fails, a
  file at the baseline passes, and a file below it is reported as lowerable.
- `.structure-baseline.json`: recorded with
  `node scripts/structure-audit.mjs --adopt statement-packing`, not
  `--update`. `--update` never adds an entry, so it would refuse, and
  `--adopt` is the audit's documented way to record a new rule's existing
  violations once. The diff is additions only (457 lines); other rules'
  entries are untouched.
- `docs/architecture/code-structure.md`: a "Packing statements onto one line"
  anti-pattern entry after "Casting `as never`", and a sentence on the
  800-line budget bullet that points to it.

No `config.mjs` or rule-list change was needed. `structure-audit.mjs` finds
rules by listing `rules/*.mjs`, and the rule takes no repository-specific
settings.

Downstream tree `C:/Users/osrs_/FluxStuff/fxwork/t397/!FluxIQWebExtension`:

- Downstream mirrors Core by copying files: every audit file except
  `config.mjs` is identical to Core's apart from line endings. I copied the
  rule and its test unchanged, and `diff --strip-trailing-cr` against Core
  shows no difference.
- `.structure-baseline.json` recorded with `--adopt statement-packing` (396
  added lines, additions only).
- No downstream doc lists audit rules (AGENTS.md points to Core's
  `code-structure.md`), so there is no downstream doc change.

## Commands run and observed results

Each command was run in both trees unless noted otherwise.

- `node --test scripts/structure-audit/rules/tests/statement-packing.test.mjs`
  -> `# pass 14`, `# fail 0` (both).
- `node --test "scripts/structure-audit/rules/tests/*.test.mjs" "scripts/structure-audit/tests/*.test.mjs"`
  -> `# tests 240`, `# pass 240`, `# fail 0` (both).
- `node scripts/structure-audit.mjs --adopt statement-packing` -> Core:
  `adopted 455 statement-packing entries, values summing to 3804`;
  downstream: `adopted 394 … summing to 2499`.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` -> Core:
  `structure-audit: passed (300 warning(s), 1163 baselined).`; downstream:
  `structure-audit: passed (184 warning(s), 651 baselined).` The Core run
  includes `docs-links`, so the new `#anti-patterns` link resolves.
- Fail-first, downstream: I added a throwaway untracked file holding
  `const a = 1; const b = a;` and ran the audit. It printed
  `FAIL [statement-packing] …t397-probe-packing.mjs: 1 line holds more than one statement, line 1.`
  and `1 violation(s) across 1 rule(s).` I then deleted the probe, and the
  audit passed again.
- Before adopting, I read sample findings, including Core `runtime/service.ts`
  lines 1, 3, 408 and 435, `flow-resource-repository.ts`, and several scripts
  and tests. All were real packing, and I found no false positives.

## Not verified

- I did not run `pnpm check` or any full package suite. Per AGENTS.md, full
  suites run only in the twice-daily sweep.
- I did not review all 6,303 baselined lines one by one; I only sampled them.

## Open questions or contradictions found

- The brief says to record occurrences with `--update`, but `--update`
  refuses to add entries by design. I used `--adopt`, the documented path for
  a new rule.
- The rule also reports two statements on one line that are not separated by
  `;` (for example `if (a) {} b();`). This follows the brief's intent (one
  statement per line). It is a little wider than the brief's literal
  definition, which starts from a `;`.
- Class property declarations packed onto one line (`a = 1; b = 2;` in a class
  body) are class members, not statements, so the rule does not report them.
  If wanted, a follow-up could extend the rule to class-element lists.
