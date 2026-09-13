# f-evidence-items-harness — the content harness asserts all 16 evidence items

Worker report, 2026-09-13. Brief: `briefs/finish-week1.md`, section
"f-evidence-items-harness". Nothing committed.

## Outcome

**Done.** `apps/extension/e2e/content/tests/evidence.spec.ts` now has rows for the six
items that had none: 2 visible text, 4 current URL, 5 page title, 10 selected elements,
13 relevant attributes and 16 expected-state evidence.
- **Tests:** 11 new tests, 30 in the spec, all passing.
- **Mutation proof:** each new test failed under its own mutation, and the file was
  restored byte-identical after each of the two mutation runs.
- **Scope:** no product change was needed, and no fixture page was added. Every new row
  runs on the existing `basic-form` Scenario Lab page and quotes only text that page
  defines (`apps/scenario-lab/src/scenarios/basic-form/scenario.ts:49-71`).

## What changed and why

The only file changed is `apps/extension/e2e/content/tests/evidence.spec.ts`
(163 insertions, 1 changed line).

**Re-verified at HEAD first.** The unedited spec ran **19 passed (14.8s)**. It had no row
reading `title`, `url`, `selectedText`, `focusedElement`, `selectedValue`, `attributes`,
`text` or `visibleText`, and none dispatching `web.dom.assert`. That matches
`l-evidence.md:349`.

**Where the six items live.**
- Items 2, 4, 5, 10 and 13 are on the snapshot itself, beside `evidence`, not inside it:
  - the `DomSnapshot` fields `url`, `title`, `focusedElement` and `selectedText`
    (`apps/extension/src/shared/protocol.ts:311-341`);
  - the descriptor fields `text`, `visibleText`, `selectedValue`, `options` and
    `attributes` (`protocol.ts:185-227`).
  - The existing `ROWS` table hands each row only `PageEvidence`, so a second table was
    needed.
- Item 16 is the verdict of the `web.dom.assert` check that an authored `expectedState`
  becomes (`domain/src/runtime/expectation/conditions.ts:1-17`, `evaluate.ts:8-13`).

**Added:**
- **A header paragraph** saying why these six had no row.
- **`SNAPSHOT_ROWS`** (7 rows on `basic-form`), run by a loop that passes the whole capture
  and the harness:
  - `visible text`: the result paragraph reads `Not submitted`, the submit button reads
    `Submit`.
  - `visible text is not invented for a control that renders none`: the name input has
    no `text` and no `visibleText`.
  - `current URL`: `snapshot.url` equals the address the harness opened, and equals
    `evidence.navigation.url`.
  - `page title`: `Basic form`.
  - `selected elements at rest`:
    - the plan select carries `selectedValue: "starter"` and its three options;
    - the name input carries no `selectedValue`;
    - there is no `selectedText`;
    - `focusedElement` is the body.
  - `relevant attributes`:
    - the name input's `attributes` equal exactly
      `{ name, data-testid, autocomplete }`. The input is also `required`, which the
      allowlist does not carry, so the row pins the allowlist in both directions.
    - the submit button's equal `{ type, data-testid }`.
  - `relevant attributes are not invented on an element that has none`: the `h1` carries
    no `attributes`.
- **Four tests at the foot:**
  - `a page selection and a focused control are carried as the selected elements`:
    - selecting the heading gives `selectedText: "Basic form"`;
    - focusing the notes textarea gives a `focusedElement` with that selector and test id.
  - `a page with no title reports an empty title, not one borrowed from its heading`:
    with `<title>` removed, `title` is `""`. This is item 5's page-lacks-it row.
  - `expected-state evidence carries the claim and what the page showed when it holds`.
    - The command is built by the domain's own shipped functions:
      `webAutomationExpectationCondition(entry, 0)`, then
      `webAutomationExpectationActionPayload`, then
      `webAutomationActionFromGatewayCommand`.
    - The entry uses the `{ selector, assert }` shape that `domain/src/output-nodes`
      writes into `parameterValues.expectedState`. The wait is 0, which is what Core's
      transition comparison passes.
    - The reply is `succeeded`, with validation `{ status: "passed", expected:
      "\"[data-testid=\"result\"]\" contains \"Not submitted\"", actual: "... reads \"Not
      submitted\"" }` and no `failure`.
  - `expected-state evidence on a page not in that state is a mismatch carrying both
    sides`. This is item 16's page-lacks-it row.
    - The expected state is that the form is `absent`; nothing was submitted.
    - The reply is `failed`, and its validation and failure record carry both the claim
      (`no element matches "[data-testid="basic-form"]"`) and what was seen
      (`"[data-testid="basic-form"]" is still present`).
    - The failure is `unexpected_state` / `web.validation.state_mismatch`.

**Which rows cover each of the 16 items** (item list from `audit-evidence.md:36-53`):

