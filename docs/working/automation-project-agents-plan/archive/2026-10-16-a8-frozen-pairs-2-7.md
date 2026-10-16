# A8 frozen pairs 2-7 (archived 2026-10-16)

Moved from the A8 Run Plan of [automation-project-agents-plan.md](../../automation-project-agents-plan.md) when the plan passed 800 lines; frozen pair 8, on which the default flip rests, stays there.

**Frozen pair 2** (downstream `805f7cbd`, Core `797452c1`, after t638-t640; docs-only commits after), waves 12-16, the
five A8 tasks in both modes, twice, no product change between:

| Task | `project` 1 | `project` 2 | `candidate` 1 | `candidate` 2 |
| --- | --- | --- | --- | --- |
| crossborder-marketplace-hub-to-cart | passed $0.081 | passed $0.022 | passed $0.014 | passed $0.015 |
| bigbox-retail-pickup-cart | passed $0.030 | failed per the Lab $0.040: the product succeeded and the oracle passed; a bypassed optional step was read as the run's failure (t641-t643) | passed $0.037 | passed $0.034 |
| everything-store-plus-earbuds-under-50 | passed $0.043 | passed $0.051 | passed $0.053 | passed $0.052 |
| social-network-feed-confirm-requests | passed $0.065 | passed $0.054 | passed $0.035 | passed $0.016 |
| bigbox-retail-pickup-towels | passed $0.080 | passed $0.060 | failed $0.066 (Core t641) | refused by the unchanged guard (round 1 failed on this source) |

**Reading of frozen pair 2 (supervisor, 2026-10-15):** `project` passed 9 of 10 by the Lab's verdict and 10 of 10 by
the product and the oracle; `candidate` passed 8 of 9 and cannot pass towels twice on this pair. `project` is at least
as reliable on every task and more reliable on towels, at a higher mean cost ($0.053 against $0.036 a build; $0.85 for the 19 runs). The strict rule
(two consecutive Lab passes per site, both modes, one frozen pair) is not met for `project` bigbox cart because of the
Lab misread, so the default is not flipped on this pair: t641-t643 fix the three defects it found, and frozen pair 3
repeats the comparison to decide the flip.

**Frozen pair 3** (downstream `8b770037`, Core `8b322a95`, after t641-t644; docs-only commits after), waves 17-21, the
five A8 tasks in both modes, twice, no product change between:

| Task | `project` 1 | `project` 2 | `candidate` 1 | `candidate` 2 |
| --- | --- | --- | --- | --- |
| crossborder-marketplace-hub-to-cart | passed $0.020 | (w19) | passed $0.014 | (w19) |
| bigbox-retail-pickup-cart | failed $0.120: the supervisor ended the build, no Flow (debug `a8-bigbox-cart-run-mv9zn5ob-debug.md`) | (w20) | passed $0.029 | (w20) |
| everything-store-plus-earbuds-under-50 | (w18) | (w20) | (w18) | (w20) |
| social-network-feed-confirm-requests | (w18) | (w21) | (w18) | (w21) |
| bigbox-retail-pickup-towels | (w19) | (w21) | (w19) | (w21) |

**Frozen pair 3 stopped after wave 17 (supervisor, 2026-10-15).** `project` bigbox cart failed on a cause general to
`project` mode (a plan's invented hand-off value, then an amendment that dropped the person's first request; the
debug `reports/a8-bigbox-cart-run-mv9zn5ob-debug.md`), so further `project` runs would fail predictably on a known
defect, and this pair can no longer meet the two-consecutive-passes rule. t645-t649 fix the chain and the chat cards
it showed; frozen pair 4 starts once they are merged.

**Frozen pair 4** (downstream `9c1e164d`, Core `0df06e34`, after t645-t649; docs-only commits after), waves 22-26,
bigbox cart and towels first, the five A8 tasks in both modes, twice, no product change between:

| Task | `project` 1 | `project` 2 | `candidate` 1 | `candidate` 2 |
| --- | --- | --- | --- | --- |
| bigbox-retail-pickup-cart | passed $0.036 (3 subflows) | (w24) | passed $0.031 | (w24) |
| bigbox-retail-pickup-towels | passed $0.030 | (w25) | failed $0.036: a kept-condition refusal's invited resend was refused by the repeat guard (debug `a8-towels-run-mva446jf-debug.md`) | (w25) |
| crossborder-marketplace-hub-to-cart | (w23) | (w25) | (w23) | (w25) |
| everything-store-plus-earbuds-under-50 | (w23) | (w26) | (w23) | (w26) |
| social-network-feed-confirm-requests | (w24) | (w26) | (w24) | (w26) |

**Frozen pair 4 stopped after wave 22 (supervisor, 2026-10-15).** `project` passed both runs (bigbox cart with three
subflows, the task it failed in wave 17; towels). `candidate` towels failed on two general Core defects from t641's
path (debug `reports/a8-towels-run-mva446jf-debug.md`): the invited resend of a kept-condition refusal is refused by
the repeat guard, and a condition testing a row's own name was vindicated. Either can end a build in either mode, so
later waves would fail predictably. t650 and t651 fix them; frozen pair 5 starts once they are merged.

