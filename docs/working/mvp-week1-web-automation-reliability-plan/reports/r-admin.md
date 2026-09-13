# r-admin — the `admin-console` fixture, and what it breaks

## Outcome

**Done.** A new Scenario Lab fixture, `admin-console`, is registered, typed,
unit-tested and covered by its own Playwright spec. Everything the brief asked
for is on the page: a virtualised customer list, a control inside an open shadow
root, routing that changes the URL with no navigation, inline editing that
destroys the element it was recorded against, hashed class names, and a region
where fifteen controls share one accessible name.

The fixture behaves as designed, and **three product defects fall out of it**.
None of them is fixed. Each is reproduced by a passing assertion in
`apps/scenario-lab/e2e/admin-console.spec.ts` that says, in a comment, that it is
pinning a defect rather than the intended behaviour.

---

## The findings, ranked by consequence

### 1. Extraction over a virtualised list silently returns the render window (silent)

This is the worst one, because nothing reports a problem.

`extractRecords` (`packages/test-runner/src/scenario-steps/extract-records.ts:47`)
resolves an extract step's items with `locateTarget(scope, target).all()` — a
document query. On a virtualised list the document holds only the mounted rows.

Measured on the fixture at rest: **15 rows in the document, 240 in the book.**
The step succeeds, the records it returns are individually correct, and the run
has no way to distinguish "the list had 15 customers" from "the list had 240 and
we read 6% of them".

The manifest's `extract-customer-list` workflow deliberately declares the correct
answer — `count: 240`, with all 240 expected records built from the book — so the
expectation is unmet today and will stay unmet until something changes. Its
`short-book` variant is the control: twelve customers, all mounted, and the same
step returns all twelve and matches the declared records exactly. Same page, same
step, same selector; the only variable is whether the rows are in the DOM.

Spec: `extraction over the virtualised list silently returns the render window
instead of the book` and `the same extraction returns the whole book when the
book fits the window`.

A Flow built from a recording of this page would report a successful extraction
of a customer book and be wrong by a factor of sixteen.

### 2. An open shadow root is invisible to the resolver, and the point strategy answers the host

The plan records shadow DOM as "recorded but not replayable". The first half is
right and the second half is imprecise in a way that matters.

**Recording works.** `eventTargetElement`
(`apps/extension/src/content/event-elements.ts:38`) reads `event.composedPath()[0]`,
so a click inside the shadow tree is recorded against the *inner* button, not the
host. `selectorFor` (`apps/extension/src/content/describe-element.ts:104`) then
records `[data-testid="digest-toggle"]`, and actionability's `topmostAt`
(`action-runtime/actionability.ts:118`) descends shadow roots, so the hit test
would pass too.

**Resolution cannot see it.** Every exact strategy is a document query:
- `resolve-target.ts:545` — the selector strategy is `document.querySelectorAll`;
- `element-finder.ts:62` — the fingerprint's selector/testId lookups are `document.querySelector`;
- `element-finder.ts:40` — its text fallback scans `document.querySelectorAll(tag)`;
- `identity/candidates.ts:142` — scored-candidate recovery enumerates `root.querySelectorAll(...)` with `root = document`.

None of these crosses a shadow boundary. Measured in the page:

```
document.querySelectorAll('[data-testid="digest-toggle"]').length   -> 0
host.shadowRoot.querySelectorAll('[data-testid="digest-toggle"]')   -> 1
document.elementFromPoint(centre of the control).tagName            -> "FX-TOGGLE"
[...document.querySelectorAll(CANDIDATE_SELECTOR)] test ids         -> does not contain "digest-toggle"
```

The third line is the dangerous one. `elementsAtPoint`
(`resolve-target.ts:554`) is `document.elementFromPoint`, which answers the
**host** — a real, connected, visible element standing exactly where the recorded
control was. `gatedPool` rejects it on the tag mismatch (`fx-toggle` vs `button`)
but then returns the ungated matches anyway, because "a strategy that found
exactly one element has resolved it". So the host reaches `vetoExactMatch` as a
single candidate. Whether it is refused decides between two very different
outcomes, and I could not determine which without running the extension:

- **veto refuses** → the strategies fall through, scoring over light-DOM
  candidates finds nothing plausible, and the run fails `target_not_found`. Bad
  but honest.
- **veto accepts** → the click lands on `<fx-toggle>`, which has no listener of
  its own, so the action reports success and nothing happens. That is
  `output_not_observed` reported as a success.

The `light-dom-toggle` variant is the control: the same test id, the same
`switch` role, the same accessible name ("Weekly digest email"), rendered as an
ordinary button in the light DOM. Measured there: `document.querySelectorAll`
returns 1, `fx-toggle` count 0, and the click works. Nothing else about the page
differs, so a run that passes on the variant and fails on the baseline has
isolated the shadow boundary and nothing else.

