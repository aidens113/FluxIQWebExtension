# Debug: run-mwa0t77i-8277ba59

Status: Passed. Both attempts right. First answer-first run of any social-network-feed task.
Source: t885, Core 72829676a (dev + 1657dadda), Extension 843bb9aa3, unchanged since run-mwa0iiha-f3c93e83.
Task: social-network-feed-recent-group-posts, unchanged, `--attempts 2`, visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Result and distance reached

- **Attempt 1, right:** `achieved`, 3 rows stored and shown, 15 live steps, 17 calls, 53% cache, $0.0656, 356 s. The first judge (0028) said no for the right reason: the Flow's read kept 31 unfiltered feed rows, the 3 asked-for posts among them ("The Flow needs a filter on joined groups and the date"). The model amended the draft with the filter (0030-0036) and the next judges (0038, 0039) said yes on 3 rows.
- **Attempt 2, right:** path `run_flow`, the saved Flow whole, 2 calls (the chat and the judge), 7 live steps, $0.0070, 107 s, digest proven. No change on the site.
- Whole run: $0.0727 (ledger), exit 0.

## Observations (not failures)

1. Notes 0040, 0042, 0043: "The instruction's named columns could not be read whole: the column after group, author, posted, text runs on, and none of its leading words is a field this read reads". The narrowed-column log (lane C) firing on the instruction's last column; the oracle still passed, so the column kept was right or not checked. Not traced.
2. A judge no that names the missing filter, followed by an amendment and a yes, is the loop working as designed.

## Next

crossborder-marketplace-free-hubs-under-ten on Sonnet.
