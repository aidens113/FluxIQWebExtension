# t648 report: repair may revisit its own addresses

## Outcome

Blocked. The brief said to stop if Core does not pass the failing proposal's steps to the domain, and it does not.
No source file was changed. Below is exactly what Core would need to pass, and where.

## What changed and why

Nothing changed in source. I found the following.

- The run's repair opening (step 0202, brief-6, `role: repair`) is `initial.core.run_node`. Its request is only the
  arrival navigation `{node: web.output.browser-navigate, parameters: {url: <start location>}, consequences: []}`.
  It has no `held` key and nothing else from the failing proposal.
- Core adds the failing trial and `yourSubflow` (script and resolved steps) under `repairOf`. It does this in
  `packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/run-brief.ts`, in
  `shownAtOpening` (around line 361). The wrapper calls the domain's `executeTool(call)` with the call unchanged and
  only then adds `repairOf` to the **result** (`ran.evidence[REPAIR_KEY]`). The domain never sees it. The model
  sees it in its prompt (0203 request, `repairOf.yourSubflow.steps`).
- `held` comes from `runtime/llm/evidence-loop.ts` lines 526-548. It is built only from draft steps with
  `disposition === "kept"`, and a repair builder's draft has none. Even when `held` is set, it means "a round that
  continues a Flow": the domain then skips arrival re-arming and forgets nothing (`node-run/run.ts`, lines 152-189).
  That is wrong for a repair, which opens with a fresh arrival. So reusing `held` would not be correct either.

### What Core would need to pass (the proposed contract)

1. **Where:** `run-brief.ts`, `shownAtOpening`, on the opening call only (`isOpeningCall(call.callId)`). Before
   `inner(call)`, add a new key to `call.value`, for example `repairs`. It holds the calls of the proposal being
   repaired (the one `yourSubflow` names, from `ACCEPTED`), each as `{node, parameters}`, in the same shape as
   `held`. The parameters go through the same `deniedEvidenceKeys` screen `yourSubflow.steps` already uses (t625),
   so the opening request is not refused `flow_bootstrap.request_refused_evidence_denied_key`. Pass nothing when the
   proposal is not held.
2. **Ordering constraint:** the domain refuses unknown keys on a call (`run.ts` line 203,
   `unexpected_input_keys`). The domain half must therefore land with or before Core's change. Otherwise every
   repair opening is refused.
3. **The domain half (small, once the key is agreed):** add `webNodeRepairedFlow(request)` in `arrival.ts`. Like
   `webNodeHeldFlow`, it reads the key only on `initial.<toolId>`, strips it from the look, and returns only the `url`
   of each call whose node `webMovesThePage`. In `run.ts`, after `run.addresses.opening(...)`, call
   `run.addresses.held(build, url, startLocation)` for each. Nothing else changes: no arrival, no
   `held-literals` hold, no forgetting skipped. `shown-addresses.ts` needs no change, because `held()` already
   compares with exact query values plus typed text, so a navigation with an edited query value stays refused.
   Test: `node-run/tests/shown-addresses.test.ts` or `arrival.test.ts`. A repair opening carrying a proposal whose
   step navigates to U accepts U, refuses U with one query value changed, and ignores the key on a non-opening
   call id.

`run.ts` is not on this brief's owned list. The domain half touches it, so a re-brief should own `run.ts` too.

## Commands run and observed results

- Read the debug report's sections 5 and 7, plus the run's steps 0201 (dispatch), 0202 (the opening call and its
  result) and 0203 (the decide request: `repairOf` appears there, as part of the opening result).
- `grep` in Core for `repairOf` and `held`. This found `run-brief.ts` (`shownAtOpening` adds the key to the result
  only) and `evidence-loop.ts` lines 526-548 (`held` comes only from kept draft steps).
- No tests, tsc or structure check were run, because no code changed.

## Not verified

- I did not check whether another build path (outside project dispatch) also opens repair builders without `held`.
- I did not check whether Core's `isOpeningCall` covers a scoped opening id (`callScope`) in the same way the
  domain's `initial.` prefix check does. The domain currently compares the call id with `initial.<toolId>` exactly,
  and a scoped id may not match.

## Open questions or contradictions found

- The brief describes fix 7 as "with Core passing the held addresses". The Core edit is a prerequisite, and Core is
  read-only on this brief.
- If Core scopes the opening call id (`callScope` when host capacity > 1), the domain's exact
  `initial.<toolId>` match in `webNodeHeldFlow` and `webNodePreparedEntry` may already miss such openings. Check
  this before reusing that guard.

## Round 2

### Outcome

Done. Both halves are built as proposed, and a scoped opening-id defect turned up and is fixed in the domain.

### What changed and why

Domain (`C:/Users/osrs_/FluxStuff/fxwork/t648/!FluxIQWebExtension`):

