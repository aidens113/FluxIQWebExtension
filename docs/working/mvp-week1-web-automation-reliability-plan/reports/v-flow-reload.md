# Report: v-flow-reload

Worker: `v-flow-reload`. Two defects found by `v-lane-facts`, both blocking an
honest Flow-lane run, plus the dead-field question. `EXTENSION_TEST_BUILD_LABEL=v-flow-reload`
was set on every command. No `pnpm lab` command, no `pnpm build`, and no
`pnpm structure:baseline` was run.

## Outcome

**Done**, with one substantive departure from the brief that the supervisor
must read before running the Flow lane: **item 1 falsifies item 2's premise**,
so I applied the corrected edit rather than the one in `v-lane-facts`' report.
The brief told me to verify it against the current tree rather than paste it;
verifying it is what turned it up. Section "Item 2" gives the evidence,
including two real-browser runs.

| | before | after |
| --- | --- | --- |
| the Flow lane's post-arm page load | `page.reload()` — wherever the recording ended | `openScenarioStart(page, origin, scenario)` — always `scenario.startPath` |
| `auth-gate/expired`'s armed rendering | `/account` → 302 → `/?expired=1` | `/scenarios/auth-gate/` |
| `auth-gate/expired`'s armed page facts | none declared, so nothing checked | the three sign-in-page facts, declared on the variant |
| `ResolvedScenarioWorkflow.expected.pageFacts` | documented as "not the thing to read" | documented as **dead: no lane reads it**, with the three remaining readers named |
| test-contracts / test-runner / scenario-lab units | 59 / 406 / 145 | 59 / **407** / **146**, all passing |
| week 1 corpus | — | **43 total / 43 runnable / 0 skipped / 0 unresolved** |

---

## Item 1 — the post-arm load

`packages/test-runner/src/run-scenario.ts` now routes **both** of its fixture
loads through one exported function:

```ts
export async function openScenarioStart(page: Pick<Page, "goto">, scenarioOrigin: string, scenario: Pick<WebScenario, "startPath">): Promise<void> {
  await page.goto(`${scenarioOrigin}${scenario.startPath}`);
}
```

— the unarmed load the recording is made against (line 180) and the Flow lane's
armed load inside `armVariant` (line 299). `page.reload()` no longer appears in
the runner.

### Does any scenario legitimately depend on resuming where the recording ended?

**No.** I enumerated every scenario that has variants, because `armVariant` —
and therefore this load — runs only when a variant is resolved
(`flow-lane/run-flow-lane.ts:70`): `ambiguous-targets`, `auth-gate`,
`failure-surfaces`, `identity-drift`, `keyboard-forms`, `modal-flows`,
`multi-tab`, `product-catalog`.

