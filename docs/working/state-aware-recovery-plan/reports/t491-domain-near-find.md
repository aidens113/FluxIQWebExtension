# t491 domain half: page search returns close matches

## Outcome

Done. `web.find_on_page` (and `web.recovery.find_on_page`) still lists exact substring matches first, unchanged and
paged by fifty. Once the exact matches are all shown, it lists up to ten close matches. Each is marked `near` and says
which query words it lacks.

## What changed and why

- `domain/src/runtime/llm-evidence/page-find/near.ts` (new): `webLlmNearMatches(elements, query, exact)`.
  - Comparison: case-insensitive over `[\p{L}\p{N}]+` tokens, so punctuation is ignored.
  - Dropped words: stop words (a, an, and, at, by, for, from, in, of, on, or, the, to, with) and lone letters
    (digits are kept). A trailing plural `s` is dropped from words longer than three letters (but not `ss`).
  - An element's words are its `name`, its `ownText` (or `text` when it has no separate own text) and its `label`.
    A container whose words all belong to its children is therefore not listed again.
  - Close when the element holds at least two query words, and either holds at least half of them or is made only of
    query words. The second case covers a variant chip that carries part of the name.
  - Ranked by words held (descending), then page order. Capped at 10. No edit distance, so the result is
    deterministic.
  - The query needs two or more significant words, so a one-word query has no close matches.
- `page-find/search.ts`:
  - After the exact lines it adds `N close match(es), holding most or part of those words but not as written:` and
    then one line per close match, in the same format as exact matches: `tN kind "words" near, lacks "250 Count" <where>`.
    It prints `near, holds every word` when only the word order differed.
  - When the list was capped, it adds `K more close matches not shown; search fewer words to narrow them.`
  - Close matches appear only on the page of the answer where the exact matches run out.
  - When there are no exact matches but there are close ones, the empty-search note says "Nothing on this page holds
    those words as written, ... the close matches below hold most or part of them." The site-search hint stays. With
    no close matches, the note is unchanged.
- The tool descriptions are in the domain, not Core. One sentence was added to each:
  - `domain/src/runtime/llm-evidence/tools.ts` (`web.find_on_page`)
  - `domain/src/runtime/llm-evidence/harness-options/options.ts` (`web.recovery.find_on_page`)
- `page-find/tests/search.test.ts`: three new tests on a generic fixture (desk / mug / rack, no scenario names):
  - an exact-title decoy, a near tile and a variant chip, with ranking and lacks;
  - case, punctuation, plural and stop-word handling, plus one shared word not being close and a word-less
    container not listed;
  - the cap of 10 with the "more" line, determinism, close matches only after the exact matches run out, and a
    one-word query giving none.

## Commands run and observed results

- Fail-first: `DOMAIN_TEST_BUILD_LABEL=t491-near node scripts/test-domain.mjs page-find/tests/search` (in `domain/`),
  run before the implementation, gave `# tests 11 / # pass 8 / # fail 3`.
- After the implementation: `DOMAIN_TEST_BUILD_LABEL=t491-near node scripts/test-domain.mjs page-find llm-evidence/tests`
  exited 0 with `# tests 223 / # pass 223 / # fail 0`.
  - The first run after the implementation failed one assertion because of a fixture bug: an `a` with no href prints
    as `a`, not `link`. I added an href to the fixture.
- `npx tsc -p tsconfig.json --noEmit` exited 0, and `npx tsc -p tsconfig.test.json --noEmit` exited 0 (both in `domain/`).
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (188 warning(s), 646 baselined)`.
  - It also printed "1 baseline entries can be lowered". That entry is not from these files: `.structure-baseline.json`
    was already modified in the main checkout.
  - The only warning on a touched file is the existing `tools.ts` 799-line advisory. Its line count did not change.

## Not verified

- No live run, Lab run or provider run, as the brief required. Whether the model acts on `lacks "..."` by looking for
  an option control is untested.
- No full suites.
- How noisy close matches are on large real pages (for example nested elements that repeat one title) was not
  measured. The cap of 10 bounds it.

## Open questions or contradictions found

- The brief's example says "lacks '250 Count'". In the run's actual case, the tile "..., 100 Count" holds "Count", so
  its line would read `lacks "250"`. The size chip "250 Count" is listed as a near fragment that lacks the name words.
- The cap (10) and the rule (at least 2 words held, and at least half held or made only of query words) are my
  choices. Neither is a user rule.
