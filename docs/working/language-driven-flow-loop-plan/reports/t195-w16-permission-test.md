# t195-w16: permission.test.ts restated to the F10 rule

## Outcome

Done. The failing assertion is fixed. Across four runs, 15 s timeouts on cases this task did not touch struck a different case each time. They are recorded below and were not root-caused.

## What changed and why

File: `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/tests/service-bootstrap/tests/permission.test.ts`

The old case "goes ahead with nothing permitted, and keeps what the instruction asked for with the proposal and the Flow" still assumed the pre-F10 rule, where an instructed refund goes ahead without asking. Since F10 (05266957, `action-permissions/destructive.ts` and `gate.ts`), move_money is asked about every time. I split it into two cases, which share one `INSTRUCTED` constant:

1. "still asks before moving money with nothing permitted, carrying what the instruction asked for on the request". With nothing permitted, the build rejects with `flow_bootstrap.permission_required`. The rejection's `permissionRequest` has `missing: ["move_money"]` and `authority.granted: []`. `authority.instructed` holds both instructed readings with `instructionId: "instruction.build"`, including move_money / "Refund the first line". `pressed` is `[]`.
2. "keeps what the instruction asked for with the proposal and the Flow once the person permits the money". This is the same build with `build(..., ["move_money"], INSTRUCTED)`. It keeps the original assertions: the refund is pressed, the instruction is read once (`authorityRequests` has length 1), the stored `instructedConsequences` hold both readings, and after approve and apply, `metadata.bootstrapInstructedConsequences` equals the stored set.

I added a comment above the pair that cites the rule in `destructive.ts`.

Other cases in `service-bootstrap/tests/`: I searched every file except permission.test.ts for "instructed", "instruction itself", "goes ahead" and "unasked". The only match was `permission-ask.test.ts:75` ("goes ahead with the action when the person grants it while the build waits"). That case depends on the person granting permission, not on the instruction, so it fits the new rule and I left it alone. The other cases in permission.test.ts already fit the new rule.

## Commands run and observed results

All commands ran from `packages/fluxiq` in the t195 Core worktree through `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w16 vitest" npx vitest run ...`.

- `src/programs/automation-studio/runtime/tests/service-bootstrap`: `Test Files 1 failed | 17 passed (18)`, `Tests 1 failed | 96 passed (97)`. permission.test.ts fully passed. The one failure was `adaptation.test.ts > bridges a generated proposal ID through the standard Adaptation Audit get, approve, and apply endpoints` with "Test timed out in 15000ms".
- Re-run of `adaptation.test.ts` and `permission.test.ts` together: adaptation 9/9 passed, with the case above at 13375 ms. permission had 1 failure: `carries on when an exploration step needs it...` timed out at 15156 ms. I did not edit that case, and it passed in the first run.
- `permission.test.ts` alone: `Tests 1 failed | 10 passed (11)`. The failure was `takes the action while exploring and builds the Flow that takes it`, which I did not edit either.
- `permission.test.ts` alone again: `Test Files 1 passed (1)`, `Tests 11 passed (11)`. Both new cases passed (4467 ms and 9880 ms).
- `src/programs/automation-studio/runtime/action-permissions`: `Test Files 5 passed (5)`, `Tests 63 passed (63)`.

## Not verified

- I did not get a single clean pass of the whole service-bootstrap directory. Every case passed in at least one run, and both new cases passed in every run. The failures across runs were 15 s timeouts on three different unedited cases. Durations for identical cases ranged from about 2 s to 15 s between runs, and `tasklist` showed 33 node.exe processes at the end. I did not root-cause the timeouts.
- tsc was not run.

## Open questions or contradictions found

- Several service-bootstrap cases run close to vitest's 15 s default timeout: adaptation's "bridges a generated proposal ID..." took 13.4 s even when it passed. Whether that is slow harness setup or something else needs its own investigation. It is outside this brief.
