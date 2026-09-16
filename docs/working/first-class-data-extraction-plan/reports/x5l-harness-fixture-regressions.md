# x5l-harness-fixture-regressions

The six content-harness failures, their causes, and the fixes. No extension
source was changed: none of the six was a leak.

## Outcome

**Done**, with a correction to the brief's failure inventory. Four of the six
named rows were real and are fixed. Two of them (`scroll.spec.ts:129,148`) do
not fail on this tree and did not fail in any of my three runs. One failure the
brief does not name appeared instead, and it is environmental.

### The security question first, for each of the three sensitive rows

The brief's overriding rule was to establish, for each of the three assertions
about a sensitive control, whether a leak had been reintroduced. **None had.**

1. **`evidence.spec.ts:535`** — the whole-wire secret scan is line 568, and it
   **passed**, both before and after the fixture change. The failure was 16
   lines later at 584, comparing a landmark's name, and the received value was
   `"Saved cards"` — the accessible name of the fixture's own new
   `<section aria-label="Saved cards">`, page chrome rather than a secret. The
   diff in the failure output is one line: `- "Saved notes"` / `+ "Saved cards"`.
2. **`identity.spec.ts:187`** — failed *before evaluating any assertion*. The
   helper on line 24 threw: `extract did not describe [data-testid="password"]:
   failed Action rejected: the target is a sensitive control, so its value is
   never read`. Nothing about the descriptor was observed, so nothing about it
   had changed.
3. **`identity-signals.spec.ts:96`** — the same throw, on `#b5-secret`, at line
   99, before `expect("checked" in described).toBe(false)` could run.

In no case did an assertion observe a value, state or name that should have been
withheld. The refusal in cases 2 and 3 **is** the security feature: D2 says
extraction refuses every read of a sensitive control in every mode, and
`action-runtime/extract.ts` now does exactly that. The two specs were using the
read-only `web.dom.extract` verb purely as a way to obtain a descriptor, and
that route is now closed for precisely the elements they are about.

So the fixes are in the specs, and they change the *route* to the descriptor,
never an assertion about it.

### Two assertions strengthened, none weakened

- `evidence.spec.ts` now scans the whole snapshot and the whole
  `capture_snapshot` reply for `PLANTED_UNLOCK_CODE`, the string x5e planted in
  every saved card's `type="password"` control, alongside the three fixture
  secrets already scanned. It passes, which is the page-side half of x5e's
  bundle scan proven at the snapshot boundary for the first time.
- `identity.spec.ts` now asserts the password descriptor carries no `value`
  property at all. The comment it replaces deferred that to "Phase 1.4"; the
  withholding is in force now, so the row pins it.

## Cause, row by row

| Row | Cause | Fixed in |
| --- | --- | --- |
| `evidence.spec.ts:535` | **The fixture's page changed under an assertion whose scope was implicit.** x5e added the saved-cards list, whose `<section aria-label="Saved cards">` is a second landmark region. The loop asserted that *every* descriptor on the page with `context.landmark === "region"` names the injected `Saved notes` region, which silently depended on that being the page's only region. | the spec |
| `identity.spec.ts:187` | **The assertion is still right; its route is gone.** `web.dom.extract` refuses a sensitive control (D2). | the spec |
| `identity-signals.spec.ts:90` | Same cause; `#b5-secret` is `data-sensitive="true"`. | the spec |
| `identity-signals.spec.ts:96` | Same cause. | the spec |
| `scroll.spec.ts:129` | **Did not fail.** Passed in all three runs. | — |
| `scroll.spec.ts:148` | **Did not fail.** Passed in all three runs. | — |

The two `identity-signals` rows are exactly the two of that file's four that
describe `#b5-secret`; the other two never touch it and always passed. That is
the signature of the shared cause rather than of anything about the landmark
assertions they also make.

## What changed and why

### `apps/extension/e2e/content/tests/evidence.spec.ts` (776 -> 790 lines)

- **Imports `PLANTED_UNLOCK_CODE`** from the scenario-lab barrel
  (`scenarios/sensitive-input/index.js`), the way `scroll.spec.ts` already
  imports `getScenario` from that package, and adds it to `FIXTURE_SECRETS`. The
  three planted values all begin with that constant, so the one string catches
  all three.
- **The region loop is narrowed by where a descriptor sits, not by what it is
  named.** The descriptors with a region landmark are filtered through one
  `page.evaluate` that keeps those whose selector resolves inside
  `[data-testid="saved-notes"]` (`closest`, so the region element itself
  counts). Narrowing it by `landmarkName === "Saved notes"` instead would have
  made the assertion vacuous — it would have selected the rows by the very value
  under test — which is why it is done by position.
