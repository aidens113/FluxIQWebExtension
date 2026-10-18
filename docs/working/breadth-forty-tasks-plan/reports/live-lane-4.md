# Report: live-lane-4 (t567, slot-4, instance bf-slot-4)

Lane tree `C:/Users/osrs_/FluxStuff/fxwork/t567` (downstream and Core branch `task/t567-a8-lane-4b`). Synced to dev
`5e59a563` / Core `76d66fe8` at start, `fb3919e2` after the first run, then dev `48cdbfee` / Core `c1ed1bdd` after
integration round 1. Launch shape: A8 (`--authoring-mode project`, `--llm-max-cost-usd 0.25`, `--llm-max-calls 250`,
the five environment variables), workspace `bf-<task>`, instance `bf-slot-4`. **Stopped 2026-10-17** at the user's
wrap-up; work continues later.

## Fix log

Fixes 1-4 were committed by the supervisor (downstream `f4286559`, Core `cb765939`) and merged to dev in integration
round 1. **Fixes 5 and 6 are uncommitted in `fxwork/t567`** (both repositories), complete and tested, not run live.
Worker reports `lane4-w1` to `lane4-w6` beside this file hold the detail.

| # | Files | Exposed by | Validation (re-run by the lead) | Status |
| --- | --- | --- | --- | --- |
| 1 | Icon-only controls in the page view. Downstream: `apps/extension/src/content/evidence/{declared-cursor.ts (new), press-cursor.ts}`, `content/identity/accessible-name.ts`; `domain/src/runtime/llm-evidence/page-view/{element/icon-hints.ts (new), element/index.ts, element/words.ts, line/choice.ts, line/control-holders.ts, line/facts.ts, line/render.ts, view-line.ts}`; tests `content/evidence/tests/declared-cursor.test.ts`, `identity/tests/accessible-name.test.ts`, `page-view/tests/{icon-controls (new), line-rules}.test.ts`, `plan-resolution/tests/press-control.test.ts`, harness `e2e/content/tests/evidence/tests/{icon-controls.spec.ts (new), page-view-controls.spec.ts}` | run-mvcwf9u2-28bb44fd: the card's save control (a span styled with its own pointer inside a pointer card) was read as inheriting the cursor and never printed | domain `test-domain.mjs runtime/llm-evidence` 1153/1153; extension `test-extension.mjs content/evidence/tests content/identity/tests` 187/187; structure audit passed | Merged. Rode in the passing run-mvczav2x (no icon in that task); not live-proven on a save |
| 2 | "drawing" identity signal for wordless controls (build path). Downstream: `apps/extension/src/content/identity/{drawing.ts (new), drawing-attribute.ts (new), candidates.ts, score.ts, corroboration.ts, index.ts}`, `content/element-finder.ts`, `content/describe-element.ts`, `shared/dom-element.ts`; `domain/src/actions/types.ts`, `element-fingerprint/{drawing.ts (new), build, source, from-descriptor, signals, index}.ts`, `output-nodes/targets/targets.ts`, `runtime/llm-evidence/{elements, sanitize, capture, stable-handles}.ts`, `structure/detect.ts`, `packet-fingerprint/from-packet.ts`, `plan-resolution/{element-identity, target-packets}.ts`; tests `identity/tests/{drawing (new), score}.test.ts`, `content/tests/element-finder.test.ts`, `element-fingerprint/tests/{shortfall, build, from-descriptor}.test.ts`, `plan-resolution/tests/identity-guard.test.ts` | run-mvcwqwec-0aa4f98b: `{span, one hashed class}` counts only "kind" and is refused at save | domain `runtime/llm-evidence output-nodes element-fingerprint` 1419/1419; extension `content/tests content/action-runtime content/evidence/tests content/identity/tests background/connection/tests src/background/activity` 1002/1002; both `tsc -p tsconfig.test.json` exit 0; audit passed (205 warnings, 638 baselined) | Merged. Not live |
| 3 | CORE: adjacent steps repeating over one list read as one span; non-adjacent duplicates refused `flow_script.repeat_over_twice`. Core: `runtime/flow-bootstrap/script-statements/{adjacent-list-repeats.ts (new), index.ts}`, `flow-bootstrap/authoring/{assemble.ts, draft-routing.ts}`; tests `script-statements/tests/adjacent-list-repeats.test.ts (new)`, `authoring/tests/draft-routing.test.ts` | run-mvcwqwec-0aa4f98b: `bootstrap.source_port_cardinality` four times | Core from `packages/fluxiq`: touched test dirs 99/99 files (with fix 4); `tsc --noEmit` exit 0; Core audit passed | Merged. Not live. `assemble.ts` at 800 lines, `authoring/` at 25 files; a non-adjacent duplicate on the draft path still reaches the old refusal |
| 4 | Plain-language failed-build card. Core: `runtime/activity/wording/{left-told.ts, ended-reason.ts}` (new), `activity/index.ts`, `activity/wording/index.ts`, `project-agents/supervisor/{left-on-target, ports, guidance, completion}.ts`, `service/project-build/run.ts`, `conversations/commands/progress.ts` + tests; downstream `apps/extension/src/background/activity/supervisor-ending.ts` + test | run-mvcwqwec-0aa4f98b UI review: every click listed as `declared no lasting act, but had an effect: possibly lasting`, ending with `bootstrap.source port cardinality` | Core 99/99 files above; extension `src/background/activity` inside 1002/1002 | Merged. Not live. `run.ts` 414 lines (advisory) |
| 5 | **Uncommitted.** Reveal by scrolling: a click on a target that is not rendered (display none, no box) scrolls toward where it would be before each automatic retry (first + 3), so lazy-load sentinels fire; waits 400/800/1600 ms after a scroll that moved the page; never scrolls for dialogs, popovers, fixed layers, menus or inert targets. Downstream only: `apps/extension/src/content/action-runtime/{results.ts, recovery/attempt.ts, recovery/budget.ts, recovery/account.ts, recovery/index.ts}`, new `reveal/{index, reveal-aim, reveal-by-scroll, unshown-target}.ts`; tests `tests/results.test.ts`, new `reveal/tests/{reveal-by-scroll.test.ts, fake-page.ts}`, new `recovery/tests/reveal-attempt.test.ts`, new harness `e2e/content/tests/reveal-by-scroll/tests/company-website-team-more.spec.ts` (report `lane4-w5-reveal-by-scroll.md`) | t707 install proof (company-website team grid: "Show more people" stays `hidden` until the grid's end is scrolled into view several times; every click failed `web.target.not_shown`) | extension `test-extension.mjs content/action-runtime background/connection/tests shared` 711/711; `tsc -p tsconfig.test.json` exit 0; audit passed (210 warnings, 638 baselined). Worker-reported only: harness spec 1 passed ("recovered on attempt 4 ... scrolling 3 times ... which revealed it") and failed with the reveal disabled | Complete and tested; **not committed, not live** |
| 6 | **Uncommitted.** "drawing" on every save path (completes fix 2): recordings project it (`apps/extension/src/background/connection/gateway-payloads.ts` + test; `shared/dom-element.ts` drops it from `UnwiredElementField`); repairs keep it (`domain/src/runtime/llm-evidence/target/override.ts` + test, `tools.ts` one line); Core's target normalizer keeps a bounded `drawing` token (`!FluxIQ/packages/fluxiq/src/programs/automation-studio/model/action-element-target.ts` + test); docs `docs/architecture/element-identity.md`, Core `docs/architecture/{package-boundaries, automation-studio-native-nodes}.md` (report `lane4-w6-drawing-every-path.md`) | the user's every-save-path fingerprint rule, after fix 2 | extension 711/711 (above, includes `background/connection/tests shared`); domain `test-domain.mjs runtime/llm-evidence element-fingerprint` 1198/1198, `tsc` exit 0; Core `npx vitest run src/programs/automation-studio/model` 15/15 files, `tsc --noEmit` exit 0, Core audit passed (400 warnings, 1154 baselined); downstream audit passed | Complete and tested; **not committed, not live**. Needs Core's dist rebuilt for the cross-repository path |

## Queue

**Scope change (user, 2026-10-17):** one full pass per site, then stop: job-board done; company-website-apprentices
and professional-network-connect-kade-senior-engineer next; then rerun job-board-save-quillmark-remote and
job-board-halvard-labs-office-jobs until they pass. The other tasks are proven provider-free by a per-site audit.

| Task | Runs (run id: verdict, billed cost, calls) | Status |
| --- | --- | --- |
| job-board-remote-easy-apply | run-mvcw0qct-0f4257a5: passed, $0.034, 46 | **pass** |
| job-board-halvard-careers-roles | run-mvczav2x-b9c5dafc: passed, $0.014, 20 | **pass** |
| job-board-save-quillmark-remote | refused at $0 by behind-dev (before the first sync); run-mvcwf9u2-28bb44fd: failed, no Flow (save control not in the page view), $0.029, 59 | open: rerun owed; fixes 1-2 address the cause |
| job-board-halvard-labs-office-jobs | run-mvcwqwec-0aa4f98b: failed, no Flow (two-loop script refused; save control missing), $0.048, 83 | open: rerun owed; fixes 1-4 address the causes |
| company-website-apprentices | run-mvd8mcu6-64486b87: failed on the facility before any model call (Core's server exited while Core's dist was rebuilt underneath it), $0 | open: rerun owed with fix 5 |
| professional-network-connect-kade-senior-engineer | | not run (next after apprentices) |
| company-website-newsletter-signup, -saturday-certificate, -heat-pump-quote | | not run (scope change) |
| professional-network-netherlands-data-engineers, -accept-messaged-invitations, -kade-lead-contact | | not run (scope change) |

Spend: $0.125 billed over five runs (two passes, two product failures, one facility failure at $0).

Debugs: `docs/working/language-driven-flow-loop-plan/debugs/{run-mvcw0qct-0f4257a5, run-mvcwf9u2-28bb44fd,
run-mvcwqwec-0aa4f98b, run-mvczav2x-b9c5dafc, run-mvd8mcu6-64486b87}.md`.

## Not verified

- No live run carries fixes 2-6. Fix 1 rode in a passing run whose task has no icon control.
- Fix 5's harness spec result is the worker's; the lead re-ran its unit tests, not the harness.
- Fix 6's cross-repository path needs Core's dist rebuilt (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter
  @fluxiq/client-gateway-websocket build` in `fxwork/t567/!FluxIQ`) before it carries `drawing` through Core.
- Who rebuilt Core's dist during run-mvd8mcu6 is not established; the Lab does not refuse a Core library rebuild in
  the same tree while a run uses it, and Core's stderr is not in `logs/core.log` (facility follow-ups in its debug).

## Notes

- find_on_page lists a display:none control as a normal match marked only "not rendered"; fix 5's report proposes
  "not shown yet" plus a sentence in the tool description (not changed).
- Small UI wording defect (run-mvcw0qct): an icon-only close button whose text is "–" is narrated as `Clicking "–"`.
