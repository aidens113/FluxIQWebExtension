# A8 runs from launch 8 to frozen pair 1 (archived)

Moved from the A8 Run Plan of `../../automation-project-agents-plan.md` on 2026-10-15 when frozen pair 2
completed. Every result here is superseded by frozen pair 2; each run's debug note is under
`../../language-driven-flow-loop-plan/debugs/`.

**Comparison on one frozen pair** (downstream `24dacba5`, Core `9b4c5a38`; docs-only commits after): round one is
launch 8 above; round two runs `candidate` on the same lanes before any further code merges.

| Task | `project` (launch 8) | `candidate` (round two) |
| --- | --- | --- |
| crossborder-marketplace-hub-to-cart | passed, $0.029 | passed, $0.015 |
| bigbox-retail-pickup-cart | passed, $0.037 | passed, $0.033 |
| social-network-feed-confirm-requests | failed, $0.103 | Flow created, oracle passed; run failed on missing replay call accounting, $0.048 |
| everything-store-plus-earbuds-under-50 | failed, $0.130 | failed, $0.069 (the same judge defect) |

**Pair 2** (downstream `4084cb98`, Core `30dceb9e`, after t598-t602; docs-only commits after):

| Task | `project` | `candidate` |
| --- | --- | --- |
| crossborder-marketplace-hub-to-cart | passed, $0.029 | passed, $0.015 |
| bigbox-retail-pickup-cart | passed, $0.044 | passed, $0.033 |
| social-network-feed-confirm-requests | failed, $0.034: whole test passed; the rate-limit repair was refused (t603) | passed, $0.025 |
| everything-store-plus-earbuds-under-50 | built and applied, whole test passed; the Lab's session listing crashed Core (t604) | passed, $0.034 |

**Wave 3 and round three** (downstream `4d885223`, Core `8d6239a8`, after t603 and t604): `project` social passed
($0.044, its first `project` pass); `project` everything-store failed ($0.128: the whole test held what the subflow
trial accepted; debug in flight); round three `bigbox-retail-pickup-towels` failed in both modes (`project` $0.074,
`candidate` $0.066) on one web-domain defect: the page view drops filter-group legends, so the seller filter was never
recognised (t605, t606 in flight).

**Wave 4** (downstream `b837e4a3`, Core `ef68a8a6`, after t605-t608): `project` everything-store, `project` towels,
`candidate` towels and `project` social all failed at the chat's first model call, $0 each: DeepSeek's API was in an
open incident ("Web/API Partially Unavailable", V4.1 Flash), so no call completed. The first try was refused before
any call (the instruction tasks were named without their scenario prefix, a supervisor error). It exposed one product
defect: the chat's turn stayed open well past its own 24 s bound and the panel showed "Sending your message" (Core
t613). Rerun on the same pair once the incident is resolved.

