# x-identifierless — the identifier-less mode, and what it measures

Worker `x-identifierless`, 2026-09-12. Three fixtures gained an identifier
policy axis; the audit's two predicted numbers are now measurements.
`EXTENSION_TEST_BUILD_LABEL=x-identifierless` was set for every extension
command. No `pnpm lab`, no `pnpm build` at the root. Nothing in
`content/identity/`, `resolve-target.ts`, `domain/` or `packages/` was changed.

## Outcome

**Done.** All three fixtures — `admin-console`, `storefront-checkout`,
`member-directory` — carry the mode; the audit's arithmetic is now observed;
and the observation is worse than the audit predicted.

**The finding, first, because it is a live safety defect.** On an
identifier-less recording the unopposed near-miss — a *different action* whose
label merely contains the recorded one — scores **0.633 and resolves**. The
resolver clicks it. The audit predicted ≈0.57 and a second analysis put it at
0.359–0.398; all three clear the 0.35 floor, and the measurement is the highest
of the three. **I did not change the floor, the veto or Core's weights.**

## 1. The audit's two predictions, measured

Method in §4. The faithfulness cross-check comes first: against an **authored**
recording the same probe reproduces the numbers `score.ts:92-116` and
`v-core-scoring.md` publish — 0.389 and 0.088 — to three decimals. The probe is
Core's own matcher, so the rows below it are too.

| Case | Recording | Pool | Score | Resolver | vs floor 0.35 |
| --- | --- | --- | --- | --- | --- |
| drift (`reworded-aria`) | authored | 2 | 0.389 | resolved | clears by 0.039 |
| drift (`reworded-aria`) | **identifier-less** | 2 | **0.690** | resolved | clears by 0.340 |
| near-miss ("Save changes and exit", unopposed) | authored | 1 | 0.088 | **refused** | 0.262 under |
| near-miss ("Save changes and exit", unopposed) | **identifier-less** | 1 | **0.633** | **resolved** | **clears by 0.283** |

Measured twice, whole probe re-run, identical both times.

| | audit §3.1-§3.2 predicted | second analysis | **measured** |
| --- | --- | --- | --- |
| drift | 0.690 | — | **0.690** — exact |
| near-miss | ≈0.55–0.60 | 0.359–0.398 | **0.633** — higher than both |

**The number that matters is not either score but the gap between them.** The
floor works today because the drift case and the near-miss sit 0.301 apart with
0.35 inside the gap. On an identifier-less recording they sit **0.057 apart**,
and the floor is below both:

| | drift | near-miss | separation |
| --- | --- | --- | --- |
| authored recording | 0.389 | 0.088 | **0.301**, floor inside |
| identifier-less recording | 0.690 | 0.633 | **0.057**, floor below both |

The mechanism is visible in the per-signal detail and is exactly the one
`L-veto-recordings.md:120-131` describes. Both cases report the same five
matched signals (`visibleText`, `accessibleName`, `role`, `tagName`,
`visibility`). The authored near-miss is refused because its id and test id
*contradict* the recording — −0.8 × 54 — and because those 54 points are in the
denominator. Remove the identifiers from the recording and the near-miss has
nothing left to contradict: it loses the penalty and the denominator together,
and rises 0.545 while the drift case rises 0.301.

**Why it is a defect and not a fixture artefact.** Level 2 runs only when every
Level 1 strategy has missed, which on a thin recording is the ordinary case.
`score.ts:96-101` names this exact scenario as the reason the floor was kept at
0.35 — "a single unopposed 'Save changes and exit' at 0.088 … on a page where it
is the only candidate left and the margin below therefore cannot protect
anything". At 0.633 the floor admits it, and there is no runner-up for the
margin to catch. The refusal that justified the constant does not happen on the
recordings production generates.

**What bounds it.** The danger needs a *thin pool*. On all three realistic
fixtures the pools are 15–60 and the margin refuses instead (§3). So the
exposure is pages where the recorded control's neighbours are gone — a filtered
list, a completed step, a one-control dialog — not every page.

## 2. What "identifier-less" means here, and why

Two policies, not one, because they are not the same deploy and they do not
measure the same thing. Both are in
`apps/scenario-lab/src/identifier-policy/policies.ts`.

