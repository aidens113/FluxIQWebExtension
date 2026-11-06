# Debug: run-mw3itjcy-ce4429f7

Status: Passed. First paid run on Haiku 5.5, a comparison the person asked for. One run on one task, so no measure of Haiku's reliability.
Source: Core c434fdecc / Downstream 4a489185b.
Task: local-classifieds-save-dining-tables, unchanged, attempt 1, typed into the real extension chat in a visible browser.
Provider: Anthropic claude-haiku-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 1 --llm-cost-ceiling-usd 1`, normal guards and no overrides.

## Result and distance reached

Answer right, ended `achieved`: $0.0766, 39 calls, 29 live steps, 81% of input from cache, 452 s. Exactly three saves, one each on the right listings, no "unsaved", `repeatedActs` empty, `actsWithNoRow` 0. All five saved items cheapest first on the card, `records`, `finalState`, `change` and `shown` all held.

Against Sonnet 5.5 on the same task and source (run-mw3if5xt-a2bc72ae): $0.79, 34 calls, 280 s. Haiku took 39 calls and 62% more time, and wrote 75K output tokens against Sonnet's 23K, which its price more than covers. Every prompt stayed below the 100K line where Haiku's price rises.

## What to watch

1. **It reasoned wrongly once and did not act on it.** At step 69 it said two saves had landed on the wrong listings and that it would save the £30 and £55 tables, which are outside the search radius. Its next acts were a claim and completion, not a press, so nothing happened. A press there would have been a wrong lasting act, and it could have happened on another run. This is the reason one pass is no proof.
2. **Two unusable replies.** Steps 67 and 74 ended `llm.provider_output_invalid`, on a call that followed a read and on the judge. Each was refused and the run went on. The raw text is in those steps' logs.
3. **A weaker judge.** The Flow-less judge ran on Haiku too, as a run takes one model. It answered yes on the second try, and the Lab's oracle independently agrees here, but a person's real task has no oracle. Whether the judge should stay on a stronger model is an open question.
4. **Repeat refusals.** The same no-effect call was refused twice around steps 26 to 30, and the model moved on.

## Still wrong

The card's site lines read "Save. Save. Save." and name no listing.

## Next

Haiku needs a wider sample before any default changes. A breadth round on both models is the person's call.
