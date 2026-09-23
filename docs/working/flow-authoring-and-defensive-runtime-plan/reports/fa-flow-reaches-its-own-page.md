# t101 — a Flow reaches its own page, or fails on a blank tab

Worker report. Branch `task/t101-flow-reaches-its-own-page`, worktree
`F:/fxwork/t101-flow-reaches-its-own-page`. No Lab run, campaign, browser or
provider run was started. Nothing was committed or pushed.

## Outcome

**Done.** The harness no longer loads the scenario's start page for a Flow whose
task was to go there. `prepareFlowPage` now leaves those runs on `about:blank` —
the tab a browser opens on — so reaching the page is the Flow's own first step.
t097's classification stays exactly as it was and now has teeth: a Flow that
cannot reach its page fails on the page as well as on the record.

Both browser-level risks t097 named are resolved, by reading the code that owns
each; neither needed a workaround. They are set out in full below, with the
files and lines, because I could not run a browser to confirm them.

**This will make runs fail that currently appear to get further, and that is
the change.** Of the corpus's 55 live instruction tasks, **37 `navigate-and-extract`
tasks now start on a blank tab** and 18 `form` tasks do not — for the reason in
"What is not blanked, and why that is not a compatibility flag". No flag, no
scenario opt-out, no environment variable: the behaviour is derived from the
task's own kind, from the same rule the judgement uses.

---

## What changed and why

### 1. The decision is a rule, in one place, shared with the judgement

New: `packages/test-runner/src/lane-rules/flow-start-page.ts`, `flowStartPage()`,
answering with one of three closed values:

| Value | What the harness does |
| --- | --- |
| `scenario-start-page` | loads the fixture's entry point and leaves the Flow on it (what every run did before) |
| `blank-tab` | loads nothing; the tab is sent to `about:blank` |
| `blank-tab-after-proving-the-arming` | loads the entry point, checks the variant's declared page facts, **then** blanks the tab |

It reads the task's kind through `createdFlowMustReachItsOwnPage(task)`, which I
**exported from `flow-lane/creation/own-page.ts`** rather than restating. That is
the one edit inside `flow-lane/` the caller-side change genuinely required, and
it is required: two copies of "which kinds must carry their own navigation" would
drift into either failing a task that was handed its page or passing a Flow the
harness carried. A test pins them together by iterating all four kinds and
asserting the harness blanks exactly what `createdFlowOwnPage(...).required` says.

`lane-rules/` is where "what a run needs and is judged on, by the lane it runs
on" already lives (`built-flow.ts`, `core-identity.ts`, `final-state-facts.ts`),
and `run-scenario.ts` already imports that barrel.

### 2. The caller

`packages/test-runner/src/run-scenario.ts`, the `prepareFlowPage` hook at what is
now line ~269. The arming still happens first (it is a server-side call and does
not need a page). Then:

```ts
const startPage = flowStartPage({ task: creation?.task, moment, armedFacts: pageFacts.afterArm });
if (startPage !== "blank-tab") {
  await openScenarioStart(page, activeTopology.scenarioOrigin, scenario);
  if (!unarmedBuild) await assertExpectedFacts(pageFacts.afterArm, playwrightScenarioFactProbe(page));
}
if (startPage !== "scenario-start-page") await page.goto(BLANK_TAB_URL);
```

No change to the lane's contract was needed, which is what t097 could not get
past: the caller already holds `creation.task`, so nothing about
`prepareFlowPage`'s signature moves and no `strictFunctionTypes` contravariance
problem arises. `BLANK_TAB_URL` is `"about:blank"`, declared once with the reason.