- Seven of the eight leave the runner's `page` on `startPath` when the
  recording ends. For those, the change is a same-URL `goto` in place of a
  `reload`, which I measured to be equivalent (see "The one assumption I
  measured" below).
- **`auth-gate` is the exception** and is the defect: its recording ends on
  `/scenarios/auth-gate/account`.
- `multi-tab` is the only other fixture whose recording touches a second tab,
  and its own `finalState` asserts the recorded tab is back on
  `/scenarios/multi-tab/`; the details tab is a different `Page` object that
  this load never touches.

No fixture *wants* the recording's last page, and the reason is structural
rather than per-scenario: the Flow the lane is about to run was generated from
a recording that began at `startPath`, so its first action is the recording's
first action. Resuming elsewhere can only mean running a Flow from a page it
was not built for. On `auth-gate` that is literal — the Flow's first action
types into `testid:username`, which exists only on the sign-in page.

The old behaviour also had a state side effect nobody asked for: the armed
reload of `/account` is a GET that the account route answers with a
`deny-account` mutation, so the fixture recorded `deniedAccountCount: 1` and
`lastDenial` before the Flow had executed a single step. That is gone too.

### The guard

The brief asked for a test that would have caught this. It needs two halves,
because neither sees the defect alone — the destination is the function's, and
the decision to use the function is the call site's. Both live in
`packages/test-runner/src/tests/scenario-assertions.test.ts`, added there
rather than in a new `run-scenario.test.ts` because
`.structure-baseline.json` pins `packages/test-runner/src/tests` at 51 files
and the baseline refuses growth; that file already owns the sibling page-fact
call-site gate that `v-lane-facts` added.

`the Flow lane's post-arm load lands on the scenario's startPath, not wherever the recording ended`:

1. Behavioural: `openScenarioStart` is driven with a stub page and must call
   `goto("<origin>/scenarios/auth-gate/")` exactly once and `reload` never.
2. Source-level: `run-scenario.ts` contains exactly two
   `await openScenarioStart(` call sites and no `await page.reload(` at all,
   and the second call site sits after the Flow lane's `armScenarioVariant`.

I also updated `v-lane-facts`' existing call-site gate, which asserted the
armed fact check came after `await page.reload();` — it now asserts it comes
after `await openScenarioStart(page, activeTopology.scenarioOrigin, scenario);`,
so its negative control ("the runner checks the armed facts before the reload")
still bites.

---

## Item 2 — `auth-gate`'s inherited fact, and why the edit changed

### What the report proposed

`v-lane-facts` proposed giving the `expired` variant its own `pageFacts` of
`sign-in-form-visible` and `demo-username-stated`, deliberately **omitting**
`expiry-notice-hidden`, on the stated ground that "the armed run's own redirect
makes it visible".

### Why that ground no longer holds

It was true only of the code item 1 removes. The expiry notice is revealed by
exactly one thing — `?expired=1` in the query string
(`auth-gate/pages.ts`: `if (new URLSearchParams(location.search).get('expired') === '1') …hidden = false`)
— and the only route that sends the browser there is `/account` answering 302
once the session is invalid (`auth-gate/scenario.ts`). Arming is
`expire-session`, which sets a server-side `sessionPolicy` and touches no
markup.

So the sequence decides the answer:

| post-arm step | page presented | `expiry-notice-hidden` |
| --- | --- | --- |
| `page.reload()` of the recording's last page (`/account`) | `/?expired=1` | **false** — the notice is up |
| `goto(startPath)` (item 1) | `/scenarios/auth-gate/` | **true** — the notice is hidden |

Applying the report's edit verbatim would have written a rationale into the
manifest that the same brief's item 1 had just made false, and would have
dropped the one fact that distinguishes the two renderings.

### What I did instead, and why it is stronger

The `expired` variant declares **all three** sign-in-page facts, shared with
the workflow through a documented `SIGN_IN_PAGE_FACTS` constant so the two
declarations cannot drift. `expiry-notice-hidden` on the armed rendering is now
precisely the live assertion that the armed run began at `startPath`: it holds
of the page item 1 presents and fails on the page the old code presented.

Both halves are proven in a real headless browser, not reasoned:

- `apps/scenario-lab/e2e/auth-gate.spec.ts` W19 arms the variant, navigates to
  `startPath` — the Flow lane's armed sequence exactly — and asserts the armed
  set. **6 passed.**
- The same spec's last test already proved the other half: arm, then reload
  `/account`, and the page lands on `/?expired=1` with the alert showing.
- As a negative control I temporarily rewrote W19 to reach the armed rendering
  the old way (`goto('/account')` then `reload()`). It failed on
  `Error: expiry-notice-hidden`, with `1 failed / 5 passed`. Spec restored
  byte-identically afterwards.

Note this only matters at all because of item 1's other consequence: with the
variant silent, `scenarioPageFactSchedule(...).afterArm` was `[]`, so the Flow
lane would have checked **nothing** about `auth-gate`'s armed rendering. It now
checks three facts, one of which is diagnostic of the very defect.

`auth-gate`'s unit test was updated to match: `pageFacts` is out of its
"inherited" loop (it is now declared, and the loop would have kept passing
while asserting the wrong thing, since the two sets are deep-equal), replaced
by a test that the variant declares its own armed facts and that the schedule
yields them on each arming. `apps/scenario-lab/e2e/auth-gate.spec.ts` W19 now
reads `scenarioPageFactSchedule(...).afterArm` instead of the merged
`expected.pageFacts`, so the browser spec checks the set the runner checks.

---

## Item 3 — `ResolvedScenarioWorkflow.expected.pageFacts`

**Left in place, and documented as dead.** The brief offered narrowing or a
plain comment; narrowing is not landable under this brief's ownership, and the
comment now says so in the type.

Two reasons, in order of weight:

1. **Ownership.** After my changes, three assertions still read the
   variant-resolved merge: `apps/scenario-lab/e2e/product-catalog.spec.ts:65`,
   and the `intermediate-state` and `multi-tab` unit tests, which assert
   *positively* that a variant inherits page facts. The latter two are under
   `apps/scenario-lab/src/scenarios/` other than `auth-gate` — this brief's
   explicit must-not-touch. **The brief should have listed
   `apps/scenario-lab/src/scenarios/{intermediate-state,multi-tab}/tests/scenario.test.ts`
   under Owns** for the narrowing option to exist. I did not widen silently.
2. **The field is not simply removable.** `ResolvedScenarioWorkflow.expected`
   is typed `ScenarioExpected` — the authored manifest shape, in which
   `pageFacts` is a legitimate field an author writes. The merge produces a
   `ScenarioExpected`, so the field exists by construction. Dropping it means
   giving the resolved value a type of its own (`Omit<ScenarioExpected,
   "pageFacts">` or a named resolved type), which is a contract change of a
   different size from "four one-line edits".

The doc comment now opens with **"`expected.pageFacts` is dead weight: no lane
reads it"**, says why the merge is meaningless for page facts, names the three
readers keeping it alive, and ends "Read it for nothing, and write no new
reader."

---

## The one assumption I measured

Seven of the eight variant fixtures previously got a `reload` and now get a
`goto` to the URL already open. That is only equivalent if an identical-URL
`goto` is a real navigation rather than a no-op, so I measured it rather than
assuming: a temporary probe in the scenario-lab Playwright suite set an
attribute on `document.body`, called `page.goto` with the same URL, and
asserted the response was non-null and the attribute gone. **1 passed** — the
document is re-fetched. Probe removed and the spec restored byte-identically.

## Files changed

- `packages/test-runner/src/run-scenario.ts` — `openScenarioStart`; both loads
  go through it; the arm callback's comment rewritten. 537 → 562 lines (a
  non-ratcheting `file-lines` warning it already carried).
