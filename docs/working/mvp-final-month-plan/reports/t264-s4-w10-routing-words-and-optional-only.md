# t264-s4-w10-routing-words-and-optional-only: worker report

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t264/!FluxIQ`, branch `task/t264-core-integration-chain`.
R = `packages/fluxiq/src/programs/automation-studio/runtime/`. W8's and W9's uncommitted ports are untouched.
Nothing was staged, committed or moved with git.

## Outcome

**Done.** Lane D w47 and lane A A3b are ported per the binding decisions. Every check the brief names exits 0:
- the brief's vitest set: 317 files, 3400 tests, all passed;
- the Core typecheck, the structure audit and `pnpm build`;
- the downstream domain and extension checks.

Every file I touched has LF endings (0 CRLF, counted with node).

## What changed and why

### w47: routing refusals in words (lane D)

- **`R/flow-bootstrap/authoring/draft-routing.ts`**: lane D's `overAfterSpan()`, the never-emitted-listing branch and
  `takeRepeatOff()` are ported.
  - Every `{"change": "always"}` became `{"change": "unrepeat"}`, because W9 dropped `always` and kept t262's `unrepeat`
    ("take the repeat off this step, and nothing else").
  - The two doc comments that named `always` now name `unrepeat`.
  - The file grows from 364 to 417 lines (an advisory warning only).
- **`authoring/tests/draft-routing.test.ts`**: lane D's 6 tests in "a span whose over comes after it", with the same
  `unrepeat` substitution.
- **`R/llm/harness-options/bootstrap-completion.ts`**: `DRAFT_ROUTING_CODES` and `withRoutingSentence`, mapped over the
  issue feedback in `refused()`, put back each of draft-routing's six refusal sentences. I added a header paragraph
  saying why.
- **`harness-options/tests/bootstrap-completion.test.ts`**: lane D's run-0072 routing test, expecting
  `amend_draft {"step": 15, "change": "unrepeat"}` on both paths.

### w47: the R18 read note (lane D)

- **`authoring/instruction-record-columns.ts`**, its test, **`harness-options/draft-acts.ts`** and its test: lane D's
  hunks applied as-is:
  - the "run a new read after step N and add it" sentence;
  - `lastActRepeats`;
  - `inRepeatedSpan()`;
  - the `BEFORE` and `BEFORE_REPEATED` texts and 1 new test in each file.
- The draft-acts hunks applied at offset 1 to 2 lines, because t262's `arrival` lines sit in the same file.

### w47: the start-location note, reworked against t262 (lane D)

- **`R/llm/deepseek/request-body.ts`**: `FLOW_START_LOCATION_NOTE` gains two sentences, in w47's own form:
  - the first step may go straight to the stable deeper address, so rerun step 1 with it and drop the travel steps;
  - keep every optional dismissal.
- **Dropped:**
  - w49's "Unless the person's instruction says how to get there ..." caveat that lane D had merged into the same
    sentence;
  - w50's `startRoute`, `startLocationNote()` and route-quoting variant.
- **Why it still adds information on top of t262:** t262's declared arrival classifies arrival. It never tells the model
  anything. Its rule still admits the shortcut:
  - the rerun of step 1 keeps the declared arrival node;
  - its declared parameter then holds the deeper address;
  - `location-agreement.ts` (unchanged) agrees a same-site deeper address with startLocation;
  - so `start-step.ts` restores nothing.
- A rerun of step 1 is not refused on this tree: `rerun-request.ts` only refuses it as `run_by_the_loop` when its tool is
  not offered, and the arrival runs through the offered run-node tool.
- The comment block records this with t262's file names.
- **`deepseek/tests/request-body.test.ts`**: lane D's w47 test, in its own describe.
  - Lane D's hunk had closed the node-catalog describe early, which moved the existing "reports what it sent" test into
    the new describe. That is not ported: the existing test stays where it was.
  - The w49 and w50 tests are dropped.
- **`bootstrap-completion.test.ts`**: lane D's "admits a first step that goes straight to a deeper address" test, now
  with `binding: { runsNodes: { arrival: { node: "web.browser.navigate", parameter: "url" } } }`.
  - Without the declared arrival, the test would pass trivially under t262, since no step could count as arriving.
  - With it, the test exercises t262's path and asserts `restoredStep` undefined, no notes, and the first node's url is
    the deeper address.
- `system-prompt-pins.json` was not touched: the note is not a pinned prompt.

### A3b: an act's only step is not left optional (lane A, Cause 5)

- **New `R/flow-bootstrap/instructed-acts/optional-only.ts`**: lane A's file, reworked for t262.
  - The input takes `arrival` and passes it through to `checkAutomationStudioInstructedActs`, so the rule reads the
    declared arrival exactly as the check, the checklist and the restore do.
  - A step that only arrives is answered `step_only_arrives` (it comes before `step_is_optional` in `step-fault.ts`),
    so it is not this rule's to answer.
  - The header says so, and points at `./step-fault.ts` for the fault, where lane A pointed at `./standing.ts`.
- **`instructed-acts/index.ts`**: exports `./optional-only.ts`. The barrel comment now says permission and optional-only
  are the two rules a completion is answered "not complete" for.
- **`instructed-acts/check.ts`**:
  - each `missingActs` entry with reason `step_is_optional` carries `said` (lane A's `optionalSaid`);
  - the header no longer says permission is the only refusing rule.
- **`bootstrap-completion.ts`**: lane A's merge, reworked for t262.
  - The optional-only check runs beside the permission check, with `startLocation` and
    `arrival: input.binding?.runsNodes?.arrival`.
  - Both checks share one `missingActs` account and one instruction, and lane A's `objects()` helper is ported.
  - The header and the `evidence_completion_cannot_answer` comment name the second rule.
- **`bootstrap-completion.test.ts`**:
  - Lane A's 2 updated permission tests (optional delete press now answered `bootstrap.instructed_act_only_optional`).
  - Its new describe, with 2 tests. I shortened the instruction to "Put the USB-C hub in my cart: Space Grey, the 7-in-1
    version." and added a colour step, so the `only_if` case has a step before the guarded one.
- **New `instructed-acts/tests/optional-only.test.ts`** (4 tests):
  - the answered entry and its `said`;
  - always-run and `only_if` are not answered;
  - no draft or no instruction answers ok;
  - the declared arrival makes an optional arriving step `step_only_arrives`, so it is not answered here; undeclared,
    the same step is `step_is_optional` and is answered.
- **`R/result-verification/build-test/summary.ts`**: lane A's Cause 5 header lines (`said` in `missingActs`), which W5
  left to this unit.
- **`build-test/tests/summary.test.ts`**: lane A's "an act whose only step may be skipped" test (instruction shortened)
  and the `navigate` import.

### A3b: choice order (lane A, Cause 2), onto dev's `choice-order.ts`

- **Dev's code, signature, behaviour and tests are unchanged.** Dev's `automationStudioFlowDraftStepMovedTarget` branch
  (t261 `b52bf47d` + t262) already refuses to prescribe a reorder when the two steps' `replay.from` differ, which is lane
  A's `otherPage`.
  - Lane A's `leftPage` needs the whole draft (`steps`), which would change dev's signature.
  - Lane A's claim-doubt branch is superseded by t262's `claim-doubt.ts`, which reaches the checklist as `claimSaid`.
  - So no lane A choice-order code is ported.
- **The only edit to `choice-order.ts`:** the stale comment path `../../flow-draft/amendment.ts` (W9's open question)
  becomes `../../flow-draft/amendment/move.ts`.
- **`instructed-acts/tests/choice-order.test.ts`**: lane A's run-shape test 1, with expectations adapted to dev's
  wording. It checks that neither choice is told to reorder ahead of the step that opened their page, that both stay
  done, and that the listing-click claim carries `claimSaid`.
  - It passes on dev's code. It would have failed on the pre-t261 sentence, which said "reorder on step 8 with to 6".
  - Lane A's tests 2 and 3 duplicate dev's existing tests ("a legitimate change after the act" in the `it.each`, and
    "keeps the reorder hint when both steps acted in the same recorded place"), so they are not ported.
- **The fixture `run-musq0b1m-draft.ts` was not created.** The one ported test needs only four steps. I wrote them inline
  with placeholder places (`search`, `item`) and words. Screened out:
  - the fixture site's port and URLs;
  - the full scenario listing title;
  - the "Autumn Mega Sale" banner text;
  - the find, type and navigation steps;
  - the `CART` and `HOME` constants.

### Docs (Core)

- **`docs/architecture/automation-studio/flow-authoring.md`** (lane D has no w47 doc hunk, so I wrote these), two
  paragraphs after "Removing an accidental row repeat":
  - routing refusals in words, and the completion carrying them;
  - the R18 read note.
- **`docs/architecture/automation-studio/llm-flow-bootstrap.md`**:
  - Lane A's Cause 5 sentences on the completion paragraph, plus one sentence on the declared arrival.
  - A new paragraph after F31, "The Flow may start where the work does (t195-w47)", tied to t262.

### Lane hunks accounted for (owned files)

| Lane / file | Hunk | Disposition |
| --- | --- | --- |
| D `draft-routing.ts` | `overAfterSpan`, never-emitted listing, `takeRepeatOff` | Ported; `always` changed to `unrepeat` |
| D `draft-routing.test.ts` | 6 tests | Ported; `unrepeat` |
| D `instruction-record-columns.ts` + test | R18 sentence, `lastActRepeats`, test | Ported as-is |
| D `draft-acts.ts` + test | `inRepeatedSpan`, test | Ported as-is |
| D `bootstrap-completion.ts` | `DRAFT_ROUTING_CODES`, `withRoutingSentence` | Ported |
| D `bootstrap-completion.test.ts` | deeper-address test; routing-sentence test | Ported; the first with a declared arrival, the second with `unrepeat` |
| D `request-body.ts` | w47 shortcut and dismissal sentences | Ported in w47 form |
| D `request-body.ts` | w49 "Unless ..." caveat | Dropped (decision) |
| D `request-body.ts` | w50 `startRoute`, `startLocationNote()` | Dropped (decision) |
| D `request-body.test.ts` | w47 test / w49 one-sentence test / w50 describe / early `});` | Ported / dropped / dropped / not ported |
| D `llm-flow-bootstrap.md` | C1 and w42 hunks | Not w47 (C1 is W9's; w42 is not mine) |
| A `check.ts` | `kind-words.ts` import, `KIND_WORDS` removal | Superseded (t262 already on tree) |
| A `check.ts` | `choicesAfterAct(acts, choices, standing, steps)` | Dropped (keeps dev's choice-order signature) |
| A `check.ts` | `said` / `optionalSaid` | Ported |
| A `checklist.ts` | `claimSaid` / claim-doubt | Superseded (dev has t262's `claimSaid`) |
| A `checklist.ts` | `madeAfterAct` signature | Dropped; file unchanged |
| A `choice-order.ts` | three-branch rewrite, `otherPage`, `leftPage` | Dropped: dev covers `otherPage`; `leftPage` needs a signature change; claim-doubt is superseded |
| A `index.ts` | optional-only export and comment | Ported |
| A `index.ts` | claim-doubt and kind-words comment | Superseded (dev exports both) |
| A `choice-order.test.ts` | test 1 | Ported, adapted to dev's wording |
| A `choice-order.test.ts` | tests 2 and 3 | Covered by dev's existing tests |
| A `optional-only.ts` | new | Ported, reworked with `arrival` |
| A `act-claim.ts` | `ClaimedStepLeftPage` and header | Dropped: only lane A's superseded choice-order and claim-doubt used it, so it would be dead code |
| A `bootstrap-completion.ts` | optional rule, `objects()`, header | Ported with `arrival` |
| A `bootstrap-completion.test.ts` | 2 updated tests, new describe | Ported (instruction shortened) |
| A `summary.ts` | Cause 5 header | Ported |
| A `summary.ts` | change-lines code (w106) | Not A3b: W5's |
| A `summary.test.ts` | Cause 5 test | Ported |
| A `build-test/index.ts` | change-lines export | Not A3b: W5's |
| A `system-prompt-pins.json` | w106 judge sentence | Not A3b; not touched |
| A `claim-doubt.ts`, `kind-words.ts`, `claim-doubt.test.ts` | new files | Never ported (decision) |
| A `run-musq0b1m-draft.ts` | fixture | Screened; the needed steps are inline, no file |
| A `llm-flow-bootstrap.md` | Cause 5 paragraph | Ported |
| A `llm-flow-bootstrap.md` | Cause 2/3 choice-order paragraph | Superseded by dev's t261/t262 text |
| A `llm-flow-bootstrap.md` | w107 instruction read; w94/w103 toggle paragraphs | Not A3b |
| A `flow-authoring.md` | reversal `out`; w107 lasting | Not A3b |

## Commands run and observed results

- **Baseline before any edit.** From `packages/fluxiq`, the brief's vitest command (`--minWorkers=1 --maxWorkers=4`,
  seven paths) gave `Test Files 316 passed (316)`, `Tests 3381 passed (3381)`, exit 0.
- **Focused runs during the work:**
  - 6 paths (bootstrap-completion, deepseek tests, draft-routing, instruction-record-columns, draft-acts,
    instructed-acts): `Test Files 20 passed (20)`, `Tests 445 passed (445)`.
  - `choice-order.test.ts`: `8 passed`.
  - `optional-only.test.ts`: `4 passed`.
  - `summary.test.ts`: `23 passed`.
- **The brief's vitest set after the change:** `Test Files 317 passed (317)`, `Tests 3400 passed (3400)`,
  `Duration 162.08s`, exit 0.
  - That is +1 file and +19 tests over the baseline: draft-routing 6, instruction-record-columns 1, draft-acts 1,
    request-body 1, bootstrap-completion 4, choice-order 1, optional-only 4, summary 1.
  - There were no failures and no timeouts.
- **Core root:**
  - `node scripts/build-cache/cli.mjs fluxiq:check`: exit 0 (`"step":"fluxiq:check"`, rebuilt).
  - `node scripts/build-cache/cli.mjs structure-audit:check`: `structure-audit: passed (251 warning(s), 349 baselined).`,
    exit 0. The count was 250 after W9.
    - The one new advisory warning is `draft-routing.ts: 417 lines`.
    - Advisory warnings that existed before also name `check.ts` (455), `bootstrap-completion.ts` (599), `summary.ts`
      (421) and `instructed-acts/` (19 files).
  - `pnpm.cmd build`: exit 0, ending with the `web:build` step.
- **Downstream root:**
  - `pnpm.cmd --filter @fluxiq-web-extension/domain check`: exit 0, after
    `core-build: ... is current with its source.`
  - `pnpm.cmd --filter @fluxiq-web-extension/extension check`: exit 0.
- **Line endings:** a node count over all 20 touched files printed `0 crlf` for each.
- **`git status --short`:**
  - My files.
  - W8's and W9's files.
  - `extend.test.ts` and `observation.ts`. These were already modified before I started and are not mine; the baseline
    passed with them.
  - My new untracked files: `optional-only.ts` and `tests/optional-only.test.ts`.
  - `git diff --cached` is empty.

## Not verified

- **New tests were not run failing first on this tree.** The lane reports record failing-first runs for their versions.
  The new optional-only tests were written after the code.
- **The ported choice-order test was not run against pre-t261 code.** The claim that it would fail there is by reading:
  the old sentence contained "reorder on step 8 with to 6".
- **Live behaviour was not checked** (no Lab, browser or provider call). In particular:
  - whether the model follows the `unrepeat` words;
  - whether it reruns step 1 to a deeper address;
  - whether a model keeping a needed press optional now exhausts its budget on repeated completion answers. Lane A
    raised this, and it is unexercised.
- `docs/reference/framework-reference.md` was not regenerated and `docs:check` was not run. It lacks the new exports
  `checkAutomationStudioInstructedActsOptionalOnly`, `AUTOMATION_STUDIO_INSTRUCTED_ACT_OPTIONAL_ONLY_INSTRUCTION`,
  `AUTOMATION_STUDIO_INSTRUCTED_ACT_OPTIONAL_ISSUE_CODE` and `AutomationStudioInstructedActOptionalVerdict`. The file is
  not owned.

## Open questions or contradictions found

- **The w49 caveat is gone, by decision.** The start note now offers the deeper-address shortcut with no "unless the
  person said how to get there". Lane D called that caveat the user's rule (t195 w49). Please confirm that dropping it is
  intended, or bring the route-following rule back in a later unit.
- **`bootstrap.instructed_act_only_optional` is unknown to two lists I do not own:**
  - `R/flow-bootstrap/plan/issue-feedback.ts` `AUTHORED_CODES`: the issue's own message is not carried. The
    `missingActs` account and the instruction are carried, so the model still gets the full account.
  - `R/flow-bootstrap/unfinished-build/not-done.ts` `BLOCKED_WORDS`: a build ending on this refusal gets no plain-words
    reason. Suggested fix: change the first entry to
    `[/^bootstrap\.instructed_act_(?:missing|only_optional)$/u, "the Flow did not yet do what you asked"]`.
- **There is tension with "information, never a gate" (t195) and the user's "no restrictions beyond permissions".**
  Optional-only now answers a completion "not complete". This was a binding decision. It restricts no action, only what
  counts as done.
- **Lane D's cleaner alternative for the routing words**, for the owner of `issue-feedback.ts`: add the six
  `flow_draft.*` routing codes to `AUTHORED_CODES` and delete `DRAFT_ROUTING_CODES`, `withRoutingSentence` and the
  `.map(...)` line from `bootstrap-completion.ts`. The model sees the same output either way.
- **`R/flow-draft/act-claim.ts:20` still names `flow-draft/amendment.ts`.** That file is owned here only for A3b parts and
  has none, so I left it.
