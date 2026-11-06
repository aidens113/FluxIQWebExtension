# Debug: run-mw48dtyo-15d7c81a

Status: Passed. Third of three Haiku runs of this task on t875 after fixes A1-A4: Haiku 3 of 3, Sonnet 3 of 3.
Source: t875 branch with A1-A4 (Core 8cbe83056, d623eb929, 1d16c4a77; Downstream 74e5b5560), same source as the Haiku runs before.
Task: company-website-apprentices, unchanged, attempt 1 only, typed into the real extension chat in a visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`, normal guards and no overrides. Instance t875-live, slot-1.

## Result and distance reached

Answer right. Ended `achieved`, 4 rows stored and 4 shown, 18 live steps, 17 model calls, 71% of input from cache, $0.0377, 256 s (336 s launch).

As in run-mw47woi1, Haiku first completed with the unfiltered grid (28 rows). The judge said no (step 35), rightly: "kept 24 non-apprentice rows". The model added the role filter and the next judge call (step 40) said yes. No citation re-ask this time.

## The chat

The card shows the four rows, "I recorded no changes", "Checked: 4 rows, once against what was asked for", "Took 4m 16s · $0.04", and "I got what you asked for, and it was checked once against what you asked."

"Checked once" reads as untrue to a person here: the result was checked twice, a no and then a yes. Either the words mean "one yes", which they do not say, or the count is wrong. Raised with the lead as an open chat-wording question, next to the "Checked: …" line t869 is already fixing. Not traced.

## What this does and does not prove

Haiku on this read: 3 of 3 since the fixes, $0.025-0.038. In 2 of the 3 runs Haiku first forgets the role filter, and the judge catches it every time. Attempt 2 is still held.

## Next

bigbox-retail-napkins-for-delivery on Sonnet.
