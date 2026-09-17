# w2-xpath-id-anchor: the xpath fallback's id anchor and its string quoting

Source: `w2-extension-selectors-and-bundle-guard.md`, open question 1.
Repository at `5e583ef` (dev). Nothing committed.

## Outcome

**Done.** Both defects in `apps/extension/src/content/element-finder.ts` are
fixed, the spec's compensation is gone, and the xpath fallback now resolves for
elements carrying an id or sitting under one. The behaviour change was measured
rather than assumed: on the `product-catalog` fixture, **18 of 94 described
elements carry an id-anchored xpath; all 18 now resolve to the element they
name, and 0 of them resolved in the form they used to be written in**. No test
outcome anywhere in the content suite changed -- all 290 pass.

**Follow-up, at the supervisor's direction: a stored xpath is now checked before
it is evaluated**, so a recording made before this fix can no longer throw out
of target resolution. Done as a value check rather than a `try`/`catch`, so the
ratcheted `failure-as-empty` baseline of 1 for this file is untouched. Counts
after the follow-up: **662 unit tests pass** (was 658) and **27 pass across the
three named specs** (was 26).

## What changed and why

**1. The anchor is now a descendant step.** `xpathFor` wrote
`/*[@id="x"]/...`, whose leading single slash makes the step absolute: XPath
reads it as "the document element, if its id is x", which is `<html>` and
practically never the recorded element. Every such path resolved to nothing, so
`findClosestFingerprint`'s xpath fallback silently never answered for an element
with an id or with one above it -- no error, no miss, a strategy that was simply
never able to reply. The walk now records whether it stopped on an id and
prefixes `//` when it did; with no id anywhere the path stays absolute from the
root, which is the one shape the single slash was right for.

**2. A string literal is delimited, never escaped.** `xpathString` escaped a
double quote as `\"`. XPath 1.0 literals have no escape sequence at all, so
`"say\"hi"` was not a mis-quoted string but a syntax error -- and
`document.evaluate` *throws* on one of those rather than missing. The literal is
now delimited by the quote the value does not contain, and built with `concat()`
when it contains both.

This matters beyond the fallback: `findClosestFingerprint` calls
`document.evaluate` with no `try` around it (`element-finder.ts:17`), so a page
whose author put a double quote in an id made a replay throw out of target
resolution instead of missing the xpath and carrying on. See the open question.

**3. The spec now checks the real output.** `unique-selectors.spec.ts` rewrote
an id-anchored xpath to `//` before evaluating it, which meant its xpath oracle
was reading a string the product never produced, and for every id-bearing
element it silently fell back to geometry alone. The rewrite is removed and the
recorded string is evaluated untouched. `identity.spec.ts` and
`identity-veto.spec.ts` carried no such compensation and needed no edit.

