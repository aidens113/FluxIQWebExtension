# Report: w1-domain-registry

Brief: `briefs/wave-1.md` § `Brief: w1-domain-registry` (Phase 1.1 step 4,
domain and shared-extension part). Worker: `w1-domain-registry`.

## Outcome

Done. All three items are implemented and every check in the brief's
definition of done passed. One baseline entry can now be lowered (see
Open questions 1).

## What changed and why

### 1. One safety registry

- **New `domain/src/actions/safety.ts`** exports `WEB_AUTOMATION_ACTION_SAFETY`,
  declared `as const satisfies Record<WebAutomationActionType, "safe" | "review">`.
  It is the single source of truth. Because the type is a `Record` over
  `WebAutomationActionType`, the compiler requires a classification for every
  output, so Phase 1.2's `web.dom.check` cannot be added without one. Safe
  outputs: `web.dom.wait_for_selector`, `web.dom.wait_for_text`,
  `web.dom.extract`, `web.dom.capture_snapshot`. Every other output is `review`.
- **`domain/src/io/manifest-definitions.ts`** now derives
  `safety: { level: registry[id], requiresApproval: registry[id] !== "safe" }`.
- **`domain/src/output-nodes/definitions.ts`** now derives
  `safeOutput = registry[id] === "safe"`, which sets both `privileged` and
  `requiresOperatorApproval`. `isSafeOutput` is deleted.
- **Behaviour change, domain manifest only.** The two waits change from
  `requiresApproval: true` to `false`; their level stays `safe`.
  `web.dom.capture_snapshot` changes from `level: "review", requiresApproval: true`
  to `level: "safe", requiresApproval: false`. The output-node definitions are
  unchanged, because `isSafeOutput` already classified the same four outputs
  as safe. All other outputs are unchanged: `review` with approval required,
  and privileged.
- **Where the source lives.** The brief asked to make one registry the source
  and derive the other. I put the source in a third, lower module instead.
  Making `output-nodes/` import `io/` would create a directory cycle, since
  `io/web-automation-io.ts` already imports `output-nodes`. The reverse would
  make `io` the owner of a node-level concern. Both consumers already import
  `actions/`.
- **New T1 test `domain/src/actions/tests/safety.test.ts`** has two tests:
  1. The registry covers every action type exactly once, and matches a
     written-out table of safe outputs.
  2. For every output, the manifest (`level`, `requiresApproval`) and the
     output node (`privileged`, `requiresOperatorApproval`) give one consistent
     classification. Each output also has exactly one manifest entry and one
     node.

### 2. Dead exports deleted

Before deleting, I re-grepped each symbol repo-wide. Each was referenced only
by its own definition and its barrel line.

| Deleted | Where | Follow-on |
| --- | --- | --- |
| `getWebAutomationOutputNodeDefinition` | `domain/src/output-nodes/registry.ts` | Its now-unused `WebAutomationActionType` import removed. `listWebAutomationOutputNodeDefinitions` stays. |
| `webAutomationRuntimeCommandFromOutput`, `webAutomationOutputResultFromRuntimeResult` | `domain/src/runtime/commands.ts` | File deleted. Its lines removed from the `runtime/index.ts` and `client/index.ts` barrels. |
| `runWebAutomationFlow` | `domain/src/runtime/flow-runner.ts` | File deleted; its `runtime/index.ts` line removed. |
| `webAutomationRuntimeTracePayload` | `domain/src/runtime/trace.ts` | File deleted; its `runtime/index.ts` line removed. |
| `runStateReadViaSnapshot` | `apps/extension/src/runtime/state-reader.ts` | File deleted; its line removed from `apps/extension/src/runtime/index.ts`. |
| `isProbablySecureGateway` | `apps/extension/src/shared/browser.ts` | none |
| `EXTENSION_NAME`, `PROTOCOL_VERSION` | `apps/extension/src/shared/constants.ts` | none |
| `LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION` (forward map) | `domain/src/actions/types.ts` | The reverse map `WEB_AUTOMATION_ACTION_TO_LEGACY_BROWSER` is now a literal declared `as const satisfies Record<WebAutomationActionType, string>`. Its name and values are unchanged, verified below. |

`WebAutomationRuntimeError` (`runtime/errors.ts`) is kept for Phase 1.5, as
the brief says.

I also deleted two companion types. Each existed only in a deleted function's
signature and had zero other references, and removing them is what left their
files empty:
- `WebAutomationRuntimeCommand`, the return type of `webAutomationRuntimeCommandFromOutput`.
- `RunWebAutomationFlowInput`, the input type of `runWebAutomationFlow`.

See Open questions 3.

### 3. `domain/src/runtime/llm-evidence.ts`

