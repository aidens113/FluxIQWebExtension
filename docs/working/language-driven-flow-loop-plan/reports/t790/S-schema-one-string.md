# S: extraction schema accepts every text test the grammar allows

Outcome: Done.

Changed: domain/src/actions/extraction/schema.ts (where condition properties), new domain/src/actions/extraction/tests/schema-text-tests.test.ts.

Cause: the schema declared contains/startsWith/endsWith/matches/equals as `type: "array"` only; the grammar (condition-grammar.ts) reads a lone value as a list of one (and a number as its digits for text tests), so Core's schema fit refused a Flow written as documented.
Fix: equals, contains, startsWith, endsWith are `["array","string","number"]` (items string|number for the text three); matches is `["array","string"]` (items string; a number pattern is not a pattern). Booleans, objects and non-string items stay refused.

Commands: tsc (domain) -> no output; test-domain actions/extraction -> 88 pass 0 fail (before test rewrite); test-domain actions/extraction/tests/schema-text -> 3 pass 0 fail; structure-audit -> passed.
Not verified: Core's real fit function (not publicly exported; tests apply its two rules, type-list and items, locally); tsc after the final test rewrite; extension tests (no extraction tests pin the refusal; only extraction-boundary.test.ts exists, not run).