- `expect(inSavedNotes.size).toBeGreaterThan(0)` keeps the guard that the row
  proves something: if the injected region ever stops being described, the row
  fails rather than passing over an empty set.

### `apps/extension/e2e/content/tests/identity.spec.ts` (203 -> 220 lines)

- New local helper `describeInSnapshot`, which reads the descriptor out of
  `harness.capture().interactiveElements` by selector and throws a named error
  if it is absent. It is the **same `describeElement` output**: the snapshot
  path and the extract reply both call that one function
  (`content/action-runtime/execute-action.ts` wires `describeElement` into
  both), so the row still judges the descriptor the recorder produces, read
  where the background worker reads it. `redaction.spec.ts:461` already reads
  the billing field this way, so the pattern is the file-local one.
- The sensitive-input row uses it for `[data-testid="password"]` and
  `[data-testid="payment"]`. Every existing assertion is unchanged; one was
  added (`not.toHaveProperty("value")`).
- The file header now says why a sensitive control is read from the snapshot.

### `apps/extension/e2e/content/tests/identity-signals.spec.ts` (128 -> 142 lines)

- The same helper, local to the file, typed to `DomElementDescriptor` (already
  imported there), used for the two `#b5-secret` reads on lines 107 and 113.
  The ordinary controls still go through the shared `describe` from
  `identity-fixtures.ts`.
- `identity-fixtures.ts` is **not** in this brief's owned paths and six specs
  import it, so its `describe` was left alone rather than given a second route.
  See open question 3.

### Not changed

`scroll.spec.ts` and every file under
`apps/scenario-lab/src/scenarios/{sensitive-input,infinite-feed}/` are
untouched. No extension source was touched.

## Commands run and observed results

Each gate ran alone, never beside another, because of this machine's RAM fault.