- `AutomationStudioRuntimeTargetOverrideEvidenceValidation` and
  `AutomationStudioRuntimeTargetOverrideFailedAction` are now imported as types
  from `fluxiq/automation-studio`. Export chain: `automation-studio/index.ts` →
  `runtime/index.ts` → `runtime/live-patch.ts`; both types are present in the
  dist `.d.ts`. The local structural copies,
  `WebRuntimeTargetOverrideEvidenceValidation` and
  `WebRuntimeTargetOverrideFailedAction`, are removed; nothing else referenced
  them.
- **The duck-typed shim is removed.**
  `bindWebAutomationLlmEvidenceRuntime(fluxiq)` now calls
  `fluxiq.programs.automationStudio.bindLlmEvidenceRuntime(...)` directly. Its
  return type changes from `boolean` to `void`. The only caller,
  `runtime/service.ts:9`, ignores the return value.
- **The direct call type-checks.** That proves `WebAutomationLlmEvidenceRuntime`
  is assignable to Core's
  `NonNullable<AutomationStudioServiceOptions["llmEvidenceRuntime"]>`, a check
  the shim had been hiding.
- **`domain/src/runtime/tests/llm-evidence.test.ts`.** The bind test no longer
  asserts a `true` return. Its old last assertion, "absent seam returns
  `false`", is now `assert.throws(..., TypeError)`: a missing seam fails
  loudly instead of being swallowed.

## Commands run and observed results

All commands ran from `F:\!FluxIQWebExtension` unless noted.

**Before any change:**
- `DOMAIN_TEST_BUILD_LABEL=w1-domain-registry pnpm --filter @fluxiq-web-extension/domain test`:
  exit 0, `# tests 24`, `# pass 24`, `# fail 0`. The runtime tests already
  passed the first time they ran, so there is no pre-existing failure to report.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (27 warning(s), 19 baselined).`

**After the changes:**
- **`pnpm --filter @fluxiq-web-extension/domain check`:** exit 0, no diagnostics.
- **`DOMAIN_TEST_BUILD_LABEL=w1-domain-registry pnpm --filter @fluxiq-web-extension/domain test`:**
  exit 0, `# tests 26`, `# pass 26`, `# fail 0`.
  - The `ok` lines cover my 2 new safety tests, 15 in `llm-evidence.test.ts`,
    4 in `reusable-evidence-coordinator.test.ts`, and 5 in
    `reusable-evidence.test.ts`.
  - `domain/src/tests/domain.test.ts` uses top-level `assert` calls, not
    `node:test`, so it prints no `ok` lines. Its bundle
    `.test-build-scratch/w1-domain-registry/tests/domain.test.mjs` was built
    and imported, and the exit code of 0 means none of its assertions threw.
- **`pnpm --filter @fluxiq-web-extension/extension check`:** exit 0, no diagnostics.
- **`node scripts/structure-audit.mjs`:** exit 0 with
  `structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.`
  and `structure-audit: passed (27 warning(s), 19 baselined).`
  - `node scripts/structure-audit.mjs --json` names the entry:
    `{"rule":"imports","key":"domain/src/client/index.ts","value":1,"recorded":2}`,
    with `failures: 0`.
  - No new finding on my files. Warnings on them only shrank:
    `apps/extension/src/shared/constants.ts` went from 11 to 9 exported values
    (still over the advisory threshold of 8), and
    `domain/src/runtime/llm-evidence.ts` from 463 to 449 lines (still over the
    advisory threshold of 400).
- **Test type-check.** `domain check` excludes `tests/`, so I ran, in `domain/`,
  `npx tsc -p tsconfig.test.json --noEmit --allowImportingTsExtensions`:
  exit 0, 0 `error TS` lines. The flag is needed for the existing
  `../index.ts` imports in the runtime tests.
- **Reverse-map equality.** I used esbuild to transpile the HEAD blob and the
  working file, then ran `assert.deepStrictEqual` on `Object.entries(...)`:
  `reverse map identical to HEAD (same entries, same order): 11 entries`.
