# Report: w2i-actionability

Worker: `w2i-actionability`. Wave 2 integration, closing the gap the wave
exposed between [reports/w2-click.md](./w2-click.md) (which implemented
`checkActionability`) and [reports/w2-select.md](./w2-select.md) and
[reports/w2-keyboard-input.md](./w2-keyboard-input.md) (which were written
while that capability still threw).

## Outcome

**Done.** The select, type, clear and keypress verbs now consult the
actionability capability and refuse a target that cannot be acted on with the
code the capability reports, and a disabled `<option>` is no longer selectable.
Six new spec rows prove it against live pages. Extension `check`, `test` and
`test:content` all pass, and the structure audit is clean.

No file outside my owns list was touched. No commit, no push, no `pnpm build`,
no `pnpm lab`.

## What changed and why

### The gate, in four verbs

Each verb now does what `click.ts` does: resolve the target, then
`deps.checkActionability(element)`, and on a refusal return
`deps.rejected(action, startedAt, report.code, <what was needed>, report.detail,
evidence())`. The code is the capability's own — `disabled`, `hidden`,
`covered` — so the result carries `web.action.<code>` under Core's
`blocked_by_capability_or_policy`, not retryable, rather than the
`output_not_observed` these verbs used to report after acting on a target
nobody could have reached.

| File | `expected` phrase in the refusal |
| --- | --- |
| `content/actions/select.ts` | "a target that can be selected in" |
| `content/actions/type.ts` | "a target that can be typed into" |
| `content/actions/clear.ts` | "a target that can be cleared" |
| `content/actions/keypress.ts` | "a target that can receive the key press" |

The gate runs immediately after `resolveTarget`, ahead of each verb's own
shape checks (`holdsText`, the `HTMLSelectElement` test, the input/textarea
test), matching `click.ts`. So a disabled `<div>` now reports `disabled`
rather than "the target holds no typed text": both are honest, and the gate's
answer is the more fundamental one. No existing row asserted the other order —
every shape-check row in `actions.spec.ts`, `select.spec.ts` and
`resolve-target.spec.ts` targets a visible, enabled element, so all of them
still pass unchanged.

**`keypress` gates only a named target.** Its target is
`action.selector ? resolveTarget(action) : document.activeElement ?? document.body`.
I gate the first branch only. With no selector the key goes wherever focus
already is: the command named nothing to refuse, the browser's own focus rules
already keep a disabled element from holding focus, and gating the fallback
would mean judging `document.body` — whose hit test is meaningless and which a
page with only absolutely-positioned content could make "hidden". This is a
decision, not an oversight; it is in the file's header comment and in Open
questions below.

### A disabled `<option>` (select.ts)

`findOption` still matches by value, label, or index; a matched option that is
`:disabled` is now refused:

```
Action rejected: the option "team" (Team) is disabled
```

code `disabled`, `expected` `a selectable option matching label "Team"`.

**Why not through `checkActionability`.** An `<option>` in a closed `<select>`
has no box, so the capability's visibility check would refuse it as `hidden`
before ever reaching its disabled check — the wrong reason, and it would scroll
as a side effect. The check is therefore `option.matches(":disabled")` in the
verb, deliberately reporting the same `disabled` code so a caller reads one
vocabulary. `:disabled` rather than the `disabled` property because the
property reflects only the option's own attribute, while the selector also
catches an option inside a disabled `<optgroup>`. I did not touch
`actionability.ts`, which the brief forbids; if that capability ever learns
about options, this check should move into it.

`w2-select`'s open question 1 ("a disabled option is still selectable,
deliberately … it should be decided together with the actionability gate") is
answered by this.

### Spec rows (6 new, all passing)

`e2e/content/tests/select.spec.ts`, on `basic-form`:

1. a disabled select → `web.action.disabled`, `stage: "execution"`,
   `retryable: false`, and the select still holds `starter`;
2. a `display: none` select → `web.action.hidden` with the capability's own
   detail ("the element's display is none"), which proves the code is read from
   the report rather than hardcoded per verb;
3. a disabled option → rejected, **and then** an enabled option in the same
   select is chosen successfully. That control matters: without it the row
   could not tell a working refusal from one that refuses everything.

`e2e/content/tests/keyboard.spec.ts`, on `basic-form` (one row per verb the
brief names):

4. `type` into a disabled field → rejected, **and not one key event reached the
   element** (the row watches `keydown`/`beforeinput`/`input`/`keyup`/`change`
   and asserts the trace is empty), where the ungated verb dispatched the whole
   key sequence and then reported `output_not_observed`;
5. `clear` on a disabled field → rejected, and the field keeps `"draft"`;
6. `keypress` Enter on a disabled field → rejected, no key dispatched, the
   fixture still reads "Not submitted" and its state is
   `{ submitted: false, submissionCount: 0 }` — so the Enter that used to reach
   `requestSubmit` cannot submit a form the keyboard never reached.

One constant (`RESULT`) was added to `keyboard.spec.ts`'s constant block for
row 6. `actions.spec.ts` needed **no** change and was not touched.

## Commands run and observed results

From `F:\!FluxIQWebExtension`, `EXTENSION_TEST_BUILD_LABEL=w2i-actionability`
on both test commands. Every exit status captured by redirecting to a file and
echoing `$?`, never through a pipe. No heredocs. No `pnpm build`, no `pnpm lab`,
no `pnpm structure:baseline`.

