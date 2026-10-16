# t680 regexp-template-escapes audit: worker report

## Outcome

Done. A new structure-audit rule, `regexp-template-escapes`, is in Core and mirrored downstream. It passes at zero violations in both trees. Downstream it found one more file, which is now fixed.

## What changed and why

- Core `scripts/structure-audit/rules/regexp-template-escapes.mjs` (new). It reads the syntax tree of every file in `ctx.scriptFiles`, source and tests alike. For each `new RegExp(...)`, `RegExp(...)` or `globalThis.RegExp(...)`, it looks at the first argument when that is a string literal, a template literal (head and every span), a parenthesised one, or a `+` chain of them. It scans the raw source for a single backslash followed by:
  - `b` (becomes a backspace);
  - any letter other than `n r t v f x u` (becomes the bare letter: `d D s S w W B p k c`...);
  - a regex syntax character `. ( ) [ ] { } * + ? ^ $ | -` (becomes the bare character).

  A `\\` pair is consumed, so doubled escapes are fine. `String.raw` is a tagged template, so it is never matched. Each finding is `severity: "fail", ratchet: false`, and its key is `path:line:col`. The message gives file:line, the escape, what the literal turns it into, and the fix (double the backslash, or `String.raw`).
- Core `scripts/structure-audit/rules/tests/regexp-template-escapes.test.mjs` (new). 10 tests, using a fake ctx built the same way as `shared-temp-root.test.mjs`. Fixtures are built with `String.fromCharCode(92)`, so no second layer of escaping is involved.
- Wiring: `scripts/structure-audit.mjs` finds every `rules/*.mjs` on its own, and `config.mjs` does not list rules, so neither file needed a change. `pnpm check` and `structure:test` already pick the test up through `rules/tests/*.test.mjs` in both repositories.
- Mirror: there is no sync script or mirror check. The mirror is a plain copy: Core's working tree is CRLF (autocrlf, index LF), downstream is LF, and only `config.mjs` differs. I copied both new files to the downstream `scripts/structure-audit/` with CR stripped. `diff -rq --strip-trailing-cr` between the two trees now lists only `config.mjs`.
- Downstream fix, `apps/extension/e2e/content/tests/extraction/tests/extract-list-catalog.spec.ts` lines 165 and 181. The rule found 4 `\d` in the `new RegExp(...)` template on line 181 ("require\d", "\di\d", "observe\d"). These are plain `d` letters written as `\d`. The `NEVER_APPEARED` string on line 165 has the same obfuscation, though it sits outside any RegExp call. Each single `\d` became `d`, and the real `\\d+` escapes stayed. The check already worked, because a swallowed `\d` reads as `d`, which is what the words need. The fix keeps every string value identical, so this is not a check that was silently skipped.
- Docs: a Core `docs/architecture/code-structure.md` Anti-Patterns bullet ("A regex escape a string swallows"), and a short paragraph under downstream `docs/architecture/repository-layout.md` "Pushes Run The Structure Audit".

## Commands run and observed results

- Core `node scripts/structure-audit.mjs --rule regexp-template-escapes`: `structure-audit: passed (0 warning(s), 0 baselined).`
- Downstream, same command, before the fix: 4 FAIL lines, all at `extract-list-catalog.spec.ts:181` with `"\d"`, ending `structure-audit: 4 violation(s) across 1 rule(s).` After the fix: `passed (0 warning(s), 0 baselined).`
- Plant: I wrote Core `scripts/t680-plant.mjs` containing ``new RegExp(`\b${word}\b`)``. The rule printed 2 FAIL at `scripts/t680-plant.mjs:2` ("holds "\b" ... a backspace (U+0008), not a word boundary ... ("\\b") or ... String.raw"), with exit=1. Then I deleted the file, and `git status` showed only the two new rule files.
- `node --test scripts/structure-audit/rules/tests/regexp-template-escapes.test.mjs`, Core and downstream: `# tests 10 # pass 10 # fail 0`.
- `node --test "scripts/structure-audit/rules/tests/*.test.mjs" "scripts/structure-audit/tests/*.test.mjs"`: Core `# tests 250 # pass 250 # fail 0`; downstream `# tests 250 # pass 250 # fail 0`.
- Full `node scripts/structure-audit.mjs`: Core `passed (390 warning(s), 1156 baselined).` exit=0. Downstream `passed (201 warning(s), 639 baselined).` exit=0.
- I parsed the spec before (git HEAD) and after with TypeScript and compared the cooked values of every string and template literal: `literals 189 189 identical cooked values: true`.

## Not verified

- I did not run the edited Playwright spec. The AST comparison shows its string values are unchanged.
- I did not run the full `pnpm check` (the full-suite policy).
- The rule is syntactic. It does not see a pattern built in a variable or a helper first, or built through `new RegExp(someFn())`. Digit escapes (`\1`, legacy octal) are not counted.

## Open questions or contradictions found

- The downstream spec's `\d`-for-`d` spelling looks like the output of an old bulk replace. Other files may have the same spelling outside `RegExp` calls, which the rule does not check. I did not look further.
- Nothing commits the mirror or checks it. The two trees are kept identical by hand, apart from line endings.
