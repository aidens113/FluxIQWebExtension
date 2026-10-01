# t194-w31: a press inside a shadow root is not pressed a second time

## Outcome

Done. The ignored-press watch now observes every shadow root inside the press's scope, beside the scope itself. Kerbfind's radius chip opens with one click: row 1 of the bikes spec is reported "Expected to fail, but passed". A press that changed nothing still reports nothing, so it is pressed again as before.

## What changed and why

- **New `apps/extension/src/content/action-runtime/ignored-press/scope-roots.ts`** exports `scopeRoots(pressed, scope): Node[]`. It returns each root once:
  - Every root the scope walk crossed on its way up from the pressed control. These are found through `parentNode` wherever `composedParent` moves to a host, so a closed root the control sits in counts too.
  - Every open root beneath the scope, nested roots included, through `openRootsWithin` from `../../shadow-dom`. This covers an answer that lands in a component beside the control, or in the control's own root when the control is a host. A closed root beneath the scope cannot be reached and is not watched.
- The file is called `scope-roots.ts`, not the w24 diff's `pressRoots` in `press-scope.ts`, because of two audit rules. One export per file rules out adding it to `press-scope.ts`. A first name, `press-roots.ts`, failed the audit's `[naming]` rule: three files would share the `press-` prefix. Using `scope-` avoids moving `press-again.ts` and `press-scope.ts` into a new directory.
- **`page-press-listener.ts`** `listenForChange` observes `pressScope(pressed)` as before, then calls `observer.observe(root, OBSERVED)` on each `scopeRoots(pressed, scope)`. Every root shares the one observer, so `flush`/`takeRecords` and `disconnect` cover them all. The header comment for the change sign now says so.
- **`index.ts`** (barrel) also exports `scopeRoots`.
- `click.ts` was not touched. It is not needed.
- **Tests**
  - New `tests/scope-roots.test.ts` has 7 rows, built on the extraction tests' `fake-shadow-dom.ts`, which is imported and not edited:
    - the Kerbfind shape (the scope is the aside, and the chip's root is watched);
    - nested roots, innermost first;
    - a closed root that was crossed;
    - open roots beside a light control, nested ones included;
    - a control that is itself a host;
    - a root found both ways is listed once;
    - no roots in scope, and a root outside the scope is never watched.
  - `tests/page-press-listener.test.ts`:
    - The fake nodes gained `shadowRoot`, `children` and a light-only `querySelectorAll`.
    - `fakePage` gained a `shadow` option: the row is a host, and the button sits at the top of its open root.
    - A new row asserts that the observed targets are `[section, root]`, all with the same init. It also asserts that nothing is reported before a mutation (a press that is truly ignored is still pressed again) and that `change` is reported after one.
  - The existing rows are unchanged and still assert one observed target when there is no root.
- Knock-on (Apply inside the widget), as w24 predicted: row 2 of the bikes spec, which presses Apply twice, still passes.

## Commands run and observed results

All were run from the tree root through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t194-w31 <what>" ...`. Final source, after the rename:

- `npx tsc -p apps/extension/tsconfig.json --noEmit`: exit 0, no output.
- `npx tsc -p apps/extension/tsconfig.test.json --noEmit`: exit 2. There are three errors, all TS2610 (`'ownerDocument' is defined as an accessor in class 'FakeElement'`), in these files:
  - `src/panel/extraction/tests/dialog-dom.ts(16,37)`
  - `src/panel/recording/review/tests/recording-review.test.ts(20,16)`
  - `src/panel/settings/tests/forget-confirmation.test.ts(17,16)`

  None of these files, and not `panel/chat/tests/fake-dom.ts`, is modified in `git status`, so the errors predate this work. No error is in ignored-press.
- Unit tests: `node <scratchpad>/t194w31-run-units.mjs apps/extension`.
  - The runner bundles only `src/content/action-runtime/ignored-press/tests/*.test.ts` and `src/content/actions/tests/*.test.ts`, with the same esbuild options as `scripts/test-extension.mjs` (`fluxiq` external). Output goes to `apps/extension/.test-build-scratch/t194-w31`, which is ignored.
  - Result: exit 0, `# tests 134`, `# pass 134`, `# fail 0`.
  - The runner installs `globalThis.window ??= { innerHeight: 800 }` before loading, as the full suite's earlier `content/action-runtime/tests/wrong-row-resolution.test.ts:37` does. Without it, `click`, `execute` and `page-identity` throw `ReferenceError: window is not defined` at load (`src/content/frame-geometry.ts:10`, a committed file). The first narrow run therefore stopped at 42 tests.
- **Old-source check.** I replaced the root-observing line in `page-press-listener.ts` with `void scopeRoots;` (then named `pressRoots`), ran the same runner, then restored the file (`grep -c` showed the line was back).
  - Result: exit 1, `# pass 133`, `# fail 1`. The failure was `not ok 8 - a press inside a shadow root: the root is observed beside the section, so a panel opened inside it is an answer`.
  - `scope-roots.test.ts` fails on the old source because its module does not exist at HEAD. `git cat-file -e HEAD:.../press-roots.ts` gave `fatal: ... exists on disk, but not in 'HEAD'`, and the module has the same contents under its new name.
- T2: `pnpm --filter @fluxiq-web-extension/extension test:content -- e2e/content/tests/live-tasks/tests/local-classifieds-bike-search.spec.ts e2e/content/tests/click.spec.ts e2e/content/tests/shadow-roots --reporter=list --output=e2e/test-results/t194-w31` finished with exit 1: `38 passed`, `5 failed`.
  - Bikes row 1 (`:227`, the radius chip): "Expected to fail, but passed." This is the proving row.
  - Bikes rows `:248` (literal read) and `:259` (scroll read): also "Expected to fail, but passed". These are GAP 2 paths in `content/extraction/`, which other workers are editing, not this change. `:259` still failed on my first run and passed on the second, as their edits landed.
  - Bikes row `:289` (retried batch): `Error: the detection proposes a title column ... Received: undefined`. This is extraction/detection, outside my files.
  - `shadow-root-controls.spec.ts:73` (consent buttons rank near the head): `Expected: < 15, Received: 37`. That row only reads the snapshot and never presses.
    - It failed 3 out of 3 with `--repeat-each=3`.
    - It failed identically (`Received: 37`) with `page-press-listener.ts` and `index.ts` restored to HEAD (`git show HEAD:...`). After that run both files were restored to my version, and `git diff --stat` showed my edits back.
    - So it is not caused by this change.
  - All 17 `click.spec.ts` rows and every other shadow-roots row passed.
- `node scripts/structure-audit.mjs`: exit 1 with 3 violations, all in `apps/extension/src/content/extraction/` and owned by other workers:
  - `extraction/` has 27 files, over the 25-file limit;
  - `extraction/tests/` has 28 files, over the 25-file limit;
  - `list-reader.ts` is 807 lines, over the 800-line limit.

  The `[naming]` violation my first filename caused is gone.

## Not verified

- No live Lab run (forbidden in this tree) and no manual browser check beyond the T2 harness.
- A shadow root attached after the press (`attachShadow` causes no mutation) is not watched. A root added inside the scope after the press is visible only as the host's insertion, which the scope's subtree observation already sees.
- Cost: `openRootsWithin(scope)` runs `querySelectorAll("*")` over the scope once per press, and the scope is at most a section, four levels up. I did not measure it on a large page.

## Open questions or contradictions found

- The bikes spec still carries `test.fail` on rows 1, 3 and 4, which now pass. The lead owns the spec and should drop the markers.
- `shadow-root-controls.spec.ts:73` fails at rank 37 regardless of this change. It is probably a consequence of other in-flight edits or a pre-existing regression; I did not investigate it.
- `extraction/tests/fake-shadow-dom.ts` is being modified by another worker. `scope-roots.test.ts` imports it and passed against its current contents.