- **`no-test-ids` — the ordinary production build.** No `data-testid`,
  `data-test` or `data-cy` anywhere; **every `id` left exactly as authored**,
  because a build has no reason to touch one. This is the common case and the
  one the audit's §2.1 argues from.
- **`no-identifiers` — a component library with generated ids.** The above, and
  every author-stable `id` replaced by an opaque token in React's `useId` shape
  (`:r0:`), with every `for`, `aria-labelledby`, `aria-describedby`,
  `aria-controls` and same-document `href` rewritten to match.

**Both were needed, and the measurement proves it rather than assuming it.**
The audit's §5.1 asks for one mode with neither identifier. For *buttons* one
mode suffices — these fixtures' buttons carry no `id`, so removing the test id
already puts them in the 88-point regime. For *inputs* it does not:
`member-directory`'s search box keeps `id="member-search"`, so under
`no-test-ids` Level 1 still resolves it by `#member-search` and nothing changes.
Only `no-identifiers` reaches it — and it reaches it in a way neither I nor the
audit predicted, by making the identifier **contradicted** rather than absent
(§3.3).

**Why the attribute is renamed, not deleted.** `no-test-ids` rewrites
`data-testid` to `data-fx-node` (and `data-test`/`data-cy` to their own names,
so an element carrying two does not end up with one attribute twice). This is
the one judgement call in the transform, so: a fixture's client script finds its
own controls with `document.querySelector('[data-testid="…"]')` because a
fixture has no framework to hold a ref for it. A real application holds the node
and needs no attribute. **Deleting the attribute would not model a production
build — it would break the page.** Renaming models it exactly: the wiring
survives and the DOM carries nothing any recorder in this repository can see.
Verified against the code rather than assumed — `selectorFor`
(`describe-element.ts:104-109`) prefers `#id`, then `[data-testid]`, then
`[name]`, then a positional chain; `candidateFingerprint` reads the same set;
and the descriptor's `attributes` allowlist
(`describe-element.ts:94`) names `data-testid`, `data-test` and `data-cy` and no
other data attribute. The audit's constraint is written in terms of those three
attribute names, and the transform satisfies it by construction.

The transform runs over the **whole served document, script included**, because
these fixtures build rows, panels and dialogs in the browser from the same
attributes the markup uses. A transform that saw only the markup would leave
every client-rendered control labelled.

## 3. The three fixtures, measured on the real page

Each fixture served by a real Scenario Lab, in real Chromium at 1280×720,
scored by the real matcher. "Production build" = `no-test-ids`, "generated-id
build" = `no-identifiers`.

### 3.1 `storefront-checkout` — the margin does the work, and refuses

Target `continue-to-address`; pool 15, three near-identical "Continue to…"
buttons.

| Case | Top | Runner-up | Margin | Outcome |
| --- | --- | --- | --- | --- |
| authored recording, authored page | 1.000 | 0.310 | 0.690 | resolved |
| **authored recording → production build** | 0.569 | 0.492 | **0.077** | **ambiguous** |
| production recording, production page | 0.792 | 0.689 | **0.103** | **ambiguous** |

Level 1: the recorded `[data-testid="continue-to-address"]` matches **0**
elements on the production build, so Level 2 runs and refuses. This is the
audit's §3.3 — "complexity degrades this resolver toward over-refusal, not
toward wrong clicks" — measured for the first time on a realistic page. It is
the safe direction, and it is also unusable: a production recording cannot
resolve its own target on an unchanged page once Level 1 misses.

### 3.2 `admin-console` — repeated row actions tie at zero

Target `nav-settings`; pool 23.

| Case | Top | Runner-up | Margin | Outcome |
| --- | --- | --- | --- | --- |
| authored recording, authored page | 1.000 | −0.105 | 1.105 | resolved |
| authored recording → production build | 0.584 | −0.079 | 0.663 | resolved |
| production recording, production page | 0.801 | −0.073 | 0.874 | resolved |

A distinct label survives the identifier collapse comfortably. The row actions
do not: the virtualised list's 15 mounted **"Row actions"** buttons (`⋯`, one
`aria-label`, no test id, no id) score **0.801 against 0.801, margin 0.000,
`ambiguous`** — under *every* policy, because those buttons never carried an
identifier to lose. That is the audit's §5.1 "repeated row actions with no
per-row label", now in the corpus and now measured, and it confirms §3.3's
prediction that a grid is always `TARGET_AMBIGUOUS`.

