# Report: w2-check-assert

Worker: `w2-check-assert`. Brief: `### Brief: w2-check-assert` in
[briefs/wave-2.md](../briefs/wave-2.md), coding against the contract in
[reports/w2-foundation.md](./w2-foundation.md).

## Outcome

**Done.** Both verbs and both capability modules are implemented and proven by
12 new T2 specs, all passing. Extension `check`, extension `test` (label
`w2-check-assert`), my spec file, and the structure audit all pass.

One qualification on the full `test:content` gate: the whole suite fails, but
**every failure is in another worker's spec file** (`scroll.spec.ts`,
`upload-dialog.spec.ts`), reproduced across two consecutive runs, with my 12
passing in both. Detail in [Commands](#commands-run-and-observed-results).

## What changed and why

### 1. `content/action-runtime/checkable-state.ts` — the capability

`setCheckedState(element, checked)` sets the state asked for instead of
toggling, which is the whole reason `web.dom.check` exists apart from click: a
replayed click against a page whose state already moved leaves the control in
the opposite state to the recorded one.

- `checked` is **read back from the element after the events are dispatched**,
  so a handler that reverts the change is reported as the control's real state
  rather than as the state that was requested. That read-back is what the
  verb's validation compares.
- Events are `input` then `change`, both bubbling — what a real check fires, in
  order. Bubbling matters for this fixture: keyboard-forms listens for the
  radio `change` on the enclosing `<fieldset>`, not on the input.
- Three things are refused rather than faked, because each would otherwise
  report success while the page disagreed: a target that is not a checkbox or
  radio; a control a person could not operate (`:disabled` or `aria-disabled`);
  and **unchecking a radio**, which no user gesture can do — a group loses its
  selection only on form reset, so the request names the wrong control.
- Disabled is tested with `:disabled`, not the `disabled` property, because the
  property does not account for an ancestor `<fieldset disabled>`.
- The element is matched by `tagName`/`type` rather than `instanceof
  HTMLInputElement`, which a cross-realm node fails.

**Declared deviation from the published contract.** The foundation report
documents the failure arm as `{ ok: false; reason: string }`. I widened it to
`{ ok: false; reason: string; code?: "not-checkable" | "disabled" }` so the
verb can pick the right failure category without re-inspecting the DOM itself.
It is additive, and `CheckableStateOutcome` is consumed only by my verb — no
other Wave 2 brief touches it.

### 2. `content/actions/check.ts` — the verb

Resolves the target, scrolls it into view, sets the state, then validates.

A control that **could not be set is ACTION_REJECTED, not a failed
post-condition**: nothing was attempted on the page, so there is no observed
effect to compare against. `disabled` reuses the shared rejection code the
actionability gate uses; `not_checkable` covers a non-checkable target and the
radio-uncheck refusal. A control that *was* set but did not hold the requested
state is the other case — a failed validation, which `deps.success` turns into
`failed` with `output_not_observed`.

The element descriptor and snapshot are captured **after** the attempt, so the
evidence shows the state the page was left in.

### 3. `content/action-runtime/assertion-evaluation.ts` — the capability

`evaluateAssertion(request, target)` judges the six kinds, retrying until the
claim holds or the timeout passes (default 5 s; `timeoutMs: 0` is a single
immediate check, as the claim is always judged once before the loop).

- **The selector is re-queried on every attempt**, not resolved once. That is
  what makes a claim about a changing page meaningful: `exists` sees an element
  that arrives late, `absent` sees one that detaches. For a bare element with
  no selector, `isConnected` plays the same part.
- **Polling, not a `MutationObserver`** (which is what `waits.ts` uses). `url`
  and `visible` change with no mutation at all — a history navigation, a
  scroll, a CSS transition — so an observer would sleep through exactly the
  claims this module exists to judge.
- `text` reads a field's `value` for input/textarea/select and `innerText`
  otherwise, because `innerText` of an input is empty. With no target at all,
  `text` is a claim about the whole page, which is how "the page says X" reads.
- `visible`: a box with area, not `display:none`, `visibility:hidden`, or fully
  transparent. `enabled`: not `:disabled` and not `aria-disabled="true"`.
- `url` accepts an exact match **or a substring**, so a claim can name a path
  without the origin the Scenario Lab assigns at run time.

### 4. `content/actions/assert.ts` — the verb

The one verb whose post-condition is the *user's* claim rather than its own,
which is exactly why its category differs:

| Situation | Category | Code |
| --- | --- | --- |
| An authored assertion does not hold | `expected_state_missing` (**STATE_MISMATCH**) | `web.assert.<kind>` |
| An action ran but its effect never appeared | `output_not_observed` | (builder's) |
| A check could not run at all | `blocked_by_capability_or_policy` | `web.action.{disabled,not_checkable}` |

I used **Core's enum values**, not the plan's display names:
`STATE_MISMATCH` → `expected_state_missing`, per the mapping table in Core's
`core-failure-taxonomy.md`. The record is `retryable: true` (the category is
not in Core's never-retryable set, and its candidate kind is
`expectation_wait_retry`) at `stage: "verification"`.

Two implementation points worth recording:

- **The failure record is built from the bounded validation**, not from raw
  page text. `deps.success` builds the result first — bounding `expected` and
  `actual` to 1024 characters and never leaving them empty — and only then is
  the `output_not_observed` record replaced with the state-mismatch one, reusing
  the builder's bounded values. Core drops an unbounded record whole, so a long
  page text would otherwise lose the failure entirely.
- **A selector is handed over unresolved.** `deps.resolveTarget` throws when
  nothing matches, but `exists` and `absent` are precisely claims about whether
  anything matches. Without a selector the target resolves however the action
  names it (coordinates, visual bounds, fingerprint) and a miss yields an empty
  target the capability reports as "nothing matched" rather than a throw.
- **The verb body is wrapped in its own try/catch.** See
  [Open questions](#open-questions-or-contradictions-found) item 1: `execute.ts`
  returns this verb's promise without awaiting it, so a rejection would escape
  the catch that turns a throw into a failure result.

### 5. `e2e/content/tests/check-assert.spec.ts` — 12 T2 specs

On `keyboard-forms` (checkbox, radio group, hidden listbox, text field) and
`failure-surfaces` (disabled button, self-detaching button).

keyboard-forms drives every control through its server, so `finalState()` is an
oracle no page assertion can fake — the checkbox and radio rows pass only if
the fixture's own `change` handlers really fired. Specific rows worth naming:

- checking, unchecking, and **repeating a request the control already
  satisfies** — the row a click-based implementation could not pass (it would
  toggle); reports `Check state already set.` with a passed validation.
- a radio set and then **replayed**, still set.
- unchecking a radio, and checking a text field: both ACTION_REJECTED with
  `web.action.not_checkable`, and the group still holds its selection.
- a disabled control: `web.action.disabled`, left untouched. The fixture ships
  no disabled checkbox, so the spec disables a live one through
  `page.evaluate`, the same pattern `actions.spec.ts` uses for late DOM changes.
- a failed text claim: asserts the full expected/actual strings, the
  `expected_state_missing` record, **and** explicitly that the category is not
  `output_not_observed` — the distinction this verb exists to make.
- `visible` failing on the hidden listbox, then holding once the page shows it
  after 150 ms, and `absent` holding only after the target detaches: both prove
  the retry loop rather than a single read.
- a command with no `assert` parameters fails honestly instead of asserting
  nothing.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`. Every exit status captured by redirecting to
a file and echoing `$?`, never through a pipe.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | exit 0 |
| `EXTENSION_TEST_BUILD_LABEL=w2-check-assert pnpm --filter … extension test` | exit 0 — `# tests 80 / # pass 80 / # fail 0` |
| `pnpm --filter … test:content check-assert.spec.ts` | exit 0 — **`12 passed (4.7s)`** |
| `node scripts/structure-audit.mjs` (scratch index) | exit 0 — `passed (31 warning(s), 19 baselined)` |
| `pnpm --filter … test:content` (full, run 1) | exit 1 — `2 failed`, `67 passed`; my 12 all `ok` |
| `pnpm --filter … test:content` (full, run 2) | exit 1 — `5 failed`, `80 passed`; my 12 all `ok` |

**The full-suite failures are not mine, and I changed no file they touch.**
Reran once as the brief requires; the failures persisted and grew as other
workers landed specs mid-run:

```text
scroll.spec.ts:129  untilStable: loads every post…        "atBottom is not defined"
scroll.spec.ts:166  untilStable on the end-early variant
upload-dialog.spec.ts:27  upload: puts the file on the input…
upload-dialog.spec.ts:70  dialog: an armed dismiss…
upload-dialog.spec.ts:94  dialog: an armed accept…
```

`atBottom is not defined` is a `ReferenceError` from `w2-scroll`'s in-flight
`scroll.ts`. The suite grew from 69 to 85 tests between the two runs, which is
`w2-upload-dialog`'s specs arriving. Both files are on other workers' owns
lists.

**Structure audit.** Run with `GIT_INDEX_FILE` pointing at a *copy* of
`.git/index` in my scratch directory, so the new spec was visible to
`git ls-files` without my touching the shared index that twelve workers share.
`pnpm structure:baseline` was not run and no baseline entry was added or
changed. 31 warnings, 19 baselined — the same counts `w2-foundation` recorded,
and **no warning names any file of mine**. My only new file went into
`e2e/content/tests/` (3 files → 4, against a 15-file advisory threshold); I
added no file to `content/actions/` or `content/action-runtime/`, both of which
already carry a `directory-files` advisory.

**Content-bundle invariant preserved.** Every import in all four source files
is `import type` (`checkable-state.ts` has none at all), so nothing new enters
the content bundle at runtime. `expected_state_missing` is a string literal in
`assert.ts`, not a value imported from Core.

## Not verified

- **No live browser validation.** `test:content` runs the real content bundle
  in headless Chromium, but nothing loaded the unpacked extension in a headed
  browser, and no Lab run exercised these verbs (the brief forbids `pnpm lab`
  for me).
- **The state-mismatch record is never round-tripped through
  `parseAutomationStudioFailureRecord`.** Its shape satisfies Core's rules by
  inspection — `expected_state_missing` is not in the never-retryable set,
  `verification` is a valid stage, `web.assert.<kind>` matches the code pattern,
  and the texts are bounded by the shared builder — but no test parses it. A
  content module cannot be unit-tested in Node (`window is not defined`, see the
  foundation report's open question 4), and the verb is not a pure module, so
  the assertion would need a new pure module I do not own.
- **STATE_MISMATCH does not reach the gateway yet.**
  `gatewayActionResultFromBrowserResult` still drops `result.failure`; that is
  `w2-browser-actions`' fix. Today the record is built and dropped at the
  boundary, so it is proven only at the content-script reply.
- **Paths no spec exercises:** `aria-disabled` on a natively enabled control;
  `:disabled` inherited from an ancestor `<fieldset disabled>`; a `text`
  assertion with no selector (the whole-page claim); an assertion whose target
  comes from coordinates, visual bounds, or a fingerprint rather than a
  selector; and a validation long enough to hit the 1024-character bound.
- **Domain `check`/`test` not run** — I changed no domain file. **`pnpm build`
  not run**, per the brief. Root `pnpm check`/`test` not run.
- Whether the two scroll/upload-dialog failures resolve once those workers
  finish is **not something I verified**; I only established they are theirs.

## Open questions or contradictions found

1. **`execute.ts` does not await the async verbs — a rejection escapes the
   catch.** Its own header warns about this for the two waits ("a returned
   promise settles after the try block exits, and its rejection would escape the
   catch") and awaits them, but the five new verbs are dispatched with a bare
   `return`. Of those, `assert`, `extract-list`, `upload`, and `dialog` are or
   will be async. I defended `assert.ts` with an internal try/catch, but
   **`w2-extract-list` and `w2-upload-dialog` have the same latent hole** unless
   they did the same. `execute.ts` is `w2-foundation`'s file, so I did not
   change it; the clean fix is `return await` on those four lines, and the
   supervisor should make it once at integration.
2. **`CheckableStateOutcome` widened** with an optional `code`, as described
   above. Flagged because the foundation report is the published contract.
3. **Visibility and enabled logic now exists in two places.** My
   `assertion-evaluation.ts` judges visible/enabled for an authored claim;
   `w2-click`'s `actionability.ts` judges them as a gate before acting, plus a
   hit-test. The responsibilities genuinely differ (a claim versus a gate), but
   the predicates are near-identical and are a consolidation candidate once both
   have landed.
4. **The default assertion timeout (5 s) is mine, not the contract's.** The
   contract says assert takes "a timeout" without naming a default. 5 s is long
   enough for a page to settle after the preceding action and short enough that
   a wrong claim fails fast, but it is a decision worth confirming.
5. **`url` assertion semantics are substring-or-exact.** Chosen so a claim can
   name a path without the Lab's run-time origin. If the product wants strict
   equality, it is a one-line change plus one spec row.
6. **Refusing to uncheck a radio is a product decision.** It is what a user can
   do, and setting `checked = false` directly would leave a group with no
   selection and fire no `change`, reporting success while the page's state
   handler never ran. If a Flow must clear a group, it needs a different verb
   (a form reset), not a looser `web.dom.check`.
