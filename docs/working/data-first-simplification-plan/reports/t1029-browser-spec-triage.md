# t1029 report: browser specs failing on dev, triaged and fixed at the root

Worker: t1029 (Claude Code worker-heavy). Tree `fxwork/t1029-browser-spec-triage`, branch `task/t1029-browser-spec-triage`. No commits made.

## Outcome

Partial. 24 of the 25 listed tests pass headed (see "Final run" below for the quoted output; one of the 24,
pinned-calls:79, timed out once in its own setup under three workers and passed alone). Six separate causes were found
(A to F); five are fixed where they belong. The fifth (social-read-completion:90) is a product defect in the content-script list
reader, which the brief says to raise before touching (`apps/extension/src/content/extraction/**`, t1022's area); it is
reported with evidence and left unfixed.

Two of the causes were real product defects that would hit live runs, not spec drift:

1. **Every project-build trial failed on its first step after a navigate** (the part-run `executor.fault.unclassified`).
   The domain's leased-session check used Core's *unbound* lease source, which answers "not current" for every lease
   bound to an instance's domain. Since Core t911 (`842588df4`, merged into Core dev 2026-11-18 `e60e82631`, and Core
   `255d606ab`), a project build's subflow trials, part runs and held pages run under a *bound* lease. So the first page
   read inside every trial threw `AutomationStudioHostResourceStaleLeaseError`, which Core's host-state capture wraps as
   "The host state capture could not be read." and classifies `executor.fault.unclassified`. A navigate is the first step
   to have an after-action capture, which is why the fault always sat on the navigate. This is the same code as
   `run-mw0hzrhs-344f6976`'s live failure (`debugs/run-mw0hzrhs-344f6976.md`), though that run was not re-examined.
2. **Every trial whose Flow holds a wait, a branch merge, a For Each, or a press that flips its own control was judged
   "unsure" whatever the judge said** (`candidate.trial_unconfirmed`, "Some required evidence was not available"). The
   web judge-evidence projector (t987 `449434406`, `d63bdae78`, `be6a5b08f`, 2026-11-22/23) marked Core's own
   control-flow and timing steps `web_judge.evidence_unrecognized`, and read a Flow press's toggle only in the shape
   Core is told it, not the shape the client answers it in (`web_judge.action_invalid`). Core's
   `result-verification/verdict/result-verdict.ts` turns any non-empty `evidenceProjection.missing` into unsure. A build
   can then never complete (the scripted builds ended `project.completion_not_latest` / `project.build_ending_told`).

## What changed and why

### Cause A: bound host leases read as stale (fixed, domain)

- Evidence: instrumented `captureStateSnapshot` in the part-run spec (instrumentation since removed) printed
  `after_action web.output.browser-navigate AutomationStudioHostResourceStaleLeaseError: Host resource
  web.automation:reset-installed-diagnostic epoch 1795554025326 is no longer held by builder brief-1. at leasedWebSessionId
  (domain/src/runtime/web-sessions/leased-web-session.ts:6) ... at readPageState (domain/src/runtime/host-runtime.ts:254)`.
  Core's `AutomationStudioHostLeaseScope.gatewaySource.isCurrent` requires `frame.binding === undefined`; Core's own
  gateway stamps through `AutomationStudioHostLeaseAuthority.for(automationStudio).gatewaySource` (owner-domain source)
  and refuses a stale bound lease unsent (`host_lease.stale`, `client-gateway/service/host-lease/stamp.ts`).
- Fix: `domain/src/runtime/web-sessions/leased-web-session.ts` asks the static source only about the unbound lease it
  can see; a bound lease names its own browser and is fenced where Core stamps it. A held lease still never falls back
  to another browser.
- Test: `domain/src/runtime/web-sessions/tests/pick-web-session.test.ts`, two new tests (a bound lease picks its own
  browser; a late callback from a released bound lease does not fall back). Both fail on the old code (checked by
  swapping the old file in: `not ok 16`, `not ok 17`, `# fail 2`) and pass on the new.
