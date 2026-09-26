# t126 — Core name matching (part 1 of 2)

## Outcome

Done. `automationStudioMatchName` is published from
`packages/fluxiq/src/programs/automation-studio/nodes/name-match/` with the
signature the supervisor fixed, and `AutomationStudioNodeRegistry` gained
`matchDefinition`, which resolves a node id by closest match and reports how.
`get()` and `list()` are unchanged. 98 tests pass in
`src/programs/automation-studio/nodes` (15 of them new, plus 3 new registry
cases); `npx tsc --noEmit` is clean.

## What changed and why

### The published contract

`name-match/` holds one exported thing per file with a barrel, re-exported from
`nodes/index.ts`:

| File | Exports |
| --- | --- |
| `value-shape.ts` | `AutomationStudioNameValueShape` |
| `candidate.ts` | `AutomationStudioNameCandidate` |
| `match.ts` | `AutomationStudioNameMatch` |
| `normalize.ts` | `normalizeAutomationStudioName` |
| `edit-distance.ts` | `automationStudioNameEditDistance` |
| `token-overlap.ts` | `automationStudioNameTokenOverlap` |
| `similarity.ts` | `automationStudioNameSimilarity` |
| `score-floor.ts` | `AUTOMATION_STUDIO_NAME_MATCH_SCORE_FLOOR` |
| `match-name.ts` | `automationStudioMatchName` |

The entry point is exactly as briefed:

```ts
export function automationStudioMatchName(
  written: string,
  candidates: readonly AutomationStudioNameCandidate[],
  options?: { valueShape?: AutomationStudioNameCandidate["accepts"] }
): AutomationStudioNameMatch | undefined;
```

**One deliberate widening, for the second worker's benefit.** The package
compiles under `exactOptionalPropertyTypes`, where `accepts?: "text" | ...`
would reject an explicit `accepts: undefined`. A caller building candidates
from parameters it may or may not know the shape of would then have to build
the object two ways. `accepts` is therefore declared
`AutomationStudioNameValueShape | undefined`, a strict superset: anything valid
under the briefed contract is still valid, and `{ id, accepts: maybeShape }`
now compiles too. `options.valueShape` is written as
`AutomationStudioNameCandidate["accepts"]` verbatim, which already admits
`undefined` through indexed access.

### Normalising

Case is folded and `_`, `-`, `.`, `/` and whitespace all collapse to one
separator, as briefed. I added one thing the brief did not ask for, because
measurement said the module was broken without it: **camel-case humps split
too**. Before that change `filterList` scored 0.104 against
`builtin.data.filter-list` and `setVariable` scored 0.110 against
`builtin.data.set-variable` — both far below any workable floor, so two of the
likeliest forms a model writes a half-remembered id in were still refusals.
Splitting the humps (plus the acronym-then-word boundary, so `DOMClick` reads
as `dom click`) moved them to 0.765 and 0.770, and made
`web.output.domExtractList` resolve as `normalized` rather than as a guess.

### Scoring

`0.45 x containment + 0.30 x dice + 0.25 x edit-similarity`, over the
normalised forms, no new dependency. Containment (shared tokens over the
shorter name) leads because the common real miss is a name written short or
long — the right tokens, the wrong amount of namespace: the model writes
`dom-extract-list` where the registry holds `web.output.dom-extract_list`.
Dice stops a long name being carried by one shared token, and Levenshtein is
the only signal that sees a typo inside a token, where both token measures
read zero.

### The floor, and why 0.25

Chosen from measurement, not taste. I probed 24 written names a model
plausibly produces against the real id set (`web.output.dom-*` from the
web-extension domain, plus `builtin.*`), printed the top three matches for
each, and found two bands with a wide gap:

- everything that **should** resolve scored 0.64 or better — `navigate` to
  `web.output.browser-navigate` 0.64, `scroll` to `web.output.dom-scroll` 0.64,
  `compare` to `builtin.logic.compare` 0.68, `for_each` to
  `builtin.control.for-each` 0.73, `wait for text` to
  `web.output.dom-wait_for_text` 0.77, `dom-extract-list` to
  `web.output.dom-extract_list` 0.82, `browser.navigate` 0.80;
- everything **genuinely absent** scored 0.083 or worse — `upload-file` 0.083,
  `sendEmail` 0.070, `screenshot` 0.065, `http.request` 0.065, `banana` 0.045,
  `sleep` 0.036, `x` 0.011, `do the thing` 0.056.

The single case in between was `click-element` to `web.output.dom-click` at
0.338: a name sharing the intent word and nothing else. That one should
resolve — a wrong correction is visible in the run and repairable, whereas a
refusal costs a paid provider call the model demonstrably does not act on
(`run-mug776kx-0214b287`, refused the same way fourteen times without
correcting). So the floor sits inside the measured gap, nearer the absent
band: 0.25 admits the 0.338 guess and rejects the 0.083 one. The reasoning and
the numbers are in the comment on the constant, so the next person changing it
sees what it was fitted to.