- `domain/src/runtime/llm-evidence/node-run/arrival.ts`
  - New `webNodeRepairedFlow(request)`. It reads `repairs` only on Core's own opening call, removes it from the call,
    and returns only the `url` of each call whose node moves the page.
  - The address extraction is now shared with `webNodeHeldFlow` (`navigationAddresses`).
  - New private `coreOpening`. It accepts `initial.<toolId>` and `initial.<toolId>.<scope>`, where the scope is
    `[A-Za-z0-9_-]{1,40}`, the pattern Core's `llm/evidence-loop/call-id.ts` enforces.
  - The header records both changes.
- `domain/src/runtime/llm-evidence/node-run/run.ts`
  - Strips `repairs` before the `held` and `arrived` readers, so both work on the stripped call.
  - After the opening's `opening(...)` resets, it records each repaired address with `run.addresses.held(...)`. It
    does not call `arrive`, and it changes nothing about arrival or forgetting.
  - The file is now 787 lines, under the 800-line limit.
- `domain/src/runtime/llm-evidence/node-run/tests/shown-addresses.test.ts`: four tests on a library-catalogue stub.
  New tests go in this file because both node-run directories are at the 25-file budget.
  1. A repair whose proposal navigates to U accepts U. It refuses U with an edited query value, and refuses a URL
     that only a non-navigation step carried.
  2. The next build's opening forgets that address.
  3. Scoped opening ids count `repairs`. Ids `call.repairs`, `initial.model.1` and `initial.core.run_node.has.dots`
     carrying `repairs` are refused `invalid_input`.
  4. A scoped opening marked `arrived: true` is accepted, and a typed call after it runs.

Core (`C:/Users/osrs_/FluxStuff/fxwork/t648/!FluxIQ`, `packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/`):

- `run-brief.ts`
  - `yourSubflow` now also returns the held proposal's calls as `{node: definitionId, parameters}`. Each copy is
    screened with `automationStudioLlmValueWithoutDeniedKeys(deniedKeys)`. When the proposal is not held, it returns
    `undefined`.
  - `repairOf` returns `{said, calls}`.
  - `shownAtOpening(loop, said, calls)` adds `repairs` to the opening call's `value` before calling the domain, and
    only when `calls` is non-empty. Later calls pass through untouched. `repairOf` is still added to the result as
    before.
  - The header has a t648 paragraph.
- `tests/repair-opening.test.ts`
  - `scripted` now records what `executeTool` received.
  - New describe block, test 1: the repair's opening carries `{node, parameters}` calls, including the navigation
    with its url and the click. No `selector` appears. No later call and no build brief carries `repairs`.
  - Test 2: a dispatcher that does not hold the proposal passes no `repairs`.

### Open question 3: scoped opening ids

They did not match before this change. Core's scoped id is `initial.<toolId>.<scope>` (`call-id.ts`, t537). Project
briefs use it when host capacity is above 1 (`run-brief.ts`, `callScope`). The domain's `webNodeHeldFlow` and
`webNodePreparedEntry` compared with `initial.<toolId>` exactly. A scoped builder's `arrived: true` (t585) was
therefore refused `unexpected_input_keys`.

Test 4 fails on the original source, which I checked by temporarily restoring the HEAD copies of `arrival.ts` and
`run.ts` and putting my versions back afterwards. Tests 1 to 3 fail there too. The live run did not hit this because it
used capacity 1 (`initial.core.run_node`).

Left open, and Core's to close: Core does not reserve the `initial.` prefix. A model-written call id such as
`initial.core.run_node.x` passes `UnusedCallId` unchanged and would be read as an opening. This already applied to
`webNodeOpensBuild` and to Core's own `isOpeningCall`, which adds `arrived` and `repairOf` by prefix. The domain
header says so.

### Commands run and observed results (round 2)

- `node domain/scripts/test-domain.mjs runtime/llm-evidence/node-run` printed `# tests 360`, `# pass 360`,
  `# fail 0`. With HEAD's `arrival.ts` and `run.ts`, `.../tests/shown-addresses` printed `# pass 13`, `# fail 4`:
  exactly the four new tests.
- In `domain`, `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` both exited 0.
- `pnpm structure:check` passed (196 warnings, 639 baselined). The first run failed on one `contract-spread` in my
  test helper; I fixed it by building the value explicitly.
- In Core `packages/fluxiq`, `npx tsc --noEmit -p tsconfig.json` exited 0.
- In Core `packages/fluxiq`, `npx vitest run src/programs/automation-studio/runtime/project-agents/dispatch` passed
  11 files and 74 tests, `repair-opening.test.ts` 12 of 12.
- In Core, `node scripts/structure-audit.mjs` passed (378 warnings, 1156 baselined).

### Not verified (round 2)

- No live run, as the brief said.
- I did not trace the real `told` and `placing` wrappers (`service/project-build/brief-ports.ts`) end to end with
  `repairs` present. They wrap inside `shownAtOpening` and spread `call.value`, so the key should pass through.
- Any non-web domain driven by project dispatch would now receive `repairs` on a repair's opening. `arrived` already
  works the same way.
- I did not update `docs/architecture/`, because no page there describes held addresses.

### Commit note

The two sides must land together, domain first or in the same unit. A domain without the reader refuses Core's
`repairs` as an unexpected key.
