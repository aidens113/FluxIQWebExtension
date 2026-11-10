# Debug: run-mwa0iiha-f3c93e83

Status: Passed. Both attempts right, no second collection. The live check of lane B's fixes: attempt 1's steps were saved this time (agreeing witnesses resolve) and attempt 2 ran them; looks reach the judge.
Source: t885, Core 72829676a (dev + 1657dadda), Extension 843bb9aa3, unchanged since run-mwa05th9-c29bd97a.
Task: photo-social-kiln-notes, unchanged, `--attempts 2`, visible browser.
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards, no overrides. Instance t885-live, slot-1.

## Result and distance reached

- **Attempt 1, right:** `achieved`, 3 rows stored and shown (Kitchen 3, Studio inspo 5, Kiln Theory notes 2), 20 live steps, 22 calls, 81% cache, $0.4587, 181 s. One decision call timed out at the provider (0025, `llm.provider_timeout`) and the next call carried on. Judge 0043 yes (native schema; Sonnet filled only the required keys, `summary: "Yes."`).
- **Attempt 2, right:** found "The Kiln Theory notes collection made" already done; no change on the site. Path `run_flow_then_explore` from attempt 1's saved steps (digest proven): the saved Flow stopped at step 17 (0045, `web.output.dom-click` `target_not_found`), the model took a snapshot to see whether the New collection dialog was still open (0047) and finished by exploring. 18 live steps, 9 calls, 69% cache, $0.2267, 139 s. Judge 0063 yes: "The collection was created with the two saved Kiln Theory posts, and nothing else was added."
- Whole run: $0.6854 (ledger), exit 0.
- **Looks reach the judge:** both judge requests carry `looked:` entries (where, and the page view found there, e.g. the Saved page with the New collection dialog), beside `endView`.

## Observations (not failures)

1. **Second sighting of a saved step that depends on a skipped carried act** (first: napkins run-mw9x529c-557f5402, step 8 "View cart"). Here step 17 was a press inside the New collection dialog that attempt 2 never opened, because the collection act was carried. Each time attempt 2 pays a recovery (here 9 calls, $0.23; napkins 6 calls, $0.17) where a Flow that skipped the carried act's own follow-on steps, or routed by page state, would need only the judge. A candidate structural fix for the lead (the act record knows which steps served a carried act).
2. Attempt 2's judge saw the carried act as "Already done earlier: Done", with no item words (still-open item 3).

## Next

Breadth: social-network-feed on Haiku.
