# Report: t743-docs (architecture docs for the t743 lane)

## Outcome

Done. Three authored docs amended in place (no changelog sections, existing headings kept, generic wording).
Both structure audits pass.

## What changed and why

### Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`

- **Authoring mode `project`**
  - "Lasting acts" bullet: a `gate_unsatisfiable` act is never in a reset's undo list, but every reader of
    what is on the site names it as left (reset-done, left-on-target `unsettleable`, phase start
    `actsUnsettleable`, reset-calls, whole trial, `lastingActsUnsettleable`). A reset left with only those
    comes back `blocked`, never `done`.
  - New bullet "A return says when nothing more can be done": `terminalReason` closed set, refused on a
    `done` return (`project.return_terminal_reason`), set from Core's own signals in `dispatch/ending.ts`
    (`personEnded`, `gateUnsatisfiable` in run-brief), an existing reason is kept, and it is forwarded by the
    dispatch tool.
  - New bullet "Repair before ending": `project.completion_repair_first`, `unrepaired`, what counts as a
    changed brief (a repair or a new plan digest; a resend does not), its order among the completion rules,
    the three exemptions (purse cannot pay one repair, fewer than `REPAIR_TURNS = 3` turns left with
    `turnsLeft` threaded through, an unsettleable act on the site), one refusal per subflow, and guidance
    step 7.
- **The site is put back before each trial**
  - Intro: names the siblings `reset-settlement/` and `reset-answers/` and the one-way dependency.
  - Undo bullet: a landed `modify_existing` subject undo spends the allowance.
  - Gate bullet: the trial refusal when only unsettleable acts remain (`acts_unsettleable`, `no_call`,
    empty `actsToUndo`, the honest exit). The mixed case. `project.trial_unsettleable` in the whole trial.
  - New bullet "Every refusal says what can meet it": the constructor, closed `failed`, `canMeet`,
    `condition` words, `candidate.undo_already_back`, the source-scan test, and the qualified
    `actionDeclarations()` / `ownUrl()` guidance.
- **How an act settles**
  - Sources updated to `reset-settlement/` (judge, decision, words and the rest) plus `undo-claims.ts` and
    `ledger-act.ts`. All `settlement-*.ts` module names were renamed in place.
  - New sub-bullet "Lists a witnessless act adopts": A1 narrowed to named and own-page lists, with lost
    lists dropped and the `name` rule once refs are closed.
  - Toggle witness: a looped step's diff now receives the attempt's `inputs` (`executor/host-state.ts`,
    `host-runtime.ts`), so each pass's act carries its own row's spot.
  - New bullets:
    - "Lists Core cannot read again": `reach.ts`, the landed and unread rules, settling `restored` or
      `unchanged` with `unread`, and the `unreachable` reason.
    - "Acts no call can settle (`gate_unsatisfiable`)": `actsUnsettleable`, the merge in project-reset,
      trials still refused, the honest exit and `terminalReason`, and the public reads `unsatisfiable()`
      and `issuedRefs()`.
  - "Core looks first": Core's own reset moves run under the core-move marker and are framed
    `move: "core"`.
  - "Toggle back": the already-back answer.
  - New bullet "Removing a subject newly present on a named destination": the `destinationRemoval` path,
    its ordered conditions, and the spend.
  - Invariants and the reset brief's honest ending extended to match.
- **What a trial says it absorbed**: two new paragraphs.
  - The feedback always names its stopping step: first 39 steps plus the last attempted step,
    `stepsLeftOut`, the trial-stop sentence, and the step log's thrown name and `loopVerdict`.
  - Judge advice after an `incomplete_text` refusal: `disclosure-advice.ts` in the repeated-advice memory,
    the rewrite rule and its limits. A bold **cross-repository contract** line names the domain's
    `action-failure/refusal.ts`.
- **A domain tool call's build scope and durable state**: the frame shape gains `move?`, plus new bullets
  for `places` (every brief's opening, issued-ref locations, dedupe and withheld rules) and
  `move: "core"` (the marker, never from the call id).
- **Cross-page reset ownership**: the builder guidance sentence is qualified to presses with no other
  witness.

### Downstream `docs/architecture/build-loop.md`

- **Elements Are Named By Handle Only**: new paragraph "Two documents at one address are two views (t743)"
  (d5). It covers:
  - the view rule: other dialogs plus another document;
  - what still replaces a view;
  - per-view state and how resolution picks a view;
  - acted identity kept per handle and address;
  - the stable-handles aliasing limit.
- **What A Build Remembers**:
  - The frame now lists `move: "core"`, and `webNodeBuildOf` answers `coreMove`. The per-brief keying and
    reset-on-fresh now apply only to arrival, held-literals and own-layers.
  - New paragraph "Shown addresses belong to the build (t743)". It covers:
    - one key per build, shared by briefs side by side;
    - no opening forgets it;
    - what counts as shown, including `places` via `webNodeOpeningPlaces` (refused on a later call);
    - Core moves skip only the address rule;
    - the three `instead` ways around `address_not_shown`, worded from `shown-addresses.ts` `INSTEAD`.
  - The durable-state paragraph: `web.shown-addresses` is one key for the whole build (no `:<callScope>`).

### Downstream `docs/architecture/extension-client.md`

- **Action Surface** (after the auth-gate paragraph), three new paragraphs:
  - "A read target's words are its value, not its identity": the `readsWords` mark and where it is set, the
    guard still counting the words, how the mark crosses the wire (`withRecordedReadMark`, `withReadMark`),
    the veto and scorer never refusing or preferring on the words, and resolve-target's `read-lookup/` never
    looking a drifted read up by them.
  - "A press the page answers only with a notice fails": notice regions, `web.action.page_reported_failure`,
    Core's retries, never a landed act. Links to the failure taxonomy.
  - "A looped pass's spot follows its row": the domain's `state-diff/places/pass-row/` rule mirroring the
    extension's `pass-row/`.
- **Defining An Extraction** (the `incomplete_text` paragraph, ~line 1908):
  - the recovery order now says to read again after the repeat with the same conditions;
  - a new paragraph "Disclosure is checked only on rows the read keeps" (list-reader and item-filter rules).

## Commands run and observed results

- Core root: `node scripts/structure-audit.mjs` printed `structure-audit: passed (429 warning(s), 1152
  baselined).` and "1 baseline entries can be lowered", which was already present per the lead report.
- Downstream root: `node scripts/structure-audit.mjs` printed `structure-audit: passed (217 warning(s), 618
  baselined).`
- Grepping both audits' output for the three doc names, `docs-links` and `working-docs` found no lines.
- I checked that every new module path cited exists in the trees. One wrong path (`../stable-handles.ts`)
  was corrected to `runtime/llm-evidence/stable-handles.ts`.
- I grepped the added lines for scenario or site words and run ids: none.

## Not verified

- I did not build, typecheck or test anything, as the brief requires.
- The descriptions come from the worker and lead reports. Apart from paths, I spot-checked only
  `shown-addresses.ts` `INSTEAD` against the code.

## Open questions or contradictions found

- `docs/architecture/failure-taxonomy.md` already carries d4's row and paragraph (not my edit). It shows in
  the downstream diff as another worker's change.
- The supervisor's completion rules (`ended_too_soon`, the reset rule) are not otherwise described in the
  Core doc. The repair-first rule is placed in the "Authoring mode `project`" bullets, the nearest place
  that describes how a project build ends.
- d5's report notes that a handle shown in both views still resolves by recency, not by the Flow's
  preceding step. The doc states this limit rather than implying it is fixed.