Also worth noting because it hides the problem: **Playwright's engine pierces open
shadow roots.** The recording lane's `locateTarget` and the runner's page-fact
probe (`scenario-assertions.ts` `firstSubjectLocator`) both find the switch
happily. So a recording lane will record this step, a page fact about the switch
will pass, and only replay through the extension will fail. The harness cannot
see the defect it is measuring.

Spec: `the shadow-rooted switch is reachable by the test engine and invisible to
a document query`, and `the light-DOM control is the same switch and a document
query does find it`.

### 3. The scroll verb cannot move a scroll container that is not the document (visible)

`step-runner.ts:82`: `case "scroll": await page.mouse.wheel(0, Number(step.value ?? 500))`.
Nothing moves the pointer first, so the wheel is delivered at (0, 0) — the top-left
corner, which in this console is the header bar.

The console is built the way consoles are built: the shell is exactly the
viewport's height and does not scroll, and the customer list scrolls inside its
own pane. Measured:

```
page.mouse.wheel(0, 5500)      ->  window.scrollY 0
                                   document.documentElement.scrollHeight <= innerHeight  true
                                   list-viewport.scrollTop 0
                                   row CUS-0128 still not mounted
page.mouse.move(into the list) ->
page.mouse.wheel(0, 5500)      ->  list-viewport.scrollTop > 0, the mounted band moves
```

The identical wheel works once the pointer is over the pane, which identifies the
cause exactly: the verb never positions the pointer. The fixture's
`browse-to-customer` workflow declares this scroll step and the state it should
reach; that expectation is unmet today.

This is visible rather than silent, but only just: the step itself does not fail.
It is the `waitForState` after it that times out, so the failure is attributed to
a missing element rather than to a scroll that went nowhere.

Spec: `the scroll verb cannot move a list that scrolls inside its own pane`.

### 4. The recorded element is gone — the shape now exists to test against

Nothing in this repository had met a list where the recorded element ceases to
exist. It does now, and the fixture's own behaviour is pinned:

- 15 of 240 rows mounted at rest (`ceil(480 / 44) + 4`, from the geometry in
  `styles.ts`);
- scrolling the pane to 5,500px mounts rows 122–140 and **removes** rows 1–15
  from the document — not hidden, not detached-but-findable, absent;
- rows still inside the band keep their element, the way a keyed virtualiser
  reuses nodes, so the churn a recording meets is the real one.

What the extension does with a recorded row that no longer exists is untested
here (see *Not verified*). The interesting question is whether scored-candidate
recovery picks a *different customer's row* — every row is the same shape with
different text, which is close to the worst case for a fuzzy matcher, and picking
the wrong one would be silent.

### 5. A route change with no navigation

Selecting a customer calls `history.pushState`; switching a settings tab calls
`history.replaceState`. Measured: the URL changes, a page-lifetime token survives,
and `performance.getEntriesByType("navigation").length` stays at 1 across both.
Reloading the same URL wipes the token, which is the difference the fixture
exists to expose.

I did not run the extension against this, but reading the two sides:
`chrome.webNavigation.onHistoryStateUpdated` **is** listened to
(`apps/extension/src/background/index.ts:65`), so a soft route change does reach
the navigation recorder — and `NavigationRecorder.shouldRecord` then suppresses
it, because `EXPLANATORY_ACTION_WINDOW_MS` drops any navigation within 5s of a
click. So the row click is recorded and the route change is not, which is
probably the right answer here. The case that is *not* covered by that window is
a route change with no preceding click; this fixture does not currently produce
one.

### 6. What a realistic page costs — three bugs in my own fixture, found and fixed

Worth recording, because the brief's premise is that the existing fixtures are
too simple to find anything. Building a page that behaves like a real one
surfaced three defects in a few hundred lines:

- **Blur re-entrancy.** Committing an inline edit on Enter replaces the input;
  Chromium fires `blur` *synchronously during the replacement*, with the element
  still `isConnected`, so the blur handler re-entered the commit that removed it
  and the outer `replaceChildren` threw `The node to be removed is no longer a
  child of this node`. An `isConnected` guard is not enough; a settled flag is.
  Symptom before the fix: Escape committed the typed value and Enter did not.
- **`[hidden]` loses to an explicit `display`.** The settings screen stacked
  under the customer screen instead of replacing it, because `.split` sets
  `display: grid` and the UA's `[hidden] { display: none }` is weaker. Only
  visible in a screenshot; every assertion still passed.
- **A reused virtual row goes stale.** Keyed reuse kept the row element across
  re-renders and never refreshed its text, so a revenue edit saved in the detail
  pane left the list showing the old number. This is exactly the class of bug the
  fixture is meant to contain, so it is now refreshed on every placement.

