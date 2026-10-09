# Run debug — run-mv0pb9sm-248ba49f (lane A round 9 = lanes A-D round 2, qualifying run 1 of a new streak in candidate mode, t342-slot-2)

Written as `run-pending-t342-slot-2-a-r9.md` before launch; renamed to the run id when the Lab assigns it.
Everything in "Expectations" was written before launch (2026-10-09 ~08:20 UTC; DeepSeek peak until 10:00 UTC, so no
paid launch before 10:00).

## Header

Lane A, t342 round 9 (the lanes A-D round 2 brief): qualifying run 1 of a new two-pass streak in candidate mode. The
product pair is new since round 8: Core and downstream t375 (adaptation unblock, plain run endings), t376 (Stop, Take
over/Hand back, onboarding, switch to Chat, neutral record button), t377 (Flow listings read only their rows; saved
traces keep each input once; the Lab's pre-send reads retry; `unchanged` ignores a pre-provider facility failure), t378
(refusals name the script line; identical resubmissions get the original issues; missing closing brace repaired;
interruptions named; guarded loop step and pace; `builtin.timing.wait` pauses; rows narrowed in the read; card words),
t379 (paired token scope). The streak therefore starts at zero.

Tree `fxwork/t342/!FluxIQWebExtension` at bce6a9c8 on `task/t342-lane-a-baseline` (source equal to dev e299e2c6; only
this lane's report and debugs differ). Core `fxwork/t342/!FluxIQ` at dcaf8f9f (= Core dev), both clean. Slot 2 claimed
by t342. No `STOP-balance`, no override files.

Previous live run on this instance: round 8 `run-mv0fu9uq-107ab0de` (failed before the chat send: one unretried 10 s
`list-flows` on a 193 MB workspace; facility failure before any provider call; debug exists).

## Preflight (0 provider calls), 08:14-08:2x UTC

- Core libraries: `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` in the
  Core tree: all three restored from the shared store (6.4 s).
- Downstream `pnpm build`: exit 0, every step restored from the shared store.
- Campaign `--dry-run` printed one command (below). The Lab `--dry-run` of it exited 0: `status ready`,
  `providerCallCount 0`, created-flow, chat entry, persistent-isolated, deepseek-flash, `coreAuthoringMode candidate`,
  `candidateTrial {trialRunner: true, startReset: true, source: lab-plan}`, maxCalls 48, $0.10,
  `permittedConsequences []`, instruction 219 chars sha256 `2e6f5e7d...a405`, `coreWeb` key `3ebf7d0f...` not cached.
- Free rehearsal (no `--live-llm`, so neither guarded nor ledgered), realistic scenario only:
  `FLUXIQ_LAB_INSTANCE=t342-slot-2 FLUXIQ_TEST_ENV_FILES=none node scripts/lab/run-lab.mjs run crossborder-marketplace
  --flow` -> `run-mv0p1mbu-ee8c2d49`, 0 calls, 08:19-08:25. It built the Core panel (`core-web-build.log` exit 0) and
  verified all four running identities (`running-{build,core,host,server-adapter}-identity.json` `verified: true`);
  browser headed (`live-panel.json` `side-panel`). Its recorded Flow failed again on the store coupon inside the
  `fb-store-coupon` shadow root (`web.target.not_found`, `recovery.exhausted`), the same as round 8's R8-S1: recording
  lane only.
- 08:19 UTC: the supervisor merged dev `ba87bc0f` (t382, the Lab's peak-hours guard removed by the user's decision;
  Lab guard scripts only, no product source, Core unchanged) into this branch, now `50cfd17b`. Launch no longer waits
  for 10:00 UTC.

## Expectations (written before launch)

Instruction, verbatim (219 characters, sha256 `2e6f5e7d...a405`):

> On Farbazaar, put three of the Voltbay USB-C hub sold by Voltbay Official Store in my cart: Space Grey, the
> 7-in-1 version, shipped from Spain. Collect that store's coupon while you are on the item. Do not buy anything.

Command (`--max-attempts 1`, so no second paid attempt):

```text
FLUXIQ_LAB_INSTANCE=t342-slot-2 FLUXIQ_TEST_ENV_FILES=none
pnpm lab:campaign crossborder-marketplace-hub-to-cart --max-attempts 1 --authoring-mode candidate -- --target persistent-isolated --workspace t342-a
```

What a correct candidate does: navigate; optional dismissals of the welcome popup and consent layer; open the Voltbay
Official Store item; leave Space Grey alone (preselected) or set it by desired state; choose 7-in-1 and Spain; collect
the store coupon (retry when busy); quantity 3; Add to cart once; never Buy now; no invented final check.

Exact oracle facts: cart line Voltbay Official Store, Space Grey, 7-in-1, ships from Spain, x 3; Voltbay coupon
collected; `Cart (3)`; `Orders to be shipped (0)`; nothing bought.

To check (new on this pair, or never exercised since it landed):

- C1 (t377): the pre-send `list-flows` on this 193 MB workspace answers quickly (round 8: over 10 s); dispatch to first
  chat step time (round 6 1.9 s, round 7 7.2 and 10.6 s). Any retry of a Lab read is logged with its endpoint.
- C2 (t377 W2): the persisted trial session rows are far smaller than round 7's 10-15 MB each.
- C3 (t378): any refusal names the model's own script step and line and what to write; did the model fix that line?
  An identical resubmission gets the original issues with candidate advice. A reply missing its closing brace is
  repaired.
- C4 (t368, never exercised): does the script end with an invented confirmation wait/check? If a wait or check fails,
  does the feedback say hidden versus absent and the nearest visible text? Same failure twice is not re-tested.
- C5 (t371): optional steps skipped in playback without spending budget.
- C6 (t373, t378 unit 6): chat cards for save and test steps; choice steps named as choose/tick with the control, not
  "Click" (round 7 U1); Type and Wait cards name their target; ready words plain.
- C7 (t376): onboarding at start; the panel switches to Chat when the Flow runs (trial and Lab playback); Stop and
  Take over present while running; the idle record button neutral, not red.
- C8 (t375): plain run endings, no raw run id in the chat.
- Trials (start reset, each step and attempts, interruptions met and what the feedback said), judge verdicts against
  the private oracle, promotion, chat apply, the Lab's playback and oracle, cost and calls.

Cost: under $0.10 for the build, at most 48 calls.

On a Lab oracle pass with product acceptance: one zero-call `lab replay`, then run 10 on the same pair with its own
debug and replay. On any failure: early-cause message to the supervisor, debug fully and stop; no further paid run.
