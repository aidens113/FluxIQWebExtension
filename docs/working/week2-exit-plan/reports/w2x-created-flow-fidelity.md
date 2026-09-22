# w2x-created-flow-fidelity (P17, t065)

Worker report for `### Brief: w2x-created-flow-fidelity`. Worktrees: `F:\fxwork\t065\!FluxIQWebExtension` and
`F:\fxwork\t065\!FluxIQ`, both on `task/t065-created-flow-fidelity`. Changes are left uncommitted.

## Outcome

**Partial.** (a) is fixed, and the fix is proven live in the real panel. (b) has one proven cause, fixed in Core,
and a second cause I found and did not fix, because it is in a file I do not own. Nothing yet produces the
measure of success: I got no created Flow on `everything-store` that reaches the results page with no model.

- **(a) Navigate.** Fixed at its cause. The first navigate of a run drove a tab nobody was watching.
  - The extension picked the last tab it had driven, or opened a new one. Every other action, and every
    snapshot Core reads, uses the page in front.
  - Now navigate drives the page in front, unless that page is a browser page, an extension page, or
    FluxIQ's own panel.
  - It also no longer reports success when Chrome shows its error page. Chrome keeps the requested URL in
    the address bar, so the old URL check passed.
  - Live, in a fresh browser profile, the panel exploration's navigate reached the scenario tab in both
    places I could check. The screenshots show the soft-check page for `/s?k=wireless+earbuds`, then the
    results page. Browser history shows the same.
  - Before the fix (same harness), history showed each navigate loading `/s?k=...` in another tab. The
    screenshotted tab stayed on the home page. That is E9's mechanism.
- **(b) Kept steps.** Cause 1 fixed. Nothing the model was shown said that the Flow replays from the page as
  it first was. The evidence policy tells it that what it changes while exploring is only for looking.
  - Core's Flow-script format, shown in the completion schema and in refusal feedback, now says so.
  - Live, n=1: the created Flow has one acting step for each change exploration made, in the same order.
    E9's Flow had none.
- **(b) Cause 2, not fixed.** Two of those steps, both dismissals, resolved to the wrong controls: the
  "Search in" select and the "Go" button.
  - The keyless run (0 provider calls) navigated, clicked the select, then failed at node 3 with
    `web.intervention.required`: the "Never miss a deal" modal was still open.
  - No dataset was stored, so `matchedRecords` against `expectedRecords` could not be measured.
  - The cause is in the domain's plan-handle resolver. It is outside my ownership (details below, with a
    deterministic probe).
- **Harness defect: stale service worker.** A persistent browser profile keeps running the extension's
  service worker from the profile's first launch.
  - Copying a rebuilt extension into `extension-under-test` does not replace it.
  - Three of my live rounds ran the pre-fix service worker, and so did one Lab debug run.
  - Any E1 lane that reused a workspace after an extension change may have tested old code.

## What changed and why

Downstream (`F:\fxwork\t065\!FluxIQWebExtension`):
- `apps/extension/src/runtime/navigation-target.ts` (new). Decides which tab a navigate drives when it names
  no tab and asks for no new one: the page in front, unless it is a browser or extension page, FluxIQ's own
  panel, or a tab whose URL cannot be read.
- `apps/extension/src/runtime/action-runner.ts`:
  - `tabRequestFor` uses the new module. The navigate branch reads the top frame's `errorOccurred`, and a
    load failure is reported as `web.navigation.unexpected` with the message "The browser could not load <url>."
  - `BrowserActionRunRequest.ownOrigins` is new.
- `apps/extension/src/runtime/navigation-outcome.ts`: `compareNavigatedUrl(requested, landed, loadFailed)` never
  matches when the load failed.
- `apps/extension/src/runtime/command-router.ts`: optional `ownOrigins()` option, passed onto the request.
- `apps/extension/src/background/connection/server-command-channel.ts`: passes `settings.coreApiUrl` (default
  `DEFAULT_CORE_API_URL`) as FluxIQ's own origin. The panel is served from Core's origin and a run is usually
  started from it, so it must never be navigated away.
- Tests:
  - `runtime/tests/navigation-target.test.ts` (new, 5 rows).
  - `runtime/tests/action-runner.test.ts` (+3 rows): navigate drives the page in front and not the tab it
    last drove; with the panel in front it opens its own tab; a failed load fails although the URL matches.
  - `runtime/tests/navigation-outcome.test.ts` (+1 row).

