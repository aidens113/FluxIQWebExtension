# t486 downstream: stale handle, type or clear into a non-field, dotted read fields, cover naming

Worker report. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t486/!FluxIQWebExtension`, branch
`task/t486-stale-handle-and-satisfied-step`. Nothing committed. Two passes: the original brief, then the
continuation, which gave me `node-run/run.ts`, `tool-rejection.ts` and `clear.ts`.

## Outcome

**Done for everything downstream**, with two pieces named for other owners, as instructed:

- **The submit-time page check for script steps** (coordinator addition from B build 2) lives in Core. See
  "Core: submit-time page check" below.
- **The extension's sticky-header blocker (N5).** Its cause is in `apps/extension/src/content/evidence/overlays.ts`,
  which is not mine. I fixed the domain half (the header line dropped the blocker's own role).

## What changed and why

### Goal 1: a handle from another page is refused before any send (live)

- **Cause, confirmed from code.** `node-run/run.ts` resolved the call with no location. A bare handle then went
  through `target-packets.ts` `resolveCurrent`'s all-pages branch, so the towels page's `t667` resolved and was sent
  to the napkins page.
- **`plan-resolution/target-packets.ts`.** New store method `resolveOn(scope, handle, page)`:
  - a handle the page holds resolves there;
  - a handle that only a page with a different document path holds is `stale`;
  - a handle no page holds is answered as a bare lookup would answer it;
  - it falls back to the old bare lookup in three cases, because none of them can say what the page lacks:
    - a page the store does not hold;
    - a page whose newest view was a look the browser cut short (new `partial` set);
    - a handle held by the same path under another query or fragment. That is the same document in another state.
      U-B3-3 (`run-mux6pndp-16feb842`), a rerun that dropped `?variant=`, is pinned by `shown-handle-past-cap.test.ts`
      and still presses the chip.
- **`plan-resolution/resolve-plan-node.ts`.** New input `onPage`. When the handle has no written `location` and there
  is no `handleReach`, the resolver uses `resolveOn`.
- **`node-run/run.ts:270`.** Now passes `onPage: current?.evidence.location`. The node run already turns
  `web.handle.stale` into the t477 refusal: `target_unobserved` / `page_moved_since_packet` with `STALE_NEXT`,
  carrying the page just captured.
- Replay, verify and candidate submissions pass no `onPage` and are unchanged.

### Core: submit-time page check for script steps (coordinator addition): not done, belongs in Core

- Core resolves each node of a submitted script on its own. The domain input says nothing about which page a step
  acts on.
- Core collects each node's `handleViews` (with `location`) in plan order without comparing them to the pages the
  preceding steps reach. File:
  `C:/Users/osrs_/FluxStuff/fxwork/t486/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/llm/harness-options/plan-parameter-resolution.ts`,
  lines 197-245. It reaches the submission at `runtime/flow-bootstrap/candidate/submission.ts:109`.
- The refusal wording that names both pages belongs in `candidate/submission-refusal.ts` `HANDLE_ADVICE`.
- No test written; its subject is in Core.

### Goal 2: type or clear into a non-editable element

- **`plan-resolution/typing-targets.ts` (new).** Marks each capture element that is not a field, with a closed kind
  word (`text`, `heading`, `checkbox`, `file_input`, …).
  - An element is a field when its page-view kind is `field…` (not `field:file`), or when the nearest
    `contenteditable` at or above it is not `false`.
  - `target-packets.ts` carries the kind on the resolution as `notAField`.
- **`resolve-plan-node.ts`.**
  - A candidate's (`view_history`) `web.dom.type` or `web.dom.clear` step on such an element is refused with the new
    reason `web.handle.not_a_field`.
  - `web.handle.target_kind.<kind>` rides beside it, plus the existing `web.handle.expected.node.*` hint where the
    kind says which node acts (a checkbox gets the click node).
  - The kind codes are new entries in `WEB_PLAN_HANDLE_ISSUE_CODES`. They are descriptive, not reasons.
  - Controls that are never editable (button, link, select, option, img) are still refused `wrong_control`, as
    before.
  - Exploration's own typing is not refused here; the extension answers it.
- **`tool-rejection.ts`.**
  - New reason `handle_not_a_field`, documented and mapped from `web.handle.not_a_field`.
  - Its `next` names the kind, read from the kind code. Example: "The handle in target names plain text, which
    holds no typed text …".
  - `useNode` is now given for this reason too.
  - The pinned test exempts `web.handle.target_kind.*` as descriptive, as it already did for the shape hints.
- **`control-fit.ts` (new, split out).** `resolve-plan-node.ts` was at 799 of 800 lines. "Which node fits a control"
  (`actsOnTheWrongControl`, `fittingNodeCode` and their tables) moved here unchanged, behind
  `webPlanControlMisfit`. The resolver is now 791 lines.
- **Extension `type.ts` and `clear.ts`.**
  - A target that holds no typed text (`type`), or has no value (`clear`), now fails with `TARGET_NOT_ACTIONABLE`:
    `unexpected_state`, `retryable: false`, still repairable.
  - Before, it was the default `OUTPUT_NOT_OBSERVED` (`retryable: true`), which Core retried three times.
  - This is the same `success(..., failureCode)` pattern as t464's select.
  - Nothing is sent or set.

### Goal 3 (W2): dotted read fields

- **Where they were dropped.** `resolveNode` passed any key holding no handle straight through. Step 0018 sent
  `"extractList.fields"` and `"extractList.minItems"` beside `"extractList": "extraction.1"`, and the page ignored
  both.
- **`plan-resolution/dotted-keys.ts` (new).** Reads a dotted key whose head is a parameter the node holds, or one its
  schema names, as that parameter's own key. A bare-handle head becomes `{ handle }`. The read then resolves exactly
  as the nested form does.
- **Refusals instead of drops:**
  - a plain-value head is refused `web.handle.malformed`;
  - a clash with the nested form is refused `web.handle.ambiguous` at the key;
  - fields with no list named are refused `web.handle.extraction_required` with the handle hint.
- Keys whose head the node neither holds nor names are left alone.

### N5: `COVERING t692` with nothing named

**Cause, traced from code:**

1. The overlay hit test at a control's centre landed on the sticky header. `overlayRoot` reported the header.
2. `escapedByScrolling` correctly did not count the control, because the click's own scroll gets it out from under
   a pinned bar. But `blockers.set(blocker, covered)` runs before that check, so the header was still reported, with
   `blocks: 0` (`apps/extension/src/content/evidence/overlays.ts:68-75`). The comment there says this is deliberate,
   so a consent bar still says what it is.
3. The domain dropped the 0 (`page-evidence.ts:318`, `blocks || undefined`).
4. The header printed the record's `role` only for a blocker with no handle. So `role: "banner"`, which route state
   7 showed, never reached the line.

**Domain half, fixed (`page-view/header.ts`):** a covering entry now says the record's role beside its handle. When
the capture describes the element, it also says:

- the cover's name, else its first heading, else its words (cut to 60 characters);
- its layer kind, else its role;
- its covers count;
- its close control, as `close <handle> "<words>"`.

**Extension half, not mine.** Suggested fix in `overlays.ts`: register an escaped pinned bar only when
`layerKind(blocker)` recognises it (consent, rate limit and so on), so a plain sticky site header stops appearing as
a blocker.

The close words copy `node-run/covered-target.ts` `CLOSE_WORDS`. page-view sits below node-run, so importing them
would invert the dependency. This joins the existing follow-up to consolidate the way-out label lists.

## Commands run and observed results

**Fail-first runs (each before its fix):**

| Test | Before the fix |
| --- | --- |
| original domain goal tests | 7 of 14 failed |
| extension `type-` | 1 of 6 failed |
| header (N5 naming) | 2 of 7 failed |
| `node-run/tests/run.test` stale-handle case | failed: "expected false, actual true" (`effectApplied`) |
| clear test | 1 of 2 failed |
| header role case | failed |
| pinned code and reason tests after adding the codes | 4 failed, then updated |

The `onPage` wiring first broke `shown-handle-past-cap.test.ts` (U-B3-3). That is why a handle held by the same path
under another query or fragment now falls back to the bare lookup; the test passes again.

**Final runs (in the t486 tree):**

- `node scripts/structure-audit.mjs` -> `structure-audit: passed (187 warning(s), 646 baselined).`
  - `run.ts` was already at exactly 800 lines, so its note rides on the changed line.
- `domain`: `npx tsc -p tsconfig.json --noEmit` -> exit 0, no output; `npx tsc -p tsconfig.test.json --noEmit` ->
  exit 0, no output.
- `apps/extension`: the same two commands -> exit 0, no output each.
- `DOMAIN_TEST_BUILD_LABEL=t486-worker node scripts/test-domain.mjs llm-evidence/plan-resolution/ llm-evidence/page-view/ llm-evidence/node-run/ llm-evidence/tests/ harness-options/tests/options system-instructions/tests/instructions`
  -> `# tests 807 # pass 807 # fail 0`.
