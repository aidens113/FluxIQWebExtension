# t358: a candidate submission can name controls from pages exploration has left

Worker: t358-view-history. Worktree `C:\Users\osrs_\FluxStuff\fxwork\t358`. Downstream is on `a721901c` and Core on `01751e68`, both with uncommitted edits. Nothing is committed.

## Outcome

Done.

A candidate submission now resolves each handle from every view exploration took, not only from the page as exploration last saw it. Each handle resolves to the identity its views agree on, which is t356's rule. Round 4's `t478` and `t488` (the start page's popup controls, gone from the next view of that page) now validate.

Unchanged:

- Exploration's `core.run_node`, reruns and every legacy completion still resolve against the current pages only.
- A handle no view ever printed is still refused, and the refusal names it.

The submission records which view each handle came from. That record goes in the submission receipt the model reads (`handleViews`). It is not stored in the candidate itself, which keeps the stored draft's exact-key contract intact (see Open questions, item 1).

## What changed and why

### Downstream domain (`domain/src/runtime/llm-evidence/plan-resolution/`)

**New file `view-history.ts`: `createWebLlmViewHistory`.** It keeps one Flow's view history:

- every handle that any capture carried (a shown packet or an unshown look);
- what its views agree it names, using the store's `acrossView` merge, which is t356's rule;
- the newest view that carried it;
- the number of that view on each page it was carried on.

A view is one capture, numbered from 1 in the order taken. Bounds: 8192 handles per Flow, and the newest 16 pages per handle.

**`target-packets.ts`:**

- `remember` and `rememberLook` now also record each capture in the history.
- `resolve` takes an optional fourth argument, `reach` (`"view_history"`).
  - Without it, behaviour is byte-for-byte as before. The old body moved unchanged into `resolveCurrent`.
  - With it, a handle the current pages resolve also carries `shownIn: {view, location}`.
  - A handle the current pages call `unknown` or `stale` resolves from the history. If a `location` is named, it must be a page that view was on.
  - A handle that a reload renumbered, or that is `ambiguous` or `not_unique`, keeps its refusal: another handle names that control now, or no single control is named.
- The per-handle merge was split out as `acrossView`, so the page store and the history share it.

**New file `frame-url-path.ts`.** The existing child-frame path reader moved here unchanged. This keeps `target-packets.ts` at 397 lines, under the 400-line advisory.

**`resolve-plan-node.ts`:**

- New input `handleReach?: "view_history"`, threaded to target handles and to the Next page control (`next-page-slot.ts`).
- When `handleReach` is set, a resolved answer carries `handleViews: [{handle, view, location}]`. Otherwise it carries exactly `status` and `parameters`, as before.

**`index.ts`** exports the new types and the history factory. `tools.ts` needed no edit: it hands Core's input object straight through.

### Core (`packages/fluxiq/src/programs/automation-studio/runtime/`)

Files touched, besides candidate/**: `llm/harness-options/{binding,plan-parameter-resolution,bootstrap-completion,index}.ts`. These are the plan-parameter resolution call the submission uses.

- **`binding.ts`:**
  - `resolvePlanNodeParameters` input gains `handleReach?: "view_history"`.
  - The resolved answer may carry `handleViews`.
  - New types `AutomationStudioPlanHandleReach` and `AutomationStudioPlanHandleView`.
- **`plan-parameter-resolution.ts`:**
  - New `handleReach` input. It is sent to the domain only when set.
  - An answer carrying `handleViews` is accepted only when `handleReach` was set and the list is valid: 1 to 64 entries, each exactly `{handle, view, location}`, with the handle matching Core's handle token, `view` a safe integer of at least 1, and `location` 1 to 2048 characters.
  - On any other answer the key is refused `bootstrap.parameter_resolution_invalid`, as before.
  - When asked, the result carries `handleViews` per node ref (`<subflow>.<node>`). When not asked, the result's keys are unchanged.
  - It imports the handle constants from `../harness/index.ts`; see Open questions, item 3.
- **`bootstrap-completion.ts`:** new `handleReach` input, passed through. An accepted verdict carries `handleViews` only when the resolution returned them.
- **`candidate/submission.ts`:** sends `handleReach: "view_history"`. A valid submission returns `{ok, candidate, handleViews}`.
- **`candidate/contracts.ts`:** `handleViews` is on the ok submission type, not on `AutomationStudioFlowCandidate`.
- **`candidate/authoring-loop.ts`:** the submit receipt includes `handleViews` when there are any. A step aimed at a control from another page than the one it runs on can then be seen; that was round 4's actual script mistake.
- **`candidate/submission-refusal.ts`:** the recovery text no longer says a handle belongs only to the page it is on. It now says:
  - a step may name a control from any view the build printed;
  - a handle no view printed cannot be a target.

  "look at that page" and "drop it" are kept.

## Commands run and observed results

**Fail-first, domain.** I restored the 4 product files from HEAD and removed the 2 new modules, then ran the new `tests/view-history.test.ts` through a scratch runner. The runner uses the same esbuild settings as `scripts/test-domain.mjs` and writes to the ignored `domain/.test-build-scratch/t358`, which I removed afterwards.

- Result: `# pass 1 # fail 4`.
- The test that passes either way is the guard: exploration's run and the legacy path still refuse.
- The files were then restored.

**Fail-first, Core.** I restored the 8 changed product files from HEAD and ran the 2 new test files.

- Result: `Test Files 2 failed (2)`, `Tests 4 failed | 3 passed (7)`.
- The 3 that pass are the legacy and malformed-input guards.
- The files were then restored, with CRLF working-copy line endings put back.

**Domain tests.** All 120 test files under `src/runtime/llm-evidence/**/tests/`: `# tests 842 # pass 842 # fail 0`. That is t356's 837 plus my 5.

**Domain typecheck.** Against the rebuilt Core dist:

- `npx tsc -p tsconfig.json --noEmit`: exit 0.
- `npx tsc -p tsconfig.test.json --noEmit`: exit 0.

**Core tests.** `npx vitest run` over `flow-bootstrap/candidate`, `llm/harness-options`, `service/candidate-trial`, `service/candidate-drafts`, `service/flow-bootstrap-commands` and `flow-bootstrap/plan`: `Test Files 56 passed (56)`, `Tests 491 passed (491)`.

**Core typecheck, nonincremental.** `npx tsc --noEmit -p tsconfig.json`: exit 0, after the final edit.

**Core audit.**

- The first run failed `[imports]`, because I had imported from `../harness/structured-response.ts`. I fixed it by importing from the barrel.
- Final run: `structure-audit: passed (288 warning(s), 508 baselined)`, exit 0.
- It also printed "1 baseline entries can be lowered"; t356 reported the same, so it predates this change.

**Downstream audit.**

- The first run failed `[contract-spread]` on a conditional spread in `resolve-plan-node.ts`. I fixed it by assigning the field.
- Final run: `structure-audit: passed (176 warning(s), 182 baselined)`, exit 0.

**Core build.** `pnpm build` in `!FluxIQ/packages/fluxiq`: exit 0. `node scripts/check/core-build.mjs` then reported: "core-build: FluxIQ Core's build at ...\t358\!FluxIQ is current with its source."

**No `as never` added.** I checked the new tests with grep. The bad-answer test passes the resolver as `unknown`.

## Not verified

- No live, Lab, provider or panel run, as briefed. Whether a trial actually finds a start-page popup control resolved from history is unmeasured:
  - the popup may be absent when the trial runs, which is t357's optional-step work;
  - the page may lay the popup out differently on a fresh load.
- I did not run the whole domain suite, the extension build or extension tests. Two extension tests (`content/action-runtime/tests/store-chooser-replay.test.ts` and `content/identity/tests/created-node-identity.test.ts`) call `resolvePlanNodeParameters` without `handleReach`, so their path is the unchanged one, but I did not run them.
- I did not run the whole Core suite.
- The model-visible receipt now carries `handleViews` with full locations, about 100 characters per handle. I did not measure the token effect.

## Open questions or contradictions found

1. **Where the record lives.** The stored candidate draft (`service/candidate-drafts/source.ts`, which I do not own) validates the candidate's keys exactly. Putting `handleViews` on `AutomationStudioFlowCandidate` would therefore have made every saved draft read back as `candidate.source_record_invalid`. So the record sits on the submission receipt (and in the run's step log, through the receipt), not in the persisted draft. If it should persist, `candidate-drafts` needs a schema change.
2. **Looks count as views.** A handle carried only by an unshown look also enters the history. This matches the current page store, which already resolves look-only handles. The stricter reading ("only shown views") is a one-line change in `target-packets.ts`: drop the `record` call in `rememberLook`. The cost would be losing t356's label merge from the look taken after a press.
3. **Import cycle in Core (observed, not fixed).** Under vitest, when `bootstrap-completion.ts` loads first, the constants re-exported through `llm/harness.ts` read as `undefined` even at call time. `../harness/index.ts` works, which is why the import is direct. `plan-node-handles.ts` imports the same constants through `../harness.ts`. In that load order its handle-token regex would be `new RegExp(undefined)`, which matches everything, and its length bound would never trip. I did not investigate whether this happens outside vitest.
4. **A renumbered handle stays refused under the view history.** The reload shows the control under another handle, and the old selector may not match a fresh load either. The supervisor may want that reconsidered once trials run from a reset page.