---

## What changed and why

New fixture, `apps/scenario-lab/src/scenarios/admin-console/` (14 source files
plus `tests/`):

| File | Holds |
| --- | --- |
| `types.ts` | Variants, tabs, record and state shapes |
| `records.ts` | The authored 240-customer book, seed-independent, every company name unique by construction |
| `format.ts` | Money formatting, the console's paths |
| `styles.ts` | Hashed class names (`css-1qk4d0`, …) and the list geometry the virtualiser reads |
| `markup.ts` | The one served shell; the settings screen in full |
| `client-script.ts` | Constants, routing, and every listener |
| `virtual-list.ts` | The virtualiser |
| `detail-pane.ts` | The detail pane and its inline editors |
| `shadow-control.ts` | `<fx-toggle>`, the open shadow root |
| `state.ts`, `route.ts`, `manifest.ts`, `scenario.ts`, `index.ts` | Fixture plumbing |

Registered in `apps/scenario-lab/src/types.ts` (`scenarioIds`) and
`apps/scenario-lab/src/registry.ts`. Seed **112**, the one gap in the 101–123
range, chosen to reduce the chance of colliding with the two fixtures being built
alongside this one (they took 131 and one other).

`apps/scenario-lab/src/tests/registry.test.ts`: the two hard-coded corpus counts
(`23`) now read `scenarioIds.length`. Three workers were adding a fixture into
the same file at the same time; a literal makes every addition an edit of that
line, and the assertion is no weaker derived.

**Design notes worth carrying forward.**

- *One served shell.* The server answers `/`, `/records/<id>` and `/settings`
  with the same document and the client routes from `location`. That is the
  history fallback a real SPA ships, it is what makes a deep link and a soft
  route change comparable, and it means the list and detail pane have exactly one
  implementation instead of a server copy the client must agree with.
- *Each variant is a control, not just a harder case.* `short-book` isolates
  virtualisation; `light-dom-toggle` isolates the shadow boundary; `read-only`
  isolates the missing editor. Each changes one thing, so a pass/fail pair is
  attributable.
- *Page facts are declared per rendering.* Every variant that changes the first
  rendering states its own set, and none inherits the workflow's. A unit test
  pins the schedule through `scenarioPageFactSchedule` for all three arming
  modes.
- *The client's money formatter is checked against the server's* by extracting
  the emitted function from the script string and running it over all 240
  records. That duplication was a real hazard: the first version of the script
  lost a backslash and rendered `$1800.00` instead of `$1,800.00`.

Four workflows: the primary edit workflow (search → open → edit in place → save),
`extract-customer-list`, `browse-to-customer`, `switch-settings-tab`.

---

## Commands run and observed results

Exit statuses captured by redirect, never through a pipe.
`EXTENSION_TEST_BUILD_LABEL=r-admin` throughout.

All figures below are from the **final** pass, taken after another worker
extended three of this fixture's files (see the note under the table).

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | **0** | clean |
| `node scripts/build-scenario-lab.mjs` | **0** | clean |
| `node --test "dist/**/*.test.js"` (scenario-lab) | **0** | `# tests 188 / # pass 188 / # fail 0` — includes all 13 `admin-console` unit tests and `every registered fixture exposes a valid versioned WebScenario manifest` |
| `npx playwright test -c e2e/playwright.config.ts admin-console.spec.ts` | **0** | `14 passed (10.3s)` |
| `npx playwright test -c e2e/playwright.config.ts` (whole lab suite) | **1** | `1 failed / 104 passed`; the single failure is `e2e\member-directory.spec.ts:109`, another worker's in-flight spec. All 14 `admin-console` tests passed. An earlier full run, before that spec landed, was `94 passed` at exit **0** |
| `node --test "dist/bench/tests/week1-corpus.test.js"` (test-runner) | **0** | `# unresolved results: none` and `# runnable: 43 (23 recording, 20 flow); skipped: 0`; `# tests 4 / # pass 4 / # fail 0` |
| `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs` (new paths staged into the scratch index first) | **0** | `structure-audit: passed (33 warning(s), 17 baselined)` — the word `admin-console` appears zero times in the output |

**Two intermediate failures, both another worker's and both since cleared.**
An earlier `pnpm check` reported one error in
`src/identifier-policy/tests/apply.test.ts`, and one `admin-console.spec.ts` run
died before starting with `SyntaxError: The requested module './filters.js' does
not provide an export named 'ROLE_OPTIONS'` — `member-directory` mid-refactor,
which reaches this spec because `lab-fixture.ts` pulls in `server.ts` and so the
whole registry. Both were re-run and both passed; neither touched
`admin-console` code. Nothing surprising in my own work failed and then passed on
a rerun.

