# Report: w2i-spec-typecheck

Worker: `w2i-spec-typecheck`. Wave 2 integration. Closes the gate hole found by
[reports/w2-waits.md](./w2-waits.md) (open question "No end-to-end spec is
type-checked") and the half-stale header sentence left by
[reports/w2-select.md](./w2-select.md) and
[reports/w2-keyboard-input.md](./w2-keyboard-input.md).

## Outcome

**Done.** `pnpm check` in `apps/extension` now type-checks all 27 files under
`e2e/**`, including every one of the thirteen Wave 2 harness specs, and the
`actions.spec.ts` header now describes what the file asserts.

**The number, which is the finding: the new coverage surfaced exactly one
error, and it was not in a spec.** All thirteen specs type-checked clean on
first compile. The single error was in the harness's global setup:

```
e2e/content/global-setup.ts(15,38): error TS7016: Could not find a declaration
file for module '../../scripts/build-extension.mjs'. … implicitly has an 'any'
type.
```

**One thing the supervisor must act on before pushing:** `check` exits 2 right
now on three errors in `src/background/connection/browser-state.ts`, a file I do
not own and am forbidden to touch. It is **not** caused by my change — detail and
the one-line fix in [Open questions](#open-questions-or-contradictions-found).

## What changed and why

### `apps/extension/tsconfig.test.json` — the gate

```json
"compilerOptions": { "noEmit": true, "allowJs": true },
"include": ["src/**/*.ts", "e2e/**/*.ts"]
```

`e2e/**/*.ts` is the fix the open question asked for. `--listFiles` confirms all
**27** e2e files enter the program, the thirteen specs among them.

`allowJs: true` is how the one error was fixed, and it is worth explaining,
because a config flag looks like the loosening the brief forbids. It is the
opposite. `scripts/build-extension.mjs` already carries complete JSDoc types on
`bundleExtensionEntry`, including the entry-name union. Without `allowJs`
TypeScript refuses to read that JS at all and the import is an implicit `any`;
with it, TypeScript reads the JSDoc and the call is checked for real. The
alternatives were worse: a hand-written `.d.mts` would duplicate a signature a
parallel worker was editing at that moment (the `page-world` entry was added to
that exact union during this task) and would drift silently, and a cast would
suppress the check rather than satisfy it.

**Proven, not assumed.** A disposable probe under `e2e/` called
`bundleExtensionEntry("not-an-entry", "/tmp")` and assigned the result to
`Promise<number>`:

```
error TS2345: Argument of type '"not-an-entry"' is not assignable to parameter
  of type '"popup" | "content" | "sidepanel" | "background" | "page-world"'.
error TS2322: Type 'string' is not assignable to type 'number'.
```

So the JS/TS boundary is genuinely typed, not silently `any`. `include` globs
match only `.ts`, so `allowJs` pulls in no JS file that is not actually
imported; the program gained exactly that one script.

### `apps/extension/e2e/content/tests/actions.spec.ts` — the header

The stale sentence called a dispatched key's missing default action the
behaviour being pinned (`w2-keyboard-input` made Enter submit), told Wave 2
verb workers to change assertions (the wave is over), and had a `w2-select`
clause bolted onto a `w2-keyboard-input` sentence. Replaced with one paragraph
describing what the file now asserts: per-character typing, an untrusted Enter
performing the default action, a select reporting `output_not_observed`, and
the file's role as one row per action type over the per-verb specs. Exact
string replacement, not a rewrite, so concurrent edits elsewhere in the file
survive.

## How much the new coverage actually catches

Worth recording, because "the specs type-check" is easy to over-read. Probed,
not inferred:

| Spec construct | Checked? | Evidence |
| --- | --- | --- |
| Command literals passed to `harness.runAction` | **Yes** | a bogus field gives `TS2353: Object literal may only specify known properties, and 'notAField' does not exist in type 'WebAutomationActionCommand'` |
| Direct property access on a reply | **Yes** | `reply.alsoNotAField` gives `TS2339: Property … does not exist on type 'BrowserActionResult'` |
| `expect(reply).toMatchObject({ … })` | **No** | `toMatchObject({ notAResultField: "nope" })` compiles clean; Playwright types the argument as `Record<string, unknown>` |

So the input half of the hole is closed — a spec can no longer send a field the
command type does not have, which is what "a spec can reference a field that
does not exist and still ship" meant for commands. The assertion half is only
partly closed: most result assertions in these specs go through
`toMatchObject`, which accepts any key, so a spec asserting a field the result
type dropped still compiles. Closing that would mean a typed assertion helper,
which is a Wave 3 decision, not this brief.

That table also explains the count. Zero spec errors is not evidence the specs
were sloppy and got away with it; the command literals were already consistent
with the real type, and the loosely typed half was never going to error.

## Commands run and observed results

All from `F:\!FluxIQWebExtension` with `EXTENSION_TEST_BUILD_LABEL=w2i-spec-typecheck`.
Every exit status captured by redirecting to a file and echoing `$?`, never
through a pipe; no heredocs; no `pnpm build` and no `pnpm lab` command.

| Command | Observed |
| --- | --- |
| `tsc -p tsconfig.test.json` (e2e added, before fix) | exit 1 — **1 error**, `global-setup.ts(15,38) TS7016` |
| `tsc -p tsconfig.test.json --listFiles` | **27** files under `apps/extension/e2e/` in the program |
| `tsc -p tsconfig.test.json` (after `allowJs`) | **exit 0** |
| `pnpm --filter …/extension check` (run 1, after both edits) | **exit 0** |
| `pnpm --filter …/extension test:content` | **exit 0 — `117 passed (13.6s)`** |
| `node scripts/structure-audit.mjs` (scratch git index) | **exit 0 — `structure-audit: passed (31 warning(s), 19 baselined)`** |
| `tsc -p tsconfig.json --noEmit` (the project I did **not** change) | exit 1 — the same 3 `browser-state.ts` errors |
| `pnpm --filter …/extension check` (run 2, rerun per the brief) | exit 2 — the same 3 `browser-state.ts` errors |
| `tsc -p tsconfig.test.json` (final) | exit 1 — **0 errors under `e2e/`**, 3 under `src/`, all in `browser-state.ts` |

**The green `check` and the green `test:content` were both observed** before the
foreign edit landed; the later red `check` is the same three foreign errors in
both runs.

**Structure audit** ran with `GIT_INDEX_FILE` pointing at a copy of `.git/index`
in my scratchpad, with `git add -A .` into that copy so the other workers'
untracked files and the deleted `keyboard.ts` read coherently. The real index
was never written — `git diff --cached --name-only` afterwards still lists only
the supervisor's three staged documents. `pnpm structure:baseline` was **not**
run, and no baseline entry was added, raised, or regenerated. 31 warnings and 19
baselined is the same count every Wave 2 worker recorded, so this work added
none.

**Three probe files** (`e2e/content/w2i-probe*.ts`) were created and deleted
inside the same shell call each time; `find` confirms none survives, and
`git status` shows my two intended files as the only ones I modified.

## Not verified

- **No live browser validation, and none was warranted.** This change is a
  compiler configuration and a comment. `test:content` was run to prove the
  specs still execute, not to prove browser behaviour.
- **`pnpm build`, any `pnpm lab` command, root `pnpm check` / `pnpm test`, and
  the domain, test-runner and test-contracts suites** were not run: the first
  two are forbidden to this worker and the rest are outside the brief's gates.
  Note that `allowJs` is in `tsconfig.test.json` only, so `pnpm build` (which
  runs `tsc -p tsconfig.json`) is unaffected by it.
- **A final all-green `check` was never observed after the foreign edit
  arrived.** I observed exit 0 before it and exit 2 after it, with the errors in
  a file I do not own. The supervisor must rerun `check` once
  `browser-state.ts` is fixed.
- **Whether the thirteen specs are semantically right** is untouched by this
  work. Type-checking proves a spec's commands match the command type; it proves
  nothing about whether an assertion is the correct assertion.
- **Firefox and the Playwright main config's own specs** (`e2e/*.spec.ts`, which
  need a built extension) are now type-checked but were not executed.

## Open questions or contradictions found

1. **A real source defect in `src/**`, which the brief tells me to report rather
   than fix.** `src/background/connection/browser-state.ts` imports
   `UNSUPPORTED_BROWSER_PAGE_REASON`, `UNSUPPORTED_STORE_PAGE_REASON` and
   `unsupportedAutomationPageReason` from `../../runtime`, and the barrel
   `src/runtime/index.ts` does not re-export them. The module itself is fine:
   `src/runtime/unsupported-page.ts` exists (still untracked) and exports all
   three; `action-runner.ts` gets them by importing the file directly rather
   than the barrel, which is why nothing failed until now.

   **It is not caused by my change**, and the proof is that
   `tsc -p tsconfig.json` — the project whose `include` I never touched, the one
   `check` has always run first — fails identically. Timestamps say it is an
   in-flight parallel edit: `browser-state.ts` was written at **17:51:25**, one
   minute before the error first appeared, while the barrel was last touched at
   16:42. This is the plan's "Two page-scheme lists now exist" open question
   being closed by someone right now.

   **The fix is one line** in `src/runtime/index.ts`: re-export
   `./unsupported-page`, which the "barrel in every directory" rule requires
   anyway. It also needs `git add` — the module is untracked, so it is invisible
   to the structure audit and would not survive a clean clone.

2. **The assertion half of the hole is still open.** See the coverage table:
   `toMatchObject` accepts any key, and it is how nearly every reply in these
   specs is asserted. The gate now stops a spec sending a field that does not
   exist; it does not stop a spec asserting one. A typed assertion helper would
   close it, and is worth a Wave 3 brief rather than a quiet addition here.

3. **`actions.spec.ts` still has no owner**, which is the condition that
   produced the half-stale sentence I rewrote. Two workers edited it as declared
   deviations and neither could safely fix the header. The sentence is correct
   today; the structural answer is still to give the file an owner or split it
   into one spec per verb before Wave 3, as `w2-select` recommended.

4. **`e2e/` is now type-checked but is not in the build project**, so a spec
   error fails `check` and never fails `pnpm build`. That is the right split —
   specs are not shipped — but it means CI must run `check`, not only `build`,
   for the gate to bite.