| # | Command | Observed |
| --- | --- | --- |
| 1 | `test:content -- evidence identity scroll --workers=2` (before any edit) | `6 failed`, `85 passed`. The six: `evidence:251 product-catalog element totals`, `evidence:251 infinite-feed forms are not invented`, `evidence:535`, `identity-signals:90`, `identity-signals:96`, `identity:187`. **No scroll row failed.** |
| 2 | `test:content -- evidence scroll --workers=1` (before any edit) | `2 failed`, `40 passed`. `evidence:535` with the `Saved notes` / `Saved cards` diff, and `evidence:251 product-catalog element totals` with `Tearing down "openHarness" exceeded the test timeout of 30000ms`. **All three scroll rows on infinite-feed passed** (129: 3.1s, 148: 673ms, 166: 2.0s). `infinite-feed: forms are not invented` passed here, so its failure in run 1 was a flake. |
| 3 | `pnpm --filter @fluxiq-web-extension/extension check` (after the edits) | exit 0, no diagnostics. Covers `tsconfig.test.json`, which compiles the e2e tree. |
| 4 | `test:content -- evidence identity --workers=1` (after the edits) | **`83 passed`**, 0 failed, 24.6s. All three fixed rows pass, including both strengthened assertions. `product-catalog: element totals and truncation` passed in **430ms**. |
| 5 | `EXTENSION_TEST_BUILD_LABEL=x5l node apps/extension/scripts/test-extension.mjs` | exit 0, `# tests 578 # pass 578 # fail 0 # cancelled 0`. |
| 6 | `test:content -- --workers=2` (full harness, after the edits) | `265 passed`, **`2 failed`**, 1.4m. **All six briefed rows passed**, including `scroll:129` and `scroll:148`. The two failures are neither assertion failures nor rows I touched — both are the teardown timeout described below: `evidence.spec.ts:252 infinite-feed: repeating structures` and `failures.spec.ts:241 on navigation: a post-condition that never appears is OUTPUT_NOT_OBSERVED`. |
| 7 | `node scripts/structure-audit.mjs` | exit 1, `1 violation(s) across 1 rule(s)`: `FAIL [working-docs] docs/working/README.md is out of date`. Supervisor-owned and pre-existing — `x0-12` and `x5e` each reported the same one. **No FAIL on any file I touched**; `evidence.spec.ts` carries only the pre-existing `file-lines` advisory warning it already had at 776 lines. |
| 8 | `test:content -- evidence failures --workers=1` (rerun of run 6's two failures) | `45 passed`, `1 failed`. **Both rows that failed run 6 passed here** — `infinite-feed: repeating structures` in 225ms and `failures.spec.ts:241` in 214ms. The single failure was a *third* row, `product-catalog: element totals and truncation`, with the same teardown timeout — and that row had itself passed in 430ms in run 4. |

### The teardown timeout: the one finding the brief does not name

One failure signature appeared **five times across five runs, on three different
rows, and never reproduced on the row it had just hit**:

```
Tearing down "openHarness" exceeded the test timeout of 30000ms.
```

It struck `evidence.spec.ts product-catalog: element totals and truncation`
(runs 1, 2 and 8), `evidence.spec.ts infinite-feed: repeating structures`
(run 6) and `failures.spec.ts:241` (run 6). It is **not an assertion failure**:
it is a hang in `harness.close()`, after the row's own assertions have already
passed.

The controlled comparison is run 8. It reran exactly the two rows that failed
run 6: **both passed** (225ms and 214ms), while the failure moved to a third row
that had passed in 430ms one run earlier. A defect that relocates to whichever
row is unlucky, and clears on the row it just failed, is not a defect in any of
those rows. In the filtered runs it consistently took whichever test was
scheduled **first**.

Two candidate causes, neither confirmed, both outside this brief's owned paths:
the machine's known RAM fault, which the brief names; or a lab HTTP server whose
`close()` waits on in-flight connections, which is newly plausible because the
product-catalog page now serves eight `<img>` requests it did not before
(`markup.ts`, `productImage`). The second would explain why it favours the first
test and why it moves between rows. **This is the one thing I would put in front
of whoever owns the harness**, because it makes the full-harness gate
non-deterministic: a clean run and a two-failure run are the same tree.

Consequence for the brief's acceptance criterion: the full harness did **not**
reach `0 failed`, and I am not claiming it did. It reached 0 assertion failures,
with 2 environmental teardown timeouts on rows I did not touch.

## Not verified

- **Browsers.** Only the content harness's Chromium, in the page's main world,
  with no extension loaded. No Firefox, no unpacked extension, no isolated
  world, no shadow DOM.
- **The brief's scroll failures.** I could not reproduce them in three runs and
  therefore cannot say what produced them. I did not change `scroll.spec.ts`, so
  if they were real they are still there; nothing I found explains them, and the
  infinite-feed fixture's **baseline** page is byte-identical after x5e's change
  (`renderFeedDocument(..., "scroll")` reproduces the previous markup exactly —
  the diff only adds the `load-more` branch).
- **Other gates.** `pnpm check`, `pnpm test`, `pnpm build`, the domain suite and
  the scenario-lab suite were not run. The extension `check`, the extension unit
  tests and the content harness were.
- **The structure audit** result is recorded below; note it cannot see untracked
  files, and much of this tree is untracked.
- **The product-catalog teardown timeout's cause**, as above.

## Open questions or contradictions found

1. **The brief's inventory is wrong in two places.** `scroll.spec.ts:129,148`
   pass on this tree; `evidence.spec.ts:251 product-catalog: element totals and
   truncation` fails under conditions the brief does not mention. The brief's
   own warning about lone non-reproducible failures on this machine applies to
   the scroll pair — but they were named as a coherent group of two, which is
   the case it told me not to attribute to the hardware. Someone should re-run
   the full harness before trusting either inventory, mine included.
2. **`evidence.spec.ts` is now 790 lines, 10 short of the 800-line hard FAIL.**
   X5-H's split of this file was already listed as needed before more rows are
   added; it is now nearly forced. The next addition of any size fails
   `pnpm check`. The four `sensitive-input` rows remain the natural extraction
   (`evidence-sensitive.spec.ts`), as `x0-12` also observed.
3. **`describe()` in `identity-fixtures.ts` still routes through
   `web.dom.extract`.** Six specs import it, and any future row that describes a
   sensitive control will hit the same refusal. The durable fix is for that
   shared helper to fall back to the snapshot for a refused target, which would
   also remove the duplication in open question 4. It is outside this brief's
   owned paths, so I did not touch it.
4. **`describeInSnapshot` is now written twice**, in `identity.spec.ts` and
   `identity-signals.spec.ts`, because the file that should own it
   (`identity-fixtures.ts`) is not mine to edit. Whoever owns it should hoist
   the helper and delete both copies.
5. **A documentation gap, not mine to close.**
   `docs/architecture/sensitive-values.md` describes extraction's refusal of a
   sensitive control, but nothing there says that the refusal also closes
   `web.dom.extract` as a *descriptor* route. That is the trap three specs fell
   into, and one sentence in the "Not a rule about page text" bullet would
   record it.