- `EXTENSION_TEST_BUILD_LABEL=t486-worker node scripts/test-extension.mjs content/actions/tests/` -> `# tests 159
  # pass 159 # fail 0`.
- Every changed file is LF, as the originals were (checked with Python; Python's text mode had written CRLF
  earlier, now undone).

## Not verified

- No live browser, Lab or provider run (per the brief).
- Core's trial retry loop treating `TARGET_NOT_ACTIONABLE` from type or clear as final. Only the code table
  (`retryable: false`) was checked.
- The real-page cases of the same-path fallback beyond U-B3-3: SPA filters that change the query.
- Core's submission advice for the new `web.handle.not_a_field` reason. Core's `HANDLE_ADVICE` has no entry for it,
  so the model gets Core's general advice at submission (exploration-side refusals get the domain's `next`).
- The extension half of N5.

## Open questions or contradictions found

1. The Core submit-time page check needs `plan-parameter-resolution.ts` and `submission-refusal.ts`, as above.
2. Core `candidate/submission-refusal.ts` `HANDLE_ADVICE` should gain a `not_a_field` entry. Suggested meaning:
   "names an element that holds no typed text; type into the field itself, or use the node the issue names".
3. `apps/extension/src/content/evidence/overlays.ts`: stop registering escaped pinned bars that `layerKind` does not
   recognise (N5's sticky header).
4. `next-page-slot.ts` resolves a Next page `control` handle with the location the model wrote, not `onPage`. I left
   it unchanged.
5. `docs/working/state-aware-recovery-plan/reports/t486-core-satisfied-step.md` in this tree is the Core worker's
   report, not mine. I did not touch it.
