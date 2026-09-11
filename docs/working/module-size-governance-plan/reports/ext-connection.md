# ext-connection — split `apps/extension/src/background/connection.ts`

## Outcome

Done, with one part of the brief not delivered and one contradiction to
resolve (both below). Types check, the smoke test passes, the bundle builds.
**Runtime unverified** — I cannot load an extension in a browser, so nothing
here is evidence of live behaviour.

| | Before | After | Limit |
| --- | --- | --- | --- |
| `connection.ts` lines | 1,913 | **736** | 800 |
| `FluxIQConnection` methods | 81 | **39** | 40 |
| Public method names | 16 | **16, identical** | — |
| New audit failures | — | **0** | — |
| New barrel-skipping imports | — | **0** | — |

## What changed and why

`connection.ts` is now a facade of 736 lines. It keeps what it must own —
settings, session, recording state, the active tab, the listener set — and the
order its collaborators run in. Nineteen modules under
`apps/extension/src/background/connection/` own one responsibility each.

**The reconnection and session-lifecycle seam came first**, as the brief asked.
`connection/gateway-session.ts` (`GatewaySession`, 303 lines) owns the socket,
the heartbeat, the reconnect backoff, the pairing state, the offline queue, and
every field that describes connection health. It owns no recording state: what a
dropped socket does to a recording is the facade's decision, reached through a
`GatewaySessionHandlers` callback set. That is the seam MVP Week 4 needs —
extension reconnect, runtime reconnect, tab closure and network failure all pass
through one class that can be exercised without a recording in flight.

The collaborators, largest first:

| Module | Lines | Owns |
| --- | --- | --- |
| `gateway-session.ts` | 303 | WebSocket session, reconnect, heartbeat, send/queue |
| `recording-evidence.ts` | 300 | State evidence per event, initial state, active snapshot |
| `core-api.ts` | 140 | Core HTTP: recordings, project snapshot, state-asset upload |
| `dom-snapshot.ts` | 111 | The DOM snapshot payload and per-frame capture/merge |
| `gateway-payloads.ts` | 103 | Recorded events shaped into gateway payloads |
| `runtime-status.ts` | 101 | In-flight runtime command status and its labels |
| `state-assets.ts` | 90 | Viewport PNG capture, hash, upload |
| `frame-geometry.ts` | 89 | Iframe geometry translated to top-frame coordinates |
| `browser-state.ts` | 88 | Recordable-page test and tab state updates |
| `index.ts` | 83 | Barrel |
| `recorded-event.ts` | 76 | Event classification, identity, activity wording |
| `navigation-recorder.ts` | 74 | Navigation debounce and dedupe |
| `project-context.ts` | 64 | Lazy project-id resolution |
| `activity-log.ts` | 61 | Recent activity and the paged recording log |
| `recording-manifest.ts` | 57 | Environment, sources, action channels, source ids |
| `value-readers.ts` | 50 | `unknown` → typed readers, `compactObject` |
| `content-attachment.ts` | 42 | Content-script attachment and recording-state messages |
| `pointer-click-filter.ts` | 25 | pointerdown/click duplicate suppression |
| `event-sequence.ts` | 12 | Background-originated event sequence numbers |

Each extraction is independently revertible: collaborators take their
dependencies through a `Deps` object (the pattern `ExtensionRuntimeCommandRouter`
already uses here), so reverting one means restoring its methods to the facade
and deleting one file.

### Two structural decisions worth knowing about

**The facade stayed at `background/connection.ts`; it does not live inside the
new directory.** This is forced by the `imports` rule, not preference.
`background/` has an `index.ts`, so it is a barrel directory: any file under
`background/connection/` importing `../tabs`, `../storage` or `../action-evidence`
would be a barrel-skipping import — a new ratcheted finding, a build failure.
The facade is the only file that may touch those modules, so it must stay a
sibling of them, and it injects `sendToTab`, `ensureContentScript`, `activeTab`,
`allTabs`, `allTabFrames`, `queueEvent` and `writeSession` into the
collaborators. That constraint improved the design — the collaborators are now
free of chrome wiring — but it was not chosen for that reason.

**The facade imports `"./connection/index"`, not `"./connection"`.** The file
and the directory are siblings of the same name, so `"./connection"` resolves
back to the facade itself. The `imports` rule explicitly allows an
`.../index` specifier, so this satisfies both TypeScript and the audit. There is
a comment at the import saying so.

### Dead code removed (the only deletions)

Two things were provably unreachable and were deleted rather than rehoused:

- `FluxIQConnection.captureAndStoreScreenContentRef` — defined, never called.
- the module-level `pointValue` — defined, never called. (The `pointValue` in
  `domain/src/client/gateway-mapping.ts` is a different, unrelated function and
  is untouched.)

