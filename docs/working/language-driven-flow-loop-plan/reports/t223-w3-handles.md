# t223-W3: element handles become `tN`

## Outcome

Done. The domain now mints element handles as `t<N>`, both positional (`sanitize.ts`) and stable (`stable-handles.ts`). `extraction.N` is unchanged. Wherever a handle the model wrote is accepted, both `t<N>` and the old `target.<N>` are read, over the same number range (1 to 999999, no leading zero), and the handle is converted to `t<N>` before it is looked up. Domain check and the full domain suite pass. Core's tsc and its vitest over the touched directories pass. The extension structure audit passes. The Core structure audit fails on one entry that this work did not touch (see Open questions).

## What changed and why

**Minting**
- `domain/src/runtime/llm-evidence/sanitize.ts`: positional handles are now `` `t${n}` ``.
  - The internal focus placeholder `"target.focus"` is kept. It is never published, and only its selector is read.
- `domain/src/runtime/llm-evidence/stable-handles.ts`: stable handles are now `` `t${n}` ``.
  - `WEB_LLM_TARGET_HANDLE_PATTERN` is now `^(?:t|target\.)[1-9][0-9]{0,5}$`.
  - Historical comments now use `tN`, with a note that runs before t223 recorded `target.N`.

**Canonicaliser**
- New `domain/src/runtime/llm-evidence/handle-spelling/canonical-target-handle.ts`, which exports only `canonicalWebLlmTargetHandle(value: unknown): string | undefined`.
  - It returns `t<N>` for either spelling, and `undefined` for anything that is not a handle.
- It sits in its own directory, `handle-spelling/`, which has its own `index.ts` barrel and is re-exported from `llm-evidence/index.ts`.
  - It is in a new directory because adding it at the top level, with its test, pushed both `llm-evidence/` and `llm-evidence/tests/` to 26 files. That is over the structure audit's 25-file limit.

**Acceptance sites (each converts to `tN` before looking up)**
- `node-run/run.ts`: `firstHandle` and `elementHandle` now use the canonicaliser, and the module's `TARGET_HANDLE` regex was removed.
  - A legacy handle written bare or as `{handle}` is kept in the draft as `{handle: "tN"}`, so the model is only ever shown one spelling.
- `plan-resolution/resolve-plan-node.ts` `resolveTarget`, and `plan-resolution/target-packets.ts` `resolve`. The second one is a defensive check at the store itself.
- `plan-resolution/handle-tokens.ts`: its kind test already used the widened pattern; only the comment changed.
- `harness-options/execute.ts` `handleIn`, which serves the recovery press and enter options. Its local regex was removed.
- `structure/detect.ts` `requestedTarget`, which serves both the authoring detection and the recovery detection.
- `tools.ts` `boundedTargetHandle`. Note that this function has no caller: grep finds only its definition.
- `target/override.ts`, where the repair handle is matched against `element.target`.
- `press.ts` `observedElement` and `currentElementForReturnedTarget`.
- Tool input schemas (`tools.ts`, `harness-options/options.ts`) take `WEB_LLM_TARGET_HANDLE_PATTERN`, so they accept both spellings.

**Model-facing text**
- `run.ts` `HANDLE_SHAPE` is now `target: {"handle": "tN"}`.
- `node-run/shown-addresses.ts` is now `{"handle": "tN"}`.
- `tool-rejection.ts` doc now says "`t` and a number".
- Harness option descriptions and the detection description never spelled a handle out, so they needed no change.
- Comments in `host-runtime.ts`, `structure/handles.ts` and `tools.ts` were updated.

**Domain tests**
- `target.<N>` and `` `target.${…}` `` were replaced with `t…` across 42 test files with an anchored sed. Every occurrence was preceded by a quote, a backtick, a space or a colon, so key paths such as `target.location` were not matched.
- Hand-fixed:
  - the `packet-carries-no-selector` regex, now `/^t[1-9][0-9]?$/u`;
  - the `stable-handles` slice, now `slice(1)`;
  - the reusable-evidence `doesNotMatch` regexes: `target\.1` became `"t1"` (the handle as it appears in the serialized JSON).
- New tests:
  - `handle-spelling/tests/canonical-target-handle.test.ts`: both spellings, and the rejected forms.
  - `node-run/tests/run.test.ts`: a node run with `target.N`, written as `{handle}` and bare, presses the same element, and the draft keeps `tN`.
  - `plan-resolution/tests/resolve-plan-node.test.ts`:
    - `target.N` in the `selector`, `target` and `element` slots, with and without a location, resolves exactly as `tN` does;
    - mixing `target.2` and `t2` in two slots is not ambiguous;
    - an unknown `target.9` is refused as unknown;
    - malformed rows for `target.0`, `target.1000000` and `tx`.
  - `structure/tests/detect.test.ts`: detection around `target.2` sends the same capture commands as `t2` and reports `target: "t2"`; `target.8` is refused as `handle_not_in_packet` with `t8`; `target.0` is a `malformed_handle`.
  - `tests/stable-handles.test.ts`: the pattern accepts `target.120` and rejects `target.0` and the over-range number.

