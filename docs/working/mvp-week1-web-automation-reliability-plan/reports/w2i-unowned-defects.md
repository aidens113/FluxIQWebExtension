# Report: w2i-unowned-defects

Worker: `w2i-unowned-defects`. Wave 2 integration, two unrelated defects in
files no Wave 2 brief owned.

## Outcome

**Done**, with one deviation the supervisor must accept or revert: I added a
single additive line to `apps/extension/src/runtime/index.ts`, which my brief's
"Must not touch: ... anything else" covers. It was the only way to satisfy both
halves of task one; the evidence is in
[Deviation](#deviation-one-line-in-a-file-i-did-not-own) below. Both fixes
carry a unit test, and each test is proven to fail against the old code.

## What changed and why

### Task one — one list answers "can this page be driven?"

`apps/extension/src/background/connection/browser-state.ts` kept its own
pattern, which required `://`. `unsupportedPageForUrl` now delegates to
`unsupportedAutomationPageReason` from `runtime/unsupported-page.ts` and maps
its answer onto what recording reports.

Two things the recording path needs that the shared rule does not carry, both
preserved:

- **The wording names recording**, not automation. `connection.ts:250` renders
  `this.unsupportedPage.reason` to the user as a "Page cannot be recorded"
  warning, and `docs/architecture/extension-client.md:31` documents it that
  way. A small map turns each shared reason constant into its recording
  wording, so the two user-facing strings are byte-identical to before.
- **The shape is `UnsupportedPageState`** (`{ url, reason }`), not a bare
  string, because six call sites in `connection.ts` and `content-attachment.ts`
  read `.reason` or test the object for truthiness.

Newly refused as a result (all previously recordable): `about:`,
`view-source:`, `data:`, `devtools:`, `javascript:`, and the three current
extension galleries (`chromewebstore.google.com`,
`microsoftedge.microsoft.com/addons`, `addons.mozilla.org`). The old rule
matched none of the eight — measured, see [Commands](#commands-run-and-observed-results).

### Task two — the lane joins through `nodeId`

`executeExistingPersistedFlow` compared `action.definitionId` to the expected
action. Core records every recorded action as one `builtin.policy.action` node
and the stored attempt drops the node's inputs, so `definitionId` reads the
same for every recorded action and could only match by accident.

It now calls `readFlowActionTypes` — the Flow lane's own module, imported
through `./flow-lane/index.js`, not copied — and matches
`actionTypes.get(action.nodeId) ?? action.definitionId`, the same expression
and the same definition-id fallback that `flow-lane/persisted-flow-run.ts`
uses. The failure message now also names what did run, as the Flow lane's
`assertFlowActions` does; action types are Core vocabulary, never page data,
and each is still passed through the file's existing `safeId`.

Two deliberate choices:

- **Only when there is something to check.** The map is read only if
  `expectedActions` is non-empty, so a run with no action expectations makes no
  extra calls and cannot newly fail.
- **The reused module's contract comes with it.** `readFlowActionTypes` throws
  `recording.contract` when the Flow declares no output-dispatching node. For a
  run that asserts actions that is honest — nothing it ran could be identified
  — but it is a new failure mode for the `existing` and `clone` lanes, and it
  costs two extra Automation Studio calls (`get-flow`, `list-flow-subflows`)
  per such run.

### Deviation: one line in a file I did not own

Task one requires `browser-state.ts` to import from
`runtime/unsupported-page.ts`. That module was **not exported from
`apps/extension/src/runtime/index.ts`**, and the structure audit's `imports`
rule forbids reaching past a directory's barrel. I measured both options rather
than assuming:

- Deep import `../../runtime/unsupported-page` — audit **fails**:
  `FAIL [imports] apps/extension/src/background/connection/browser-state.ts: 1
  import(s) reach into another directory's files instead of its barrel`.
  `browser-state.ts` has no `imports` entry in `.structure-baseline.json`, so
  this is a new violation, and the mirrored ratchet refuses to baseline a new
  one.
- Barrel import `../../runtime` — fails to compile until the barrel exports the
  module: `error TS2305: Module '"../../runtime"' has no exported member
  'unsupportedAutomationPageReason'`.

So the brief's "point the background one at the newer module" and its
"structure audit clean" were unsatisfiable together without it. I added
`export * from "./unsupported-page";` to the barrel — additive, alphabetically
placed, no other file's behaviour changed. It is also what the repository's own
rule ("a barrel in every directory") asks for; `w2-browser-actions` added the
module without adding it to the barrel, which is why it was unreachable from
outside `runtime/`. **Revert it and task one cannot land as specified.**

## Commands run and observed results

`EXTENSION_TEST_BUILD_LABEL=w2i-unowned-defects` was set for every extension
command. No `pnpm build` and no `pnpm lab` command was run. Exit status was
captured by redirecting to a file and echoing `$?`, never through a pipe.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/extension check` | `check_exit=0` |
| `pnpm --filter @fluxiq-web-extension/extension test` | `test_exit=0` — `# tests 122 # pass 122 # fail 0` |
| `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json --noEmit` | `exit=0`, no output |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | `exit=0` — `# tests 389 # pass 389 # fail 0` |
| `node scripts/structure-audit.mjs` (scratch git index) | `audit_exit=0` — `structure-audit: passed (32 warning(s), 19 baselined)`, no `FAIL` line |

The audit was run through a scratch git index
(`cp .git/index <scratch>; GIT_INDEX_FILE=<scratch> git add -A`) because it
reads only tracked files and `runtime/unsupported-page.ts` and `flow-lane/` are
still untracked. `pnpm structure:baseline` was **not** run.

### Both tests proven to fail against the old code

A test that passes before and after proves nothing, so I replayed the old logic
against exactly the inputs the new tests assert on
(`<scratchpad>/w2i-old-behaviour-proof.mjs`):

```text
== Task one: old rule against the URLs the new tests assert are refused ==
  MISSED (test would fail)  about:blank
  MISSED (test would fail)  view-source:https://example.test/
  MISSED (test would fail)  data:text/html,<p>hello</p>
  MISSED (test would fail)  devtools://devtools/bundled/inspector.html
  MISSED (test would fail)  javascript:void(0)
  MISSED (test would fail)  https://chromewebstore.google.com/detail/abc
  MISSED (test would fail)  https://microsoftedge.microsoft.com/addons/detail/abc
  MISSED (test would fail)  https://addons.mozilla.org/en-US/firefox/addon/fluxiq/
  old rule missed 8 of 8
== Task two: old vs new matching on Core's real attempt shape ==
  expected web.dom.type: old=false new=true
  expected builtin.policy.action: old=true new=false
```

The task-two fake now carries Core's real shape (`definitionId:
"builtin.policy.action"`, `nodeId: "node.one"`, and a Flow node whose
`parameterValues.outputId` is `web.dom.type`), so the pre-existing assertions
in that file exercise the join rather than a shape Core never produces. The new
test also covers the definition-id fallback and an action reached through a
subflow's graph Flow.

## Not verified

- **No live target.** The brief said an existing target could not be exercised
  here, and it was not. Task two is proven by unit test and by reading Core's
  shape from `w2-flow-lane.md`; it has never run against a real persisted Flow.
  The new `recording.contract` failure mode and the two extra HTTP calls are
  therefore unobserved in a real run.
- **No browser validation of task one.** `unsupportedPageForUrl` is a pure
  function and is unit-tested, but the recording path that consumes it
  (`connection.ts`, `content-attachment.ts`) was not exercised in a browser, so
  "a `data:` page now blocks recording" is reasoned from the call sites, not
  seen. AGENTS.md asks for manual browser validation on recording-path changes.
- **`pnpm build` and root `pnpm check`/`pnpm test`** were not run — the brief
  reserves both for the supervisor. Only the two affected packages were built
  and tested.
- I did not re-run anything after the final audit, so the audit reflects the
  tree as it stood at that moment; other workers were editing it concurrently.

## Open questions or contradictions found

### 1. The same latent bug survives in `run-manifest/action-timings.ts`

`flowActionTimings` (line 12) sets `actionType: action.definitionId` for every
attempt, and `run-scenario.ts` feeds its result into `run.json` for both the
`existing` and `clone` lanes. Every recorded action therefore lands in the run
manifest as `builtin.policy.action`, so the evidence bundle cannot say what
actually ran. It is the identical defect to the one I fixed, one call site
over, and it is outside my owns (`existing-flow-run.ts` and its tests). Fixing
it needs the `nodeId → outputId` map threaded to the caller, which the Flow
lane already builds. **Recommend assigning it.**

### 2. The brief's "must not touch" made its own definition of done unreachable

Documented in [Deviation](#deviation-one-line-in-a-file-i-did-not-own). Flagged
rather than silently worked around; a future brief that says "point X at Y"
should grant the barrel of Y's directory.

### 3. `w2-flow-lane` called this bug and left it

`w2-flow-lane.md` Finding 1 identified the `existing-flow-run.ts` defect
precisely and correctly declined to fix it as out of scope. That report's
reasoning matched what I found in the source; nothing in it needed correction.
