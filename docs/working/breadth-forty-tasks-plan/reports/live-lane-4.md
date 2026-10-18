# Report: live-lane-4 (t567, slot-4, instance bf-slot-4)

Lane tree `C:/Users/osrs_/FluxStuff/fxwork/t567` (downstream branch and Core branch `task/t567-a8-lane-4b`), synced to
dev `5e59a563` / Core `76d66fe8` at start, fast-forwarded by the supervisor to dev `fb3919e2` after the first run.
Launch shape: A8 (`--authoring-mode project`, `--llm-max-cost-usd 0.25`, `--llm-max-calls 250`, the five
environment variables), workspace `bf-<task>`, instance `bf-slot-4`.

## Fix log

All fixes are uncommitted in the lane tree. Worker reports beside this file hold the detail.

| # | Files | Exposed by | Validation (lead re-ran) | Status |
| --- | --- | --- | --- | --- |
| 1 | Icon-only controls in the page view. Downstream: `apps/extension/src/content/evidence/{declared-cursor.ts (new), press-cursor.ts}`, `content/identity/accessible-name.ts`; `domain/src/runtime/llm-evidence/page-view/{element/icon-hints.ts (new), element/index.ts, element/words.ts, line/choice.ts, line/control-holders.ts, line/facts.ts, line/render.ts, view-line.ts}`; tests `content/evidence/tests/declared-cursor.test.ts`, `identity/tests/accessible-name.test.ts`, `page-view/tests/{icon-controls (new), line-rules}.test.ts`, `plan-resolution/tests/press-control.test.ts`, harness `e2e/content/tests/evidence/tests/{icon-controls.spec.ts (new), page-view-controls.spec.ts}` (report `lane4-w1-icon-controls.md`) | run-mvcwf9u2-28bb44fd (the card's save control, a span the page styles with its own pointer under a pointer card, was read as inheriting the cursor and never printed) | domain `test-domain.mjs runtime/llm-evidence` 1153/1153; extension `test-extension.mjs content/evidence/tests content/identity/tests` 187/187; structure audit passed. In the run-mvczav2x build (passed). | Done; not live-proven on a save |
| 2 | "drawing" identity signal for wordless icon controls (fingerprint floor). Downstream: `apps/extension/src/content/identity/{drawing.ts (new), drawing-attribute.ts (new), candidates.ts, score.ts, corroboration.ts, index.ts}`, `content/element-finder.ts`, `content/describe-element.ts`, `shared/dom-element.ts`; `domain/src/actions/types.ts`, `domain/src/element-fingerprint/{drawing.ts (new), build, source, from-descriptor, signals, index}.ts`, `output-nodes/targets/targets.ts`, `runtime/llm-evidence/{elements, sanitize, capture, stable-handles}.ts`, `structure/detect.ts`, `packet-fingerprint/from-packet.ts`, `plan-resolution/{element-identity, target-packets}.ts`; tests `identity/tests/{drawing (new), score}.test.ts`, `content/tests/element-finder.test.ts`, `element-fingerprint/tests/{shortfall, build, from-descriptor}.test.ts`, `plan-resolution/tests/identity-guard.test.ts` (report `lane4-w2-drawing-signal.md`) | run-mvcwqwec-0aa4f98b (cause 3: `{span, one hashed class}` counts only "kind", refused at save) | domain `test-domain.mjs runtime/llm-evidence output-nodes element-fingerprint` 1419/1419; extension `test-extension.mjs content/tests content/action-runtime content/evidence/tests content/identity/tests background/connection/tests src/background/activity` 1002/1002; `tsc -p tsconfig.test.json` domain and extension exit 0; structure audit passed (205 warnings, 638 baselined) | Partial: build path only. Recording (`background/connection/gateway-payloads.ts`) and Core repair normalizer (`model/action-element-target.ts` strips unknown fields from `parameters.target`) do not carry the drawing yet |
| 3 | CORE: adjacent steps repeating over the same list read as one span; non-adjacent duplicates refused `flow_script.repeat_over_twice` with a plain instruction. Core: `runtime/flow-bootstrap/script-statements/{adjacent-list-repeats.ts (new), index.ts}`, `flow-bootstrap/authoring/{assemble.ts, draft-routing.ts}`; tests `script-statements/tests/adjacent-list-repeats.test.ts (new)`, `authoring/tests/draft-routing.test.ts` (report `lane4-w3-repeat-span.md`) | run-mvcwqwec-0aa4f98b (cause 1: `bootstrap.source_port_cardinality` four times) | Core `npx vitest run .../flow-bootstrap/authoring/tests .../script-statements/tests` -> "Test Files 780 passed (780)" | Done; `assemble.ts` is at 800 lines, `authoring/` at 25 files. A non-adjacent duplicate on the draft path still reaches the old refusal |
| 4 | Plain-language failed-build card. Core: `runtime/activity/wording/{left-told.ts, ended-reason.ts}` (new) + `activity/index.ts`, `activity/wording/index.ts`, `project-agents/supervisor/{left-on-target, ports, guidance, completion}.ts`, `service/project-build/run.ts`, `conversations/commands/progress.ts`; tests `activity/wording/tests/{left-told, ended-reason}.test.ts (new)`, `supervisor/tests/left-on-target.test.ts`, `project-build/tests/project-build-{facade,reset,time-limit}.test.ts`, `service/tests/provider-unavailable-authoring-modes.test.ts`, `commands/tests/plain-failure.test.ts`. Downstream: `apps/extension/src/background/activity/supervisor-ending.ts` + test (report `lane4-w4-failure-card.md`) | run-mvcwqwec-0aa4f98b UI review (failure card lists every click as `declared no lasting act, but had an effect: possibly lasting`, ends with `bootstrap.source port cardinality`) | extension `src/background/activity` inside the 1002/1002 above; Core 99/99 test files with fix 3 (Validation below) | Done; `run.ts` 414 lines (advisory) |

## Queue

**Scope change (user, via the supervisor, 2026-10-17):** one full pass per site, then stop. job-board is done
(remote-easy-apply, halvard-careers-roles); the remaining runs are company-website-apprentices and
professional-network-connect-kade-senior-engineer. The other tasks are proven provider-free by a per-site audit.

| Task | Runs (run id: verdict, billed cost, calls) | Status |
| --- | --- | --- |
| job-board-remote-easy-apply | run-mvcw0qct-0f4257a5: passed, $0.034, 46 | **pass** |
| job-board-save-quillmark-remote | (refused at $0 by behind-dev before the sync); run-mvcwf9u2-28bb44fd: failed (no Flow; save control not in the page view), $0.029, 59 | stopped (scope change); fixes 1-2 address it |
| job-board-halvard-labs-office-jobs | run-mvcwqwec-0aa4f98b: failed (no Flow; two-loop script refused, save control missing), $0.048, 83 | stopped (scope change); fixes 1-4 address it |
| job-board-halvard-careers-roles | run-mvczav2x-b9c5dafc: passed, $0.014, 20 | **pass** |
| company-website-apprentices | | next, the site's one full pass (expected gap: the grid's hidden "Show more people" is revealed only by scrolling to the grid's end; evidence from t707) |
| company-website-newsletter-signup | | not run (scope change) |
| company-website-saturday-certificate | | not run (scope change) |
| company-website-heat-pump-quote | | not run (scope change) |
| professional-network-netherlands-data-engineers | | not run (scope change) |
| professional-network-connect-kade-senior-engineer | | next (the site's one full pass) |
| professional-network-accept-messaged-invitations | | not run (scope change) |
| professional-network-kade-lead-contact | | not run (scope change) |

Spend so far: $0.125 over four runs.

## Validation

- Downstream, after fixes 1, 2 and 4: domain 1419/1419, extension 1002/1002, both `tsc -p tsconfig.test.json` exit 0,
  `node scripts/structure-audit.mjs` -> "structure-audit: passed (205 warning(s), 638 baselined)".
- Core, fixes 3 and 4, from `packages/fluxiq`: `npx vitest run <runtime>/activity/wording/tests
  <runtime>/project-agents/supervisor/tests <runtime>/service/project-build/tests <runtime>/conversations/commands/tests
  <runtime>/service/tests/provider-unavailable-authoring-modes.test.ts <runtime>/flow-bootstrap/authoring/tests
  <runtime>/flow-bootstrap/script-statements/tests` -> "Test Files 99 passed (99)"; `npx tsc --noEmit -p tsconfig.json`
  exit 0; Core root `node scripts/structure-audit.mjs` -> "structure-audit: passed (399 warning(s), 1155 baselined)".
  (An earlier run from the Core root ran the whole workspace: "Test Files 780 passed (780)".)

## Not verified

- No live run carries fixes 2-4 yet; fix 1 rode in run-mvczav2x (a task with no icon control).
- Fix 2 does not reach recordings or repairs.
- Core's dist is not rebuilt with fixes 3-4 (the next launch needs `pnpm build` in Core).

## Notes

- Small UI wording defect (run-mvcw0qct): an icon-only close button whose text is "–" is narrated as `Clicking "–"`.
