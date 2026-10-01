# Settings and Forget recovery

Status: Complete — implementation frozen for supervisor verification
Owner: wait_gaps
Date: 2026-10-01
Scope: Released settings-view.ts, forget-confirmation.ts and two new owning tests only. Existing settings-draft tests unchanged. No shared helper, protocol, storage, extraction, recording, Core or other worktree changes.

## Progress and evidence

- Read Current State, exact released brief and frozen recovery audit. Added deferred-request component regressions with local document/focus modeling; no shared test harness edit.
- Original source reproduction: heavy label `codex t224 settings recovery before`, native exit1;22tests/7pass/15fail,162.1456ms. All six unchanged draft tests passed. Exact TEMP log `C:/Users/osrs_/AppData/Local/Temp/codex-t224-settings-before.log`. An earlier attempt failed to locate the private build script due to an incorrect relative generated path; corrected that path and reran before editing product.
- Implemented synchronous mutation ownership across Save and optional reconnect, Disconnect and Forget. Status refresh derives control busy state from this owner. Internal guards protect direct activation as well as native disabled controls. Fixed local unexpected-rejection messages release state in finally; exception contents are never rendered.
- Existing editable form, persistent draft, submitted revision guards, labels, ids and request payloads preserved. No form replacement or new transport/storage behavior.
- Forget callback returns acknowledged success. Refusal/rejection keeps confirmation open with local retry feedback. Internal pending guard preserves single activation; explicit Cancel remains default focus on user-owned open. Success enables the opener before closing/focusing it, and restores only if the original Forget source still owns focus in a visible active document with no hidden/inert ancestry.
- Preparing focused related tests and scoped TypeScript against this revision. No broad gates, live/browser/provider calls, panel management or commits.

## Final behavior and validation

- One synchronous mutation owner spans Save plus optional reconnect, Disconnect and Forget. Handler guards refuse overlapping activations; status pushes cannot release pending controls. Finally releases the lock on fulfilled refusal and unexpected rejection. Save inputs stay editable; newer edit revisions and persistent drafts retain their existing semantics.
- Forget's acknowledged boolean result controls closing. A false/rejected result retains confirmation, enables explicit retry and gives fixed local feedback. Independent component pending state blocks repeated direct dispatch. On success the opener is enabled before guarded focus restoration. The original Forget button must own focus both at activation and completion; document must remain visible/focused, source connected and ancestry visible/non-inert. External field/page/document focus remains untouched. Explicit opening still focuses Cancel when the opener owns focus.
- Final heavy label `codex t224 settings recovery final`, native exit0:23tests/23pass/0fail/0skip/0cancelled,92.3315ms. Includes settings recovery8, Forget confirmation9 and unchanged settings-draft6. All three bundles import into the same Node process, matching the extension runner's shared-process behavior.
- Final scoped TypeScript native exit0, empty types log. Roots are the two new tests plus unchanged settings-draft; imports include both modified source owners. Earlier focused22/22 passed but types rejected a test-only `side-panel` surface spelling; corrected to the actual `sidepanel` contract and added rejected-reconnect coverage before final23/type run. No product API or type weakening.
- Exact logs: `C:/Users/osrs_/AppData/Local/Temp/codex-t224-settings-before.log`, `codex-t224-settings-focused.log`, `codex-t224-settings-final.log`, `codex-t224-settings-types.log` in the same directory. Final types log supersedes the intermediate typo failure.
- Independent runner from repository root: `node apps/extension/.test-build-scratch/codex-settings/related-runner.mjs`. Generated bundles are `panel/settings/tests/{settings-recovery,forget-confirmation,settings-draft}.test.mjs` under that private ignored label. Local `build.mjs` uses esbuild bundle/platform-node/target-node22/format-esm, CSS empty and existing fluxiq/gateway externals; scoped config extends `tsconfig.test.json` with only those three test roots.
- Source and new tests frozen; supervisor notified before report completion. No shared helper, background/protocol/storage mutation, recording/extraction change, broad gate, browser/live/provider activity, panel management, commit or push. Component/source verification is not live browser certification.
- Final owned-path `git diff --check` exit0. `git diff --numstat` for existing settings-draft.test.ts is empty; that test source remains unchanged. Report is frozen with implementation.