**The arming is still proved against a loaded page.** For a variant task the
entry point is loaded, `pageFacts.afterArm` is checked, and only then is the tab
blanked — so "the fixture did not arm as declared" can still never arrive
disguised as "the generated Flow failed". The cost is one extra load of the entry
point before the Flow's own, which is stated in the code and repeated under "Not
verified". For a task with no variant `afterArm` is empty by construction
(`scenarioPageFactSchedule`: the armed facts are the variant's), so nothing is
loaded at all and the fixture sees exactly one GET — the Flow's.

**Blanking also does the other job the load was doing.** `creation/lane.ts`'s
comment was right that the lane cannot simply drop the load, because the reset
and the arm are server-side and the tab would otherwise still show wherever the
exploration ended. `about:blank` clears that too.

### 3. The two browser risks t097 named

**(a) "The extension tab is bound to the scenario origin at pairing time."** It
is not bound; it is tracked. `activateScenarioTab` (`run-scenario.ts`) runs once
after pairing and only waits until the extension *reports* that tab. What the
extension keeps is `ActivePage` (`apps/extension/src/background/connection/active-page.ts`),
which re-reads Chrome's active tab on every tab event and again immediately
before every action (`server-command-channel.ts`: `await this.deps.page.refresh()`
in the `execute_action` branch). Blanking the tab keeps the same tab id active,
so `activeTabId` stays defined and nothing in the harness re-checks the active
tab's origin after pairing (`activateScenarioTab` has exactly one call site).

The one real effect is that `ActivePage.currentUnsupported` becomes set, because
`unsupportedPageForUrl` delegates to the shared rule and `about:` is a privileged
scheme (`runtime/unsupported-page.ts`). That reason is passed to the runtime as
`request.unsupportedPageReason` — and `unsupportedPageReasonFor`
(`runtime/action-runner.ts`) consults it **only for non-navigation actions**; a
navigation is judged by its destination. That is precisely the split this task
wants, and it is why `about:blank` is the right blank page rather than a neutral
page on an allowed origin:

- a Flow whose first node is its navigation leaves the blank tab and runs;
- a Flow with no navigation cannot do anything there at all, and its first click
  is refused with `Browser and extension pages cannot be automated.`

**(b) "Navigating from `about:blank` runs under the network guard."** The guard
routes by destination, not by initiator: `installDeterministicNetworkGuard`
(`packages/test-runner/src/network-guard.ts`) passes `route.request().url()` to
`isAllowedRequest`, `about:` is in `INTERNAL_PROTOCOLS` and returns allowed, and
the scenario origin is in `pageOrigins`. A navigation from a blank tab to the
fixture is therefore an ordinary allowed request. `page.goto("about:blank")`
issues no network request at all.

**A third effect neither of us named, which I could not test and am stating
rather than burying.** `navigationTargetTab` (`runtime/navigation-target.ts`)
deliberately refuses to take over a page the extension cannot automate, so with a
blank tab in front a Flow's navigation no longer drives "the page in front": it
drives the last-driven automation tab, or, if the service worker restarted and
lost its module state, opens a new one. In the expected case the automation tab
*is* the tab we blanked — exploration drove it — so nothing visible changes. In
the restart case the Flow runs in a new tab; `findScenarioPageWithExpectedState`
scans every page in the context, so the oracle still finds it, and non-navigation
actions follow Chrome's active tab, which the new tab becomes. I judge both paths
sound from the code; neither was exercised in a browser.

### 4. Scope: what is not blanked, and why that is not a compatibility flag

- **`form` and `extract` tasks keep their page.** This is the same rule t097
  wrote into `own-page.ts` and defended there: a person asking for the form in
  front of them to be filled in *is on that page*, so "where a real user would
  start" for them is the page, and blanking it would start them somewhere no user
  ever is. It is derived from the task's declared kind, not from a scenario
  opt-out, and the judgement uses the identical predicate. The corpus has no
  `extract`-only task today; it has 18 `form` tasks.
- **The recorded-Flow lane keeps its page.** Its Flow replays a script that began
  on the page it was recorded from, so there is no instruction that says it
  should have gone anywhere and no `ownPage` judgement to hold it to. (The two
  lanes cannot both be requested: `assertLaneFlag` refuses `--flow` with
  `--llm-task create-flow`, and `run-scenario.ts:93` refuses a creation request
  without a live run.)
- **The repair lane's replay is blanked**, for a created Flow that must reach its
  own page. It prepares through the same hook with no `moment`, and a repaired
  Flow that still cannot reach its page must not be carried there either.
- **The build is not blanked.** See the open question below — this is the one
  deliberate limit, and it may matter more than the fix.

### 5. Comments that had become false

Three comments stated present-tense behaviour that this change makes untrue.
They are in `flow-lane/`, and I corrected them rather than leave the next reader
a false map: `creation/own-page.ts`'s header ("It fixes neither half of the
harness's navigation"), `creation/lane.ts`'s `prepareFlowPage` doc (the bolded
"the lane cannot leave it out" paragraph), and the doc on `creation/tests/lane.test.ts`'s
own-page test. All three are comment-only; no behaviour in those files changed.

---

## Commands run and observed results

All in `F:/fxwork/t101-flow-reaches-its-own-page`.

**`pnpm --filter @fluxiq-web-extension/test-runner test`** — exit 0:

```
# tests 1326
# pass 1326
# fail 0
# duration_ms 39623.5438
```

The seven tests added (t097's baseline was 1319):

```
ok 562 - a task whose instruction is to go somewhere is left the blank tab a browser opens on
ok 563 - a task that is given its page keeps being given it, because that is where the person asking is
ok 564 - the harness blanks the tab for exactly the tasks the judgement holds to reaching their own page
ok 565 - an armed rendering is proved on a loaded page first, and the Flow still starts blank
ok 566 - the build keeps its page, whatever the task's kind
ok 567 - an unnamed preparation is a run, not a build, and the recorded lane keeps its page
ok 717 - the runner leaves a Flow that must reach its own page on a blank tab, and proves any arming before it does
```

`ok 717` is the call-site wiring test, in the existing
`run-evaluation/tests/runner-wiring.test.ts` beside the other assertions about
`run-scenario.ts`'s source: it pins that the load is now conditional, that the
blanking happens after the armed-fact check, and that exactly one
`openScenarioStart` remains in the hook. That file's existing lane-rules test
(`ok 712`) asserts the runner's import line verbatim and had to be updated for
`flowStartPage`; it was the one failure of my first full run
(`# pass 1324 / # fail 1`) and is green above.

**`pnpm check`** — exit 0:

```
# pass 182     (structure:test)
# pass 88      (lab:test)
# pass 116     (task:test)
structure-audit: passed (100 warning(s), 121 baselined).
... 10 of 11 workspace projects: check: Done
```

t097 reported this failing on a stale `docs/working/README.md`; it is clean on
this branch. `run-scenario.ts` is 791 lines against the 800-line ratcheted limit,
which is why the explanation for the change lives in `flow-start-page.ts` and
only the decision lives at the call site. Its `swallowed-failure` (14) and
`failure-as-empty` (4) baselines are unchanged — the new code catches nothing.

Run once under Git Bash, `pnpm check` segfaulted (exit 139) with no output; it
then passed twice under PowerShell. I recorded it and did not chase it: this
machine has known faulty RAM and a known antivirus/bash-spawn problem.

**The two `ten-sites-r5` runs, replayed through the changed code.** Each run's
recorded `snapshots/flow-lane.json` (in the supervisor's checkout,
`F:/!FluxIQWebExtension/test-runs/instances/r5/`) was read and its task and flow
shape passed through the real `flowStartPage` and `createdFlowOwnPage` /
`assertCreatedFlowReachesItsOwnPage` from the built `dist`, and its first
recorded action through the extension's own `unsupportedAutomationPageReason`
(transpiled from `apps/extension/src/runtime/unsupported-page.ts` with esbuild, so
the refusal below is executed rather than quoted). No browser, no Core, no
provider. Output:

```
=== run-mudwci8d-de88aa32 (navigate-and-extract, everything-store-first-page-plus-earbuds)
  flow shape          : navigationNodes=0 of 7 nodes; actions {"web.dom.click":3,"web.dom.extract_list":1,"web.dom.type":1}
  harness leaves it on: about:blank   [flowStartPage -> blank-tab]
  first recorded action: web.dom.click -> refused: Browser and extension pages cannot be automated.
  own page            : {"required":true,"navigationNodes":0,"reached":false}
  lane says           : flow_lane.flow_does_not_reach_its_page: The created Flow holds no node that reaches its own page, so a navigate-and-extract task ran only because the harness had already loaded the page for it
=== run-mudw1ktb-0557816b (navigate-and-extract, everything-store-plus-earbuds-under-50)
  flow shape          : navigationNodes=1 of 5 nodes; actions {"web.browser.navigate":1,"web.dom.click":1,"web.dom.extract_list":2}
  harness leaves it on: about:blank   [flowStartPage -> blank-tab]
  first recorded action: web.browser.navigate -> judged by its destination, so it leaves the blank tab (runtime/action-runner.ts: unsupportedPageReasonFor)
  own page            : {"required":true,"navigationNodes":1,"reached":true}
  lane says           : passes the own-page judgement
```

Read against the post-mortem, that is the honest pair:

- **`run-mudwci8d`** is the run this task exists for. Its Flow holds no
  navigation node and no URL; its very first action is a click. Handed the store's
  home page it retried that click once and carried on to twelve wrong records.
  Left a blank tab it cannot take a single step, and the lane reports
  `flow_lane.flow_does_not_reach_its_page` ahead of anything about its records.
  The harness is no longer the reason it got as far as it did.
- **`run-mudw1ktb`** carries its navigation and its first action *is* that
  navigation, which is judged by its destination and leaves the blank tab. It
  starts blank and still reaches its page, then goes on to fail on its dataset,
  which was already the true story. That it is unaffected is the control: the
  change costs a Flow that does its own first step nothing.

Both runs name no variant, which the script asserts rather than assumes — with a
variant, `afterArm` would have to come from the manifest and the decision would
be `blank-tab-after-proving-the-arming`.

The replay script is `t101-replay-r5.mjs` in this session's scratchpad, with the
transpiled `unsupported-page.mjs` beside it. Neither is committed: `test-runs/` is
untracked evidence and a test depending on it would not be reproducible.

## Files changed

New:

- `packages/test-runner/src/lane-rules/flow-start-page.ts`
- `packages/test-runner/src/lane-rules/tests/flow-start-page.test.ts`

Changed:

- `packages/test-runner/src/run-scenario.ts` (the hook, `BLANK_TAB_URL`, the import)
- `packages/test-runner/src/lane-rules/index.ts` (barrel)
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts` (the pinned import line, and the new call-site test)
- `packages/test-runner/src/flow-lane/creation/own-page.ts` (exports the shared predicate; header comment corrected)
- `packages/test-runner/src/flow-lane/creation/lane.ts` (comment only)
- `packages/test-runner/src/flow-lane/creation/tests/lane.test.ts` (comment only)

Nothing under `apps/extension/src/content/**`, `domain/src/**`,
`packages/test-runner/src/existing-fluxiq-control.ts` or
`packages/test-runner/src/live-llm/**` was touched.

## Not verified

- **Nothing was run in a browser.** No Lab run, campaign, browser or provider
  call. Everything above about what the extension does on a blank tab is read
  from its source — `unsupported-page.ts`, `navigation-target.ts`,
  `action-runner.ts`, `automation-tab.ts`, `active-page.ts`,
  `server-command-channel.ts` — and, for the refusal itself, executed against the
  extension's own transpiled rule. **The first live created-Flow run on this
  branch is the real test**, and it should be watched for three things: that a
  Flow carrying a navigate node still reaches its page from blank; which tab it
  ends up in (the blanked one, or a new one); and that the extension raises no
  new failure of its own while the front tab is unautomatable.
- **Whether Core gates anything on the browser-state input.** The extension will
  now publish a `client.state_update` describing an unsupported page just before
  the run starts. I found no dispatch-time gate on it in the extension, and Core's
  web-automation browser state is passive evidence, but I did not read Core's
  planner to rule out a refusal there.
- **The extra load for a variant task.** A `navigate-and-extract` task with a
  variant loads the entry point once to prove the arming, then blanks, then the
  Flow loads it again. A fixture that renders differently on the first load of a
  browser session — a once-per-session banner held in cookies or local storage,
  which the server-side reset does not clear — would show it to the proof and not
  to the Flow. I found no such fixture, and I did not audit all ten sites for one.
- **Failure screenshots for a Flow that cannot start.** The failure screenshot
  falls back to `scenarioPage`, which for a nav-less created Flow is now the blank
  tab. That is arguably the truthful picture — it is what the Flow was looking at —
  but it is a change in what the bundle shows, and nobody has looked at one yet.
- **`pnpm build` was not run** at the repository root. `pnpm test` builds the
  package it tests and `pnpm -r check` typechecked all ten projects.

## Open questions and contradictions found

1. **The build is still handed its page, and that is the likelier cause of the
   missing navigation node.** FluxIQ explores by running real Flow nodes, and a
   Flow is assembled from the nodes that ran. A model that is *already on* the
   store's home page never has to run a navigate node, so no navigate node can
   end up in the Flow it proposes — which is exactly the shape of
   `run-mudwci8d`. Blanking the build would change what the model sees and
   therefore which Flow it writes, so it is a measurement decision for the
   supervisor rather than a harness fix, and I left it. **If the next live run
   still produces `navigationNodes: 0` Flows, this is where to look next**, and
   the change is one line in `flowStartPage`.
2. **`prepareFlowPage`'s name and the lane's contract now understate it.** The
   hook prepares the run, which sometimes means presenting a page and sometimes
   means deliberately presenting none. `creation/lane.ts`'s doc says so now, but a
   future task may want to rename it (`prepareFlowRun`) or let the lane read the
   decision instead of inferring it from a `moment`.
3. **The corpus has no `navigate`-only and no `extract`-only task** — 37
   `navigate-and-extract` and 18 `form`. Both rules are written and tested for all
   four kinds, but only two are exercised by real tasks.
4. **t097's two remaining producers of a bare `ambiguous_or_unknown`**
   (`lane-observation.ts:84`, `bench/evaluate-run.ts:224`) are still open; I did
   not touch them.
