# Report: w1-content-aliases

Brief: `briefs/wave-1.md`, section `Brief: w1-content-aliases` (Phase 1.1 step 4, content-script part).

## Outcome

**Done.** The content script no longer matches legacy dotted action types, and
`content/types.ts` re-exports the shared protocol types instead of keeping a
looser copy of them. Every definition-of-done check passed, and the exit grep
prints nothing. The content-scoped type-check fallback was not needed, because
the full package `check` passed.

## What changed and why

| File | Change |
| --- | --- |
| `apps/extension/src/content/actions/execute.ts` | Removed the `\|\| action.actionType === "dom.*"` half of all ten dispatch conditions. Rewrote the header: it had called the dotted aliases part of the contract. The new header says types arrive canonical from `domain/src/client/gateway-mapping.ts`, and that the final `throw` still guards whatever reaches it at runtime. |
| `apps/extension/src/content/types.ts` | Replaced the 91-line local copy with a type-only `export type { ... } from "../shared/protocol"`. It re-exports the nine names content imports: `BrowserActionCommand`, `BrowserActionResult`, `DomElementDescriptor`, `DomSnapshot`, `JsonObject`, `JsonValue`, `RecordingEventKind`, `RecordingEventPayload` and `RectDescriptor`. `FrameDescriptor` and `JsonPrimitive` are dropped; the repo-wide grep found no consumer of either outside the two type files. |
| `apps/extension/src/content/recorder.ts` | `emit(kind: string, ...)` and `basePayload(kind: string, ...)` became `kind: RecordingEventKind`. This is the content code that relied on the loose `RecordingEventPayload.kind: string`. |
| `apps/extension/src/content/snapshots.ts` | `shouldAttachStateSnapshot(kind: string)` became `kind: RecordingEventKind`. It did not strictly rely on the loose copy, so this is a judgement call: every recording-kind literal in content is now checked. |

Where the copy was looser, content now uses the protocol type:

- **`BrowserActionCommand.actionType` / `BrowserActionResult.actionType`.**
  `string` became `BrowserActionType`, which is the domain's
  `WebAutomationActionType` union. A dotted comparison is now a compile error.
  The command also gains the optional `tabId`, `frameId` and `url` fields.
- **`visualTarget`.** The loose inline shape (`bounds`, `documentBounds`,
  `anchor`, `selector`) became `ActionVisualTarget`, which adds the required
  `namespace` and `statePath` fields. Content reads only `bounds`, `anchor` and
  `documentBounds` (`action-runtime/resolve-target.ts`) and copies the value
  through unchanged (`action-runtime/results.ts`). No code change was needed.
- **`RecordingEventPayload`.** `kind: string` became `RecordingEventKind`, fixed
  in `recorder.ts` as above. The payload also gains an optional `visualTarget`.
- **Structurally identical.** `DomSnapshot` (`frame` was the named
  `FrameDescriptor`), `DomElementDescriptor`, `RectDescriptor`, `JsonValue` and
  `JsonObject` match the protocol shapes.

`shared/protocol.ts` needed no change. Because the re-export is type-only,
esbuild erases it: the protocol's runtime imports (`CLIENT_GATEWAY_PROTOCOL_VERSION`,
`webAutomationClientCapabilities`, `browserExtensionCapabilities`) do not reach
the content bundle. The bundle diff below shows this.

**The final `throw` is kept** in `execute.ts`. Two things can still reach it at
runtime:

- `web.browser.navigate`, which is in the union but runs in the background worker;
- a rejected command forwarded past the type (open question 1).

## Commands run and observed results

1. **Pre-edit baseline.** `pnpm --filter @fluxiq-web-extension/extension check`
   exited 0.
2. **Pre-edit bundle and audit.** A scratch esbuild script
   (`<scratch>/w1-content-aliases-bundle.mjs`) built `src/content/index.ts` with
   the content-entry options from `build-extension.mjs`, with the sourcemap off.
   The bundle was 50736 bytes and held 10 `"dom.<action>"` alias literals.
   `node scripts/structure-audit.mjs` exited 1 with one FAIL, which is not mine:
   `[working-docs] docs/working/README.md is out of date with the documents' header blocks`.
   It also printed `1 baseline entries can be lowered`.
3. **Exit grep.** `grep -rn '"dom\.' apps/extension/src/content/actions` printed
   nothing (grep exit 1).
4. **Check after edits.** `pnpm --filter @fluxiq-web-extension/extension check`
   exited 0.
5. **Build after edits.** `pnpm --filter @fluxiq-web-extension/extension build`
   exited 0 (`build\content\index.js 48.7kb`).
6. **Smoke test.** `pnpm --filter @fluxiq-web-extension/extension test` printed
   `Extension smoke test passed.` and exited 0.
7. **Compile probe.** A scratch tsconfig extending the extension's compiled a
   probe that imports `content/types`. `tsc` exited 2 with exactly the expected
   errors:
   - `TS2367: This comparison appears to be unintentional because the types 'WebAutomationActionType' and '"dom.click"' have no overlap.`
   - `TS2820: Type '"dom.clik"' is not assignable to type 'RecordingEventKind'. Did you mean '"dom.click"'?`

   The canonical `=== "web.dom.click"` line compiled.