**4. Tests.** `src/content/tests/element-finder.test.ts` (new) pins the exact
text for all six shapes the brief named: id on the element, id on an ancestor,
no id at all, an id holding each quote kind, and both together. The unit runner
is Node with the hand-built stub page and has no `document.evaluate`, so
resolution is proven in Chromium instead: a new row in `unique-selectors.spec.ts`
builds those same shapes through the DOM API and asserts each recorded xpath
resolves to exactly one node and that it is the element it was written for. A
second new row takes the before/after measurement quoted above on a real
fixture page. `stub-page.ts` gained the two members `xpathFor` reads -- `id`
(the DOM's empty string when absent) and `children` -- rather than a second page
stub being added beside it.

**5. A stored xpath is checked before it is evaluated** (the follow-up).
`findClosestFingerprint` called `document.evaluate` with whatever the recording
carried. For a recording made before this fix whose id held a double quote, that
string is `/*[@id="say\"hi"]` -- not a mis-quoted expression but a syntax error,
and an XPath engine *throws* on one. The throw left `findClosestFingerprint`,
left `resolveTarget`, and failed the action, so the id, test id, name and
class-set lookups below it never ran: strictly worse than the strategy finding
nothing. `isReadableXpath` now answers one question before the value is handed
over -- does a literal try to escape its own delimiter -- and an xpath that
fails it is treated as a strategy with nothing to offer, leaving the rest of the
resolution to run.

It is a value check, not a `try`/`catch`: turning the failure into an empty
answer would have needed the `failure-as-empty` baseline of 1 for this file
raised, which is not a worker's call. It walks the expression the way XPath
lexes one -- a literal runs to the next matching quote, with no escape
processing -- rather than testing for `\"` anywhere, because a backslash is an
ordinary character in an id and `//*[@id='a\"b']` is a path that must still be
used. Chromium agrees on all three: the stored form throws, and both written
forms evaluate.

Files changed, all of them mine: `src/content/element-finder.ts`,
`src/content/tests/element-finder.test.ts` (new), `src/content/tests/stub-page.ts`,
`e2e/content/tests/unique-selectors.spec.ts`.

## Commands run and observed results

| Command | Result |
| --- | --- |
| `node scripts/test-extension.mjs` (before the fix) | `# tests 658 / # pass 653 / # fail 5`. The five new rows failed with `+ '/*[@id="save-settings"]' - '//*[@id="save-settings"]'` and `+ '/*[@id="say\\"hi"]'`; the no-id row already passed. |
| `node scripts/test-extension.mjs` (after) | `# tests 658 / # pass 658 / # fail 0`, exit 0. |
| `node scripts/test-extension.mjs` (after the follow-up) | `# tests 662 / # pass 662 / # fail 0`, exit 0. The four new rows: the old escaped form is never evaluated and resolution falls through to the id; an unterminated literal is refused the same way; a well-formed xpath is still evaluated and still answers ahead of the id; and everything the writer now emits is still handed over, including `//*[@id='a\"b']`. |
| `pnpm --filter @fluxiq-web-extension/extension test:content -- unique-selectors.spec.ts identity.spec.ts identity-veto.spec.ts` | `26 passed (8.2s)`, then `27 passed (10.0s)` after the follow-up. Exit 0 both times. The added row is the guard's premise in a real engine: `{ stored: "threw", written: "evaluated", backslash: "evaluated" }`. |
| `pnpm --filter @fluxiq-web-extension/extension test:content` (whole suite) | `290 passed (55.3s)`, exit 0. |
| Measurement, from the run's JSON annotations | `product-catalog: 18 of 94 described elements carry an id-anchored xpath; 18 resolve as recorded, 0 resolved in the old single-slash form`. |
| `pnpm --filter @fluxiq-web-extension/extension check` | **exit 1**, but every error is in `domain/src/runtime/llm-evidence/target-equivalence.ts`, an untracked file from another worker's in-flight edit. Zero errors under `apps/extension`, and the browser-bundle guard printed no bundle failure. `tsconfig.test.json` covers `src/**/*.ts` and `e2e/**/*.ts`, so my new test and spec edits were type-checked. |
| `pnpm --filter @fluxiq-web-extension/extension build` | **exit 2**, stopped at the same domain type errors before `build-extension.mjs` ran. |
| `FLUXIQ_LAB_EXTENSION_BUILD_ROOT=apps/extension/.lab-instances/xpath-w1 node apps/extension/scripts/build-extension.mjs` | exit 0, every entry bundled. Run into the ignored instance directory deliberately (see below), and the fix is in the output: `anchored ? "//" : "/"` appears in the content bundle. Directory removed afterwards. |
| `node scripts/structure-audit.mjs` (after the follow-up) | `1 violation(s) across 1 rule(s)`, exit 1 -- `[working-docs] docs/working/README.md is out of date with the documents' header blocks`, which is this report being new and is the supervisor's `pnpm structure:baseline` to run. No finding on any file I own, and the guard drew none: it is a value check, so the `failure-as-empty` count for `element-finder.ts` is still the baselined 1. |
| `pnpm --filter @fluxiq-web-extension/extension check` (after the follow-up) | **exit 1**, and the red has *moved*: the domain errors cleared (that worker finished) and `src/shared/tests/present.test.ts` now fails two `TS2345`s because another worker has `apps/extension/src/shared/protocol.ts` open and is adding a field to `DomElementContext`. Neither file is mine and I have touched neither. No error named any file I own, in this run or any earlier one. |
| `node scripts/structure-audit.mjs` (before the follow-up) | Ran three times, and the verdict moved each time because other workers were editing: **FAIL** on `domain/src/runtime/llm-evidence/tests/target-equivalence.test.ts` before I changed anything, then `passed (61 warning(s), 122 baselined)` exit 0 with my change in place, then **FAIL with 13 violations across 2 rules**. **No finding, in any of the three runs, on any file I own.** The 13 are six `failure-as-empty` and five `imports` findings inside `domain/.check-isolate-w2rto/` -- a scratch copy of `domain/src` another worker created inside the repository, which the audit walks like real source -- plus `packages/test-runner/src/flow-lane/repair/{apply,replay}-repair.ts` and `run-scenario.ts`. |

**`apps/extension/build/` was not changed by me.** `apps/extension/build/content/index.js`
is `ea95c707d32cf87606989bcf4dbbb6d6` before and after my work. It was already
modified in the working tree when I started, by someone else. The package build
never reached its write step, and I deliberately pointed the bundler at the
ignored `.lab-instances/` root instead of running the default build: refreshing
the tracked directory now would have baked another worker's half-finished domain
edits into it.

## The behaviour change, stated precisely

The fallback can now rescue a replay for any element whose recording anchored on
an id -- 18 of 94 described elements on the catalog fixture, where before the
count was 0. **No test outcome changed:** all 290 content tests pass, including
the four identity-veto rows and all thirteen identity rows.

Anything the fallback now returns is still gated. The xpath lives inside
`findClosestFingerprint`, which feeds the `fingerprint` strategy, and
`resolve-target.ts:224` runs `vetoExactMatch` on that strategy's single answer
before it is acted on, demoting a refused match to a miss. There is no path by
which a newly-resolving xpath reaches an action without passing the veto.

One assertion changed meaning without changing result, and it is worth knowing.
`identity-veto.spec.ts:210-214` asserts the recorded xpath no longer matches
after the page is restructured. That row removes the Save button's own id and
test id, but the button sits inside `<form id="settings-form">`, so its xpath is
anchored on the form -- which means the assertion used to be **vacuously true**:
the path could not have resolved whatever the page did. It now evaluates a path
that could resolve, and still reports `false` because the recorded steps below
the anchor no longer lead anywhere. The row is load-bearing now; it was not
before.

## Does any persisted recording actually carry an old-form quoted-id xpath?

**No. The guard is purely defensive in this repository.** Every stored xpath I
can find here is structural, none is id-anchored, and none carries the escape:

| Where | Stored xpath values | Old-form escape | Id-anchored |
| --- | --- | --- | --- |
| `.fluxiq/artifacts/automation-studio/projects/.../objects/` (102 JSON files) | 633 | 0 | 0 |
| `test-runs/` run evidence | 429 | 0 | 0 |
| Tracked fixtures, specs and JSON | 0 | 0 | 0 |

All 1,062 are of the shape `/html[1]/body[1]/...`. Nor could the Lab produce a
quoted id to record: no fixture id contains a quote (685 `id=` occurrences, none
with `&quot;` or `&#39;`), and `identifier-policy/apply.ts` only rewrites ids
matching `^[A-Za-z][\w.:-]*$`, which excludes one. The hazard is a real page --
a quote is legal in an HTML id -- and any recording captured against one before
today, none of which exist here.

Two things worth noticing in that table. Not one persisted xpath is id-anchored,
so **nothing already recorded gains anything from the anchor fix**; the 18-of-94
improvement is in what is captured from now on. And because none carries the
escape, the guard's protection cannot be demonstrated on stored data here --
which is exactly why its premise is pinned in Chromium instead.

**A correction about method.** I first searched these directories with
`timeout 240 rg ...` and reported no matches. That was wrong: `rg` is not on
PATH when spawned through `timeout`, so the command failed with "No such file or
directory", `2>/dev/null` hid it and `| head` masked the exit code -- the search
never ran. The numbers above are from `grep -r`, cross-checked against a single
file read directly. Any search in this repository whose emptiness matters should
be confirmed to have actually executed.

## Not verified

- **The full `pnpm check`, `pnpm test` and `pnpm build`.** Red throughout on
  other workers' uncommitted edits, which I must not touch -- first
  `domain/src/runtime/llm-evidence/`, then, once that cleared,
  `apps/extension/src/shared/protocol.ts` and the `present.test.ts` rows that
  read it. What I can say is bounded but consistent: across every run, no error
  named a file I own.
- **The guard against a real stored recording.** No persisted xpath in this
  repository carries the old escape, so the fall-through is proven by the unit
  rows (the expression never reaches `evaluate`) plus Chromium confirming that
  expression throws -- not by replaying a genuine pre-fix recording end to end.
- **A real browser with the extension loaded.** Everything here is the content
  harness (headless Chromium, content bundle, no extension loaded) plus the Node
  unit runner. A replay actually rescued by the repaired fallback on a live page
  has not been observed; the veto interaction above is read off the code, not
  measured on a live run.
- **Recordings already persisted.** The fix changes what is *written* from now
  on; nothing rewrites what is stored. Searched and quantified above.
- The 18/94 measurement is one fixture page, taken once. Other pages will differ
  with how liberally their authors use ids.

## Open questions or contradictions found

1. ~~`document.evaluate` is still called unguarded~~ -- **closed** by the
   follow-up above, as a value check rather than a swallow, so the
   `failure-as-empty` baseline stayed at 1. No stored recording here carries the
   shape it guards against (see the table above), so it is protection for real
   pages, not a fix to anything currently in the tree.
2. **An xpath recorded before this change keeps the form it was written in, and
   nothing migrates it.** Answered for this repository by the table above: all
   1,062 stored values are structural and therefore unaffected -- none was
   id-anchored, so none was broken and none needs re-recording. A recording made
   elsewhere against a page whose elements carry ids is the case that would
   still be stale, and it would have to be re-recorded to benefit. Whether any
   such recording exists outside this checkout is Core's side.
3. **A worker's scratch directory is making the shared gate red for everyone.**
   `domain/.check-isolate-w2rto/` is a copy of `domain/src` sitting inside the
   repository while I worked, and `scripts/structure-audit.mjs` walks it as if
   it were source, so it contributed eleven of the thirteen violations in my
   last audit run. Whatever created it should put it outside the repository or
   under an ignored, audit-excluded path; otherwise every concurrent worker
   reads a red gate it did not cause and cannot fix.
4. **The advisory `directory-files` warning on `apps/extension/e2e/content/tests/`
   is at 24 files against a threshold of 15.** I added no file there (both new
   rows went into the existing spec), but the directory is over budget and a
   future worker adding a spec will push it further.
