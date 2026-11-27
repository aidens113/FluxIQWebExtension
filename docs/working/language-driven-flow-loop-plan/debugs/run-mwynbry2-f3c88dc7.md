# run-mwynbry2-f3c88dc7: bigbox new-store cheapest towels, the saved Flow's replay pressed "+ Add" a second time

Lane: t1015 `paid-bigbox`. Task: `bigbox-retail/bigbox-retail-new-store-cheapest-towels`, answer-first, `--attempts 4`,
no reseed between attempts, visible Chrome, run watcher on. fluxiq 0.54.33 (shared Core `fxwork/!FluxIQ` at
`9c023c281`). Provider: Anthropic `claude-sonnet-5-5` for build and judge. The lead stopped it during attempt 3.
Step files: `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-26/run-mwynbry2-f3c88dc7/steps/`. Debugged offline from the
step files, the Lab log (`bigbox3.log`), the run's own stores (`.attempt-work/run-mwynbry2-f3c88dc7/fluxiq-root/.fluxiq`:
`global.sqlite` row `.../attempt-acts`, `project.sqlite` table `client_gateway_trace_events`) and the code. No live or
paid run was used. Full report: `docs/working/page-diff-delivery-plan/reports/run-mwynbry2-double-add.md`.

## What happened

| Attempt | Calls | What it did |
| --- | --- | --- |
| 1 | 17, $0.65 | Explored. Pressed "+ Add" on the $1.28 roll by hand (call c9, sent 07:16:29). The draft named that step for act `a1` (0029, `"act":"a1"`), and the checklist said `a1.fulfilment` "stood chosen" because Pickup (20) was checked. Judged yes twice (0030, 0031). |
| 2 | 19, $0.54 | Replayed the saved Flow (0032-0044). **Step s11 "+ Add" was pressed again** (0042 has `dispatch`/`pressed click`; gateway event `trace.94bd…#150`, 07:17:33). The cart read qty 2. Judge 0046: no, `act_wrong`, "added twice". The model set Qty to 1 (0048-0049), then spent 0050-0084 getting the stored result to match the page, and ended achieved. |
| 3 | 4+ (stopped) | Replayed attempt 2's Flow. "+ Add" (0096) and the saved Qty fix (0098) were both refused as already done (no `dispatch` span, no gateway event). Judge 0101 said unsure (no rating evidence in the trail), and the model began re-checking the search (0102-0108). |

## Why

1. **The run gate found no carried act for s11, so it pressed it** (`run-gate.ts:162-170`, then `:176-198`).
   - The call has no row (s11 is not in a For Each). For a row-less call, `matches` is "same key" and nothing else
     (`runtime/answer-first/act-record/record.ts:707-709`). The other route, a step name (`record.ts:693`), never applies to a
     by-hand exploration act: only the run-acts and trial-ledger mergers stamp `steps` (`mergers/from/run-acts.ts:15`,
     `trial-ledger.ts:26`).
   - The act record holds attempt 1's "+ Add" as `landed`, `carried`, `doneInAchieved`, keys `d4434560…` and `1702ab3d…`.
     Attempt 2's press went on the record as a new act, stage `run`, with the single key `38367187…`, on the same
     control words (`98b2aa37…`).
2. **The keys differ only by `requiresChosen`** (proven offline, below).
   - The saved node s11 carries `requiresChosen: [{ at: <Pickup (20) checkbox>, words: "Pickup (20)" }]`, which the
     exploration press never had. Compare gateway events `trace.36057d16…#223` and `trace.94bd255b…#150`: the
     `selector` and `element` are identical.
   - `NOT_IDENTITY` (`act-record/identity/target-keys.ts:40`) does not list `requiresChosen`. So it stays in `rest` (`:77`),
     becomes an input (`:78`), and enters the fingerprint key (`:82`) and the place key (`:86`).
3. **Why s11 had `requiresChosen` this time and not in run-mwyfc9uf.** None of t1070-t1073 decided it.
   - This run's build model named the "+ Add" step for `a1` itself. So `a1` had an act step, and `a1.fulfilment`, with no step
     named for it, was credited as stood chosen (`instructed-acts/standing.ts:232-233`, t1023). The assembly then wrote it
     on the node as a precondition (`instructed-acts/chosen-precondition.ts:84-93`, t1030, Core `f2471627c`, 2026-11-24).
   - In run-mwyfc9uf the model named that step only for `a1.fulfilment` (`a1` was `no_step_added`, its 0027 request). So
     there was no act step, no stood credit, and no `requiresChosen`, and the keys matched.
   - t1073's F6 borrowing would not have added one to that naming either: the borrowed step makes the choice itself
     (`standing.ts:225`), so it is not `stood`.
   - So the defect is latent since 2026-11-24. Any saved act step credited with a stood option is pressed again on its
     first replay.
4. **The judge was right, and so was the model's fix.**
   - The words typed again carry every act that landed (t869). So the change attempt 2 was asked to make to the cart was
     none, and qty 2 is a lasting act done twice. "9 to 10 after add 1" does not apply, because the add should not have
     run at all.
   - Setting Qty back to 1 undid exactly this run's own duplicate act, which the reset rule allows.
5. **Why attempt 2 made decisions after the replay.**
   - 0045 `flow_not_proven` (`completion/replay-stands.ts:67`) is by design: attempt 1's Flow came from a by-hand run, so
     its first replay is the judged whole run.
   - Everything after 0046 follows from the double add. 1 call (0048) fixed the cart. 0050-0084, 14 decisions and 3 judges,
     went into making the stored result match the page:
     - the re-run read (0051, 0068) did not replace the stale qty-2 row (0059);
     - three re-runs were refused as `same_draft` (0054, 0062, 0072);
     - the next read left each line twice (0080), and exact duplicates are not collapsed unless a row identity was
       reported (`record-defaults/process-defaults.ts:30-33`). So the model had to declare dedupe (0083).

## Offline proof run

`node <scratchpad>/dbg-mwynbry2/keys-proof.mjs` imports the built `target-keys.js` and keys the forms from this run:

```text
saved node (attempt 1 Flow s11, with requiresChosen)  keys run:3836          | placeKeys new:63f8
saved node without requiresChosen                     keys exploration:d443  | placeKeys exploration:1702
exploration ran-with (element, selector)              keys exploration:d443  | placeKeys exploration:1702
```

The saved node reproduces the run act's key exactly. Remove `requiresChosen` and it reproduces both of attempt 1's keys.

## Next

- Fix A (root): a precondition is not identity. Keep the parameters Core writes onto a step for how it runs, such as
  `requiresChosen`, `ensureState` and `routeSignatures`, in one exported list that the assembly and `target-keys.ts` both
  read. Add a test that every one of them leaves a node's keys unchanged.
- Fix B (structural): at assembly, stamp each by-hand act with the plan key of the draft step its call became
  (`step:s11`), as the trial-ledger merger already does. Then the carry no longer depends on the parameters keeping
  their shape.
- Fix C (secondary): a re-read of the same list at the same address supersedes that list's earlier rows in the result,
  and exact duplicate rows always collapse (user, 2026-11-20).
- Prove A and B on this recording's act record and saved node before any live run. Then rerun this task with
  `--attempts 4`. Accept it only if attempt 2 sends no "+ Add" and makes no call beyond the one `flow_not_proven` judge.