| # | Item | Rows in `evidence.spec.ts` |
| --- | --- | --- |
| 1 | Interactive elements | product-catalog: element totals and truncation; intermediate-state: element totals agree with the element list |
| 2 | Visible text | **basic-form: visible text; visible text is not invented for a control that renders none** |
| 3 | Forms | intermediate-state: forms model; product-catalog: forms model groups by the owning form; infinite-feed: forms are not invented |
| 4 | Current URL | **basic-form: current URL** (no page-lacks-it row: every document has a URL) |
| 5 | Page title | **basic-form: page title; a page with no title reports an empty title** |
| 6 | Navigation state | product-catalog: navigation state |
| 7 | Dialogs / modals | modal-flows: dialogs are not reported before one opens; an open modal; the native dialog |
| 8 | Page regions | product-catalog: landmarks and regions; intermediate-state: a page caught mid-work |
| 9 | Repeating structures | product-catalog and infinite-feed: repeating structures; intermediate-state: not invented; modal-flows: change and recency (third capture) |
| 10 | Selected elements | **basic-form: selected elements at rest; a page selection and a focused control** |
| 11 | Recently interacted | modal-flows: change and recency; intermediate-state: element totals agree (0) |
| 12 | Changed elements | modal-flows: change and recency; intermediate-state: element totals agree (0) |
| 13 | Relevant attributes | **basic-form: relevant attributes; not invented on an element that has none** |
| 14 | Loading state | product-catalog: loading state at rest; intermediate-state: mid-work busy; infinite-feed: aria-busy |
| 15 | Blocking overlays | modal-flows: blocking overlays; product-catalog: none on a page with none; modal-flows: open modal |
| 16 | Expected-state evidence | **basic-form: expected-state evidence when it holds; on a page not in that state** |

## Commands run and observed results

All commands used `EXTENSION_TEST_BUILD_LABEL=f-evidence-items-harness`. Exit codes were
captured by redirecting output to a file, never through a pipe. Harness command, from
`apps/extension`:
`pnpm exec playwright test -c e2e/playwright.content.config.ts --workers=2 evidence.spec.ts`.

1. **Baseline, the unedited spec:** `19 passed (14.8s)`, `exit=0`. The test line numbers
   (`:241`, `:247`, ...) show it loaded the original file.