### 3.3 `member-directory` — a generated id contradicts, and refuses

Target `member-search`, an `<input>` that carries **both** an `id` and a test
id. Pool 60 of 147 examined.

| Case | Top | Runner-up | Margin | Level 1 | Outcome |
| --- | --- | --- | --- | --- | --- |
| authored recording, authored page | 1.000 | 0.266 | 0.734 | `#member-search`, 1 hit | resolved |
| authored recording → production build | 0.777 | 0.266 | 0.511 | `#member-search`, 1 hit | resolved |
| **authored recording → generated-id build** | **0.306** | 0.266 | **0.040** | **0 hits** | **unmatched** |
| production recording, production page | 1.000 | 0.359 | 0.641 | 1 hit | resolved |
| generated-id recording, generated-id page | 0.835 | 0.359 | 0.476 | 1 hit | resolved |

The third row is the one worth keeping. A build that generates its ids does not
merely thin the recording, it **contradicts** it: the recorded `#member-search`
matches nothing, and Core charges −0.8 for the disagreeing identifier rather
than −0.1 for a missing one, so the score lands at 0.306 — *below* the floor —
and the resolution is refused where the same drift with the id simply absent
resolves at 0.777. Missing and contradicted are 0.471 apart here.

**`MAX_CANDIDATES = 60` binds for the first time in this corpus.** This page has
253 buttons; the enumeration examined 147 and reported `truncated: true`. Every
capacity bound the audit listed as "declared but unexercised" (§1) is still
unreached except this one, which is now reached by a fixture.

## 4. How this was measured

A probe in the scratchpad, written nowhere into the repository. It bundles the
**real** `content/describe-element.ts` and `content/identity/` with esbuild and
the extension build's own workspace aliases, loads the page in real Chromium at
the content harness's viewport, reads the recorded descriptor with the real
`describeElement`, and enumerates and scores with the real
`collectTargetCandidates` / `scoreTargetCandidates` / `scoreTargetCandidate`.
Fixture pages are served by a real `startScenarioLab`, as the content harness
serves them, and each policy is armed through the fixture's own
`set-identifiers` mutation and a reload.

Its faithfulness is not asserted: against the authored recording it reproduces
0.389 and 0.088, which are the numbers `score.ts` and `v-core-scoring.md`
publish from a different harness.

**It does not call `resolveTarget`.** I added that import and removed it again:
`resolve-target.ts` was mid-edit by another worker and had a syntax error at
line 447 at the moment I built. Level 1 is therefore reported as a direct
`document.querySelectorAll` of the recorded selector — the same query
`element-finder.ts:14` makes — and not as the resolver's own traversal. The
Level 2 numbers are the resolver's, since it applies the same
`scoreTargetCandidates` with the same floor and margin.

## What changed and why

| File | Change |
| --- | --- |
| `apps/scenario-lab/src/identifier-policy/policies.ts` | **New.** The three policies and what each models. |
| `…/identifier-policy/apply.ts` | **New.** `applyIdentifierPolicy(document, policy)` — the test-id rename, the id generation, and the reference rewrite that keeps the accessibility tree intact. |
| `…/identifier-policy/index.ts` | **New.** Barrel. |
| `…/identifier-policy/tests/apply.test.ts` | **New.** 5 tests: identity under `as-authored`; no test id survives; ids untouched by `no-test-ids`; ids generated and every reference rewritten by `no-identifiers`; a runtime-composed id left whole; and reference integrity under every policy. |
| `…/scenarios/admin-console/{types,state,markup}.ts` | `identifiers` on the state, `set-identifiers`, one call in `renderConsoleDocument`. |
| `…/scenarios/admin-console/tests/scenario.test.ts` | 3 tests appended. |
| `…/scenarios/storefront-checkout/{state,mutate,markup,payment-frame}.ts` | The same, plus the card frame, which is a second document and needed its own call. |
| `…/scenarios/storefront-checkout/tests/scenario.test.ts` | 3 tests appended. |
| `…/scenarios/member-directory/{types,state,markup}.ts` | The same. |
| `…/scenarios/member-directory/tests/scenario.test.ts` | 3 tests appended. |