- `packages/test-runner/src/tests/scenario-assertions.test.ts` — the new
  post-arm-destination test; the existing call-site gate updated off
  `page.reload()`.
- `packages/test-contracts/src/scenario-workflow.ts` — the dead-field comment
  on `ResolvedScenarioWorkflow`. No behaviour change.
- `apps/scenario-lab/src/scenarios/auth-gate/manifest.ts` — `SIGN_IN_PAGE_FACTS`
  and its rationale; the workflow and the `expired` variant both declare it.
- `apps/scenario-lab/src/scenarios/auth-gate/tests/scenario.test.ts` —
  `pageFacts` out of the inheritance loop; a new test for the declared armed
  facts and the schedule on all three armings.
- `apps/scenario-lab/e2e/auth-gate.spec.ts` — W19 reads the schedule's
  `afterArm` rather than the merged field.

**Not touched**: `packages/test-runner/src/bench/**`, `flow-lane/**`, every
scenario other than `auth-gate`, `apps/extension/**`, `domain/`. Many other
files show as modified in `git status`; those are other workers' uncommitted
work, present before I started.

## Commands run and observed results

Exit status captured by redirecting to a file and echoing `$?`, never through a
pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-contracts check` | **0** | `tsc -p tsconfig.json --noEmit`, no diagnostics |
| `pnpm --filter @fluxiq-web-extension/test-contracts test` | **0** | `# tests 59 / # pass 59 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | **0** | no diagnostics |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | **0** | `# tests 407 / # pass 407 / # fail 0` (406 before) |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | **0** | no diagnostics |
| `pnpm --filter @fluxiq-web-extension/scenario-lab test` | **0** | `# tests 146 / # pass 146 / # fail 0` (145 before) |
| `npx playwright test -c e2e/playwright.config.ts auth-gate` | **0** | `6 passed (3.1s)` — includes W19 checking the armed set against the armed `startPath` rendering in a real browser |
| corpus script: `expandCorpus(week1Corpus, loadScenarioManifests(root))` | **0** | `total 43 / runnable 43 (23 recording, 20 flow) / skipped 0 / unresolved 0`; `expectedFailure 10, of which 6 carry a code`; `auth-gate W19 variant=expired lane=flow resolved=true failure={"category":"auth_required"}` |
| `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` | **1** | 32 warnings and 2 FAILs, **none mine** — see below. Real index untouched (`git diff --cached --name-only` → 0 lines) |

All checks were re-run on the fully restored tree after the negative controls;
the numbers above are from that final pass.

### The structure audit is not clean, and was not clean before this work

The audit was run three times against a scratch index. The final state, with
this report staged too:

```
FAIL [working-docs] docs/working/mvp-week1-web-automation-reliability-plan.md: 858 lines exceeds the 800-line threshold.
FAIL [working-docs] docs/working/README.md is out of date with the documents' header blocks.
```

Both are pre-existing and the supervisor's — `v-lane-facts` reported the same
two, and regenerating the index needs `pnpm structure:baseline`, which the wave
rules forbid a worker from running.

The first two runs also showed a third FAIL, which was the parallel edit the
brief warned about:

```
FAIL [imports] apps/extension/src/background/connection/dom-snapshot.ts: 1 import(s) reach into
               another directory's files instead of its barrel, e.g. "../../content/evidence/present" at line 32.
```

I confirmed it was not mine rather than assuming: `git show HEAD:…/dom-snapshot.ts`
carries no `content/evidence` import at all, so line 32 was a working-tree
change by the worker still editing that file. It had disappeared by the third
run — that worker landed their barrel fix in between.

**32 warnings, all pre-existing `file-lines` advisories**, and the warning set
is byte-identical between the first and last runs (`diff` of the two warning
lists is empty). The only warning naming a file I touched is `run-scenario.ts`
at 562 lines, which is not baselined and does not ratchet; it already warned at
530 before `v-lane-facts` and at 537 after.

