# Debug: run-mw4eb5r3-a20f3542

Status: Failed. Attempt 1 right; **attempt 2 repeated a lasting count act**: the cart went from 2 napkin packs to 4. Live proof of the double act the same-words rule exists to prevent. Cause traced provider-free (report `lane-a/same-words-double-add.md` in the Core worktree). Fix A is in Core's act record, with a test. Napkins pairs are on hold until it lands.
Source: t875 branch with A1-A7 plus the uncommitted A8 (records-yes) and the native judge required set (Core d9ca4eea3 + working tree; Downstream cb1cf3caa).
Task: bigbox-retail-napkins-for-delivery, unchanged, `--attempts 2` (the same words typed twice into one thread, no reseed), visible browser.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards and no overrides. Instance t875-live, slot-1.

## Result and distance reached

- **Attempt 1, right:** `achieved`, 2 rows (soap 1 $3.97; napkins 500 Count 2 $11.88), site change exactly `cart:5530103:delivery +2`. 11 calls, $0.2678, 89 s, 69% cache. The judge (0022) said yes with `checked` and `answerRecords {asked: true, siteShows: 2}`.
- **Attempt 2, wrong** (records, final_state, repeated_act, not_shown). The chat started it, so A5 worked. Then:
  1. The saved Flow's run pressed Add to cart before any model call: 2 -> 3. The carried `+` stepper was skipped, so the press added one pack, not two.
  2. The judge (0024) said no: "only one pack was added net, not two". It judged "add two more".
  3. The model added one more (0026-0028): 3 -> 4.
  4. The judge (0031) said yes: "up by 2 (from 2 to 4)".
  5. It ended `achieved` with 2 rows, napkins at 4. 5 calls, $0.1682, 75 s.
- Whole run: $0.436, 678 s. The ledger recorded it (A7 working).

The card reads "I got what you asked for" over a 5-item cart, with "Add to cart (2 times)" and "Saved today: the steps, except the one that did 'Qty' (it was left out of the Flow)". Every line of that is a consequence of the cause below.

## Causes

1. **A carried count act with "room" is pressed again** (the defect). The request "two packs" gives the Add act asked 2. One press after the quantity `+` delivered both packs, so the act record shows landings 1 of 2. Attempt 2's seed carried the act correctly: the same act id and task id; the `+` and "Reject all" were carried as heldOnRepeat and skipped. But `hasRoom` (Core `runtime/answer-first/act-record/record.ts:623-625`) never checks `entry.carried`. So the counting-mode run gate, the by-hand check and `stepDone` all let a carried act at 1 of 2 run again. That contradicts the record's own header (record.ts:110-113, "a carried act reads no count"). Landing it again also dropped the carried flag. Reproduced against the run's Core build.
2. **The judge of a same-words attempt is not told what is already done.** By 0024 the act had lost its carried flag, so no "Already done earlier" line reached the judge. Its question says what held before is no credit. So it asked for two more and pushed the model into a third pack. On dev, t869's change names acts already done earlier; this is to be re-checked there, with a sentence in the Flow-less question if still needed.

The native judge grammar with the required set worked on Sonnet: all three replies carried every key.

## Next

Fix A: a carried act never has room. Add a provider-free test on this shape (a count Add after a stepper, attempt 1 achieved, same words, attempt 2 presses nothing). Then the napkins pair on Sonnet as the live check.