**Core (example text and comments only, no behaviour change)**
- `flow-bootstrap/plan/flow-script-format.ts`: the examples changed from `target: target.7/2/4/5/9` to `t7/t2/t4/t5/t9`.
- `llm/deepseek/system-prompt.ts`: the example changed from `…(2)}:target.3` to `…(2)}:t3`.
- `llm/harness/explored-evidence-label.ts` and `task-request.ts`: comments changed to `t3`.
- `llm/tests/harness.test.ts`: the pinned string changed to `explored.2:t3`.
- `llm/harness/tests/explored-evidence-label.test.ts`: a new case confirms that:
  - `AUTOMATION_STUDIO_RUNTIME_TARGET_HANDLE_PATTERN` (`^[A-Za-z0-9](?:[A-Za-z0-9_.:-]*[A-Za-z0-9])?$`) accepts `t3`, `t999999`, `target.3` and `explored.2:t3`;
  - `automationStudioExploredEvidenceHandle("explored.2:t3")` is qualified with handle `t3`;
  - a bare `t3` is unqualified.
- The authoring `HANDLE_TOKEN` in `flow-bootstrap/authoring/values.ts` uses the same grammar, so `target: t7` in a script is read as a handle.
- Core rebuilt its libraries (`pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`). The domain test gate refused to run against a stale Core dist after these Core edits.

**Docs**
- `docs/architecture/page-evidence.md`: `t1`–`t999999`, a note on legacy input, and the "`tN` handle is the only way to name an element" sentence.
- `docs/architecture/testing-facility.md`: `t1`, `t2`.

## Commands run and observed results

- `heavy.sh … pnpm --filter @fluxiq-web-extension/domain check`:
  - First run: exit 0, `{"build-cache":"build","step":"domain:check",…}`.
  - Rerun after all edits: exit 0, `"reason":"inputs changed: core:packages/fluxiq/dist, domain"`.
- `heavy.sh … pnpm --filter @fluxiq-web-extension/domain test` (unlabelled), first run: `# tests 1065 # pass 1064 # fail 1`.
  - The failure was in my new detect row. After `target.9` the next call was `t9`, which the repeated-refusal guard reported as `answered_the_same_again`. That shows the two spellings are one answer.
  - I changed the row to `target.8`.
- Second run: refused by `core-build.mjs` with "FluxIQ Core's build … is 68 minute(s) behind its source". I rebuilt Core (exit 0, `fluxiq:build … stored`).
- Third run (check, then test): exit 0, `# tests 1065`, `# pass 1065`, `# fail 0`.
  - The new tests appear in the output as `ok 513`, `ok 514`, `ok 595`, `ok 667` and `ok 727`.
- Core `npx tsc --noEmit -p .` in `packages/fluxiq`: exit 0, with no output.
- Core `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap src/programs/automation-studio/runtime/llm`: `Test Files 134 passed (134)`, `Tests 1597 passed (1597)`.
- `node scripts/structure-audit.mjs`, extension: `structure-audit: passed (135 warning(s), 119 baselined)`, after the move into `handle-spelling/`.
  - Before the move it reported 2 `directory-files` failures, which were mine.
- `node scripts/structure-audit.mjs`, Core: `FAIL [file-lines] packages/fluxiq/src/programs/automation-studio/runtime/service.ts: 4506 lines exceeds … Baseline for this entry is 4505`, `1 violation(s)`. I did not touch that file. `git status` in Core lists only my six files, and its last commits are `c070c94b`/`b7305903`.
- `grep -rn "target\.[0-9]" domain/src`: shows only the deliberate legacy-input rows in:
  - `handle-spelling/tests/canonical-target-handle.test.ts`
  - `plan-resolution/tests/resolve-plan-node.test.ts` (lines 127–139, 397–398)
  - `structure/tests/detect.test.ts` (lines 264–274, 461)
  - `tests/stable-handles.test.ts:180`

## Not verified

- No live browser and no Lab run, as the brief said.
- The extension package (`apps/`) was not built or tested. Another worker owns it and was editing it while I worked.
- The full Core suite was not run, only the two directories I touched.
- The recovery-option legacy path (`execute.ts` `handleIn`) was not given a dedicated test. It uses the same canonicaliser covered above, and its existing tests pass.

## Open questions or contradictions found

- Core structure audit: `runtime/service.ts` is at 4506 lines against a baseline of 4505. This existed before this work and is not mine; whoever grew it, or the supervisor, needs to address it before `pnpm check` passes in Core.
- `apps/extension/src/content/identity/tests/created-node-identity.test.ts` (lines 84 and 118) still writes `target.2` and `target.4` as handles. These still resolve because the old spelling is accepted, but the apps owner may want them changed to `tN`.
  - `packages/test-runner` tests use `target.1`/`target.2` as opaque data, which is harmless.
- `tools.ts` `boundedTargetHandle` and `harness-options/execute.ts` `targetHandle` have no callers; they were already dead code before this change. I converted them rather than deleting them.
- `domain/dist/**` (build output) still holds old `.d.ts` text; it is regenerated by a domain build.