Core (`F:\fxwork\t065\!FluxIQ`):
- `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/plan/flow-script-format.ts`: one new
  statement, plus a header note on why. The Flow runs later with no model, from the page the run starts on,
  and nothing done while gathering evidence is still in effect. Every change the answer depended on is a step,
  in order, including closing a notice, prompt or banner. Arriving at an address closes nothing.
- `.../flow-bootstrap/plan/tests/flow-script-format.test.ts` (new, 3 rows). The statement is in the format, and
  it reaches the model through `AUTOMATION_STUDIO_EVIDENCE_FLOW_BOOTSTRAP_COMPLETION_SCHEMA`.

I did not touch `evidence-loop.ts`, `loop-limits/*`, `recovery/*`, `live-patch*`, the recorder, extraction
pagination, blocked-action classification or `service.ts`.

## The created Flow, step by step (es2, adaptation `adaptation.bootstrap.b6b93924...`, applied)

What exploration did, from the adaptation's own `evidenceTrace` (10 provider calls; the explore driver
reported $0.0546 and 44,397 evidence bytes):
1. `web.inspect_current_page` (initial)
2. `web.press_control`, callId `dismiss.1`
3. `web.press_control`, callId `dismiss.2`
4. `web.enter_field`, callId `search.1`
5. `web.press_control`, callId `search.2`
6. `web.press_control`, callId `continue.1` (the store's browser check)
7. `web.detect_repeating_structure`
8. `web.inspect_current_page`
9. `web.navigate_same_origin` (74-byte result)
10. `web.navigate_same_origin`
11. complete

The Flow it created, then what it kept or dropped:

| Node | Node type | Target | Kept or dropped |
| --- | --- | --- | --- |
| s1 | navigate | the store home URL | Start page. |
| s2 | click | `#\:r17r93\:`, the "Search in" select | Should be a dismissal (step 2). Wrong control. |
| s3 | click | `[data-testid="nav-search-submit"]`, "Go" | Should be a dismissal (step 3). Wrong control. |
| s4 | type | "wireless earbuds" into "Search Brightaisle" | Correct (step 4). |
| s5 | click | "Go" | Correct (step 5). |
| s6 | click | the "Search in" select | Should be "Continue shopping" (step 6). Wrong control. |
| s7 | click | "Go" | Possibly the Plus filter. Wrong control. |
| s8 | `extract_list` | item `#\:r11y0n\: > div.css-09atwzr`; `url` read from `img@src` | The expected dataset reads `h2 a@href`. |

- Dropped: no Brightaisle Plus filter that works, and no scroll to load the last four results.
- The mapping of s2, s3, s6 and s7 to exploration steps is inferred from order. Core does not keep the model's
  raw completion, so I could not read the handles it wrote.
- Compare E9, lane B: navigate to the results URL, click Plus, `extract_list`, end. No dismissal, no search step.

Keyless run through the panel (`demo:llm:explore:request:run`, 0 provider calls, Core run `f8b17a57`):
- navigate: succeeded, same URL.
- click s2: succeeded.
- click s3: failed with `user_intervention_required` / `web.intervention.required`: "the element is inert; a
  modal dialog is open over the page".
- No dataset was stored.

## Cause 2 of (b), outside my ownership: the plan resolver forgets controls exploration removed

`domain/src/runtime/llm-evidence/plan-resolution/target-packets.ts` keeps only the **newest** packet for each
page. Once exploration dismisses an overlay, its controls are gone from that page's newest packet:
- A handle for the dismissed control, **with its location**, resolves `unknown`, so the plan is refused.
- **Named bare**, the handle is skipped on that page and resolves against whatever *other* page has the same
  number. `stable-handles.ts` numbers controls per page, so that is a different control. It resolves with no
  refusal.

A deterministic probe against the built domain (`createWebLlmStableTargetHandles` + `createWebLlmTargetPackets`,
scratch file `t065-cff/t065-handle-probe.mjs`) printed:

```text
home, overlays up:   target.1=Search in, target.2=Go, target.3=Search Brightaisle, target.4=Accept, target.5=Not now
home, after dismiss: target.1=Search in, target.2=Go, target.3=Search Brightaisle
results page:        target.1=Search in, target.2=Go, target.3=Search Brightaisle, target.4=Brightaisle Plus, target.5=Next
target.4 bare -> {"ok":true,"selector":"#plus",...,"accessibleName":"Brightaisle Plus"} | at home -> {"ok":false,"code":"unknown"}
```

So a created Flow cannot currently name a control that exploration itself removed.

Smallest fix I would make:
- In `target-packets.ts`, keep each page's handle **history**, not only its newest packet. `stable-handles.ts`
  never reuses a number on a page, so an old handle can never mean another control there. Drop the history
  only when a newer packet gives an existing number to a different address, which is its 99-control reset.
- A bare handle that two pages give different selectors then becomes `ambiguous` and is refused, where today
  it becomes a silent wrong click.

It needs a brief that owns `domain/src/runtime/llm-evidence/plan-resolution/*`.

## Commands run and observed results

All live runs set `FLUXIQ_TEST_ENV_FILES=none`, `FLUXIQ_WEB_EXTENSION_ROOT`/`FLUXIQ_CORE_ROOT` to the t065
worktrees, and ports 50899 (panel) and 50900 (gateway). They ran sequentially. A random panel identity was
kept in scratch and never printed. The DeepSeek key was read from `F:\!FluxIQWebExtension\.env.local` into
the `demo:llm:setup` process only. `FLUXIQ_LAB_ALLOW_BEHIND_CORE` was never set.

Driver: scratch `t065-cff/panel.sh <label> <phases>`, which runs
`pnpm demo:llm:{prepare,setup,explore,explore:request:apply,explore:request:run}` with
`FLUXIQ_LLM_SCENARIO_ID=everything-store` and the `first-page-plus-earbuds` instruction.

| Round | Workspace | Service worker actually running | Result |
| --- | --- | --- | --- |
| es1 baseline | fresh | pre-fix | explore failed, `flow_bootstrap.evidence_limit` (19 decisions, 63,922 B); no navigate used |
| es1 r2 | reused | pre-fix (stale, see below) | `evidence_limit` (18 decisions, 63,414 B) |
| es1 r3 | reused | n/a | Core web build `kill EPERM`; no provider call |
| es1 r3b | reused | pre-fix (stale) | `evidence_tool_failed` at 63,986 B. Navigate loaded `/s?k=` in another tab (history visit 15, LINK); the scenario tab stayed home |
| es1 r4 | reused | pre-fix (stale) | `evidence_tool_failed` at 63,797 B. Navigate: history visit 20 `/s?k=` LINK in another tab, then visit 22 RELOAD of that tab; the screenshots stayed on the home page; the model then searched on the scenario tab. **E9's mechanism reproduced.** |
| es2 a1 | fresh | fixed | `evidence_tool_failed` at 63,888 B. **Navigate landed in the scenario tab**: screenshot `00116` is the soft-check page and `00124` the results page; history visits 7-10 |
| es2 a2 | fresh | fixed | `evidence_repeat_without_progress` (15 decisions, 46,504 B) |
| es2 a3 | fresh | fixed | Panel saw `generation.http-400`, but Core persisted the proposal at 23:53:23Z |
| es2 a4 | fresh | fixed | Explore reported that proposal in 16 s (`proposed`, 10 calls, $0.0546). Apply's driver failed `exploration_request_apply.failed`, while Core shows the adaptation `applied` |
| es2 run | fresh | fixed | 0 provider calls. Failed at node 3 with `web.intervention.required`, as above |

Evidence for these rounds is under `F:\fxwork\t065\!FluxIQWebExtension\test-runs\panel-es1` and `\panel-es2`
(ignored).

Lab, provider-free: `node scripts/lab/run-lab.mjs run navigation --flow --target isolated`.
- Post-fix: `run-mubuyrqn-ce8f0e18`, passed.
- Pre-fix sources, rebuilt: `run-mubv2tka-bcd69274`, also passed.
- The Lab cannot see this defect. `findScenarioPageWithExpectedState` (`packages/test-runner/src/run-scenario.ts:736`)
  searches every scenario-origin tab for the expected final state, so a navigate into a new tab passes.

Stale service worker, the evidence:
- `panel-es1/browser-profile-isolated/Default/Service Worker/ScriptCache/*_0` dates from 15:30 local, the first
  launch. It contains 0 occurrences of `navigationTargetTab`, while `extension-under-test/background/index.js`
  at 16:17 contains the fix.
- A Lab persistent workspace run with a temporary `chrome.storage` debug write (`run-mubvskal-e16627a1`) wrote
  nothing, and its ScriptCache matched the first launch's build. The debug code is removed; `git diff`
  shows none.
- The es2 fresh profile's ScriptCache contains the fix (2 matches).

Focused tests and checks:
- Focused extension unit tests (scratch runner `t065-ext-focused.mjs`: same esbuild config as
  `scripts/test-extension.mjs`, only `navigation-target`, `navigation-outcome`, `action-runner` and
  `automation-tab`): `# tests 49, # pass 49, # fail 0`.
- Core: `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/plan/tests/flow-script-format.test.ts`,
  3 passed.
- Downstream `FLUXIQ_TEST_ENV_FILES=none pnpm check`:
  - First run: exit 1, `failure-as-empty` in `navigation-target.ts` (a catch returning undefined). Replaced
    with `URL.canParse`.
  - Rerun: exit 0, `structure-audit: passed (84 warning(s), 122 baselined)`.
- Core `pnpm check`: exit 0, `structure-audit: passed (170 warning(s), 361 baselined)`; the `tsc --noEmit`
  runs in `packages/fluxiq` and `apps/web` both "Done".

Spend:
- The one proposal reported $0.0546 over 10 calls.
- The driver records no cost for failed explorations. Six paid explorations failed, at about 11-19 calls each;
  I estimate $0.4-0.6 in total. No 429s were seen.

## Not verified

- The measure of success. No created Flow reached the results page past both overlays with no model, so
  `matchedRecords` against `expectedRecords` was never measured. The judge script is ready at scratch
  `t065-cff/t065-judge.mjs`, which uses the Lab's `measureExtraction` and the `extract-first-page` records.
- The load-failure branch of navigate (`errorOccurred`) is unit-tested only. No live refused connection was
  driven.
- The panel-in-front rule (a navigate never takes over FluxIQ's own panel) is unit-tested only. The demo
  harness runs the panel in a separate browser.
- (b) rests on one completed build, n=1. Whether the model writes the dismissals reliably is unmeasured.
- The mapping of the created Flow's s2, s3, s6 and s7 to exploration's steps is inferred from order, because
  the model's completion is not persisted.
- Why the es2 apply driver failed while Core shows the adaptation `applied`, and why a3's panel saw HTTP 400
  while Core persisted the proposal.
- The last `URL.canParse` change was made after the live runs. It behaves the same for http URLs. The dist
  was rebuilt, but no live run used this exact build.

## Open questions or contradictions found

1. **Stale extension service worker in persistent profiles (harness).** Any demo or Lab workspace reused
   after an extension rebuild keeps running the service worker from its first launch. The manifest version
   stays `0.1.0` and the profile's `Service Worker/ScriptCache` is not refreshed. Options:
   - clear `Default/Service Worker` in the harness before launch;
   - bump the manifest version per build;
   - reload the extension after launch.

   This affects every persistent-workspace verification of extension changes, including E1's lanes and
   P2/P9's.
2. **Plan-handle resolution** (cause 2 above) is the remaining blocker for (b). It needs an owner for
   `domain/src/runtime/llm-evidence/plan-resolution/`.
3. **The Lab masks navigate-tab defects.** Its all-tabs final-state search should check the page the Flow
   acted on.
4. **Exploration on this task rarely completes.**
   - 1 in 7 paid explorations produced a proposal.
   - The others ended on `evidence_limit` or `evidence_tool_failed` at about 64,000 bytes (P11 / P2), or on
     `evidence_repeat_without_progress`.
   - The fixed 64,000-byte bootstrap budget is in `loop-limits/flow-bootstrap-evidence-loop.ts:107`, which I
     did not touch.
5. **Docs (not owned).** The Navigate row of `docs/architecture/web-capabilities.md` (line 106) still says
   "Reuses the remembered automation tab unless `newTab` or a named tab says otherwise". Suggested:
   > Drives the page in front, the one every other action runs on and Core observes, unless it is a browser
   > or extension page or FluxIQ's own panel (the Core API origin). Then it reuses the remembered automation
   > tab, or opens one. A top frame that ended in the browser's error page fails as `navigation_unexpected`
   > even when the address bar shows the requested URL.
