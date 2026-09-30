# t200-w8 report: Lab exploration caps, campaign run-token budget, testing-facility doc

## Outcome

Done. The exploration evidence now carries every element of each captured page, with nothing cut. The campaign no longer passes a run-token budget. The testing-facility doc now describes the new behaviour.

## What changed and why

- `packages/test-runner/src/web-flow-exploration.ts`
  - Removed `maxElementsPerPage` from `WebFlowExplorationLimits`, along with its 80 default and 150 maximum. `sanitizeWebExplorationSnapshot` no longer takes a `maxElements` argument. No caller in the repository passed one, apart from the test I updated.
  - Removed the 300-character cut (`MAX_TEXT_LENGTH`) on element text, names and titles.
  - Removed the 500-character cut on selectors (`MAX_SELECTOR_LENGTH`) and the 80-character cut on roles.
  - Also removed two smaller cuts: 40 characters on tag and inputType, and 100 characters on the screening reads. With these gone, `optionalText` only collapses whitespace.
  - Secret screening is unchanged: `isSensitiveElement` (password, `current-password`/`new-password`/`one-time-code`/`cc-*` autocomplete, `data-sensitive`). Values, attributes, selected text, and URL queries and fragments are still never copied.
  - Kept on purpose: `maxPages` (the number of pages Core may select, not page content), the 4,000-character instruction bound, and the 2,000-character URL bound. The URL bound drops an href over 2,000 characters.
- `packages/test-runner/src/tests/web-flow-exploration.test.ts`
  - The large-page test now sends 400 elements, each with a 900-character selector, 1,200-character text and name, and a 200-character role, plus a 1,000-character title. It asserts that all of it reaches Core whole, at more than 1 MB.
  - New test: a page of more than 200 elements with password, OTP, card and `data-sensitive` inputs. The secrets are still screened out and the last element is kept.
- `scripts/lab/live-campaign/lab-run/command.mjs`
  - Dropped `--llm-max-run-tokens 1000000` from both `REPAIR_LIMITS` and `CREATE_LIMITS`, and rewrote the comments.
  - Checked beforehand what happens without the option:
    - `packages/test-contracts/src/llm-validation.ts:174` validates the run budget only when it is present.
    - `packages/test-runner/src/live-llm/live-llm-plan.ts` `runTokenBudget` then uses per-request x calls: 48M for create, 26M for repair. The existing plan test "without --llm-max-run-tokens ..." covers this.
  - So the run is bounded by `--llm-max-cost-usd 0.25`, the call count and Core's stall guard. An operator can still pass `--llm-max-run-tokens` after `--`.
- Campaign tests
  - `tests/tasks.mjs` and `tests/command-line.test.mjs`: removed the option from the expected arguments.
  - `tests/lab-run-command.test.mjs` now asserts:
    - neither a create task nor a repair task carries the option;
    - an operator's `-- --llm-max-run-tokens 5000000` is passed through exactly once.
- `docs/architecture/testing-facility.md`
  - Exploration seam, around line 43: the bundle is now whole. The doc names the removed caps and the 48,000-byte budget, and says secret screening is the only filter and the 1M context window the only bound.
  - Around line 1554: packet sizes are recorded, never judged. It records that the `evidence-packet-budget` invariant and the domain's 6,000-byte and evidence byte budgets were deleted on 2026-09-30. This matches `observed-run-evaluation.ts`, which no longer carries the invariant.
  - LLM allowance paragraph, around line 2507:
    - Replaced the stale 8,000/2,000/10,000 figures and the 50,000-token ceiling with 992,000/8,000/1,000,000 and the 1,000,000 window.
    - Recorded the history: the 50,000 ceiling, and the 48,000/8,000/56,000 figures under Core's 64,000.
    - Removed "one live run at a time", which contradicts the current four-slot rule.
  - Calls-per-run paragraph: added that the campaign passes no run-token budget, and why.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t200 runner check" pnpm --filter @fluxiq-web-extension/test-runner check`: "[heavy] t200 runner check holds b2". The build-cache line was `"reason":"no stamp; not stamped, because inputs changed while it ran (core:packages/fluxiq/src)"`. No tsc errors. I re-ran it later with the exit code captured: `check exit=0`.
- `node --test scripts/lab/live-campaign/tests/*.test.mjs`: `# tests 21`, `# pass 21`, `# fail 0`.
- `bash .../heavy.sh "t200 runner build" pnpm --filter @fluxiq-web-extension/test-runner build`: exit 0. The build-cache said "not stamped, because inputs changed while it ran (core:packages/fluxiq/src)".
- `node --test dist/tests/web-flow-exploration.test.js`, in packages/test-runner: 6 ok, `# pass 6`, `# fail 0`. This includes "sends every element of a large page to Core whole, with no count or text cuts" and "still screens secrets out of a page with no element cap".
- As an extra check, I ran the sibling `node --test dist/tests/demo-llm-exploration-*.test.js`: 43 of 44 passed.
  - The failure is `demo-llm-exploration-request.test.js`: `SyntaxError: The requested module 'fluxiq/automation-studio' does not provide an export named 'AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES'`.
  - The import is in the stale `domain/dist/runtime/llm-evidence/limits.js` and `domain/dist/runtime/adapter.js` (built at 11:44). The export is gone from Core's in-progress state, and no source file under packages/, apps/ or domain/src references it.
  - This is caused by Core and domain work in progress. It is not caused by my files, and I did not fix it.

## Not verified

- No Lab or live run, as the brief says. I did not confirm how Core behaves with 1 MB+ exploration evidence.
- The domain test build and the rest of the test-runner suite were not run.
- I did not rebuild domain/dist, which belongs to another worker, to clear the failure above.

## Open questions or contradictions found

1. **"$0.25 per build" does not match the testing-facility doc.** The doc describes `--llm-max-cost-usd` as a per-call ceiling, with the run total held to min($2, per-call x calls) and saved as `maxEstimatedCostUsdPerRun`. With a 48-call create task, that allows up to $2 a run, not $0.25. That is `live-llm-plan.ts` `maxTotalEstimatedCostUsd`, outside my ownership. If the user's $0.25 is meant per build, the plan or Core must hold the run total to it. I worded the doc as "its `--llm-max-cost-usd 0.25` spend ceiling".
2. `testing-facility.md` around line 1211 still says each sanitized evidence packet carries a "truncation flag", and the bench reports a "truncation count" around line 1981. Both still exist in `observed-run-evaluation.ts` (`truncationCount`), so I left them. If the domain no longer truncates, they are always 0/false, and the lead may want them removed in a later task.
3. The 2,000-character href bound in `web-flow-exploration.ts` still drops very long links from the evidence. I kept it as URL validation, not a page-information cap. Say if it should go too.