## Negative controls

Every guard was watched failing with its defect reintroduced, and every file
restored byte-identically (verified with `diff` against a pre-control copy).

| Reintroduced defect | Command | Exit | Observed |
| --- | --- | --- | --- |
| arm callback back to `await page.reload();` | test-runner `test` | **1** | `not ok 362` — `the Flow lane loads the armed rendering through openScenarioStart`; `not ok 363` — `the recording lane's load and the Flow lane's armed load…  1 !== 2` |
| a stray `await page.reload();` kept *alongside* the correct load | test-runner `test` | **1** | `not ok 363` — `nothing in the runner re-presents the page it happens to be on … true !== false` |
| `pageFacts` removed from the `expired` variant | scenario-lab `test` | **1** | `not ok 8` — `the variant states the armed rendering rather than borrowing the workflow's … + undefined` |
| W19 spec reaching the armed page the old way (`goto('/account')` then `reload()`) | `npx playwright test … auth-gate` | **1** | `1 failed / 5 passed` — `Error: expiry-notice-hidden`, `- expiry-notice-hidden with timeout 3000ms` |

## Not verified

- **No Lab command was run, so the Flow lane is not proven end to end.** State
  plainly what this change is and is not evidence for:
  - **Is** evidence that the runner navigates to `origin + scenario.startPath`
    after arming and never reloads (unit test + source gate, both watched
    failing), that an identical-URL `goto` re-fetches the document (measured in
    a browser), and that `auth-gate/expired`'s three armed page facts hold of
    the rendering reached by arming and then loading `startPath`, and fail on
    the rendering the old code reached (both measured in a browser).
  - **Is not** evidence that `pnpm lab … --flow --variant expired` passes. The
    armed page-fact check has still never executed inside a Flow-lane run; the
    recording, the Core proposal, the reset, and the generated Flow are all
    untouched by me and unexercised here. If W19 now fails at the armed fact
    check, the fixture did not arm or did not land where I expect — not a
    product failure in the Flow.
- **The other 19 Flow-lane corpus entries were not run.** For seven of the
  eight variant fixtures the change is `reload` → same-URL `goto`, which I
  measured to be equivalent, but "equivalent in the probe" is not "ran green in
  the lane".
- **Only `auth-gate.spec.ts` was run from the scenario-lab e2e suite** — the
  spec I changed. Other specs in that directory are being edited by other
  workers and a full-suite failure would have been noise.
- **The extension content harness was not run.** I changed no extension file
  and no fixture markup — only a manifest, a contract comment, the runner, and
  tests — so there is nothing there for it to see.
- **`pnpm check`, `pnpm test`, `pnpm build`** were not run: the build is
  forbidden by the wave rules and the repository-wide gates are the
  supervisor's.
- **The existing and clone lanes are unaffected and unexercised.** They arm
  before their only load and never call `armVariant`, so neither item touches
  them.

## Open questions or contradictions found

1. **A Flow run with no variant still never re-presents the page, and that is
   in a file I do not own.** `flow-lane/run-flow-lane.ts:70` calls
   `armVariant()` only `if (input.workflow.variant)`, but `resetScenarioLab`
   runs unconditionally just above it. So `pnpm lab run <scenario> --flow`
   without `--variant` resets the fixture server-side and then runs the Flow
   against a page still showing the pre-reset DOM, from wherever the recording
   ended. **No corpus row is affected** — all 20 runnable Flow-lane entries are
   variant runs, by construction (`laneForResult` sends every unarmed workflow
   to the recording lane) — so this is latent, not blocking. The fix is to lift
   the load out of the `armVariant` callback so it follows the reset
   unconditionally, which means editing `run-flow-lane.ts` and its input
   contract. Outside this brief's Owns; reporting rather than shipping it.
2. **`v-lane-facts`' item-2 recommendation should be treated as withdrawn**,
   not merely amended. Its "Edits I did not make" §1 is written for the
   inheritance reading that was rejected, and its §2 correctly flags the reload
   as a latent hazard; with the hazard fixed, the manifest edit it proposed
   would make `auth-gate` *worse* by omitting the fact that detects a
   regression. If the supervisor prefers the report's literal edit, say so —
   but it should be a deliberate choice, and the browser control above shows
   what it costs.
3. **`v-failure-surfaces`' open question 2 is still open**, untouched:
   `blocked-url` expects a succeeded `web.dom.click` *and* a structured
   failure. Only a Lab run can settle it.
4. **`docs/architecture/testing-facility.md` still documents neither the Flow
   lane nor `--variant`**, so it says nothing about where the armed rendering
   comes from either. Outside my Owns; noted because this change adds a rule
   worth writing down for humans: *the Flow lane presents the fixture twice,
   both times at `startPath`.*