| Command | Observed |
| --- | --- |
| `pnpm --filter …/extension check` (1st) | exit 2 — 3 errors, all `src/background/connection/browser-state.ts` importing `UNSUPPORTED_BROWSER_PAGE_REASON`, `UNSUPPORTED_STORE_PAGE_REASON`, `unsupportedAutomationPageReason` from `../../runtime` |
| `pnpm --filter …/extension check` (rerun) | **exit 0**, clean |
| `pnpm --filter …/extension test` | **exit 0** — `# tests 122 / # pass 122 / # fail 0` |
| `pnpm --filter …/extension test:content` | **exit 0** — **`123 passed (14.0s)`**, 0 failed, 0 flaky |
| `node scripts/structure-audit.mjs` (scratch git index) | **exit 0** — `structure-audit: passed (32 warning(s), 19 baselined)` |

**The first `check` failure was a parallel edit and cleared on the single
rerun**, as the brief predicted. Neither file is mine and nothing in
`content/actions/` is reachable from them: `background/connection/browser-state.ts`
and the `runtime/` barrel it imports belong to `w2-browser-actions`, which was
evidently mid-edit. No error in any run named a file I own.

All six new rows are `ok` in the `test:content` log, by name:
`select.spec.ts:145`, `:158`, `:171`; `keyboard.spec.ts:211`, `:228`, `:242`.
The only line in that log matching "failed" is the *name* of an existing waits
row ("reports timed_out, not failed"). The previous full-suite count recorded in
this wave was 117 passed (`w2-keyboard-input`); 117 + 6 = 123, so no
pre-existing row was lost or silently skipped.

**The audit was run through a scratch index.** `select.spec.ts` and
`keyboard.spec.ts` are still **untracked** (their authoring workers' files are
uncommitted), and the audit reads only tracked files, so a plain run would not
have seen them at all. `.git/index` was copied into my scratchpad,
`GIT_INDEX_FILE` pointed at the copy, both specs added with `git add -N`, and
`git ls-files --cached` confirmed the audit could see them. The repository's own
index was never written. No warning names any file of mine; the single
`content/actions/` line is the pre-existing 18-file directory advisory, which I
neither caused nor raised, having added no file. The count differs from the 31
earlier Wave 2 workers saw — the new warning is in another worker's area, not
mine, and nothing was baselined.

## Not verified

- **No live browser validation.** `test:content` runs the real content bundle
  in headless Chromium against live Scenario Lab fixtures, which is where these
  behaviours are decidable, but nothing loaded the unpacked extension in a
  headed browser. Per the brief I ran no `pnpm lab` command, so none of this was
  exercised through the background worker, the gateway, or a Flow.
- **`pnpm build` was not run** (forbidden for parallel workers), so the tracked
  `build/` directory does not contain this change. The supervisor's integration
  build is the first time it will.
- **Root `pnpm check` / `pnpm test` and the domain package were not run.** I
  changed no domain file.
- **Only `disabled` and `hidden` are exercised for these four verbs.** The
  `covered` branch is wired identically (the code comes from the report, which
  row 2 proves) but no new row covers a field under an overlay; `click.spec.ts`
  covers `covered` for click. Likewise untested through these verbs:
  `aria-disabled` on the element or an ancestor, `inert`, `opacity: 0`, the
  zero-size box, and the clamped hit point.
- **The ungated `keypress` fallback has no row.** No spec sends a keypress
  without a selector, before or after my change, so the decision above is
  reasoned from the focus rules, not observed.
- **The scroll side effect is not asserted.** `checkActionability` scrolls the
  target into view, so `type`, `clear` and `select` now scroll before acting
  where they did not before. Every existing row still passes, but no row asserts
  the new scroll position for these three verbs.
- **Firefox:** not run; the content config is Chromium only.

## Open questions or contradictions found

1. **`hidden` is stricter than "typeable" for a field the user cannot see.**
   The capability reports `hidden` when no part of the element is in the
   viewport even after scrolling, so a field parked off-screen
   (`left: -9999px`) as an input proxy behind a custom widget is now refused
   for `type`/`clear` rather than filled. That is the brief's instruction
   ("reject with the code the capability reports") and it is honest about what
   a person could do, but it is a product judgment worth the supervisor's
   confirmation: no fixture exercises it today, and a real corpus site using
   that pattern would newly fail. Narrowing it would mean a "focusable" gate
   distinct from the "clickable" one, i.e. a change to `actionability.ts`,
   which this brief forbids.
2. **The `keypress` fallback is deliberately ungated** (see above). If the
   supervisor wants the implicit target gated too, it is a two-line change, but
   it makes `document.body`'s hit test load-bearing for every selector-less key
   press and I would not recommend it without a fixture that pins the
   behaviour.
3. **The disabled-option refusal lives in the verb, not the capability.** Same
   code vocabulary, different home, for the box-less-`<option>` reason given
   above. If a later wave extends `checkActionability` to elements that have no
   box but do have an enabled state, this check should move there so the two
   cannot disagree.
4. **`git diff --stat` does not attribute this change cleanly.** The four verb
   files also carry `w2-select`'s and `w2-keyboard-input`'s uncommitted
   rewrites, so the stat against `HEAD` (259 insertions) is the three workers'
   combined work, not mine. Mine is the gate block in each verb, the
   disabled-option block, and the two header comments.
5. **Three documents are staged in the shared index** by another agent:
   `docs/working/README.md`, `docs/working/mvp-week1-web-automation-reliability-plan.md`,
   and that plan's `open-questions.md`. I staged nothing and touched none of
   them — my audit used a copy of `.git/index` in my scratchpad — but the
   supervisor should know the real index is not empty before committing.
