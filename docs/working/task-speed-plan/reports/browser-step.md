# Browser step speed: S0 spans, S3 readiness from events, S4 one capture a step (t888, lane 1)

## Outcome

Partial. S0 (step spans and the Lab's per-attempt speed section), S3 and S4 are built and tested, and they were measured before and after on three realistic scenarios. The same steps passed in both runs. One part of the S0 brief is not built: per-step timing for a saved Flow's replay. Its hook belongs in files I do not own (see Open questions).

Measured (provider-free, headed, scripted model). Each row gives the mean ms per step as before → after: step / page action / overhead (the step minus the act's own page time). The last column is the look after the act.

| Scenario | Node (n) | Step | Action | Overhead | Look after |
| --- | --- | --- | --- | --- | --- |
| local-classifieds | dom-click (8) | 3197 → 2542 | 640 → 697 | 2556 → 1845 | 916 → 460 |
| local-classifieds | dom-extract_list (3) | 2971 → 2268 | 1797 → 1816 | 1174 → 453 | 801 → 125 |
| local-classifieds | dom-select (2) | 1795 → 948 | 94 → 102 | 1701 → 846 | 1198 → 260 |
| local-classifieds | dom-type (1) | 3289 → 2366 | 538 → 180 | 2751 → 2186 | 1315 → 1361 |
| local-classifieds | browser-navigate (6) | 2591 → 2699 | 1276 → 1315 | 1315 → 1384 | 839 → 849 |
| everything-store | dom-click (6 → 5) | 2505 → 1789 | 271 → 351 | 2234 → 1438 | 1278 → 494 |
| everything-store | dom-extract_list (1) | 4033 → 2822 | 1926 → 1949 | 2107 → 873 | 1342 → 301 |
| company-website | dom-click (5) | 2616 → 1859 | 378 → 403 | 2238 → 1456 | 1205 → 497 |
| company-website | dom-scroll (2) | 1905 → 1201 | 66 → 85 | 1839 → 1116 | 1272 → 341 |
| company-website | dom-extract_list (1) | 3866 → 3133 | 1966 → 1999 | 1900 → 1134 | 1280 → 389 |

Per attempt, browser overhead went from 38.2 to 28.5 s (local-classifieds), from 18.5 to 11.0 s (everything-store) and from 19.4 to 13.6 s (company-website). The look before an act was answered from the kept look 0 → 17 of 32 times, 0 → 4 of 16 (before) and 14 (after), and 0 → 6 of 18. The mean time before the content script started on the look after an act fell from about 1,020 ms to 483, 302 and 244 ms.

Measured split before the change (the S0 question): the look after the act took 0.8 to 1.3 s, of which the capture itself was 0.1 to 0.2 s. The rest was `waitForTabReady`'s one-second stable-address clock: the act used up the before-look's proof, so the after-look had none. The look before the act was already cheap in these scripted runs (0.13 to 0.29 s), because the instant decisions kept the old 10 s proof fresh.

## What changed and why

- **Core step logger** (`packages/fluxiq/src/runtime/llm/step-log/span.ts`, `tool-step.ts`, `index.ts`). A tool step opens a span collector and writes `spans: [{name, at, ms, detail?}]` to `meta.json`. The store is one per process (`Symbol.for`), because the Lab's web server bundles its own copies of Core while the domain imports `fluxiq/automation`. With a store per copy, the first Lab run wrote no spans.
- **Domain** (`node-run/timing/`, `run.ts`). Each node run times `look.before`, `prepare`, `permission`, `act`, `look.after`, `press.settle`, `compose` and `look`. Through a timed gateway it also records `send.<action>` and `page.<action>` (the content script's own start and end), and `sanitize` from each look's answer to its packet. `run.ts` reached 810 lines; it sat at exactly 800 before. `unknownNode` and `handleRefusal` moved to `node-run/refusal-detail/`.
- **S3** (`apps/extension/src/runtime/navigation-events/`, `automation-tab.ts` `readyFromSnapshot`, `action-runner.ts`). Each tab has a count of its top frame's navigation events (`webNavigation` before-navigate, committed, history state, fragment; tab replaced). A look's readiness proof records that count. The proof now stands across the act until the page moves, with no age limit. A navigation event means a wait (`waitForTabReady` is unchanged). `tabs.onUpdated` is not used: its `loading` also reports child frames loading. A proof left by a worker before a restart keeps the old rule: used once, and only within 10 s.
- **S4** (`content/page-changes/`, `runtime/look-reuse/`, `shared/page-changes-message.ts`, `content/message-handler.ts`, `content/index.ts`). Each frame counts what could change a look: DOM mutations (open shadow roots included); `input`, `change`, `scroll`, `focusin` and `focusout`, `toggle`, `load` and `error`, the end of a transition or animation, and fonts loading; and on the window, `resize`, `pagehide`, `beforeunload`, `pageshow`, `popstate` and `hashchange`. FluxIQ's own closed UI host is excluded. The worker keeps the last plain whole-tab look of each tab. It reuses that look only when every frame answers the same script copy and count, the navigation count is the same, and only reads were sent since. Any other action forgets the kept look, so the look after an act is always a fresh capture. A look the page changed under while it was being taken is not kept.
- **Lab** (`packages/test-runner/src/attempt-lane/live/attempt/speed.ts`, `run-attempt-command.ts`). The attempt report gets a speed section per attempt: wall time; decisions split into thinking and output by tokens; browser time split into action and overhead; judge, interpretation, other tools and gaps; and a line per node type with the mean of every span. `attempt.json` carries `speed`.
- Tests beside each change. A page that navigates late: `runtime/tests/automation-tab.test.ts` (the proof ends at the navigation event, and every action after it waits) and `look-reuse/tests` (a navigation event means a fresh look). A mutation between steps: `look-reuse/tests` (one frame's mark moves, so a fresh look) and `content/page-changes/tests`. The action-runner stub answers the new mark message, and each stub starts with no kept look.

## Commands run and observed results

- Core: `npx vitest run src/runtime/llm/step-log/tests/` gave 10 files, 63 tests passed. After the cross-copy test was added, `npx vitest run .../span.test.ts` gave 6 passed. `node scripts/structure-audit.mjs` (Core) exited 0, with warnings only.
- Domain: `tsc -p tsconfig.json --noEmit` and `tsc -p tsconfig.test.json --noEmit` both exited 0. `node scripts/test-domain.mjs llm-evidence/node-run/` (after the split): 560 tests, 560 passed.
- Extension: `node scripts/check-extension.mjs` exited 0. `node scripts/test-extension.mjs runtime/tests runtime/look-reuse runtime/navigation-events`: 450 tests, 450 passed. `... content/`: 1718 tests, 1718 passed. The edited files rerun: 63 tests, 63 passed.
- test-runner: `tsc -p tsconfig.json --noEmit` exited 0. `node --test dist/.../speed.test.js dist/.../cache-share.test.js`: 4 passed.
- Extension `node scripts/structure-audit.mjs`: one violation, `[working-docs] docs/working/README.md is out of date`. It predates my changes: this branch is at 841de4548, before dev's index regeneration (a684eedaa). `node scripts/check/core-mirror.mjs`: "1 mirror set(s) match".
- Lab, `pnpm lab attempt <scenario> --task <id> --authoring-mode answer-first --scripted-model --attempts 2` with `FLUXIQ_LAB_INSTANCE=t888`:
  - local-classifieds dining tables, before (run-mwa6qe6u) and after (run-mwa7fo30): both attempts right; 24 + 18 live steps, 21 + 1 calls; the attempt ran 64 s before and 56 s after. Exit 0 both times.
  - everything-store batteries-and-descaler, before (run-mwa71kt7) and after (run-mwa7rlhm): "answer wrong because records, final_state, repeated_act, not_shown" in both. That is this script's designed verdict: it double-adds to show a repeated act. Exit 1 both times.
  - company-website apprentices, before (run-mwa74w8s) and after (run-mwa7vgm1): same 9 node calls on the same controls, and identical rows read. Both runs then stopped at "script expects no request 2 of kind panel_command", which is the existing script having no second-attempt form.

## Not verified

- No live (paid) run was made. In live runs the before-look should save more, because a model decision often outlasted the old 10 s proof. That was not measured.
- Firefox was not exercised. It reports no `documentId`, so it keeps no proof and waits as before. Reuse there would rest on the content-script copy and the navigation count.
- Replays of a saved Flow (each attempt 2) are still not split per step: the report shows them as about 53 s of gaps.
- Time to first token is not logged, so a decision's input time is not split out.
- The seven other realistic scenarios were not run.

## Open questions or contradictions found

- **Replay timing.** A saved Flow's replay runs through `domain/src/runtime/adapter.ts` (`executeWebAutomationRuntimeCommand`) or Core's answer-first flow-run, not through a tool step. Both are outside my paths. It needs a per-command step-log entry there; the span store is ready for one.
- **Shared file outside my list.** I created `apps/extension/src/shared/page-changes-message.ts`, the message name and answer type shared by content and worker, following `page-challenge-message.ts`.
- **Docs not updated.** `docs/architecture/extension-client.md` (readiness, kept look, the new content message) and `testing-facility.md` (the speed section) need updating. They are not mine to edit.
- **Steps that differ between before and after.** In everything-store, the before run had one extra press, "Not now" on the "Never miss a deal" modal. That modal opens on a page timer (`scenario-lab/.../everything-store/client/shell-script.ts:120`). The faster run left each page before the timer fired, and no page of it shows the modal. In company-website the same controls carry different handle numbers.
- **Clocks still in a step, outside S3 and S4.**
  - Every click that does not navigate waits `NAVIGATION_START_GRACE_MS` (300 ms) in `click-landing.ts`, after the content script has replied.
  - An act that does navigate still pays `waitForTabReady`'s 1 s stable-address clock, by design: it waits only when a navigation began. `dom-type` with submit and `browser-navigate` show this.
  - What remains in a click's overhead after the change: about 0.45 s outside the content script during `act`, 0.13 to 0.27 s for the look before, 0.06 to 0.09 s of sanitize per look, and about 0.05 s each for `prepare` and `compose`.
- **Stale-Core override.** The Lab runs used `FLUXIQ_LAB_ALLOW_STALE_CORE=1`. Core's `fluxiq:build` left no cache stamp only because `span.test.ts` was added during the build; the compiled output was current.