Evidence: `grep -rn "captureAndStoreScreenContentRef\|pointValue"` over `apps`,
`domain`, `packages`, `scripts`, `e2e` returns no source reference to either —
only build artifacts and domain's separate function.

Two pure wrappers were collapsed into their single callee, which is a rename,
not a change: `captureScreenPngBytes` → `captureVisibleViewportPngBytes`, and
`visualSampleForState` → `captureFreshVisualSampleForState` (its whole body was
`const fresh = await captureFresh(...); if (fresh) return fresh; return undefined;`).
`sendClientMessage`'s unused `_tabId`/`_frameId` parameters were dropped; all ten
call sites passed two arguments.

## Commands run and observed results

```
pnpm --filter @fluxiq-web-extension/extension check
  > tsc -p tsconfig.json --noEmit
  exit 0, no output

pnpm --filter @fluxiq-web-extension/extension test
  > node scripts/smoke-test.mjs
  Extension smoke test passed.     exit 0

pnpm --filter @fluxiq-web-extension/extension build
  built background/content/popup/sidepanel bundles, exit 0
```

The build is what proves esbuild resolves `"./connection/index"`. The bundle
contains the collaborators:
`apps/extension/build/background/index.js` line 1407 `var ActivityLog = class {`,
2028 `var GatewaySession = class {`, 2286 `var PointerClickFilter = class {`,
2450 `var RecordingEvidenceReporter = class {`.

**I then reverted `apps/extension/build/` to HEAD** (`git checkout -- apps/extension/build/`).
Two reasons: it is outside my brief's owned paths, and rebuilding it also
regenerated `build/content/index.js` from the concurrent `ext-content` worker's
in-flight source. The supervisor should run `pnpm --filter @fluxiq-web-extension/extension build`
once after integrating both workers so the tracked artifact matches the merged
source. Nothing else under `build/` is modified by me.

I ran `git add -N apps/extension/src/background/connection/` because
`scripts/structure-audit/context.mjs` enumerates files with `git ls-files`;
untracked files are invisible to the audit, so the first audit run was
misleading. The files are intent-to-add only, not staged content, and nothing is
committed.

### Structure audit

```
node scripts/structure-audit.mjs
  warn  [class-methods]    connection.ts:85: FluxIQConnection has 39 methods,
                           past the 25-method advisory threshold.
  warn  [directory-files]  background/connection/: 19 source files is past the
                           15-file advisory threshold.
  warn  [file-lines]       connection.ts: 736 lines is past the 400-line
                           advisory threshold.
  FAIL  [working-docs]     docs/working/README.md is out of date.
structure-audit: 1 violation(s) across 1 rule(s).
```

The `working-docs` FAIL is **pre-existing and not mine** — I reproduced it on a
clean tree before touching anything. It needs `pnpm structure:baseline`, which
the brief told me not to run.

The three warnings are advisory, not ratcheted, and none fails a build. Two of
them are large improvements on baselined failures: `class-methods` 81 → 39 and
`file-lines` 1,913 → 736 both drop below their hard limits for the first time.
The `directory-files` warning is genuinely new: 19 files is over the 15-file
advisory threshold, well under the 25-file limit. I judged nineteen narrow
modules better than merging responsibilities back together to buy a number, but
if you disagree the clean regrouping is a `connection/payloads/` subdirectory for
the six pure leaf modules (`value-readers`, `dom-snapshot`, `frame-geometry`,
`recorded-event`, `gateway-payloads`, `browser-state`), which would put both
directories under the threshold without merging anything. A subdirectory import
of `./payloads` resolves to a directory and so adds no barrel skip.

No new `imports` findings and no `naming` prefix-group findings. Prefix groups
were designed around the rule's threshold of 3: `gateway-` and `recording-` have
two members each.

### Public surface: identical

`FluxIQConnection`'s 16 public methods, extracted by TypeScript AST before and
after and diffed — **no difference**:

```
connect, disconnect, dismissRecordingBlock, handleContentReady,
handleHistoryStateUpdated, handleNavigationCommitted, handleRecordingEvent,
handleTabUpdated, listCoreRecordings, recordingLogPage, selectAutomationTab,
startRecording, status, stopRecording, subscribe, updateSettings
```

The constructor signature `(settings: FluxIQSettings, session: FluxIQSession)` is
unchanged, so `background/index.ts` needed no edit at all — it is untouched.

### Wire-visible strings: no change

Every string and template literal was extracted by AST (module specifiers
excluded) from the old file and from the new facade plus all 19 modules, then
counted and diffed. Every delta is accounted for, and **no wire-visible string
was added, removed or altered**:

