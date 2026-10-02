# run-muqbzu32-8691a65e: earbuds, chat-driven, stopped at the $0.10 ceiling with no Flow (2026-10-02, t194 run 13)

- **Run:** `everything-store` / `everything-store-plus-earbuds-under-50`, instance `t194-slot-3`, headed, chat-driven
  (`buildEntry: chat`), default model, no cost flag (Core's ceiling $0.10). Launched 02:12:47 UTC from `fxwork/t194` at dev
  (Core `b369ca14`, downstream `ff175763`: t232's page view, t228's step logs, lane B's rerun-from-replay and repeat
  guards, F29-F39). Step log: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-01/run-muqbzu32-8691a65e/steps/`.
- **Verdict:** failed, `runtime.behavior`, `lab.chat_build_failed`: "The build stopped at its spending limit of $0.10
  before the Flow was finished ... over 15 decisions" (`summary.json` `firstFailure`). No Flow, so no read, judge or repair.
- **Cost:** $0.0738 by the ledger (`finish`, `buildCeilingUsd 0.1`, `buildsOverCeiling 0`), 16 provider calls (1 chat
  intent + 15 decisions, one of them malformed).

## The page the model saw

The supervisor's precondition held: from step 0005 the page view shows `t17 field[search] "Search Brightaisle" =""` and
`t18 button "Go"` (`steps/0005-decide/request.txt:2641-2642`); t232's fix took effect.

## Decisions (step log)

| Step | In tokens (cached) | Out | Cost | What |
| --- | --- | --- | --- | --- |
| 0003 | 16,251 (640) | 97 | $0.0048 | navigate to the start (0002 was the opening capture refused `not_at_start_location`: lane A's) |
| 0005 | 19,376 (12,160) | 86 | $0.0023 | Accept cookies |
| 0007 | 20,139 (12,288) | 93 | $0.0025 | type with a written selector `input[type=search]`: refused `target_not_a_handle` (t228's refusal site) |
| 0009 | 20,326 (13,824) | 68 | $0.0021 | find_on_page |
| 0011 | 20,497 (13,952) | 107 | $0.0022 | type `t17`: refused `target_covered` (the "Never miss a deal" modal) |
| 0013 | 20,732 (12,544) | 85 | $0.0026 | Not now |
| 0015 | 21,099 (12,928) | 103 | $0.0027 | type + submit |
| 0017, 0019 | ~21,000 | ~85 | $0.0050 | snapshot; Continue shopping |
| 0021 | 27,833 (13,568) | 72 | $0.0044 | detect_repeating_structure |
| 0023 | 30,702 (19,328) | 400 | $0.0040 | **malformed**: the reply was JSON, not the decision format (`llm.provider_malformed_response`) |
| 0024 | 31,025 (20,992) | 307 | $0.0035 | read the list: 70 rows, 5 pages, only the ad rule |
| 0026 | 41,355 (13,696) | 469 | $0.0089 | amend + rerun: Plus, rating >= 4, price < 50, not ad, name not contains accessories -> **10 rows** |
| 0029 | 58,368 (15,616) | 473 | $0.0135 | amend + rerun, same conditions (its summary: "drop the name-text filter and use atLeast/atMost") -> 10 rows |
| 0032 | 72,677 (24,960) | 515 | $0.0151 | amend + rerun, "corrected price filter" -> the purse refused the next decision |

Per-call input: min 16,251 / median 21,099 / max 72,677 tokens.

## Causes

1. **The read result is 32-74 k characters, three times over** (lane C). In 0032's request the three reads are 32,034,
   58,213 and 74,330 characters (`extract.results1`, `rerun.12`, `rerun.13`); of `rerun.13`'s 74 k, `rejectedRows` is
   52,201: every row each condition rejected, full fields with 200-character redirect URLs, a row failing three
   conditions listed three times (`domain/src/runtime/llm-evidence/node-run/rejected-rows.ts`, F19's `rowsWithOthers`). The
   request grew 31 k -> 41 k -> 58 k -> 72 k tokens over three decisions and the build ran out of money.
2. **A false "reads as numbers" note drove the reruns** (lane C). Each read carried "where 4 tests the text of name, which
   reads as numbers ($12.99: 3, $24.99: 600, ...); for at least or at most use atLeast or atMost" for the condition
   `name not contains [ear tips, charging case, ...]`: `node-run/numeric-text-filter.ts` takes the first digit run of any
   product name ("Bluetooth 5.3", "50H") as the number the condition compared. The model's next two summaries answer that
   note ("use atLeast/atMost for rating and price", "corrected price filter") while its conditions stay the same.
3. The read itself held 10 of 13: the accessory rule (`charging case`) removed the three true "... with Wireless Charging
   Case" pairs alone (F19 showed them, `rowsAlone`), as in runs 9 and 11. Lane B's rerun fix worked: every rerun read 5 pages
   from page 1 (`paginationStop control_disabled`, 94 seen).
4. **Cache:** after the first amendment the cached share fell to 13.7 k of 41 k, 15.6 k of 58 k, 25 k of 72 k: the prefix
   breaks before the reads (lane B / t193 W2).
5. **The purse's worst case** (all input uncached plus the 8,000-token reply allowance; replies here were 68-515 tokens)
   refused a decision with $0.026 of the $0.10 left (F17; proposal in the lane report, not applied).
6. Other lanes': the opening capture refused `not_at_start_location` (lane A); a written selector refused
   `target_not_a_handle` (t228); a JSON reply counted malformed (Core reply parser).

## UI review

Final frame `screenshots/00013-8c75d3eabe9f.jpg` (side panel open, page 5 of the results behind it): the chat shows each
step with its reasoning ("Updating the draft Flow -- Amending the draft: rerun the extract with a corrected price filter
..."), action cards "Action · the page Done" and "Read list · the page Done" (the card names "the page", not the control
or the list), then the closing message: "'Create an automation here' stopped because the build could not finish. The build
stopped at its spending limit of $0.10 before the Flow was finished. I explored live once over 15 decisions. The Flow so
far was kept ..." and "Open FluxIQ". A toast "Build failed / Build stopped: a budget ran out" sits bottom left over the
page. Defects: the closing message lacks the spent and projected figures F21 adds for a purse refusal (the ending carried
no `costRefusal`, cause traced by t194-w47); cards name "the page" (t191/t174).

## Fixes

F40 (lane C): `rejectedRows` compacted and the numeric-text note held to conditions that compare digits; see the lane
report's Fix log.
