# d-identity-evidence-sensitive-pages — element identity, page evidence and sensitive values

Worker brief: `briefs/finish-week1.md`, thirty-fifth dispatch,
`## d-identity-evidence-sensitive-pages`. Repository at `af80298` (working tree),
Core at `F:\!FluxIQ` `604d0d3`, read only. Audit items: I1-I3, P1-P2, S1-S2, and
the upload name rule that `af80298` unblocked.

## Outcome

Done. Every item the audit lists for the three pages is fixed. The link check and
the structure audit pass.

## What changed and why

Only these three pages changed, plus this report.

### `docs/architecture/element-identity.md`

- **I3.** "verified against source on" is now 2026-09-13.
- **I1.** The candidate bound was 600 on the page. It is now 5,000 interactive
  elements examined and 60 candidates kept.
  - Source: `apps/extension/src/content/identity/candidates.ts:106,108`.
  - Added: the pool reports `examined` and `truncated` (`TargetCandidatePool`,
    `:56-69`).
  - Added: a `TARGET_NOT_FOUND` from a cut-short scan says the page may hold more
    (`content/action-runtime/resolve-target.ts:496-499,518-521`).
- **I2.** The Limits bullet no longer says a Flow "must author a wait first". It
  now says:
  - acting verbs still do not wait or retry;
  - a recording proposes `web.dom.wait_for_selector`, condition `present`, before
    the click;
  - the conditions: a mutation batch that added nodes, the first executable entry
    after it a click with a selector, the top document, and no evidence in between
    naming another URL. Source: `domain/src/recording/proposals/late-target-wait.ts:35-98`,
    wired at `domain/src/web-panel-host.ts:135`;
  - a child-frame click proposes none;
  - the recording side links to `extension-client.md#recording-evidence`.
- **Held back.** The wait's timeout is not described (`late-target-wait.ts:15`).

### `docs/architecture/page-evidence.md`

- **P2.** The date is now 2026-09-13.
- **P1.** The unclear "top-frame only unless a command addresses a frame, where the
  two agree" is replaced. The new text says:
  - the action path does not merge;
  - an action runs in the top frame, unless the command addresses a child frame by
    frame id or by its document's path, which survives a reload
    (`apps/extension/src/runtime/frame-address.ts:29-56`);
  - its result carries that frame's own snapshot;
  - a link goes to `web-capabilities.md#child-frames`.
- **Basis for "does not merge":** `captureMergedTabSnapshot` has one non-test
  caller, `background/connection/recording-evidence.ts:233`. An action verb takes
  `deps.captureSnapshot()` in the content script, as in `content/actions/upload.ts`.

### `docs/architecture/sensitive-values.md`

- **S2.** The date is now 2026-09-13.
- **Upload names, under "The Wire".** `upload` compares file names but quotes none:
  - it passes only on exactly the requested names, in order;
  - `expected` and `actual` give only a count and whether the names match;
  - a refusal names a file by its position;
  - it sets no `redacted` flag.
  - Source: the `af80298` diff of `content/actions/upload.ts` and
    `action-runtime/file-input.ts`.
- **S1, a new section, "Run Time: The Value Returns As A Run Input".**
  - **The request.** A recorded entry into a sensitive control becomes a
    `web.dom.type` whose `text` is a `$state` binding at `web.secret.<key>`, with
    no fallback (`domain/src/output-nodes/secret-binding.ts:46-59`,
    `payloads.ts:156-162`). Its key comes from `recorded-element-key.ts`.
  - **An unanswered request** is refused before dispatch as
    `web.intervention.required`, by parameter and path
    (`domain/src/client/gateway-mapping.ts:149-157,366-375`;
    `domain/src/runtime/failure/codes.ts:59`).
  - **Core 0.4.0 withholding at rest:**
    - `metadata.inputs` and the run-summary envelope's `inputs`;
    - the trace, both inputs and resolved values;
    - a saved attempt's `command.parameters`, `result.message`, `result.error` and
      `attempt.message`.
    - Execution uses real values.
    - Sources: Core `6621d66` commit message, Core
      `docs/architecture/package-boundaries.md:166-221` and
      `automation-studio.md:407-431`, and the archive ledger entry
      "Core withholding" (`:3007-3066`).
  - **What Core does not withhold:**
    - `command.metadata`, `result.payload`, `result.failure` and
      `result.metadata`;
    - the known gap: an unbound input copied into another key;
    - records saved before 0.4.0.
  - **The Lab supplier.** The Flow lane supplies each declared secret once, paired
    one to one by control, and fails before the Flow starts when the pairing fails
    (`packages/test-runner/src/flow-lane/declared-secrets.ts:102-151`). Linked to
    `testing-facility.md#declared-replay-secrets`.