**Frozen pair 5** (downstream `ee0723db`, Core `8c39a3f7`, after t650-t651; docs-only commits after), waves 27-31,
bigbox cart and towels first, the five A8 tasks in both modes, twice, no product change between:

| Task | `project` 1 | `project` 2 | `candidate` 1 | `candidate` 2 |
| --- | --- | --- | --- | --- |
| bigbox-retail-pickup-cart | passed $0.052 (2 subflows) | (w29) | passed $0.038 | (w29) |
| bigbox-retail-pickup-towels | failed $0.067: whole-Flow trial unsure, judges disputed a 9-row read (debug `a8-towels-run-mva6mlo8-debug.md`) | (w30) | failed $0.083: out of time after 8 trials, same dispute | (w30) |
| crossborder-marketplace-hub-to-cart | (w28) | (w30) | (w28) | (w30) |
| everything-store-plus-earbuds-under-50 | (w28) | (w31) | (w28) | (w31) |
| social-network-feed-confirm-requests | (w29) | (w31) | (w29) | (w31) |

**Frozen pair 5 stopped after wave 27 (supervisor, 2026-10-15).** Bigbox cart passed in both modes; towels failed in
both, on general judging gaps, not a t650/t651 regression (debug `reports/a8-towels-run-mva6mlo8-debug.md`): every
9-row read matched the oracle, the judges disputed it with nothing real, and Core could not answer (an unlabelled
split, kept conditions only from a double no, nothing recorded of what a site filter left out, unseen-row claims not
refuted, looping judge replies lost at the output ceiling). Pair 4's project towels pass was a lucky judge draw. Core
t652-t654 fix them; frozen pair 6 starts once they are merged.

**Frozen pair 6** (downstream `49b65bc9`, Core `4e51c1da`, after t652-t655; docs-only commits after), waves 32-36,
bigbox cart and towels first, the five A8 tasks in both modes, twice, no product change between:

| Task | `project` 1 | `project` 2 | `candidate` 1 | `candidate` 2 |
| --- | --- | --- | --- | --- |
| bigbox-retail-pickup-cart | passed $0.094 (2 subflows; peak price) | (w34) | failed $0.191: playback closed the Flow's own store picker (debug `a8-bigbox-cart-run-mvac0ddx-debug.md`) | (w34) |
| bigbox-retail-pickup-towels | failed $0.190: never converged, budget spent (debug `a8-towels-run-mvac0nmw-debug.md`) | (w35) | failed $0.242: Flow correct (oracle passed) but Core's post-playback check refuted it (debug `a8-towels-run-mvac1av6-debug.md`) | (w35) |
| crossborder-marketplace-hub-to-cart | (w33) | (w35) | (w33) | (w35) |
| everything-store-plus-earbuds-under-50 | (w33) | (w36) | (w33) | (w36) |
| social-network-feed-confirm-requests | (w34) | (w36) | (w34) | (w36) |

**Frozen pair 6 stopped after wave 32 (supervisor, 2026-10-16).** `project` bigbox cart passed; the other three failed
on general causes: a playback recovery that closed a layer the Flow's own step opened (cart, `candidate`), a correct
towels Flow refuted by Core's post-playback check though the oracle passed (`candidate`), and a towels build that
never converged within its purse (`project`). Wave 32 ran at peak price (02:17 UTC): the same tokens cost twice wave
27's (23:46 UTC), so costs are not comparable across the two waves; the failing builds also made two to three times
the calls. t656 (clearing spares run-opened layers) and t657 (playback steps record routing and cleared layers) are in
flight; the towels fixes follow their debugs.

**Frozen pair 7** (downstream `813a3340`, Core `917ca845`, after t656-t662; docs-only commits after), waves 37-41,
bigbox cart and towels first, the five A8 tasks in both modes, twice, no product change between:

| Task | `project` 1 | `project` 2 | `candidate` 1 | `candidate` 2 |
| --- | --- | --- | --- | --- |
| bigbox-retail-pickup-cart | passed $0.043 (2 subflows) | (w39) | passed $0.033 | (w39) |
| bigbox-retail-pickup-towels | passed $0.033 | (w40) | failed $0.123: a false build yes on wrong rows, refuted after playback (debug `a8-towels-run-mvahlxuu-debug.md`) | (w40) |
| crossborder-marketplace-hub-to-cart | (w38) | (w40) | (w38) | (w40) |
| everything-store-plus-earbuds-under-50 | (w38) | (w41) | (w38) | (w41) |
| social-network-feed-confirm-requests | (w39) | (w41) | (w39) | (w41) |

**Frozen pair 7 stopped after wave 37 (supervisor, 2026-10-16).** `project` passed both runs (bigbox cart, towels) and
`candidate` bigbox cart passed; `candidate` towels failed on a general Core gap (debug `reports/a8-towels-run-mvahlxuu-debug.md`):
a yes is checked only against rows left out, never rows kept, so a re-ask after Core refuted the nos' wrong reasons
turned them into a false yes on a wrong row; and t662's playback hold, had it fired, would have set aside two correct
nos. Both are correctness risks in every list task in either mode, so the pair stops for t663 and t664.

