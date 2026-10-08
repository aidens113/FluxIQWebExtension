# Run debug — run-muz3cqdh-927fd2f1 (lane A round 7, qualifying run 1 in candidate mode, t342-slot-2)

Written as `run-pending-t342-slot-2-a-r7.md` before launch; renamed to the run id when the Lab assigns it.
Everything in "Expectations" was written before launch (2026-10-08 ~05:23 UTC; off-peak until 06:00, launch by
about 05:37).

## Header

Lane A, t342 round 7: qualifying run 1 of the two-pass streak in candidate mode. Since round 6 only the Lab changed:
t367 (downstream 6f8019da) accepts a promoted candidate with a complete trial audit, records the candidate, trials and
verdict, and runs its own reset, playback and private oracle. The product pair is unchanged from round 6: Core
97772aeb. The Core panel build is cached under round 6's key `df51d8f7...`.

Tree at downstream 61add9df (contains dev 6f8019da), Core 97772aeb (= Core dev), both clean. Test-runner rebuilt
(exit 0); everything else reused. No `STOP-balance`, no override files.

Previous run on this instance: round 6 `run-muz2cj6p-80eb2179`. The product passed (trial yes, both judges yes,
promoted, applied, "ready"), but the Lab refused the proposal (`lab.proposal_without_evidence_audit`, fixed by t367).
Zero-call replay `replay-muz2npvw-b51023b7` passed.

## Expectations (written before launch)

Same instruction (sha256 `2e6f5e7d...a405`), oracle and correct-candidate description as round 3's debug
(`run-muyqgopm-1bfa7054.md`). Command: as round 6, with `--authoring-mode candidate`.

Dry run (05:23 UTC): `status ready`, 0 calls, chat entry, flash, candidate, `candidateTrial {trialRunner: true,
startReset: true}`, 48 calls, $0.10, `permittedConsequences []`, `coreWeb` cached.

To check:

- the trials as in round 6: coupon retried, Space Grey checked with nothing pressed, Add to cart, the cart check;
- both judge verdicts;
- promotion and chat apply;
- **new (t367):** the Lab accepts the promoted candidate, records `candidate` (id, revision, digest, trials,
  verdict), resets, plays the saved Flow on its own tab, and measures the private oracle:
  - cart line Voltbay Official Store, Space Grey, 7-in-1, Spain × 3;
  - coupon collected;
  - `Cart (3)`;
  - `Orders to be shipped (0)`;
- playback UI: run status, step cards, result.

On a Lab oracle pass with product acceptance: one zero-call `lab replay`. Then a second candidate creation run only if
it can launch before about 05:40 UTC; otherwise round 8 goes in the 10:00 UTC window.

## Result (first pass, 05:29 UTC; full detail follows below)

**Passed.** Lab verdict `passed`, `flowCreated: true`, `oracleVerdict: passed`, `reportedVerdict: passed`; $0.021437 (build $0.019842). The Lab played the saved Flow (11 playback steps) and judged it with the private oracle. Zero-call replay `replay-muz3idd0-d170048d` (05:28 UTC): passed, 0 provider calls, 0 interventions, 0 harness activations, model providers disabled, Flow hash `6e9a6cd8...` unchanged, run succeeded, goal held.

## Result in full (written by the t342 lane lead, 2026-10-08 ~05:50 UTC)

**Passed, end to end, on the Lab's own oracle.**

- Launched 05:23:45 UTC (guard `admitted`, fingerprint `sha256:563e825a...`); panel open 05:24:01; Lab verdict
  `passed` at 05:27:37.
- 18 calls, $0.021437:
  - chat: 1, $0.000071;
  - exploration: 9 runs, $0.012751;
  - submissions: 2, $0.002602;
  - trial requests: 2, $0.001998;
  - build judges: 2, $0.001554;
  - completion: 1, $0.000937;
  - the Lab's post-run result check: 1, $0.001525.
- Build $0.019842 of the $0.10 ceiling.
- No Lab process was left running.

Sequence:

1. Exploration, 0002-0020.
2. Revision 1 (0021) accepted.
3. Trial 1 (0023/0024), `start: "reset"`:
   - navigate;
   - two optional dismissals skipped as absent;
   - coupon succeeded after 2 attempts;
   - `dom-check` Space Grey, 7-in-1 and Spain succeeded;
   - type 3;
   - Add to cart;
   - `wait_for_text "added to cart"` timed out after 4 attempts.
4. Revision 2 (0025) waited for "cart" instead.
5. Trial 2 (0027/0028), `start: "reset"`: every step succeeded. Verdict **yes**.
6. Judges 0029/0030: both said the run carried out the request.
7. 0031: complete.
8. Core promoted candidate `candidate.dc0decff...` revision 2 as `adaptation.bootstrap.f38dcd3f...`. The chat applied it
   and said it was ready.
9. The Lab (t367) accepted it and recorded the candidate: 2 trials, 2 judge calls, verdict yes.
10. The Lab reset the fixture and played the saved Flow on its own tab (`ownPage.reached: true`): 11 playback steps.
    - navigate;
    - two dismissals skipped;
    - coupon failed once, then succeeded;
    - three checks;
    - type;
    - Add to cart;
    - wait;
    - result check confirmed.
11. Private oracle, all four facts held, final state `held` (nothing bought), harness activations 0:
    - `Cart (3)`;
    - `Orders to be shipped (0)`;
    - the Voltbay Official Store line, Space Grey, 7-in-1, Ships from Spain × 3;
    - the Voltbay store coupon.
12. **Zero-call replay** `replay-muz3idd0-d170048d` (05:28 UTC): passed; 0 provider calls, 0 interventions, 0 harness
    activations; model providers disabled; Flow hash `6e9a6cd8...` unchanged; run succeeded; goal held.

Judge versus oracle: agreement (both yes, all four facts held).

**Weak point.** The pass leans on revision 2's self-check `wait_for_text "cart"`, which is always true (the header
says "Cart"). The real checks were the judges and the oracle. Qualifying run 2 chose "Cart (3)", which is hidden in
the closed mini-cart, and failed on it.

UI (13 moments; end panel viewed):

- The overlay goes "Testing your Flow", then "Flow ready | Your Flow is ready", then "Running your Flow | Step N of
  10", then "Run finished".
- The playback cards name 7-in-1, Spain and Add to cart; "Check result · Passed"; "Run finished".
- Small issues:
  - the choice steps show as "Click" cards while the overlay says "Ticking";
  - the Type and Wait cards name nothing;
  - the coupon and dismissal lines name no control.
