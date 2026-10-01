# t195-w18: a declined permission ask no longer blocks a different control's ask

## Outcome

Done. A person's explicit "no" is now remembered for one question only: the same control name, the same control kind, and the same classes. A different question raises a new request, and the build asks it. A request nobody answered still stays in force, so the build waits only once. The domain now tells the model `consequences_declined` for a declined press.

Every check the brief named was run and passes, with one exception. The Core structure audit fails on `runtime/service.ts` at 4,506 lines against a baseline of 4,505. This worker did not touch that file (`git diff HEAD` shows no change), so the failure was already there at `e5b8f015`.

## What changed and why

### Core (`C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`)

- **`runtime/action-permissions/gate.ts`**
  - The single `raised`/`raisedRef` pair is replaced by three pieces of state:
    - `outstanding`: a request that was raised and not declined, so it is still waiting or nobody answered it. While it stands, no new request is raised.
    - `latest`: the request carried by the most recent refusal. This is what `request` returns, so it is what the build ends on or is proposed with.
    - A list of declined questions. Each entry holds the request plus the raw control name and kind from the domain, recorded when the request was raised.
  - `settle()` accepts `"granted" | "declined" | "unanswered" | "refused"`. `"refused"` is kept with the same meaning as `"unanswered"` for `recovery/runtime-exploration.ts`, which was not changed.
  - A grant adds the missing classes, as before, and clears `latest` when that request is the one granted.
  - `checkFor` looks for a matching decline before applying the permitted-set filter. A question matches a decline when the control name and kind are the same and the action still declares every class that was declined. A match is refused with the declined request's id, `declined: true`, and the declined `missing`. Because this check runs first, a later grant of the same class on another control does not lift the decline.
  - `raisedDuring(ref)` now reads `latest.action.ref`. For every existing caller the result is the same as before.
- **`runtime/action-permissions/declaration.ts`**: the refused member of `AutomationStudioActionPermissionVerdict` gains an optional `declined?: true`, with a doc comment. Existing callers are unaffected.
- **`runtime/parking/permission-ask.ts`**
  - New `automationStudioPermissionAskOutcome()` returns `"granted" | "declined" | "unanswered"`, typed as `AutomationStudioPermissionAskOutcome`.
  - `"declined"` means the thread holds a `deny` answer. A timeout comes back from the conversation port as `undefined`, because the store marks the ask `expired` rather than answered. A thrown error or no wait also counts as unanswered.
  - `automationStudioAskedAndGranted` is now a thin wrapper and behaves as before.
  - Both are exported from `parking/index.ts`. The header comment is updated.
- **`runtime/flow-bootstrap/action-permissions.ts`**
  - The build-wide `asked` boolean is replaced by `asked: Set<requestId>`, so each request is asked at most once.
  - A decision marked `declined` is never asked.
  - After an unanswered ask the build calls `settle("unanswered")` and returns the refusal. Any other outcome is settled and the check is asked again. A grant then permits the action; a decline makes the gate return the `declined` refusal.
  - The header passage and the `request()` doc are rewritten.
  - `planStep`, `endedOnRequest` and `request()` still read `gate.request`. That value is now the request that actually refused the step, and the plan-step test below proves it.
- **`runtime/llm/node-tools/run-node.ts`**: the example now reads "the press that applies a filter or opens checkout is []". The description is **1,990** characters, measured by a scratch script that rebuilds the joined string. The ≤2,000 test passes. The stale "1,996" comment is updated.
- **`docs/architecture/automation-studio/llm-flow-bootstrap.md`**: the "One question is asked per build" passage is replaced by a paragraph that states the new rules.
- **Tests**
  - `action-permissions/tests/gate.test.ts` gains a describe block with four cases:
    - a decline on A, then B asked and granted, then B permitted;
    - A refused again without asking, with A's id and `declined: true`, even after B's grant;
    - the same control asked about different classes is a new request, while the declined classes stay refused;
    - an unanswered or refused request stays in force.
  - New `flow-bootstrap/tests/action-permissions.test.ts` drives the build wiring with a scripted port:
    - a decline then a grant on a different control;
    - the declined control refused again without asking;
    - a timeout means one wait;
    - a plan-step refusal ends the build on the right request. It is a new declined request in one case, and the declined exploration request when the plan step repeats the declined question.
  - `tests/service-bootstrap/tests/permission-ask.test.ts` gains one test through the real service and conversation store. A deny on "Continue to checkout", then a grant on "Place order": the press goes ahead, the proposal carries no request, and the ask rows are waiting/declined, waiting/allowed.
  - `llm/node-tools/tests/run-node.test.ts`: the wording assertion now pins the new phrase.

### Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQWebExtension`)

- **`domain/src/runtime/llm-evidence/permission.ts`**: the refused member of `WebActionPermission` gains `declined?: true`. The value is copied from the verdict through `present<T>()`, because a conditional spread failed the extension `contract-spread` audit.
- **`press.ts` and `node-run/run.ts`**: only the `reason:` line changed. It now reads `requestId === null ? "nobody_to_ask" : permission.declined ? "consequences_declined" : "consequences_not_granted"`. Nothing else in `run.ts` was touched.
- **`tool-rejection.ts`**: `consequences_declined` is added to `WEB_LLM_TOOL_REJECTION_REASONS`, with its doc line: the person declined this press; do not make it again with that declaration; do the task another way or finish without it.
- **Tests**
  - `tests/tool-rejection-detail.test.ts`: a declined press through `run_node`, which exercises `run.ts`.
  - `tests/press.test.ts`: `pressControl` directly, which exercises `press.ts`. It covers the declined case and the still-being-asked case.

## Commands run and observed results