8. **Bundle diff, before against after.** The after-edit bundle was 50329 bytes.
   `diff` showed exactly the 10 dispatcher `if` lines losing their
   `|| action.actionType === "dom.*"` half, and nothing else.
   `grep -c` for `CLIENT_GATEWAY_PROTOCOL_VERSION|webAutomationClientCapabilities|browserExtensionCapabilities`
   printed `0`. The remaining `"dom.*"` literals are recording kinds only.
9. **Tracked build against the scratch bundle.** After stripping the
   sourceMappingURL line and normalizing esbuild's `// <path>` comments, the
   tracked `apps/extension/build/content/index.js` is identical to the scratch
   after-bundle (diff exit 0). It contains `0` action-only aliases.
10. **Audit after edits.** `node scripts/structure-audit.mjs` exited 0 with
    `structure-audit: passed (27 warning(s), 19 baselined).` The README FAIL had
    cleared in the meantime; I did not touch that file. The only content
    warnings are unchanged and predate this work: `content/: 17 source files`
    and `element-traits.ts: 11 exported values`.
11. **Audit with a scratch index.** I copied `.git/index` into the scratchpad and
    used it as `GIT_INDEX_FILE`. In that copy I added the untracked `actions/`
    and `action-runtime/` directories and my three files, and removed the two
    deleted files. The copy then tracked 40 content files. The audit exited 0
    with the same `passed (27 warning(s), 19 baselined)` and **no finding for
    any file under `content/`** beyond the two warnings above. The real index
    has nothing staged.
12. **Lowerable baseline entry, for the supervisor.** `--json` shows
    `imports domain/src/client/index.ts recorded 2 -> now 1`. It comes from
    another worker's domain edit, not this change. I did not run
    `pnpm structure:baseline`.
13. **Live Chromium spec.**
    `pnpm exec playwright test -c e2e/playwright.config.ts e2e/action.spec.ts`
    printed `ok 1 ... executes actions through the real content-script message path (918ms)`
    and `1 passed (1.8s)`. The spec sends `web.dom.capture_snapshot`,
    `web.dom.type` and `web.dom.click`.
14. **Producer search.** A repo-wide grep for dotted action literals found
    them only in two places:
    - the domain's reverse map, `domain/src/actions/types.ts:79-89`;
    - its normalization tests, `domain/src/client/tests/gateway-mapping.test.ts`.

    Every producer that sends `executeAction` straight to the content script
    uses canonical types: `e2e/action.spec.ts`,
    `packages/test-runner/src/interactive-session.ts:44-45,167-168` (allowlisted)
    and `web-flow-exploration.ts:180`.

## Not verified

- **Seven verbs never ran live.** `wait_for_selector`, `wait_for_text`,
  `extract`, `clear`, `select`, `scroll` and `keypress` were checked only by
  compilation and the bundle diff. `test:content` (the w1-content-harness
  suite) does not exist yet: `apps/extension/e2e/content/` is absent.
- **Firefox**, and live recording with the tightened `kind` types. Those type
  changes are erased at build, and the bundle diff shows no runtime change from
  them.
- **Repository-level gates.** `pnpm check`, `pnpm test` and `pnpm build` are
  outside the brief.
- **The specific real-tree errors are reasoned, not observed.** I made the
  `types.ts` change and the code fixes together, so I never saw the errors the
  tightened types would have raised in the real tree: TS2367 in `execute.ts`
  and TS2322 in `recorder.ts`. The probe in command 7 shows the same checks on
  the same types.

## Open questions or contradictions found

1. **A rejected command is still dispatched.** The cast is in
   `apps/extension/src/runtime/result-mapping.ts:15-16`, which I do not own:

   ```ts
   return webAutomationActionFromGatewayCommand(command) as BrowserActionCommand;
   ```

   After w1-domain-mappings, that call returns a `WebAutomationActionRejection`
   (`status: "rejected"`, `code: "ACTION_REJECTED"`, raw `actionType`) for an
   unknown type. The cast forwards the rejection as a command, which
   contradicts the domain's doc comment "Nothing is dispatched for it". For a
   DOM action, the content script now throws `Unsupported action type` and
   replies `failed`, so it is still not rewritten into a page read. But the
   `ACTION_REJECTED` code is lost, and a frame is messaged for nothing. The
   background should branch on `"status" in result` and reply with the
   rejection without dispatching.
2. **A second path reaches the content script without normalization.**
   `packages/test-runner` sends content messages directly
   (`interactive-session.ts`, `web-flow-exploration.ts`). It is safe today
   because it sends only canonical types, but `InteractiveExtensionActionType`
   (`interactive-session.ts:44`) is a hand-copied list rather than being
   derived from `WebAutomationActionType`, so the two can drift apart.
3. **`dom.wheel` is never emitted.** `RecordingEventKind` includes it, but the
   recorder emits `dom.scroll` for wheel input. This is w1-domain-mappings'
   item 1; tightening the types in content leaves it unchanged.
4. **The tracked build includes other workers' changes.** My `pnpm build`
   regenerated all of `apps/extension/build/`, including in-flight background
   changes that are not mine. Only the content bundle is attributable to this
   change (command 9). Rebuild at integration.
5. **Answer to audit-actions open question 6.** The separate copy was not
   deliberate enough to keep. Its header ("widen them rather than reshaping
   them") is gone, and the new header points changes to `shared/protocol.ts`.
