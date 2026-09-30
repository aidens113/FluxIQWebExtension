# Rung 1 history to 2026-09-26

Moved from the Current State of `language-driven-flow-loop-plan.md` on 2026-09-30 to keep that section within its budget. Nothing here is current; the live lanes (t194 owns rung 1) carry the present state.

The table below is the earlier ten-run scored/Flow-producing subset, not the complete 18-attempt ledger.

| Time | Id | Calls | Flow | Records observed | Ended as |
| --- | --- | --- | --- | --- | --- |
| 19:35 | `run-muhd1vc7-0ec27a16` | 19 | 5 nodes | 0 of 13 | refuted |
| 20:23 | `run-muher0en-508ddb69` | 25 | 3 nodes | 15, **1 matched** | refuted |
| 00:27 | `run-muhnh0s5-98a27f42` | 32 | 7 nodes, a search | 8, **3 matched in order** | refuted |
| 01:28 | `run-muhpo10p-771abad6` | 37 | — | 0 | refuted |
| 01:57 | `run-muhqop38-997ee8e5` | 27 | — | **55** | refuted |
| 02:17 | `run-muhrf6c4-9714939f` | 18 | — | 0 | refuted |
| 02:33 | `run-muhrz0at-39a25508` | 23 | — | 0 | refuted |
| 03:09 | `run-muht9lpw-a39aa056` | 17 | **1 node, 0 navigation** | 0, never ran | replay died on `about:blank` |
| 03:30 | `run-muhu0tjc-bb62f6f4` | 17 | 3 nodes | 0 | refuted, **and the re-author applied a correction** |
| 03:43 | `run-muhubegx-9469de5e` | 33 | 10 nodes, a search | **43** | refuted, re-author failed `extend_failed` |

**In the fourteen attempts then available, the dominant failure was ours: a wait, not a model.** T143 closed that batch's question by duration alone. Every
extraction read that returned zero records ended at **~2 s** — exactly
`PAGE_STILL_MS`/`EMPTY_PAGE_SETTLE_MS`, the early settle this repository shipped
in `a05134a` at 18:29 on 2026-09-25. Every read that returned rows either found
its list at once or waited much longer:

```
2089, 2576, 2109, 2082 ms                              -> zero records
255, 4631, 6935, 10068, 11082, 14256, 14258, 14264 ms  -> records
```

The fixture's own gates clear on a 4 s timer (`notifications`) and an 8 s timer
(`softCheckAuto`). A page waiting on a `setTimeout` is mutation-quiet and
`readyState: "complete"`, which is the one state `documentStillness` cannot tell
from a finished page — so the read declared the page incapable of producing a list
while the list was still two to six seconds away. **The zero read is a
seventeen-hour-old regression of ours, not a model or draft failure**; t148 was assigned to fix it.

Two corrections to the table above follow from the same reading, and both were
this repository's defects rather than the product's answers:

- `run-muhd1vc7-0ec27a16` **stored 16 rows** and `run-muhrf6c4-9714939f`
  **stored 8**. Both were scored against the wrong record set by the judge pairing
  that `96833cf` fixed at 19:59, after both runs. Their rows were stored and
  published; only the score was wrong.
- `run-muhrz0at-39a25508` read 14264 ms and got rows, then read 2082 ms and got
  none, and stored "0 records across 1 record set". Its two extraction nodes both
  carry a `recordOutput`; the leading hypothesis, not established, is that the
  empty second read replaced the first's rows in a shared dataset.

So of the ten, one never ran (`run-muht9lpw`, no navigation node), two were
mis-scored, one was probably overwritten by its own second read, two read nothing
because of the wait, and two read far too much. **Only `run-muhnh0s5`'s three rows
in the right position remain a real partial answer**, and the two over-wide reads
are the only evidence about filtering that survives.