| Delta | Cause |
| --- | --- |
| `"Screenshot capture or upload failed."`, `"Screenshot stored"`, `"Screenshot unavailable"` removed; `"image/png"` 2→1, `"snapshot"` 10→8, `"success"` 6→5, `"warning"` 14→13 | the unreachable `captureAndStoreScreenContentRef`, deleted |
| `"number"` 16→14, `"object"` 6→5 | the unreachable `pointValue`, deleted |
| `"viewport"` 3→2 | `captureScreenPngBytes` wrapper collapsed — one return-type annotation |
| `"recording"` 32→31 | the old `attachTabForRecording` wrote `this.recordingState === "recording"` twice; both call sites now share one `isRecording()` closure |
| `"neutral"` 2→3, `"tone"` 1→5, `"state"` 4→5, `"succeeded"` 4→5, `"server.session_ready"` 1→2 | the same default value or type annotation now written at both sides of a seam |

I verified the `"recording"` reduction line by line against the original rather
than assuming, because a lost `=== "recording"` would be a lost guard. It is the
duplicate-expression case above, not a missing guard: all four
`sendRecordingEvidence` guards, both `attachTabForRecording` reads, and every
other comparison are present.

All ten `client.*` message sends survive with the same type and payload
expression: `client.start_recording`, `client.stop_recording`,
`client.state_update` ×3, `client.recording_event` ×2, `client.action_result`,
`client.snapshot` ×2. Storage keys were not touched — `storage.ts` is unmodified.

## Not verified

- **Runtime behaviour. Nothing here was run in a browser.** No reconnect, no
  pairing, no recording, no action execution, no tab or frame handling was
  exercised. Compilation and a file-existence smoke test are not evidence about
  any of it. The reconnection seam in particular is the highest-risk change in
  this work and has had no live test.
- The extension e2e suite (`pnpm --filter @fluxiq-web-extension/extension test:e2e`)
  was not run. It is the one check here that would exercise real behaviour, and
  it is the thing I would run first.
- Repository-wide `pnpm check`, `pnpm test`, `pnpm build` were not run; I ran the
  extension package's own checks plus the structure audit. `pnpm check` currently
  fails on the pre-existing `working-docs` violation regardless.
- Two orderings changed where no observer sits between the statements, so I
  believe them equivalent but did not prove it at runtime: in `ProjectContext`,
  `activeRecordingProjectId ??= projectId` now precedes the session write rather
  than following it; and `GatewaySession.send` is an arrow property rather than a
  prototype method.
- `apps/extension/build/` is at its HEAD contents and therefore **stale** with
  respect to this change. Rebuild it after integration.

## Open questions or contradictions found

**1. The dispatch's shared context requires tests I cannot usefully write.**
It says "Each extracted module gets its test alongside it in that directory's
`tests/` folder." `apps/extension` has no unit-test runner: its `test` script is
`node scripts/smoke-test.mjs`, which only checks that three entry files exist,
and there are zero `*.test.ts` files anywhere under `apps/extension/src` today.
Writing test files there would produce tests that nothing compiles or executes —
precisely the defect `Current State` already records for
`domain/src/runtime/tests/*.test.ts` ("compiled and run by nothing"). Adding a
runner means editing `apps/extension/package.json` and `tsconfig.json`, which are
outside my brief's owned paths, and it is a decision with repository-wide
consequences.

So I wrote no tests, deliberately. The supervisor needs to choose: add a
`node --test` runner to `apps/extension` the way `packages/test-contracts` does
(`tsc -p tsconfig.json && node --test tests/*.test.mjs`), then have someone write
tests for these modules — `NavigationRecorder.shouldRecord`, `ActivityLog`,
`RuntimeStatusTracker.finish`, `frame-geometry` and `value-readers` are pure and
would test cleanly — or accept that this package stays verified by type-check,
smoke test and e2e only, and correct the shared context so the next Phase 2
worker is not given an instruction the package cannot satisfy.

**2. `FluxIQConnection` is at 39 of 40 methods.** It passes, but with one method
of headroom, so the next person to add a method to it is forced into another
extraction. The honest reading is that the facade still carries four
responsibilities' worth of orchestration and the remaining split is
recording-session state (`recordingState`, `eventCount`, `recordingStartedAt`,
`activeRecordingId`, `pendingRecordingStart`, `recordingBlock`). I did not do it
because every candidate shape I could find turned into an anaemic state bag with
a dozen accessors — worse structure than the facade, bought purely to move a
number. It is worth a deliberate design pass rather than a mechanical one, and it
will be easier once the recording paths have live test coverage.

**3. `directory-files` at 19.** Described above with the `connection/payloads/`
regrouping option. Supervisor's call.

**4. Cross-worker contact.** My `pnpm build` regenerated
`apps/extension/build/content/index.js` from the `ext-content` worker's in-flight
source before I reverted `build/`. Nothing under `apps/extension/src/content/`
was read or written by me at any point.
