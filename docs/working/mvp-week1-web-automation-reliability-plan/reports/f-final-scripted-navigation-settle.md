# f-final-scripted-navigation-settle — preserve consecutive intentional navigations

Implementation report, 2026-09-13. Owned files only:

- `packages/test-runner/src/scenario-steps/step-runner.ts`
- `packages/test-runner/src/scenario-steps/tests/step-runner.test.ts`
- this report

No shared working document, Core/extension source, Lab worktree, run artifact,
commit, or remote was touched.

## Outcome

Implemented the recording-driver settle barrier identified by `i-final-w10`.
`ScenarioStepRunner` now remembers completion of the trusted operations that
can emit the extension recorder's navigation explainers (`click`, `press`, and
`check`). Before a later scripted `navigate`, it sleeps only for the remainder
of the combined navigation-explanation and debounce bound. A navigation with no
prior relevant input, or one whose bound has already elapsed, starts
immediately.

The settle bound is deliberately **5,250 ms**, derived rather than guessed:

- 5,000 ms: `NavigationRecorder`'s explanatory-action window;
- 250 ms: its pending-navigation debounce.

Waiting only 250 ms is insufficient: Chromium may classify Playwright's
scripted navigation as `other`, which the recorder still drops while the prior
click/submit can explain it. Adding the debounce accounts for a commit at the
end of that explanation window remaining pending before classification.

The injected sleep happens inside the `navigate` operation after its start time
is captured. Consequently the wait is included in that step's published
duration. The completion timestamp used to track the prior input is the same
timestamp used to finalize its timing, avoiding a second clock read and keeping
tests and production accounting aligned.

## Tests

Three deterministic injected-clock/sleep rows cover the requested branches:

1. a navigation 100 ms after a click sleeps the remaining 5,150 ms, then calls
   `goto`, and its duration includes all 5,150 ms;
2. a navigation exactly 5,250 ms after a click does not sleep;
3. a navigation with no prior explaining input does not sleep.

The existing all-operations row now injects sleep and proves the barrier is
part of navigate timing without making the unit suite wait on wall time.

## Validation

- `pnpm --filter @fluxiq-web-extension/test-runner check`: **passed**.
- Private compilation to
  `packages/test-runner/.private-scripted-navigation-settle`: **passed**.
- Focused restored test:
  `node --test .private-scripted-navigation-settle/scenario-steps/tests/step-runner.test.js`:
  **6 passed, 0 failed**.
- `git diff --check` over both owned source files: no whitespace error (Git
  printed only the repository's LF-to-CRLF warnings).

Mutation proof:

- Pre-mutation SHA-256:
  - `step-runner.ts`:
    `22D2A93CE76DC9EAF2DC8F7716B27D39BC281AD1D243E56DB814C607DF6A0E18`;
  - `step-runner.test.ts`:
    `4409C85A9DF1AF7A405D23CA4F418F6BFD7C6A5A275D7BF400B3DBBCF4B05823`.
- Removed the settle call from the `navigate` branch, privately rebuilt, and
  reran the focused suite: **4 passed, 2 failed**. The explicit barrier row
  observed no sleep, and the all-operations row measured 5 ms rather than the
  expected 5,230 ms navigation duration.
- Restored the call with `apply_patch`; both SHA-256 values returned exactly to
  those above. The private rebuild passed and the focused suite returned to
  **6 passed, 0 failed**.
- The verified private output directory was removed; `Test-Path` returned
  `false` afterwards.

## Remaining proof

No Lab run was authorized for this worker. Supervisor validation still needs
the brief's live W10 proof: primary Flow 3/3 with two candidates and both click
and navigation attempts, plus `broken-link` 3/3 with two candidates and its
expected first-click `navigation_unexpected` failure. Both final benches then
need to restart from repeat 0 at the same new pushed downstream/Core pins.