**A concurrent edit to files this brief gave me.** While this was being written,
another worker added an `identifiers: IdentifierPolicy` axis to
`admin-console/types.ts`, `state.ts` (a `set-identifiers` operation) and
`markup.ts` (an `applyIdentifierPolicy` pass over the finished document). I did
not revert it, and every figure above was measured against the merged state; the
default `as-authored` policy leaves the rendering unchanged, so all 13 unit tests
and all 14 e2e tests still pass. Worth flagging so the supervisor knows two
briefs overlapped on one directory.

The corpus figure is the required one: **43 runnable, 0 unresolved**, unchanged by
this fixture, which is not in the week1 corpus.

The structure audit failed once before this, on
`[imports] apps/scenario-lab/e2e/admin-console.spec.ts: 4 import(s) reach into
another directory's files instead of its barrel`. The spec now imports only from
`../src/scenarios/admin-console/index.js`.

I did not run `pnpm lab`, `pnpm build`, or anything that touches shared output.

---

## Not verified

- **Nothing in this report was measured with the extension loaded.** The Scenario
  Lab e2e suite is Playwright-only. Every claim about the extension's resolver,
  recorder or verbs is either (a) a page-side measurement of what a document
  query, a point hit-test or a candidate enumeration returns, or (b) a reading of
  named source lines. The two are labelled separately above. The single most
  valuable next step is a recorded-and-replayed run of
  `switch-settings-tab` against the real extension, to settle whether
  `vetoExactMatch` accepts or refuses the `<fx-toggle>` host — that decides
  between an honest `target_not_found` and a silent no-op reported as success.
- **What replay does with a virtualised row that no longer exists** is untested.
  The fixture now produces the condition; nothing has yet been driven through it.
- **Whether the recorder produces a `web.page.navigated` event for the
  `pushState` route change.** The listener exists and the suppression window
  probably eats it, but that is a reading, not a measurement.
- **The `read-only` variant's declared failure category** (`target_not_found`) is
  what the runtime can report, not necessarily what the page means. The page says
  "read-only access" in a banner; a human would call that
  `blocked_by_capability_or_policy`. I declared the reportable one and left the
  gap visible rather than encoding an aspiration.
- **Firefox.** Everything was run on Chromium. The blur-during-removal behaviour
  that bit the inline editor is browser-specific and the fix does not depend on
  it, but the shadow-DOM and virtualisation measurements have not been repeated
  elsewhere.
- **`recordingEvents` counts.** The manifest declares event *types* without
  counts, because I could not observe the recorder to know what the counts are.
  Someone who can should tighten them.

---

## Open questions and contradictions found

1. **Two manifest expectations are deliberately unmet.**
   `extract-customer-list` declares 240 records and today's implementation returns
   15; `browse-to-customer` declares a scroll that today reaches nothing. Both are
   written as the correct answer on purpose. **This fixture is not in the week1
   corpus** and I did not add it — adding either workflow to the corpus would take
   it red. That is the supervisor's call, and it is the honest way to make the
   defects visible in the bench rather than in a report nobody re-reads.

2. **The harness cannot see defect 2.** Playwright's engine pierces open shadow
   roots, so the recording lane and the page-fact probe both find the switch. Any
   measurement of shadow-DOM support that runs through the recording lane alone
   will report success. This is a hole in the facility, not in the product.

3. **`gatedPool` returning ungated matches is load-bearing here.** The comment in
   `resolve-target.ts` justifies it ("a hidden or disabled target is what an
   assertion asks about"), which is right for hidden and disabled. It also lets a
   *tag-mismatched* element through as a resolved single match, which is what puts
   the shadow host in front of the veto. Those two cases may deserve to be
   separated: the gate exists to catch "wrong element", and a tag mismatch is the
   strongest possible signal of exactly that.

4. **A pre-existing console-error flake.** Chromium requests `/favicon.ico`, the
   lab answers 404, and the page logs `Failed to load resource: the server
   responded with a status of 404`. Every lab page does this, not just mine
   (reproduced on `product-catalog`), and it does not appear through Playwright's
   request events, so `installDeterministicNetworkGuard` does not see it. Every
   manifest declares `allowedConsoleErrors: []`. It did not fire in any suite run
   here — it seems to depend on being the first page in a fresh browser — but it
   is a live flake risk for anything that asserts an empty console.

5. **Concurrent edits to shared files.** Three fixtures were landing at once in
   `src/types.ts`, `src/registry.ts` and `src/tests/registry.test.ts`. I appended
   rather than rewrote, and replaced the registry test's literal counts with
   `scenarioIds.length` so the next fixture needs no edit there at all. Worth
   checking that all three additions survived.