**The policy is a separate axis from each fixture's existing mode/variant, and
composes with it.** `admin-console`'s `variant` and `member-directory`'s `mode`
change what the console *is*; the policy changes only what a recorder can see of
it. Arming either leaves the other alone, and each fixture's tests assert that
both ways round. Arming a policy resets the run's changes, as every armed
fixture here does, so a run never records half of one rendering and half of
another.

**Two ownership widenings, reported rather than hidden.**

1. `apps/scenario-lab/src/identifier-policy/` is a new shared module outside my
   brief's Owns line. The transform is genuinely generic — which attributes a
   build removes is a fact about the recorder, not about any page — and three
   copies of eighty lines is the duplication the repository's own structure
   rules forbid. The directory is new, so it collided with nobody.
2. `member-directory` was still being written when I reached it. See below.

**Concurrency.** All three directories had active owners. I checked timestamps
before every write and worked in the order they went quiet. `r-dashboard`
observed `member-directory/markup.ts` carrying the import without its call site
— a ~10-second window between two edits; both are in place now and I have said
so directly. I did not touch `members.ts`; the `identifier()` helper there is
`r-dashboard`'s own and the name is a coincidence.

## Commands run and observed results

Exit status captured by redirecting to a file and echoing `$?`, never through a
pipe. Scenario-lab's build is redirected with `FLUXIQ_LAB_SCENARIO_OUT_DIR`
where it was run outside `pnpm test`, so no running Lab instance read a torn
`dist/`.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter …/scenario-lab check` | **0** | `tsc -p tsconfig.json --noEmit`, no diagnostics. Run six times across the work; the final run is clean. |
| `pnpm --filter …/scenario-lab test` | **0** | `# tests 197 / # pass 197 / # fail 0`. 14 of those are mine: 5 in `identifier-policy/tests/apply.test.ts` and 3 appended to each fixture's `tests/scenario.test.ts`. I do not quote a before-count, because other workers were adding tests to the same package throughout. Final run after every edit. |
| `node --test …/bench/tests/week1-corpus.test.js` | **0** | `# runnable: 43 (23 recording, 20 flow); skipped: 0` — **43 runnable, 0 unresolved**, with the rebuilt registry. `# pass 4 / # fail 0`. |
| `node scripts/structure-audit.mjs`, scratch `GIT_INDEX_FILE` (a copy of `.git/index`; the real index was never written), new files staged first | **0** | `structure-audit: passed (33 warning(s), 17 baselined)`. **No finding names any file I created or changed** — grep for `identifier-policy` over the output returns 0. The warnings are other workers' files; the "3 baseline entries can be lowered" note is someone else's improvement, not mine. |
| Probe: the audit's two predictions | **0** | The table in §1. Run twice, identical. |
| Probe: `storefront-checkout`, `admin-console`, `member-directory` | **0** each | The tables in §3. |
| Probe, first attempt | **1** | `browserType.launch: Target page … has been closed`. Not RAM: `e2e/playwright.content.config.ts` documents it — the default headless shell crashes on this machine, and the repo's own config sets `channel: "chromium"`. Fixed by doing the same. |
| Probe, one run mid-session | **1** | `Cannot find module …/@fluxiq/contracts/dist/automation-studio.js` — Core's `dist/` was being rewritten by another worker. Re-run once, as the brief directs: clean, same numbers. |

Two failures were mine and are worth recording because both were caught by the
tests rather than by inspection: the transform first renamed all three test-id
attributes to *one* name, which writes a duplicate attribute on an element
carrying two; and my first `member-directory` reference-integrity assertion
scanned the client script, where an id is a half-finished template.

## Not verified

- **No end-to-end resolution through `resolveTarget`.** §4 says why. The Level 2
  scores are the resolver's own function with the resolver's own floor and
  margin; the Level 1 column is a direct `querySelectorAll` of the recorded
  selector, not the resolver's strategy ladder. The claim "the resolver clicks
  the near-miss" therefore rests on: Level 2 returning `resolved` with that
  candidate, and the reasoning that every Level 1 strategy misses a recording
  carrying no selector match, no id, no test id, no class-set match and no exact
  text match. **Re-running the probe against `resolveTarget` once
  `resolve-target.ts` is stable would close this, and it is one import.**