### Shape as a tie-break

Ranking adds `+0.02` for a candidate whose `accepts` equals
`options.valueShape`; the **reported** score is the name score before that
nudge, so the number keeps meaning name similarity. 0.02 is smaller than any
difference two meaningfully different names produce, so the shape settles a tie
and never outvotes a clearly better name — `filter-list` with
`valueShape: "number"` still resolves to `builtin.data.filter-list` (0.764)
over `builtin.data.filter-rows` (0.408). `unknown` on either side is treated as
an absence of information, not a shape. Ties with no shape signal keep the
caller's order (first listed wins), so the answer is deterministic.

`exact` and `normalized` are decided before scoring and also prefer a
shape-matching candidate among equals, but no shape can displace a verbatim id.

### The registry lookup

```ts
matchDefinition(nodeId: string, resolution: AutomationStudioNodeRegistryResolution):
  AutomationStudioNodeDefinitionMatch | undefined
```

returning `{ definition, match }`. Its candidates are exactly what
`list(resolution)` already admits, so a correction can never reach a node the
caller could not have run: an importer node out of scope stays out of scope
even when its id is written verbatim. `get()` is untouched and still exact;
`list()` is untouched.

## Commands run and observed results

```
npx vitest run src/programs/automation-studio/nodes
  OK .../name-match/tests/similarity.test.ts (7 tests) 7ms
  OK .../name-match/tests/match-name.test.ts (8 tests) 16ms
  OK .../nodes/tests/canonical-registry.test.ts (9 tests) 16ms
  Test Files  11 passed (11)
       Tests  98 passed (98)
```

Every new test passed on its first run. Coverage of the briefed cases:
exact beats a near match that is listed first, scores 0.805 on its own and is
the only one matching the requested shape; six separator, case and camel-case
variants of `web.output.dom-extract_list` all return `how: "normalized"`,
score 1; `max-items` / `max-value` against `max` are identical on every signal
and are separated only by `valueShape`, with both queries reporting the same
score; seven absent names return `undefined`; an empty candidate list, an
empty name, a blank name and `"..."` are all safe.

```
npx tsc --noEmit
  (no output, exit 0)
```

```
node scripts/structure-audit.mjs
  structure-audit: 1 violation(s) across 1 rule(s).
  FAIL [file-lines] .../runtime/llm/evidence-loop.ts: 889 lines exceeds the 800-line limit.
```

That failure is pre-existing and not mine: `evidence-loop.ts` is unmodified in
the working tree (last touched by commit 68422a1). No finding names any file in
this change. The audit also reports "2 baseline entries can be lowered"; I did
not run `pnpm structure:baseline`, since it rewrites a shared file.

## Not verified

- `pnpm --filter fluxiq build` was **not** run, per the brief — a live run is
  reading Core's `dist`, so nothing here has been compiled into `dist` and no
  consumer outside this package has exercised it.
- No live provider run, and no downstream web-extension check. Nothing calls
  `matchDefinition` yet; the plan-side caller is the second worker's half.
- The floor is fitted to one candidate corpus (the real web `dom-*` outputs plus
  Core's built-ins) and 24 hand-written names. It is evidence, not a guarantee:
  a much larger or much more uniform id set could narrow the gap between the
  two bands.
- `pnpm check` and `pnpm test` at repository scope were not run.

## Open questions or contradictions found

1. **Nothing consumes `matchDefinition` yet.** The refusal path that cost
   `run-mug776kx-0214b287` fourteen calls lives outside the files I own, so this
   half only makes the correction available. Someone has to route the node-id
   refusal through it for the run behaviour to change.
2. **How a correction should be reported to the model is not settled.**
   `match.how` and `score` exist so a caller can say "you wrote X, I ran Y", but
   whether that goes into the conversation, the run record, or both is a
   decision above this module.
3. **`web.output.dom-extract` and `web.output.dom-extract_list` are genuinely
   close**, and a model writing `dom-extract` when it wanted the list form now
   gets a confident exact match on the wrong one. That is correct behaviour for
   a matcher and a naming problem for the node set; worth noting because the two
   ids differ only by a suffix.
4. **One test went into a file the brief did not list as mine**:
   `nodes/tests/canonical-registry.test.ts`, three cases appended. The subject
   (`canonical-registry.ts`) is mine and the repository's rule puts its test in
   that folder, so a new sibling file would have broken the `a/b.ts` to
   `a/tests/b.test.ts` correspondence. The second worker is in
   `flow-bootstrap/plan/`, so there is no conflict.