2. **`pnpm check` in `apps/extension`**
   (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`): `exit=0`, with no
   diagnostics. `tsconfig.test.json` includes `e2e/**/*.ts`, so the spec was type-checked.
3. **The harness on the edited spec:** `Running 30 tests using 2 workers` ...
   `30 passed (8.6s)`, `exit=0`. All 11 new titles are listed `ok`.
4. **`node scripts/structure-audit.mjs`** (from the repository root):
   `structure-audit: passed (42 warning(s), 17 baselined).`, `exit=0`. One warning is
   mine:
   `warn [file-lines] apps/extension/e2e/content/tests/evidence.spec.ts: 520 lines is past the 400-line advisory threshold.`
   It is advisory and not ratcheted; the hard limit is 800.
5. **Backup:** `sha256sum` gave
   `9d1b275ac2dae2af7da46013ec9515663f4542b23e262086bf2952f37cc971f5`. That is the
   content of runs 2-4; nothing was edited between run 3 and the backup.
6. **Mutation run A**, one broken expectation in each new test, all 11 applied together:
   `11 failed`, `19 passed (19.9s)`, `exit=1`. Exactly the 11 new tests failed, and every
   existing test passed.

   | New test | Mutation | Observed failure |
   | --- | --- | --- |
   | visible text | `text: "Not submitted"` → `"Not submitted."` | `- "text": "Not submitted.",` `+ "text": "Not submitted",` |
   | visible text is not invented | reads the `submit` element instead of `name` | `Received: "Submit"` |
   | current URL | `toBe(harness.url)` → `toBe(harness.lab.origin)` | `Expected: "http://127.0.0.1:55181"` `Received: "http://127.0.0.1:55181/scenarios/basic-form/"` |
   | page title | `"Basic form"` → `"Scenario lab"` | `Expected: "Scenario lab"` `Received: "Basic form"` |
   | selected elements at rest | `selectedValue: "starter"` → `"team"` | `- "selectedValue": "team",` `+ "selectedValue": "starter",` |
   | relevant attributes | drops `autocomplete: "off"` from the expected map | `+ "autocomplete": "off",` (toEqual, deep equality) |
   | attributes are not invented | asserts `attributes` undefined on the name input instead of the `h1` | `Received: {"autocomplete": "off", "data-testid": "name", "name": "name"}` |
   | selection and focus | `selectedText` `"Basic form"` → `"Basic"` | `Expected: "Basic"` `Received: "Basic form"` |
   | page with no title | `toBe("")` → `toBe("Basic form")` | `Expected: "Basic form"` `Received: ""` |
   | expected state holds | `actual` `reads "Not submitted"` → `reads "Submitted"` | `- "actual": "\"[data-testid=\"result\"]\" reads \"Submitted\"",` `+ ... reads \"Not submitted\""` |
   | expected state not held | validation `actual` → `is gone` | `- ... is gone",` `+ ... is still present",` |

   Restored with `cp`: `sha256sum` gave `9d1b275a…c971f5` on both copies, and `cmp`
   printed `restored byte-identical`.
7. **Mutation run B**, covering the parts of four tests that run A's first failure never
   reached: `4 failed`, `26 passed (12.3s)`, `exit=1`. Exactly the 4 mutated tests failed.
   - **current URL**, the navigation cross-check changed to the Lab's origin:
     `Expected: "http://127.0.0.1:55350"` `Received: "http://127.0.0.1:55350/scenarios/basic-form/"`.
   - **selected elements at rest**, focus changed from `"body"` to `"input"`:
     `Expected: "input"` `Received: "body"`.
   - **selection and focus**, the focused test id changed from `notes` to `name`:
     `- "testId": "name",` `+ "testId": "notes",`.
   - **expected state not held**, the failure code changed to `web.action.timeout`:
     `- "code": "web.action.timeout",` `+ "code": "web.validation.state_mismatch",`.

   Restored with `cp`: `sha256sum` gave `9d1b275a…c971f5` on both copies, and `cmp`
   printed `restored byte-identical`.
8. **`git status --short -- apps/extension`:** only
   `M apps/extension/e2e/content/tests/evidence.spec.ts`. `git diff --stat` shows
   `1 file changed, 163 insertions(+), 1 deletion(-)`. `e2e/test-results/` and
   `e2e/content/.harness-build/` are git-ignored (`.gitignore:18`, `:25`).

No failure looked like the faulty-RAM pattern, so nothing was rerun. Each run above is a
single observation.

## Not verified

- **No Lab run.** The brief forbids one. The rows prove what the content script puts in
  its own snapshot and its `web.dom.assert` reply, in real Chromium on a Scenario Lab
  page. For the criterion's Lab half, a Lab run would have to show two things:
  - **Items 2, 4, 5, 10 and 13:** a stored action-result snapshot
    (`attempt.result.payload.result.snapshot`) carrying `url`, `title`, `focusedElement`,
    and elements with `text`/`visibleText` and `attributes`. `l-evidence.md:277-288`
    already observed these.
  - **Item 16:** a Flow whose node carries `parameterValues.expectedState`, and a stored
    attempt whose `transitionComparison` reports `checkedConditionCount` of 1 or more.
    That covers a web.dom.assert or W19's click-landing claim. `l-evidence` saw 0
    `expectedState` bytes, because its Flow had no expectation.
- **Hops not exercised:**
  - the background worker's frame merge (`captureMergedTabSnapshot`);
  - the domain state projection and the sanitized LLM packet, which domain unit tests
    cover per `l-evidence.md:364-376`;
  - delivery between real extension contexts. The harness is single-world, with no
    background worker (`e2e/content/harness.ts:12-21`).
- **Item 16's row stops before the dispatch path.** It uses the domain's condition
  reader, payload builder and gateway mapping as shipped. It does not run Core's
  transition comparison, the host runtime's dispatch, the background routing, or
  `createWebAutomationExpectationEvaluator`'s verdict.
- **Caps not asserted:**
  - visible text, 500 characters;
  - `selectedText`, 2,000;
  - attribute values, 500;
  - `options`, 20.

  Each would need a long-text fixture, meaning a `scenario-lab` edit (not mine) or DOM
  injection. None was cheap.
- **Other gaps:**
  - A sensitive `<select>` withholding `selectedValue` is not re-asserted here; the
    redaction specs own it.
  - The Firefox content config did not run.
  - Root `pnpm check`, `pnpm test` and `pnpm build` did not run. I ran the extension's
    `pnpm check` and the structure audit script; the root check also runs
    `structure:test`, `lab:test` and `pnpm -r check`.

## Open questions or contradictions found

- **Stale audit entry.** `audit-evidence.md:53` calls item 16 absent because "no web
  output node writes `parameterValues.expectedState`". That is no longer true:
  - `domain/src/output-nodes/definitions.ts:34-40` declares the parameter;
  - `domain/src/runtime/expectation/` evaluates it on the page.

  The audit row is stale; the harness now pins the content-script half.
- **Criterion wording.** Whether "16 items green" also needs a Lab observation for
  item 16 is the supervisor's ruling. The harness rows alone do not supply one.
- **File length.** `evidence.spec.ts` is now 520 lines, which triggers the advisory
  file-lines warning but no failure.
  - To bring it under 400, move `SNAPSHOT_ROWS` and the expected-state tests into a
    sibling spec.
  - The brief's `evidence.spec.ts` filter is a regular expression, so a name like
    `snapshot-evidence.spec.ts` would still be selected; `snapshot-items.spec.ts` would
    not.
- **Leftover build folders.** `apps/extension/e2e/content/.harness-build/` holds four
  `run-*` directories, all git-ignored. They may belong to other workers' runs in
  progress, so I did not delete them.