- **No extension, no background worker, no gateway, no browser extension load.**
  Nothing here exercises a live replay.
- **The near-miss markup is still synthetic**, as `v-core-scoring.md:373` already
  recorded. I reproduced `v-matcher-calibration.md:232`'s
  `<button id="exit-btn" data-testid="save-and-exit">Save changes and exit</button>`
  verbatim rather than inventing one, and the identity-drift page around it is
  `render.ts`'s, but no fixture ships that button.
- **`pnpm check`, `pnpm test` and `pnpm build` at the repository root were not
  run**, nor the extension's own `check` or the content harness. I changed no
  extension, domain or package source. Other workers were mid-edit in
  `content/identity/` and `resolve-target.ts` throughout — the latter had a
  syntax error at one point — so a root check would have reported their work,
  not mine.
- **No manifest variants, and no bench coverage.** See the first open question:
  an identifier-less rendering cannot be expressed in the bench's vocabulary, so
  these modes are reachable from the content harness and the probe only. Nothing
  in `week1.ts` names them and the corpus count is unchanged at 43.
- **The `no-identifiers` policy cannot reach an id a client script composes at
  runtime** (`id="' + member.id + '"`). Those are skipped along with their
  references, so the page stays self-consistent, but such a rendering is not
  fully identifier-less. It is stated on `applyIdentifierPolicy` and asserted by
  a test. No recorded target in any of the three fixtures is one.
- **The generated ids are fixed strings, not per-render.** `:r0:` is stable
  across runs of a rendering, deliberately: an id that changed per run would test
  reproducibility rather than identity, which is the reasoning
  `v-drift-fixture.md` already applied to class hashes.
- **I did not re-run the other fixtures' e2e specs** (`pnpm --filter
  …/scenario-lab test:e2e`) or the content harness. The unit suite covers every
  rendering these changes touch, and the default policy is `as-authored`, which
  is byte-identical to the previous output — asserted by the first test.

## Open questions or contradictions found

1. **The Testing Lab can only assert and record what production strips.** This
   is the audit's own finding one level down, and it is structural.
   `packages/test-runner/src/scenario-assertions.ts:62` resolves every manifest
   fact subject as `[data-testid=<subject>]`, and every manifest recording step
   targets `testid:<value>` (e.g. `storefront-checkout/manifest.ts:59-82`). So an
   identifier-less rendering **cannot be a bench variant at all** — not its page
   facts, not its final state, not its recording script. That is why I added no
   manifest variants, and it means the regime production traffic is actually in
   is the one regime the bench cannot express. Closing it needs a subject
   vocabulary that is not the test id; that is a `packages/` change and outside
   my brief.
2. **Should the floor scale with the recording's identifier weight?** The audit
   asked this from arithmetic; §1 answers it with a measurement. A single
   constant now has to separate 0.389/0.088 in one regime and 0.690/0.633 in the
   other. No constant does: the two gaps do not overlap. **This is the
   supervisor's decision and I have not touched it.** What the measurement adds
   is that the answer cannot be a different constant either.
3. **Missing and contradicted are 0.471 apart on a real control** (§3.3), and
   which one a deploy produces is decided by whether its component library
   generates ids. The same drift resolves at 0.777 or is refused at 0.306
   depending on a build setting no recording can see. Core's split is doing
   exactly what `v-core-scoring.md` designed it to do; it is worth knowing how
   large the consequence is.
4. **`MAX_CANDIDATES = 60` now binds** (§3.3: 147 examined, 60 kept,
   `truncated: true`). The audit called every capacity bound "declared but
   unexercised"; this one no longer is, and `collectTargetCandidates` gained an
   `examined`/`truncated` return shape mid-session, so the diagnostic half of the
   audit's §3.5 is being addressed by someone. `MAX_SCANNED = 600` is still
   unreached — the largest page here examined 147.
5. **`collectTargetCandidates` changed its return type while I was measuring**,
   from `TargetCandidate[]` to `{ candidates, examined, truncated }`. My probe
   reads both, so the numbers survive the change, but any other reader of that
   function written today will not.
