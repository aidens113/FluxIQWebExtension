# l1-d4-docs: current-state docs for the L1 reset settlement

## Outcome

Done. Both docs now describe the settlement redesign as the code does it. I read the source behind every claim; the source files are listed per section below. No source, test or working document was touched.

## What changed and why

### Core `docs/architecture/automation-studio/llm-flow-bootstrap.md`

- **"Authoring mode `project`", "Lasting acts" bullet.** Added: a reset brief settles what Core's own looks can before its first decision. A reset that cannot settle an act ends `blocked` with the act still listed. Source: `brief-ports.ts`, `reset-loop.ts`.
- **"The site is put back before each trial":**
  - **"An undo counts only when the act's effect is gone" bullet.** Now says these source-page rules settle only legacy unscoped acts. A strict act settles by its witnesses, and `stillThere` stays diagnostic. Source: `ledger.ts` header and `beforeTrial`.
  - **"Acts the site cannot undo" bullet.** Now says strict acts settle only by their witnesses. An open strict act refuses with `candidate.trial_reset_unproved`, listing `actsToRestore` with `settle`. Source: `ledger.ts` `unprovedReset`.
  - **"The gate" bullet.** The deadlock admission (an identical refusal, or a fourth in one phase) now applies to legacy acts only. The ledger refuses unproved acts both before and after the policy. Source: `ledger.ts` `beforeTrial`.
  - **New bullet, "A refused trial is retested after any call".** Covers the loop memory rule (`llm/refused-action-retest.ts`) and the repeat guard's reset precondition (`llm/repeat-guard/outcomes.ts` `PRECONDITIONS`, `changesState: false`). It notes that this is independent of `retry_allowed`, and that the loop stays bounded by `repeat_without_progress`.
- **New subsection "How an act settles"** (under the site-reset part):
  - Witnesses: the group witness with the relevant-scopes rule, and the toggle witness from `control.place`/`control.state`, the reads' `controls`, and the trial diff's `controls`.
  - The ledger clock and what counts as a fresh read.
  - The three outcomes (settled restored, settled unchanged, open) and the open reasons `name`/`look`/`undo`/`toggle`.
  - `standing()`.
  - Core looking first (`checks.lookAt`, with the callers that wire it).
  - Per-act `settle` words.
  - Trial acts inheriting destinations through the repeat matcher.
  - Toggle-back admission.
  - The invariants that still hold.
  - The reset brief's honest `blocked` completion.

  Sources: `site-reset/ledger.ts`, `settlement-act-groups.ts`, `settlement-group-witness.ts`, `settlement-toggle-witness.ts`, `settlement-control-tracker.ts`, `settlement-decision.ts`, `settlement-trial-repeat.ts`, `settlement-words.ts`, `settlement-observations.ts`, `words.ts`, `contracts.ts`, `start-check.ts`, `project-reset.ts`, `project-agents/dispatch/reset-loop.ts`, `reset-done.ts`, `service/project-build/brief-ports.ts`.
- **"Cross-page reset ownership": corrected claims the code no longer makes.**
  - The cannotUndo paragraph now says a strict act is refused until fresh reads settle it. It also adds the one exception to "declaring no consequence does not bypass ownership": the toggle back.
  - Failed declared press: the doc said it needed every original group inventory and "no extra scopes". It now says the act settles `unchanged` on its relevant scopes, and that unrelated lists do not block.
  - Declared retry: it now says "relevant scopes of the original group" instead of "the exact original whole resource group".
  - Project resets: the doc said "Newly moved ... subjects in sibling complete collections refute restoration". It now says a sibling refutes only when it holds an act subject differently, and that a missing relevant scope leaves the act open.
  - Transfer completion: it now requires origin and destination, plus any original scope that held the subject. The "captured sibling collections" requirement is gone.

### Downstream `docs/architecture/page-evidence.md`

- **"Start state for a build's site reset".** Added a paragraph listing the answer's opaque `scope`, `resource`, `items`, `subjects`, `collections` and `controls`. Source: `start-state/observe.ts`.
- **New section, "Complete Lists And Control States For A Reset":**
  - **List completeness.** ARIA path or native path. The native conditions are: capture not truncated, at least one item, not `aria-busy`, and `listWayOn: "none"`. An absent fact means not complete. A table with set-size rows is never complete. Each item must hold exactly one distinct subject.
  - **Scope, group and row-state token makeup.**
  - **The extension fact.** `content/dom-snapshot.ts` sets it from `read-coverage/list-way-on.ts`, which uses `list-continues.ts`. The values are `next_page`, `load_more`, `feed` and `none`.
  - **Domain reading of the fact.** It is read in `elements.ts` and never printed.
  - **Stateful controls.** The roles and attributes that make a control stateful, its place token, its state token, and `controls` counts with the 2,000-place bound.
  - **Where these travel.** The start-state answer, the declaration `control.place`/`state`, the diff `spot`, and the diff `controls`.

  Sources: `control-spot/collection.ts`, `stateful.ts`, `role.ts`, `place.ts`, `state.ts`, `states.ts`, `target.ts`, `llm-evidence/permission.ts`, `state-diff/places/diff.ts`, `apps/extension/src/content/extraction/read-coverage/list-way-on.ts`.
- **"Who Reads It", host runtime diff paragraph.** `spot` was documented as `{ item?, dialog? }`. It now shows the full token set (`subject`, `page`, `scope`, `resource`, `place`, `state`). The paragraph also adds the diff's `collections` and `controls` keys. Source: `target.ts`, `diff.ts`.
- **State digest.** Both `web-state.v6` mentions are now `web-state.v7`, with one line on why v7 exists. Source: `state-digest.ts` header.
- **Closing reset paragraphs:**
  - The completeness paragraph no longer says a semantic list "must provide finite item cardinality and every distinct item position". It now names both the ARIA path and the native path.
  - The last paragraph now says that modern acts settle by witnesses (complete lists and a toggled control's state).

## Commands run and observed results

- `node scripts/structure-audit.mjs --rule docs-links` in the Core worktree printed `structure-audit: passed (0 warning(s), 0 baselined).`
- `grep -rn "web-state.v6" docs/architecture` in the downstream worktree found no matches.
- `grep` of the Core doc for `originalGroupRestored`, `subjectRestored`, `leftUnchanged`, `destination-unchanged`, `nameDestination`, `kept as done`, `page not read` and `whole group` found no matches.
- `git diff --stat`: the Core doc has 169 insertions and 25 deletions; page-evidence.md has 108 insertions and 14 deletions.

## Not verified

- `docs-reference.mjs --check`, the other half of Core's `docs:check`, was not run.
- The downstream repo has no docs link check, so the new in-doc section references there were not checked mechanically.
- There is no rendered-Markdown review.
- The claims rest on reading the source, not on running it.

## Open questions or contradictions found

- The design report names the extension's detector file as `read-coverage/list-continues.ts`. The fact is actually produced by `read-coverage/list-way-on.ts`, which calls `list-continues.ts`. The doc names both.
- The design report's phrase "no item carries aria set attributes that disagree" does not match the code. In the code, any row carrying `aria-setsize` switches the list to the ARIA path alone. The doc describes the code.
- In the Core doc, the deadlock-admission wording in "The gate" was already true only for legacy acts before this change; it now says so. No behaviour question arises from it.