- **Zero-hit grep per deleted symbol.** Each symbol was grepped with
  `grep -rnw ... --exclude-dir=docs`, excluding `node_modules`, `dist`,
  `build`, `.test-build`, `.script-build`, `test-runs`, `.test-build-scratch`
  and `.git`, piped to `wc -l`. The last column lists the documents that still
  name each symbol.

  | Symbol | Code hits | Named only in these docs |
  | --- | --- | --- |
  | `getWebAutomationOutputNodeDefinition` | 0 | audit reports, `briefs/wave-1.md` |
  | `webAutomationRuntimeCommandFromOutput` | 0 | `extension-runtime-capabilities-plan.md`, audit reports, brief |
  | `webAutomationOutputResultFromRuntimeResult` | 0 | `extension-runtime-capabilities-plan.md`, audit reports, brief |
  | `runWebAutomationFlow` | 0 | `extension-runtime-capabilities-plan.md`, `audit-core-runtime.md`, brief |
  | `webAutomationRuntimeTracePayload` | 0 | `audit-core-runtime.md`, brief |
  | `runStateReadViaSnapshot` | 0 | audit reports, brief |
  | `isProbablySecureGateway` | 0 | audit reports, brief |
  | `EXTENSION_NAME` | 0 | audit reports, brief |
  | `PROTOCOL_VERSION` | 0 | audit reports, brief |
  | `LEGACY_BROWSER_ACTION_TO_WEB_AUTOMATION` | 0 | audit reports, brief |
  | `WebAutomationRuntimeCommand` (companion) | 0 | `extension-runtime-capabilities-plan.md` |
  | `RunWebAutomationFlowInput` (companion) | 0 | none |
  | `WebRuntimeTargetOverrideEvidenceValidation` (item 3) | 0 | `audit-core-runtime.md` |
  | `WebRuntimeTargetOverrideFailedAction` (item 3) | 0 | `audit-core-runtime.md` |

  `docs/architecture/` and the READMEs name none of these symbols. They also
  never state the safety level or approval requirement of any output.
- **Final diff.** I reviewed `git diff` of every modified file. Each diff is
  exactly the intended change.

## Not verified

- **Live approval behaviour.** Nothing ran a provider-free flow through Core
  to confirm it no longer prompts for waits or `capture_snapshot`. The test
  proves the declared classification only. I did not trace which of the two
  fields Core's approval gate reads: manifest `requiresApproval` or node
  `requiresOperatorApproval`.
- **Web-panel host build.** `pnpm --filter @fluxiq-web-extension/domain host:build`
  and loading the built host were not run; they are not in my definition of
  done. The new `fluxiq/automation-studio` import is type-only, so esbuild
  erases it.
- **Extension `build` and `test` (smoke).** Not run; only `check` is in my
  definition of done. The deleted extension exports had no importers.
  `apps/extension/build/` was not rebuilt; it shows modifications in the tree
  from other workers.
- **Browser testing.** None; nothing in this brief needs it.

## Open questions or contradictions found

1. **Baseline can be lowered.** `imports` for `domain/src/client/index.ts` goes
   from 2 to 1, because the `../runtime/commands` barrel line was removed. The
   supervisor should run `pnpm structure:baseline`; I did not, per the
   concurrency notes.
2. **Test placement.** `actions/tests/safety.test.ts` tests `actions/safety.ts`,
   but it also asserts the two consumers in `io/` and `output-nodes/`. Read
   strictly, the "several subjects → nearest common directory" rule would put
   it in `domain/src/tests/`, which I do not own. Move it there if that
   reading is preferred.
3. **Deletions beyond the brief's list.** I deleted `WebAutomationRuntimeCommand`
   and `RunWebAutomationFlowInput` (signature-only companions, zero
   references), and item 3 replaced the two exported `WebRuntimeTargetOverride*`
   types. If Phase 1.5 wants a `WebAutomationRuntimeCommand` type, it can be
   recovered from git.
4. **One edit outside my owned list.** `apps/extension/src/runtime/index.ts` is
   not in that list. I removed only its `./state-reader` line, under the
   brief's rule to delete an emptied file together with its barrel line.
5. **Stale shared doc.** `docs/working/extension-runtime-capabilities-plan.md`
   still describes `webAutomationRuntimeCommandFromOutput`,
   `webAutomationOutputResultFromRuntimeResult`, `runWebAutomationFlow` and
   `WebAutomationRuntimeCommand` as delivered (audit cites `:48`, `:619-620`,
   `:933`). It is a shared document, so I did not edit it.
6. **Public signature change.** `bindWebAutomationLlmEvidenceRuntime` now
   returns `void` instead of `boolean`. It is exported through the domain root
   barrel; its only caller ignores the return value.
7. **Line endings.** With `core.autocrlf=true`, no `.gitattributes`, and every
   touched file `i/lf` in `git ls-files --eol`, commits are unaffected.
   - Before my edit, the working copy of `output-nodes/definitions.ts` already
     mixed endings: 89 CRLF lines and 15 LF lines. I kept each line's own
     ending, so it is still `w/mixed`.
   - `manifest-definitions.ts` is `w/crlf`, as it was before my edit.
   - `actions/types.ts` is `w/lf`. During the work I briefly added CRs to its
     rewritten lines, having misread an MSYS `grep -c $'\r'` quirk, then
     normalized it back to LF.
   - New files are LF.
8. **Process note.** My first Bash edit script failed at parse time ("unexpected
   EOF while looking for matching `''") and wrote nothing; I confirmed this
   before continuing. I left my per-label bundle directory,
   `domain/.test-build-scratch/w1-domain-registry/`, in place; it is
   gitignored (`.gitignore:24`).