- **The page-text route, "Not a rule about page text".** The page now says:
  - a page that displays a secret puts it into every state snapshot, every action
    result's snapshot, and Core's workspace, and nothing withholds it;
  - the `data-sensitive` display rule is not built, and is ranked with the Week 1
    blockers. Links go to the plan, and to the testing-facility page for the run
    leak check.
  - Sources: archive ledger `:2146-2179` (Fix 6 deferred), and
    `reports/i-secret-in-workspace.md:345-359`.

### Choices not dictated by the brief

- **No relative link into Core.** No page under `docs/architecture/` links to
  `!FluxIQ/` today, so Core's pages are named by path in backticks.
- **The run-leak-check link names the page, not an anchor.** The testing-facility
  worker is adding that section, and its heading is not known yet.
- **No plan history added,** following the dispatch decision. The existing
  history on these pages (D13, D14, "until Wave 3") was outside the audit's items
  and left alone.
- **No secret value was read or written.**

## Commands run and observed results

All were run from `F:\!FluxIQWebExtension`, after the edits.

- **The link check,**
  `node .../scratchpad/dcd-check-links.mjs docs/architecture/element-identity.md docs/architecture/page-evidence.md docs/architecture/sensitive-values.md`:
  `exit=0`, "checked 26 relative links in 3 page(s), 0 unresolved".
- **The structure audit,** `node scripts/structure-audit.mjs`: `exit=0`,
  "structure-audit: passed (40 warning(s), 17 baselined)."
- **`git status --short` / `git diff --stat`:** lines changed per page were
  element-identity 20, page-evidence 9 and sensitive-values 70.
  `extension-client.md` and `briefs/finish-week1.md` are also modified; neither
  edit is mine.
- **Read-only checks:**
  - `git status --short docs/architecture/` before editing: clean;
  - the three pages were last changed in `b274fb4`;
  - `git show af80298` for the upload diff;
  - `git log --oneline -16` and `git show --stat 6621d66` in Core.

## Not verified

- **Nothing was run beyond the link check and the structure audit.** No unit tests,
  content harness or Lab: the edits are documentation only.
- **Anchors on pages other workers are editing.** `extension-client.md#recording-evidence`
  and `testing-facility.md#declared-replay-secrets` resolved at the time of the
  check. If the extension-client or testing-facility worker renames either heading,
  rerun the link check at integration.
- **"The run leak check finds a declared secret shown this way"** rests on the
  audit (T3) and the `i-secret-in-workspace` ledger entry. I did not reread
  `attest-run-redaction.ts`.
- **"Supplies each declared secret once"** rests on `declaredSecretBindingInputs`,
  which returns one input per path, and on the audit's T8. I did not reread
  `run-flow-lane.ts:121-138`, the call site.
- **The action path's "that frame's own snapshot"** is inferred: the merge has one
  caller, and verbs capture in the content script. No harness row was run for it.

## Open questions or contradictions found

1. **The wrong W19 attribution does not affect my pages.** The audit's T1 names a
   W19/W18 attribution error on `testing-facility.md` only.
2. **`sensitive-values.md` still uses history phrasing:** "until Wave 3",
   "Wave 2", "the leak `web.dom.type` carried". So does `element-identity.md`
   (D13, D14, "What changed in Week 1 Phase 1.3"). The dispatch decision
   "describe the current design only" was applied to my additions only, because
   the audit lists none of these phrases. If the supervisor wants them stripped
   too, that is a further pass on the same three files.
