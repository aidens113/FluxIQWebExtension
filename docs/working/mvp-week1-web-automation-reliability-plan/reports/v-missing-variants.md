# Report: v-missing-variants

Worker: `v-missing-variants`. Build the six Week 1 corpus entries whose Scenario
Lab variant did not exist, so W10, W25, W26 and W27 resolve, run, and assert a
failure code. `EXTENSION_TEST_BUILD_LABEL=v-missing-variants` was set for every
command. No `pnpm lab` command and no `pnpm build` was run.

## Outcome

**Done.** All six exist, all six resolve, and each declares a Core category *and*
a code from the closed set. A seventh variant was added — `ambiguous-targets`
`form-context` — because W26's proof has two halves and only one of them is a
corpus row; details in [W26](#w26--ambiguous-targets-no-context-and-form-context).

Measured against the built registry with the facility's own `expandCorpus`:

| | before | after |
| --- | --- | --- |
| total results | 43 | 43 |
| runnable | 37 (23 recording, 14 flow) | **43** (23 recording, 20 flow) |
| resolved but skipped | 0 | 0 |
| **unresolved** | **6** | **0** |
| results carrying `expectedFailure` | 4 | **10** |
| …of those, carrying a **code** | **0** | **6** |

One thing the supervisor must act on: **`packages/test-runner/src/bench/tests/week1-corpus.test.ts`
now fails, by design, and I do not own it.** One line fixes it; see
[The handoff this change forces](#the-handoff-this-change-forces).

## What changed and why

Each variant arms through the fixture's own `set-mode`, changes the recorded
control and nothing else, and declares what the armed run must be classified as.
The recording script is untouched in every case, so the unarmed row behaves
exactly as before.

### W10 — `navigation` / `broken-link` → `navigation_unexpected` / `web.navigation.unexpected`

The recorded link's `href` is **not** rewritten. The page it points at is gone:
armed, `/scenarios/navigation/second` answers `302` to
`/scenarios/navigation/link-retired`, a "Page not found" notice served **404**
with no fixture client — a real 404 runs none of the site's application code.
That is what a large site does with a retired URL, and it is why the category
fits: the landed URL is not the requested one.

Discriminating: the notice deliberately carries **no** `navigation-page`
heading. If it did, the recorded `waitForState` would be satisfied by the notice
and the armed run would look healthy. The e2e row asserts that wait genuinely
expires, that the href is byte-identical after arming, and that the fixture's
`visits` never contains `second`.

### W25 — `delayed-ui` / `too-slow` → `timeout` / `web.action.timeout`

The armed page is the *same page* with one number changed: the reveal delay goes
from the seeded ~150 ms to a fixed **20,000 ms**. Nothing reports slowness and
nothing refuses to render — the content genuinely arrives, twenty seconds late.

20,000 ms was chosen against two thresholds, not picked for effect: the recorded
step's `timeoutMs: 1000`, and the content script's `DEFAULT_WAIT_TIMEOUT_MS =
10_000` (`apps/extension/src/content/action-runtime/waits.ts:17`), which is what
a replayed `web.dom.wait_for_selector` uses when the recorded timeout does not
reach it. A delay of 2 s would have satisfied the runtime default and the
variant would have passed as a success. A unit test asserts the armed page and
the baseline page differ **only** in that number, and that the number exceeds
10,000.

### W26 — `ambiguous-targets`, `no-context` and `form-context`

This is the corpus's only proof that ambiguity is resolved by context, so it was
built as a pair. The baseline rendering is **byte-identical** to what it was:
the content-harness suite pins its markup, its geometry, and the fact that both
buttons report the same `context`.

- **`no-context`** (W26, `target_ambiguous` / `web.target.ambiguous`): the two
  panels are merged into one unnamed group and the buttons lose their test ids —
  a design system that stopped emitting them, which is the commonest way a
  recorded selector dies. The two buttons are then **byte-identical**
  (`<button class="ui-button">Continue</button>`), with no form, fieldset, list,
  named region or second heading between them, so every signal
  `content/identity/context.ts` reads is the same for both. A unit test asserts
  the two opening tags are equal strings; the e2e row computes each button's
  context signals in the page and asserts the two objects are deep-equal.
- **`form-context`** (not a corpus row): the *same* two test-id-less buttons,
  each back inside its own named `<form>` with a `<legend>`. `formName`,
  `formAction` and `fieldsetLegend` differ; nothing else does. The e2e row proves
  it by nulling exactly the context fields and asserting the remainder is equal,
  then resolving the intended control through `form[name="primary-choice"]` and
  checking the manifest's own `finalState` — including
  `recorded-testid-gone`, so a resolution here cannot have come from the test id.

Without `form-context`, "ambiguous without context" is a claim about a page
nothing compares against. The plan's own Phase 1.3 proof names both halves:
*"`ambiguous-targets` returns `TARGET_AMBIGUOUS` without context and resolves
with form/label context"*. `form-context` is that second clause.

**One thing this fixture cannot prove today**, and it belongs in the ledger: on
the *baseline* page, context does **not** distinguish the two buttons.
`elementContext` records a landmark's **role**, not its name, so both report
`{ landmark: "region", heading: "Ambiguous targets" }` —
`apps/extension/e2e/content/tests/identity.spec.ts:112` asserts exactly that and
says so in a comment. Adding an `<h2>` to each section would have made the
baseline context-resolvable and broken that spec, which I do not own. So the
"context resolves it" half lives in `form-context`, not in the baseline.

### W27 — `failure-surfaces`, three surfaces on one control

All three arm `detach-target` — the one control on that page a person can
actually press, and therefore the only one a recording captures. That makes them
alternatives rather than three unrelated surfaces, and each is something a real
site does between a recording and a replay:

| Variant | The page | Category / code |
| --- | --- | --- |
| `disabled` | the record was locked; the button is present and refuses | `blocked_by_capability_or_policy` / `web.action.rejected` |
| `detached` | the item was deleted; the button is absent and a deletion notice stands where it was | `target_not_found` / `web.target.not_found` |
| `blocked-url` | the action now leads off-site; the workspace link guard bounces to a `403` interstitial naming the refused destination | `navigation_unexpected` / `web.navigation.unexpected` |

Discriminating: the primary workflow already ends with `detach-target` absent,
so `detached`'s "absent" fact alone would pass for the wrong reason — the variant
also requires the `detach-target-removed` notice, which exists in no other mode.
`disabled` requires the control **present and disabled**, and `blocked-url`
requires it **present and enabled**, so no two of the three can be satisfied by
the same page. A unit test asserts the whole document is identical across modes
once the recorded control and the script are blanked out.

**`blocked-url` stays on loopback deliberately.** A navigation that actually
reached `https://partner.example.invalid/...` would be aborted by the runner's
deterministic network policy (`packages/test-runner/src/network-guard.ts`,
asserted at `run-scenario.ts:314`) and reported as `runtime.behavior` — a
different failure from the one this surface is for. The guard interstitial names
the refused destination instead, escaped, and the e2e row asserts the network
guard saw **no** non-loopback destination.

### Two design decisions worth knowing

**1. Arming is an override: `mode` is absent from a fixture's state until armed.**
My first cut carried `mode: "baseline"` in `createState`, as `intermediate-state`
does. That changed what an *unarmed* run publishes, and four rows in
`apps/extension/e2e/content/tests/identity-resolution.spec.ts` (`:195`, `:272`,
`:296`) compare the whole state with `toEqual` — a must-not-touch file. Rather
than ask for edits there, the mode is now optional and appears only once
`set-mode` is applied. The principle is defensible on its own terms and is
written into the type: *a fixture's published state for the unarmed page is part
of its contract, and adding a variant is not a reason to change it.* It does
diverge from `intermediate-state`'s explicit `mode: "baseline"`; if the
supervisor prefers one convention, the cheap direction is to loosen those three
`toEqual`s to `toMatchObject`.

**2. Two variants declare `allowedConsoleErrors`.** Chromium reports a non-2xx
main-frame response as a console error, and
`run-expectations/console-errors.ts` fails a run on any error the manifest does
not allow. Rather than serve the retired page and the guard page as `200` — which
would make them fake — the `broken-link` and `blocked-url` variants allow exactly
`"Failed to load resource: the server responded with a status of 404"` / `403`.
The runner matches by substring; my e2e spec applies the same rule rather than
the lab fixture's exact-list comparison, because the lab fixture's rule cannot
express "this page is a 404 and says so once per load".

## Files

New: `apps/scenario-lab/src/scenarios/ambiguous-targets/{modes,render,manifest}.ts`,
`apps/scenario-lab/src/scenarios/failure-surfaces/{modes,render,manifest}.ts`,
`tests/scenario.test.ts` under each of `navigation/`, `delayed-ui/`,
`ambiguous-targets/`, `failure-surfaces/`, and
`apps/scenario-lab/e2e/negative-variants.spec.ts`.

Changed: `scenario.ts` and `index.ts` in each of those four scenario
directories.

Not touched: `apps/scenario-lab/src/scenarios/identity-drift/`,
`apps/extension/e2e/content/tests/identity-resolution.spec.ts`,
`packages/test-runner/src/bench/**`, `apps/extension/src/**`, `domain/`.
(`apps/scenario-lab/e2e/scenario-pages.spec.ts` was edited and then reverted; it
is unmodified.)

## Commands run and observed results

Exit status captured by redirect and `echo $?`, never through a pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | **0** | `tsc -p tsconfig.json --noEmit`, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` | **0** | `# tests 140 / # pass 140 / # fail 0` (was 122 before; 18 new subtests) |
| `npx playwright test -c e2e/playwright.config.ts negative-variants` (in `apps/scenario-lab`) | **0** | `8 passed (24.3s)` |
| `npx playwright test -c e2e/playwright.config.ts` (whole scenario-lab e2e suite) | **0** | `73 passed (30.2s)` |
| `pnpm --filter @fluxiq-web-extension/extension test:content` | **1** | `187 passed, 2 failed` — both failures in fixtures I do not touch; see below |
| `node <scratchpad>/vmv-corpus.mjs` — `expandCorpus(week1Corpus, loadScenarioManifests(root))` against the built registry | **0** | `total 43 / runnable 43 / skipped 0 / unresolved 0 / expectedFailure 10, of which 6 carry a code` |
| `node <scratchpad>/vmv-before.mjs` — the same expansion with the six new variants stripped from the loaded manifests | **0** | `total 43 / runnable 37 (23 recording, 14 flow) / unresolved 6 / expectedFailure 4, none carrying a code` |
| `node --test packages/test-runner/dist/bench/tests/week1-corpus.test.js` | **1** | `# tests 4 / # pass 2 / # fail 2`; diagnostics `unresolved results: none` and `runnable: 43 (23 recording, 20 flow); skipped: 0`. Both failures are `UNRESOLVED_TODAY` — expected `[the six]`, actual `[]`. |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (copy of `.git/index` + `git add -A apps/scenario-lab`) | **0** | `structure-audit: passed (30 warning(s), 19 baselined)`; **no finding names any scenario-lab path**. Real index left with 0 staged entries (verified). |

The corpus test's own output is the cleanest before/after in one run: its
`expected` array still names the six missing variants and its `actual` is now
empty.

### The two content-harness failures are not mine

Both reproduce on a second and third run and neither uses a fixture I changed:

1. `identity-resolution.spec.ts:327` — `reworded-aria`, an `identity-drift`
   rendering another worker is adding right now (that directory is my
   must-not-touch, and `git status` shows their uncommitted edits to
   `identity-drift/{modes,save-action,manifest}.ts`).
2. `redaction.spec.ts:310` — "the domain withholds a sensitive control's
   comparison"; the observed result carries the card number `4111111111111111`
   in `failure.expected`. That is `sensitive-input` and the failure-record
   producers, i.e. `w3-redaction` / `w3-failure-producers` territory.

My first content run also showed failures in `scroll.spec.ts` and a scratch
`zz-v-matcher-calibration-tmp.spec.ts`; both were gone by the second run, and
the pass count moved 182 → 187 between runs, so that tree is actively churning.

## The handoff this change forces

`packages/test-runner/src/bench/tests/week1-corpus.test.ts` is a **deliberate
tripwire** — its own comment says *"When a fixture adds one, this test fails
until its entry is removed"* — and it is on my must-not-touch list. It is now
red. The owner needs one edit:

- **`UNRESOLVED_TODAY` → `[]`** (used by two assertions, `:60` and `:89`). That
  alone makes the file green.
- Worth doing at the same time, because the test exists to pin the plan's corpus
  table: extend `PLAN_NEGATIVE_VARIANTS` with the six new rows —
  `W10 navigation/primary/broken-link: "navigation_unexpected"`,
  `W25 delayed-ui/primary/too-slow: "timeout"`,
  `W26 ambiguous-targets/primary/no-context: "target_ambiguous"`,
  `W27 failure-surfaces/primary/disabled: "blocked_by_capability_or_policy"`,
  `W27 failure-surfaces/primary/detached: "target_not_found"`,
  `W27 failure-surfaces/primary/blocked-url: "navigation_unexpected"`.

The brief drew `packages/test-runner/src/bench/**` as another worker's, which is
right for the source, but the tripwire it contains is the intended handoff for
exactly this change. Nothing I shipped is inert — the six resolve and the bench
plans them — but the gate stays red until that line moves.

## Not verified

- **No variant has been *run*.** No `pnpm lab` command was permitted, so nothing
  here proves what the extension and Core actually report. What is proven is the
  page an armed run would meet and the failure the manifest declares. Whether a
  Flow-lane run of `no-context` produces `TARGET_AMBIGUOUS` rather than resolving
  by score is the open question; the fixture-level proof is that no signal the
  resolver reads differs between the two candidates.
- **No new content-harness row.** `apps/extension/e2e/content/tests/` is not in
  my Owns, and the one file in it named explicitly is must-not-touch, so I did
  not add a spec there. The rows that would close the gap, if the supervisor
  wants them, are: arm `ambiguous-targets` `no-context`, replay the descriptor
  read off the baseline page, and assert
  `{ category: "target_ambiguous", code: "web.target.ambiguous" }`; then the same
  on `form-context` asserting it resolves. That is the one proof this work is
  missing.
- **`pnpm check`, `pnpm test` and `pnpm build` were not run** — the wave rules
  forbid the build, and the repository-wide gates are the supervisor's.
- **The "before" row of the table is a reconstruction**, not a second checkout:
  the six new variants were stripped from the manifests the built registry
  loads, then expanded. The independent confirmation is `week1-corpus.test.js`'s
  own `expected` array, which still lists exactly those six labels.
- **The bench Flow lane moved under me.** `expand-corpus.ts` no longer skips
  variants (`week1Corpus.lanes = ["recording", "flow"]`, uncommitted), which is
  why "runnable" counts variants at all. `v-criteria`'s `23 runnable / 14 skipped
  / 6 unresolved` was measured before that landed and is no longer the shape of
  the plan.

## Open questions or contradictions found

1. **`failure-surfaces`'s recorded workflow may not be runnable at all, and this
   predates my change.** Its first step is
   `{ id: "disabled-target", operation: "click", target: "testid:disabled-target" }`
   with no `timeoutMs`. `ScenarioStepRunner.perform` calls `target().click({})`
   (`scenario-steps/step-runner.ts:79`), Playwright's click waits for the
   *enabled* actionability check, and the runner sets no default timeout — so the
   step should take Playwright's 30 s default and then throw, failing the run at
   step 1. I measured the behaviour it rests on: in my `disabled` e2e row,
   `click({ timeout: 1000 })` on that same disabled control rejects with
   `Timeout`. I did **not** change the recording script — a variant must not, and
   it is outside what this brief asked for — but if W27's unarmed row cannot
   complete, the Flow lane never gets a recording to build its variants from, and
   all three W27 variants stay theoretical. The honest fix is for the recorded
   script to stop clicking a control a person could not click and to keep the
   disabled surface as the `pageFact` it already is. Supervisor's call.
2. **`toEqual` on a fixture's whole published state is brittle**, and it is what
   forced decision (1) above. Three rows in `identity-resolution.spec.ts` and one
   in `scenario-pages.spec.ts` do it. Every one of them means a fixture can never
   gain a state field. `toMatchObject` costs nothing and would remove a whole
   class of cross-worker breakage.
3. **`elementContext` records a landmark's role, not its name.** Two controls in
   `<section aria-label="Primary">` and `<section aria-label="Secondary">` are
   context-identical to the resolver, though a person and Playwright's
   `getByRole("region", { name })` tell them apart instantly. That is why W26's
   positive half had to use a form and a legend. If Core's matcher is ever meant
   to use a region's accessible name, `content/identity/context.ts` is where it
   would start.
4. **Four of the ten `expectedFailure` entries still carry no code** — W14, W15,
   W19, W24, all pre-existing. The corpus can now compare a reported code against
   a declared one for six rows and only a category for four. Adding the codes is
   four one-line edits in `modal-flows`, `multi-tab`, `auth-gate` and
   `intermediate-state`, none of which this brief owned.
5. **`ambiguous-targets` now has a variant the corpus does not name**
   (`form-context`). Nothing enforces that a fixture's variants are all corpus
   rows, and it is exercised by the scenario-lab e2e suite. If the supervisor
   wants it measured rather than merely tested, it needs a W-row of its own; if
   the supervisor wants variants and corpus rows to correspond exactly, it should
   be removed and the "context resolves ambiguity" claim dropped with it.