- Not a Core change. Core's API has no binding-agnostic "is this lease current"; if the lead wants the domain to fence
  bound leases itself too, Core would need to expose one (or the domain would bind `AutomationStudioHostLeaseAuthority
  .for(fluxiq.programs.automationStudio).forDomain(...)`, which couples it to Core's choice of domain id).

### Cause B: the web judge projector made trials unconfirmed (fixed, domain)

- Evidence: logging the judge request's `evidenceProjection` and the projector's inputs showed, for the part-run trial,
  `{"source":"n:5","codes":["web_judge.evidence_unrecognized"]}` on `builtin.timing.wait` with evidence `{"data":null}` and
  `{"source":"n:6","codes":["web_judge.action_invalid"]}` on `web.output.dom-click` whose raw result carried
  `"toggle":{"via":"class","gains":["css-04lcxz0"],"loses":[]}` plus `toggleBefore`; for the four other part-run tests,
  `builtin.control.merge` (`{"next":true,"mergeMode":"first"}`) and `builtin.control.for-each`
  (`{"item":{"$datasetRow":...},"index":0,"count":3}`), 9 gaps per trial.
- Fix 1, `domain/src/runtime/llm-evidence/judge-evidence/project.ts`: a step whose Core definition class is
  `control-flow` or `timing` (`getAutomationNodeDefinition`, Core's own taxonomy) carries Core's bookkeeping and is not
  counted as unrecognized web evidence. Unreadable content on any other node (data, policy action, web, or no
  definition) still fails closed.
- Fix 2, `domain/src/runtime/llm-evidence/judge-evidence/action.ts`: a toggle is read in both shapes, the told
  `{signature, beforeSignature, idempotentWith}` and the client's raw signature with `toggleBefore` beside it (the shape
  inside the client result a Flow attempt's evidence is read from), normalised through `webToggleOutput`.
- Tests: two new tests in `judge-evidence/tests/project.test.ts` (both shapes, attribute toggles' `idempotentWith`,
  malformed toggles still invalid; wait/merge/for-each miss nothing, data/policy/web/no-definition still unrecognized).
- Note found on the way, not changed: `project.ts`'s role decision uses `webRunnableNode(definitionId)`, which matches
  names fuzzily; `builtin.timing.wait` matched a web node through it (that is why my first exact-match attempt through
  it failed its test). It only affects the projected `role`, not gaps.

### Cause C: the content harness counted the content script's own timers as the page's work (fixed, harness)

- All 9 auction-marketplace tests failed on the sort button (which ignores its first press by design) with `timed_out`:
  "the first press was unanswered and no fresh binding was observed while page work remained pending; no further press
  was made". t906 (`d43b357f8`, 2026-11-11) made an unanswered press keep watching while the page world reports pending
  work. The harness runs the content script in the page's main world after the page-world bundle has wrapped
  `setTimeout`, frames, idle callbacks and `fetch`, so the content script's own watch timers were counted as the page's
  pending work until the command deadline. In the browser the content script is in an isolated world and never is.
- Fix: `apps/extension/e2e/content/harness.ts` keeps the window's own schedulers before the page world installs and runs
  the content-script bundle with them in scope. Product code unchanged.
- Result: 7 of the 9 auction tests passed on the next run; the other 2 then failed only on cause D.

### Cause D: specs pinned the read shape t982 changed (spec updates, citing the commit)

t982 (`ba64bbf1c`, `731b2b601`, 2026-11-22, `docs/architecture/retained-extraction.md`; the user's 2026-11-20 rule that
extraction keeps every column) makes a read retain every safe detected field beside the asked columns, and lets a
condition test a retained field by key instead of an inline read. Specs that compared whole rows or the request's field
list now compare the asked columns, and keep every other oracle (row count, order, values, each once):

- `everything-store-cart-names.spec.ts:76`: rows projected to `item, quantity, price`.
- `auction-marketplace-kestrel-auctions.spec.ts:553` and `:596`: rows projected to the four owed columns; the request
  must contain the owed columns (`arrayContaining`) rather than be exactly them.
- `local-classifieds-bike-search.spec.ts:302`, `:316`: rows projected to the answer's columns.
- `professional-network-rotterdam-data-engineers.spec.ts:406`: same.
- `crossborder-marketplace-spain-hubs.spec.ts:358`: the ad condition is now `{ field: keys.ad }` (a retained column)
  instead of an inline `read`; the rating condition is unchanged.
- `item-conditions.spec.ts:262`: the condition names a field of the request whose own spec reads `data-ad-id`, so the
  request is still literal and self-contained.
- `social-read-completion.spec.ts:90`: the helper-rows check allows retained detected columns beside `identity`.

### Cause E: a load-more swallowed press is now handled inside one command (spec update)

- `company-definition-fields.spec.ts:55` expected two Next page attempts (a certain no-effect, then a host retry). t903
  `f72e2bff9` (2026-11-11) presses a load-more the list proves ignored once more inside the same command. The spec now
  expects one attempt, one succeeded receipt, both presses counted (still `2`), and the same item count.

### Not fixed: social-read-completion:90 (cause F, product defect, extraction)

- After the cause D spec update it fails "at least one disclosure must actually expand". Logged evidence: the helper
  read, asked only `identity`, was sent 56 fields and answered `{"disclosedRows":5,"records":26}`, and 0 collapsed
  "See more" controls remained, so every For Each click met no control (`web.target.not_found`).
- Cause: t982's retained fields are held to the reader's whole-text rule (`content/extraction/list-reader.ts`,
  `assertDisclosed` over every field, `readDisclosing` by default since t752 / `5f0b26ef9`). A read asked for one column
  presses disclosure controls for text nobody asked for. By reading the code (not run), the same rule would refuse a
  `discloseText: false` read with `incomplete_text` because a retained, unasked column is collapsed. The request does not
  tell the content script which fields are asked: every field arrives `required: false` (seen in the auction request).
- Fix belongs in the extraction reader plus a request marker from the domain (retained fields held optional, never
  pressed for, never refusing). Not done: the brief reserves `apps/extension/src/content/extraction/**` for t1022 unless
  raised first, and it is a domain-to-content contract change.

## Commands run and observed results

(final outputs quoted in "Final run" below)

- Setup: `pnpm --filter @fluxiq-web-extension/test-contracts build` -> reuse from store; `pnpm --filter
  @fluxiq-web-extension/extension build` -> `e2e-chromium: verified 26 files`.
- Baseline `node scripts/test-content.mjs part-run --headed` -> `5 failed`, each `flow_bootstrap.evidence_repeat_without_progress`.
- Baseline `node scripts/test-content.mjs auction-marketplace-kestrel --headed --workers=2` -> `9 failed, 1 passed (5.8m)`.
- Baseline (with the harness fix already in) the other 8 listed tests -> 8 failed, first errors as listed under D, E, F.
- After cause A only: part-run :66 trial ran all 8 steps, verdict `unsure` (cause B).
- After A and B fix 1/2 for wait and toggle: part-run -> `4 failed, 1 passed (5.0m)`; after the control-flow class rule:
  `5 passed (5.3m)`.
- Auction after cause C: `2 failed, 8 passed (9.0m)`; with cause D updates, in the 15-test rerun: `1 failed, 14 passed
  (6.5m)` (the one failure social-read-completion:90).
- `DOMAIN_TEST_BUILD_LABEL=t1029 node scripts/test-domain.mjs runtime/llm-evidence/judge-evidence runtime/web-sessions`
  -> `# pass 27`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0; `pnpm --filter @fluxiq-web-extension/extension check` ->
  exit 0 (first run; final run below).
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (260 warning(s), 551 baselined).`

### Final run (all edits final, temporary instrumentation removed)

- `node scripts/test-content.mjs part-run everything-store-cart-names.spec.ts:76 company-definition-fields.spec.ts:55
  item-conditions.spec.ts:262 social-read-completion.spec.ts:90 crossborder-marketplace-spain-hubs.spec.ts:358
  local-classifieds-bike-search.spec.ts:302 local-classifieds-bike-search.spec.ts:316
  professional-network-rotterdam-data-engineers.spec.ts:406 auction-marketplace-kestrel --headed --workers=3` ->
  `2 failed`, `18 passed (11.2m)`. Failed: social-read-completion:90 ("at least one disclosure must actually expand",
  cause F) and pinned-calls-job-board:79, which got past its build and parts and then timed out in the spec's own
  `readyBoard` setup (`locator.waitFor: Timeout 9000ms exceeded ... waiting for locator('rf-assistant .fa-min') to be
  visible`, at the third `freshBoard`). The board opens that panel 6000 ms after load
  (`scenario-lab/.../board/widgets-script.ts`), so the spec has 3 s of slack; with three headed browsers running it ran out.
- Rerun alone: `node scripts/test-content.mjs pinned-calls-job-board.spec.ts:79 --headed` -> `1 passed (8.6m)`; it also
  passed in the earlier three-worker part-run run (`5 passed (5.3m)`).
- `DOMAIN_TEST_BUILD_LABEL=t1029 node domain/scripts/test-domain.mjs runtime/llm-evidence/judge-evidence
  runtime/web-sessions` -> `# tests 27`, `# pass 27`, `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/extension check` -> `EXT_EXIT 0` (tsconfig.test.json covers `e2e/**`).
- `pnpm --filter @fluxiq-web-extension/domain check` -> `DOMAIN_EXIT 0` (after a test-file fix for the audit below).
- `node scripts/structure-audit.mjs` -> first `1 violation(s)` (`contract-spread` in my new
  `judge-evidence/tests/project.test.ts` line 188), fixed by writing both literals; then `structure-audit: passed (260
  warning(s), 551 baselined).`

## Not verified

- No Lab or live run (forbidden by the brief). Whether cause A or B explains specific live failures (for example
  `run-mw0hzrhs`) is inferred from the matching code and step, not proven on a recording.
- No `git bisect`: Core is a shared detached checkout, so older downstream commits would build against today's Core.
  Introducing commits were found by `git log -S` and reading the diffs instead.
- The `discloseText: false` refusal under cause F is read from the code, not run.
- Only the listed specs were run; other specs that compare whole rows from evidence-runtime reads may need the same
  cause D update.
- Firefox build and Chrome side panel not exercised; the content harness is Chromium only.

## Open questions or contradictions found

- Cause F needs a decision: should retained (unasked) fields ever drive disclosure presses or `incomplete_text`
  refusals? The t982 doc says additional fields are optional; the reader treats them as required-whole.
- Core has no binding-agnostic lease currency check for domains (cause A). Current fix relies on Core's gateway fencing.
- The brief's "headed as AGENTS.md requires": the content config is headless by default; every run here passed `--headed`.
- pinned-calls-job-board:79 can time out in its setup under parallel load: the spec waits 9 s for a panel the fixture
  opens 6 s after load. Not changed (no timeout raised); the lasting fix is for the spec to wait on the page's own
  signal that the panel opened, or to run with fewer workers. Left for the lead.