Heavy commands ran through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w18 ..."`.

### Core vitest and type check

Run from `packages/fluxiq`:

- `npx vitest run runtime/action-permissions runtime/parking runtime/flow-bootstrap runtime/recovery runtime/tests/service-bootstrap automation-studio/tests/permission-defaults.test.ts runtime/llm/node-tools`
  - Result: `Test Files 1 failed | 118 passed (119)`, `Tests 1 failed | 1551 passed (1552)`.
  - The one failure was `run-node.test.ts` "shows both answers", which pinned the old wording. The assertion was updated.
- After the fix, `npx vitest run .../llm/node-tools`: `Test Files 4 passed (4)`, `Tests 35 passed (35)`.
- `npx vitest run .../tests/service-bootstrap/tests/permission-ask.test.ts`: `Tests 4 passed (4)`.
- `npx tsc --noEmit -p tsconfig.json`: no output, `tsc-exit 0`.

### Core build

- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build`:
  - `packages/fluxiq build: {"build-cache":"build",...,"ms":283578}` and `Done`; the other two `reuse` and `Done`; exit 0.
  - The built `dist/.../declaration.d.ts` contains `declined?: true;`.

### Structure audits

- Core, `node scripts/structure-audit.mjs`: `structure-audit: 1 violation(s) across 1 rule(s)`. The violation is `FAIL [file-lines] .../runtime/service.ts: 4506 lines ... Baseline for this entry is 4505`. This was already there; the file is unchanged from HEAD.
- Extension, `node scripts/structure-audit.mjs`, first run: 2 `contract-spread` FAILs, in my `permission.ts` and in my test. Both were fixed. The re-run printed `structure-audit: passed (135 warning(s), 119 baselined)`.

### Domain check and tests

- `pnpm --filter @fluxiq-web-extension/domain check`: `check-exit 0` (build-cache `build`, 63 s).
- `pnpm --filter @fluxiq-web-extension/domain test`: `# tests 1063`, `# pass 1063`, `# fail 0`. Both new tests appear as `ok 856` and `ok 912`.

### Each new test fails with its change reverted

Source files were swapped to their HEAD versions, the tests were run, and the files were restored. The restore was confirmed by grep counts and diff stat.

- **Core: five source files at HEAD** (gate, declaration, flow-bootstrap action-permissions, permission-ask, parking index), running gate.test, the new wiring test and permission-ask.test: `Tests 7 failed | 21 passed (28)`.
  - Failing: the three new gate cases, three of the four wiring cases, and the new service case.
  - Two new tests passed against HEAD and needed more work:
    - **Gate "other classes" case.** It passed only because the old `settle` treated an unknown answer as a grant. I strengthened it so the declined classes must stay refused. With `gate.ts` alone at HEAD it now fails: `1 failed | 19 skipped`.
    - **Wiring "waits once when nobody answers" case.** It guards a rule the brief keeps unchanged, so it cannot fail on a revert. I checked it with a mutation instead: removing `|| asked.has(request.requestId)` makes it fail (`1 failed | 3 skipped`).
- **Domain: `press.ts` and `node-run/run.ts` at HEAD**, running `DOMAIN_TEST_BUILD_LABEL=w18revert node scripts/test-domain.mjs`: `not ok 856`, `not ok 912`, `# pass 1061`, `# fail 2`. The labelled scratch directory was removed afterwards.

## Not verified

- No live run and no Lab run, by order.
- I did not check through a model whether "opens checkout" changes what a model declares.
- The run-node description length of 1,990 comes from my script. The test only asserts ≤2,000; it does not print the length.
- I did not run the whole Core suite, only the folders the brief named. I did not run `pnpm check`, `pnpm test` or `pnpm build` at the repository level.

## Open questions or contradictions found

1. **Should `recovery/runtime-exploration.ts` follow? Yes, recommended, as its own brief.** Today it calls `automationStudioAskedAndGranted` and `settle("refused")`. In a repair, a person's no is therefore treated like silence, and it blocks every later question in that repair. That is the same defect on the repair path.
   - The change is small: call `automationStudioPermissionAskOutcome`, call `settle(outcome)`, and ask the check again on a decline.
   - It also needs a review of its per-call ask guard, and of `raisedDuring(call.callId)` at line 343. That call now reads the request the latest refusal carried, which can be a declined request raised on an earlier call.
2. **Replay refusals still never say `consequences_declined`.** `domain/.../node-run/replay-answer.ts` `webNodeReplayPermissionReason` maps every refusal to `nobody_to_ask` or `consequences_not_granted`. That file is in the folder another task owns and was outside my brief, so I left it.
3. **What a finished build is proposed with after a decline.** I kept today's rule: `request()` returns the request the latest refusal carried.
   - If a decline is not followed by another grant, the build is proposed carrying the declined request, and the proposal cannot be approved ("was refused"). Yet the Flow cannot contain the declined step, because plan steps are gated.
   - If the decline is followed by a grant on another control, `request()` is `undefined` and the proposal can be approved.
   - So "finish without it" in the new reason text produces a proposal that cannot be approved, unless something was granted later. Whether a declined request should hold a proposal at all is a product decision for the supervisor.
4. **The matching rule is my reading of "same missing classes".** A question repeats a declined one when the name and kind are the same and the action still declares every class that was declined. Equality was not required.
   - The name compared is the domain's raw name, not the name the request carries. Otherwise two controls whose names were both withheld would count as the same question.
   - The match is checked before the permitted-set filter, so a grant elsewhere does not lift a decline.
5. **A declined action is recorded twice in `declarations`.** The first record is the refusal before the ask; the second is the `declined` refusal from the check asked again. A granted action is already recorded twice the same way, refused and then permitted.