**Wave 5 canaries** (one run first while DeepSeek's state was unknown): canary 1 (`run-mv8zw5l2`, after t613) found
DeepSeek still down; its chat turn now ended inside its bound, but the build's ending blamed the model and the
supervisor (Core t619). Canary 2 (`run-mv93ywox`, after t619) failed at Lab startup, $0: the gateway server build was
stopped at a fixed 60 s on a loaded machine (downstream t620). DeepSeek's incident closed about 23:20 local.

**Wave 5** (downstream `9f362856`, Core `72487d26`, after t605-t621; all four at once):

| Task | `project` | `candidate` |
| --- | --- | --- |
| everything-store-plus-earbuds-under-50 | **passed**, $0.085 (first `project` pass here; one builder, whole test yes first time) | not run |
| social-network-feed-confirm-requests | failed, $0.063: the whole test passed after a slow-down recovery, the repair came back with the pass standing, and the supervisor's completions were refused for their shape until a guard stall lost the pass (Core t622) | not run |
| bigbox-retail-pickup-towels | failed, $0.176: the oracle's exact 9 rows at step 0051 and three more times, never confirmed: rows a text condition left out are not settled, sponsored copies read as dropped (Core t624) | failed, $0.048: a Flow of 17 rows judged yes; its Next followed an arrow that drops every filter (downstream t623) and the judges missed it |

**Reading of wave 5 (supervisor, 2026-10-15):** the page-view group fixes worked (every facet named, the right ones
ticked, in both modes); what failed is downstream of building: pagination that loses the list's scope, a judge that
cannot confirm a correct text-filtered list, and a completion path that throws away a standing pass. All three are
being fixed; the next wave reruns all three failing runs and `project` everything-store for a consecutive pass.

**Wave 6** (downstream `0638d45f`, Core `95cc9a7d`, after t622-t624):

| Task | `project` | `candidate` |
| --- | --- | --- |
| everything-store-plus-earbuds-under-50 | failed, $0.066: a two-subflow plan; the first builder's allowance ran short ($0.018 left) while the purse held $0.184 (Core t627); its repair was refused before its first turn (t625) | not run |
| social-network-feed-confirm-requests | **passed**, $0.063: whole test yes, the repair refused before its first turn, the rescued pass kept (t622 live) | not run |
| bigbox-retail-pickup-towels | failed, $0.138: the subflow passed, the whole test said no, four repairs refused before their first turn (t625); debug in flight | **passed**, $0.086: the first towels pass; Next took the filter-keeping page number (t623 live), judges saw text-settled rows (t624 live) |

**Reading of wave 6 (supervisor, 2026-10-15):** t622, t623 and t624 each worked live where they applied. Two of
them carried regressions found here: t622's repair context carried the web domain's denied `selector` keys, so every
repair was refused before its first turn (Core t625), and t623 counted a search form's default "All" option as an
applied filter, so a Next on an unfiltered search faulted (downstream t626). A brief's share of the purse could not
grow while the purse had room (Core t627).

**Wave 7** (downstream `e9c2b5f5`, Core `48b45401`, after t625-t628):

| Task | `project` | `candidate` |
| --- | --- | --- |
| everything-store-plus-earbuds-under-50 | **passed**, $0.121 (a second subflow never built; the plan was amended to one) | not run |
| social-network-feed-confirm-requests | **passed**, $0.027 (no repair needed) | not run |
| bigbox-retail-pickup-towels | **passed**, $0.096 (first `project` towels pass; two repairs ran and returned done, then the whole test yes) | failed, $0.058: the exact rows at revision 7, held by nos calling settled rows missing that Core could not refute (Core t629) |

**Reading of wave 7 (supervisor, 2026-10-15):** `project` passed all three tasks on one pair, and the repair loop
worked end to end for the first time. `candidate` towels failed on a shared judge defect (a no claiming rows Core
settled are missing is not refuted); wave 6's `candidate` pass had survived the same misreading by luck. Next: t629,
then wave 8 on its pair, then wave 9 on the same pair if wave 8 finds nothing new, for two consecutive passes per site
on one frozen pair.

**Wave 8** (downstream `003c3353`, Core `be766f29`, after t629 and t630):

| Task | `project` | `candidate` |
| --- | --- | --- |
| everything-store-plus-earbuds-under-50 | **passed**, $0.048 (one subflow, whole test yes first time) | not run |
| social-network-feed-confirm-requests | **passed**, $0.068 (a slow-down repair added the branch, whole test yes again) | not run |
| bigbox-retail-pickup-towels | failed, $0.082: the exact rows four times, 6 of 8 judge calls wrong (Core t631, t632) | failed, $0.020: a Flow of 11 judged yes; the site's "Today" filter also admits delivery and no judge or check caught it (Core t631) |

**Reading of wave 8 (supervisor, 2026-10-15):** `project` passed everything-store and social again (social three in a
row, everything-store two). Towels fails in both modes on the judge: refuting a no by its wording keeps missing new
phrasings, a recurring failure, so t631 refutes a no by the conditions and rows it references against Core's read
account, and t632 holds an upheld exclusion across a subflow's trials.

**Wave 9** (downstream `1ef54cd1`, Core `658d95ff`, after t631-t635):

| Task | `project` | `candidate` |
| --- | --- | --- |
| everything-store-plus-earbuds-under-50 | **passed**, $0.037 (third in a row) | not run |
| social-network-feed-confirm-requests | failed, $0.088: the whole test yes, then repairs and three unsure whole tests; debug in flight | not run |
| bigbox-retail-pickup-towels | **passed**, $0.096 (three repairs, the fourth whole test yes) | **passed**, $0.030 (Core reported `unverified`; the oracle passed) |

**Tally of `project` across waves 5-9 (each wave on its own pair):** everything-store P F P P P, social F P P P F,
towels F F P F P. The default-flip rule wants two consecutive passes per site on one frozen pair for both modes; no
wave has yet been repeated on an unchanged pair.

**Frozen pair** (downstream `112ad66e`, Core `cf928307`, after t636 and t637), waves 10 and 11:

| Task | `project` | `candidate` |
| --- | --- | --- |
| crossborder-marketplace-hub-to-cart | failed, $0.070: overlapping plan parts, an output on an undeclared port, a url-less navigate reported as a policy refusal (Core t638, t639; downstream t640) | **passed**, $0.016 |
| bigbox-retail-pickup-cart | **passed**, $0.042 | **passed**, $0.035 |
| everything-store-plus-earbuds-under-50 | **passed**, $0.036 | **passed**, $0.067 |
| social-network-feed-confirm-requests | **passed**, $0.048 | not run yet |
| bigbox-retail-pickup-towels | not run yet | not run yet |

The crossborder failure is pre-existing (not a regression of t625-t637); its fixes end this frozen pair, so the
comparison restarts on the pair after t638-t640.

**Reading of pair 2 (supervisor, 2026-10-14):** `candidate` passed all four, each for less than `project`; `project`
passed two and built correct Flows for the other two, each lost to a defect of its own machinery (t603) or of a listing
it made too large (t604). `project` still does not beat `candidate`; the default stays `candidate`.

**Reading of rounds one and two (supervisor, 2026-10-14):** on this pair `project` matches `candidate` where both
work (crossborder, bigbox) at a higher cost (about 1.1-1.9x), fails social where `candidate` built a correct Flow, and
both fail everything-store on one shared judge defect. `project` does not yet beat `candidate`, so the default stays
`candidate`. Next: the fixes found here (t598, t599, t601 and the replay accounting), then a fresh pair for both modes.

**Attempts** (each debugged in `language-driven-flow-loop-plan/debugs/<runId>.md` before the next launch):

| Launch | Pair (Core) | Runs | Outcome | Fix |
| --- | --- | --- | --- | --- |
| 1, `project` | after A18 | four runs (run-mv7rkmen, -rm0qo, -rmobk, -rnc14) | none started, $0: all four launched from one lane tree (supervisor setup error) | one lane tree per run |
| 2, `project` | after A18 | three runs (run-mv7rvqfz, -rx3mk, -ryk3v), own trees | none started, $0: the Lab chat was unavailable | t568 SQLite long-path open |
| 3, `project` | after t568 | run-mv7t07hx (crossborder $0.006), run-mv7t19hg (bigbox), run-mv7t2xxc (social $0.024), run-mv7t4ozn (everything-store $0.005) | the supervisor searched like a builder, then every raw plan was refused | t569 planning format, look budget |
| 4, `project` | `e56fec59` | run-mv7vk3ol (crossborder $0.072), run-mv7vl89u (bigbox $0.078), run-mv7vmvhd (social $0.078), run-mv7vor5f (everything-store $0.171) | plans and dispatches work; three ran out of calls, everything-store's subflow trials judged no 4x, unsure 1x (judge reliability, cross-mode) | t570 call shares and brief defaults; the call cap above |
| 5, `project` | `048a1d91`, 250 calls | run-mv816jbn (crossborder $0.003), run-mv8186yr (bigbox $0.094), run-mv819so1 (social $0.003), run-mv81b25e (everything-store $0.003) | first try refused before any call (the Lab took at most 64 calls; t576); then three builds' briefs were sized 77-117 turns and every builder refused its own configuration (loop takes 64); bigbox's builders ran, but no subflow trial could pass (stale trial tab, dependents started early, no honest builder ending) | t577 turns capped at the loop's 64; Core t578-t582 from the bigbox debug |
| 6, `project` | `2db229e9`, 250 calls | run-mv85un8j (crossborder $0.028), run-mv85vjqo (bigbox $0.031), run-mv85xmgq (social $0.040), run-mv85zf4i (everything-store $0.004) | crossborder built a Flow that passed its judged whole run (the first in mode `project`), then Core refused its settings (a 64-call cap); bigbox passed two of three subflows (prepared entry not "arrived"); social could not reset a confirmed request (whole test skips the start hook); everything-store's submit tool description overran its limit | t583, t584 merged; t585-t589 |
| 7, `project` | `6a81a391`, 250 calls | run-mv8c76i3 (crossborder $0.036), run-mv8c7unr (bigbox $0.112), run-mv8cam5t (social $0.056), run-mv8cbm4y (everything-store $0.074) | social's whole test passed and it was adding the rate-limit branch when the Lab's 795 s chat deadline ended it, as it ended bigbox and everything-store; bigbox's whole test ran on a stale page (no shared phase start) and eight repairs changed nothing; crossborder's first builder did the second part's act unrecorded | t592-t596 |
| 8, `project` | `9b4c5a38`, 250 calls | run-mv8i8r0u (crossborder $0.029), run-mv8i94yu (bigbox $0.037), run-mv8ic6mk (social $0.103), run-mv8id5vg (everything-store $0.130) | **crossborder and bigbox passed end to end** (Flow created, oracle passed); social's second subflow never built; everything-store's builder came back partial and its repair was stopped by the build bound | debugs in flight; t598 held to keep the pair frozen |
