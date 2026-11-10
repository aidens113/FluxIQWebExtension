# Debug: run-mwaknxf9-7549d126

Status: Failed. Attempt 1 ended `achieved` with a **wrong answer that the judge accepted**: 15 rows, where the oracle expects 16. Attempts 2-4 did not run (a wrong attempt 1 leaves the site in no known state).
Source: t885, Core 89491333a, Extension ba4857f7d (batch 4 committed, dev with t890 round 1 merged), plus the uncommitted next-page `noEffect` line.
Task: bigbox-retail-rated-delivery-towels, unchanged, `--attempts 4`, visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Result and distance reached

- Attempt 1: explore, 50 live steps, 49 calls (interpretation 1, judge 4, decisions 44), 69% cache, $0.1800, 999 s. Lab verdict `wrong` because `records` and `not_shown`.
- **The missing row:** "Loftwell Select-A-Size Paper Towels, 12 Double Rolls", $19.94, 4.7. It is an organic listing the oracle (`qualification/rated-delivery-towels.ts:21`) expects. The 15 stored rows are otherwise exactly the expected ones, in order.
- **The wrong yes:** judge 0114 said yes: "Sponsored listings (Loftwell Select-A-Size, ValueRidge 2-Pack, the first Hearthside 12 Double listing) ... are excluded, and the duplicate Hearthside 12 Double listing appears once." The site lists some products twice, as an ad and as an organic card. The organic Loftwell Select-A-Size was lost and the judge took its absence as the ad's correct exclusion.
- Judges 0043, 0060 and 0101 each said no for named reasons (sponsored rows kept, two rows wrong).
- Calls were cheap but slow: model decisions took 825.7 s of the 1002 s.

## The robot check, seen in a look (second form of the user's complaint)

At 0013-0014, after the "Highest rating" sort (a `web.dom.select`), the after-action look showed the site's robot check ("Robot or human? Press and Hold"). Haiku answered `complete` four times (0015-0022: "Stopping: a robot check blocks the results ... I do not solve it"), and each was refused `nothing_to_judge`. No hand-off was made; the check cleared on its own and the model went on. Traced read-only (report `mvp-seal-plan/reports/live-checks-r3/look-person-check-trace.md`):
- the select's reply came back from the old document, so its landing was never judged (`apps/extension/src/runtime/click-landing.ts:285-315`);
- a look never reports a check (`action-runner.ts`, `click-landing.ts:323-329`), though Core and the domain already pause on a look's person-needed answer;
- the model text "Never solve a robot check (CAPTCHA); say that one blocks you" (`domain/.../system-instructions/instructions.ts:81`) tells it to stop.

## Next

1. The look carries the person-needed signal and a self-clearing check is waited out; the select's landing is judged; the model text says FluxIQ pauses. The extension files wait on the lead's clearance (t891's paths).
2. Trace the dropped organic row and the judge's yes on it (likely: duplicate names across ad and organic cards, deduped before or after the ad filter).
3. Rerun this task at `--attempts 4`.
