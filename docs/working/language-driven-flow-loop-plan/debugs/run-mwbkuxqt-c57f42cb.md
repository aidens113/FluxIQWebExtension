# Debug: run-mwbkuxqt-c57f42cb

Status: Failed, not judged. Attempt 1 did the act right (Voltbay Official Store followed, nothing in the cart), but it never stored the asked one-row table. Six judges said no, the loop guard escalated to `ask_person` (stuck_in_a_loop) after 73 calls, and the Lab stopped watching after 600 s (`AttemptProofStuck`). Attempts 2-4 did not run. First live run of this task.
Source: t885 = dev 0871fb237 (extension) / 3766caea6 (Core).
Task: crossborder-marketplace-follow-official-store, unchanged, `--attempts 4`, visible browser. Lab run through `heavy-slot.mjs run t885 --priority`.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Result and distance reached

- Cost $2.7225 (ledger). 55 live steps, 73 calls. Two traffic-screen checks were paused and cleared in place.
- The task asks to "give me a one-row table with column following containing my account's "Followed stores" line exactly as the account writes it, label included". The oracle is one record, `{following: "Followed stores: Hubsmith Global Store; Mirafone Accessories; Qinport Official Store; Voltbay Official Store"}` (`manifest/follow-official-store.ts`).
- The model had the right line in its answer text every time, but stored no row. Judges 0038, 0074, 0077, 0101, 0104 and 0122 each said: the follow landed and the cart is unchanged, but recordSets is empty, and the account text the looks found is cut off.

## Causes (traced read-only; report `mvp-seal-plan/reports/live-checks-r3/one-row-table.md`)

1. **No tool reads one element into a one-row record.** `dom-extract` read the full line (0036, 0072, 0110, 0112), but it answers a string, and Core takes only an array as rows (`answer-first/rows/found-rows.ts`). Extract List needs a detected list. The fixture's own recording reads this element as a one-record read (`fields: {following: ":scope"}`); the model's tools have no equivalent.
2. **Detection could not bind the hidden line's handle** (`handle_not_in_packet`, 0041, 0058, 0095). It binds only through the last page view (`structure/detect.ts`, `tools.ts`). On the visible account control it returned unrelated lists (product options, the home page grid) labelled with that control as target.
3. **What the model and judge saw was cut.** The model's page search cuts words at 80 characters (`page-find/search.ts`, `WORDS_SHOWN`), which breaks the whole-page rule. The judge's `looked` passes the page view after a read rather than what the read returned (`attempt/call-chain.ts` `lookOf`), each cut to 600 characters, and the question calls it "a short cut".
4. Contributing: the account menu opens only on CSS hover, which synthetic clicks never trigger, and there is no hover node.
5. The loop guard worked as designed. After each no the model made new reads, but none could add a row.

## Next

The fixes are routed by owner (lead's message): one element read as a one-row record (domain); detection binding (domain); the model's search shows whole words (domain); the judge gets whole looks of what a call found (Core `call-chain.ts`, `result-verification`, `completion`). Rerun this task at `--attempts 4` once they land.
