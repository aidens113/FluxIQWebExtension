# t193-wJ: target resolution on bigbox's armed `redesigned-buy-box`

Read-only analysis of the 20 listed runs of `bigbox-retail-pickup-cart-redesigned-after-creation`
(`test-runs/instances/t193-slot-2/run-*`). No source edits, no Lab runs.

## Outcome

Done. **The brief's premise does not hold: the redesign's class rename caused none of the 20 failures.**

- **Class names are not part of any recorded identity.** All 189 recorded element steps in this slot
  carry only `tagName`, `accessibleName` and/or `visibleText`, `inputType`, `context` (`shadowHosts`,
  `listPosition`, once `record`), and a withheld `selector`. No `classNames`, `role` or `testId`.
  None of the recorded selectors uses a generated class. The selectors are `[data-testid="atc"]`, `button`,
  `button > span:nth-of-type(2)`, and `nth-of-type` paths. Core's scorer reproduces every reported
  number exactly from `{name, tagName, selector}` with no class signal:
  - 0.643 = (24 + 7 + 4 - 3.5) / 49 for an exact name match whose candidate has no selector;
  - -0.12 (-0.116) = (-13.2 + 7 + 4 - 3.5) / 49 for a contradicting name;
  - 0.36 (0.363) = (10.286 + 7 + 4 - 3.5) / 49 for the chip.
- **The intended break was recovered every time it was reached.** In 9 runs a product page's Add to cart
  step ran on the variant. It resolved each time by Level-2 scoring at 0.643 (`scored-candidate`,
  7-9 candidates). That score is the moved buy-box button: its name matches exactly, and it has lost
  `data-testid="atc"` (-3.5 on the selector). Buy now scores -0.116 against the recorded "Add to cart" and
  fails corroboration, so it cannot win. The one Add to cart failure (munwdydi s11) ran on `/cart`, where no
  such button exists.
- **13 of the 20 runs failed at target resolution. In all 13, the step ran against a page state the
  Flow never reproduces.** The main cause, in 8 runs, is a build click that switched the store. The click
  answered `web.action.rejected.action_failed`, so it was dropped from the Flow, but it had already
  switched the store and reloaded the page. The model then pressed the header chip under its post-switch
  name ("…Millbrook Crossing Supercenter"). Playback starts from the reset store, Carden Falls, so that
  recorded name contradicts the chip. The other 7 runs did not fail at target resolution: 4 were judge
  refusals, 2 were final-state oracle refusals after running to the end, and 1 was a runaway loop.
- **Store at playback start equals store at build start: Carden Falls (id 2291).**
  `packages/test-runner/src/flow-lane/reset-scenario-lab.ts:13-20` posts `/__control/reset` before
  arming. The store is server state (`bigbox-retail/state/initial-state.ts:16` `storeId: HOME_STORE_ID`;
  `catalog/stores.ts:17` `HOME_STORE_ID = "2291"`, `:10` is Carden Falls Supercenter). The first playback
  chip click matched "Pickup or delivery?Carden Falls Supercenter" exactly (0.643) in every run.

### Per-run table (first failing node)

"Picker chip" means the recorded selector `button` inside the shadow root of
`body > div > header > div > vr-fulfillment-picker`, recorded as `{tagName: button, accessibleName:
"Pickup or delivery?Millbrook Crossing Supercenter", context.shadowHosts: 1}`. "Picker span" means
`button > span:nth-of-type(2)` in the same root, recorded as `{tagName: span, visibleText: "Millbrook
Crossing Supercenter", shadowHosts}`. "Swatch" means
`main > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(4) > div:nth-of-type(2)`, recorded as
`{tagName: div, visibleText: "12 Double Rolls$16.47"}`.

| Run | First failing node (attempt) | Recorded target | Break or collateral | What the armed page held | Candidates, scores, why refused |
|---|---|---|---|---|---|
| munwdydi | s11 click (10) | `[data-testid="atc"]`, `{button, "Add to cart"}` | Intended control, wrong page | `/cart` (screenshot 00022). s10 navigated there before s11. The cart held dish soap from s9, which had pressed the moved Add to cart at 0.643 | 7 same-family buttons, best -0.12. No "Add to cart" on the page |
| munwmt25 | none (status succeeded, final-state oracle failed) | - | - | - | No resolution failure. The Flow never adds the paper towels (its nodes cover napkins only) |
| muny76m9 | s4 click (3) | `main > section:nth-of-type(2) > ul > li:nth-of-type(1) > button`, `{button, "Added", listPosition}` | Collateral (home rail) | Home page, the rail button reads "+ Add" | Veto refused "+ Add" at -0.22 (off-viewport, so no +4). Family 13, best -0.12. "Added" is the post-press label (`client/shell-script.ts:160`). A single text run, so stable-name does not apply (`stable-name.ts:92`) |
| munymcpf | s5 click (4) | Picker chip | Collateral (header) | Home page, flyout open (s4 opened it), store Carden | Selector matched 4 visible buttons: chip 0.36, three "Set as my store" -0.12. Chip uncorroborated, so `unmatched`, reported as `target_ambiguous` (see Code path) |
| munyt4jo | none (judge `core.result.does_not_answer_request`) | - | - | - | Not a resolution failure. No store step, positional "+ Add" presses |
| munyzo8z | none (`flow_lane.stopped_without_failed_attempt`) | - | - | - | Loop s15-s17 ran about 83 passes, 158 Add to cart presses (all 0.643), 250 actions, 3 steps unattempted |
| munzl2eh | s7 click (6) | Picker chip | Collateral | As munymcpf | As munymcpf |
| munzpdlu | none (judge) | - | - | - | Not a resolution failure |
| munzutb0 | s4 click (3) | Picker span | Collateral | Home page, store Carden | Veto refused span "Carden Falls Supercenter" at -0.12: text overlap 1/5 is below 0.35, which counts as a contradiction. Family 0: `span` is not in `CANDIDATE_SELECTOR` (`candidates.ts:120-123`) |
| muo00owc | s5 click (4) | Picker chip | Collateral | As munymcpf | As munymcpf |
| muo06beo | s14 click (13) | Picker chip | Collateral | Flyout open (s13 had just opened it) | As munymcpf. s13, the same recorded name, resolved at 0.643 through stable-name because the flyout was closed and the chip was the only match |
| muo0ks69 | s6 click (5) | Swatch | Collateral (product page, layout unchanged by the redesign) | Napkins product page (screenshot 00019) | The selector hit napkins' second swatch "250 Count$6.48". Veto -0.12. Family 6, best -0.12. Wrong page |
| muo0wf2q | s5 click (4) | Picker span | Collateral | As munzutb0 | As munzutb0 |
| muo12lnk | s15 click (14) | Swatch | Collateral | Napkins page. The towel search was typed but never submitted (screenshot 00016) | As muo0ks69 |
| muo18781 | s18 click (17), then s20 (19) | Picker chip | Collateral | As munymcpf | As munymcpf |
| muo1dxrj | none (judge) | - | - | - | Not a resolution failure (pressed the wrong product) |
| muo1la5v | none (judge) | - | - | - | Not a resolution failure |
| muo2690x | s5 click (4) | Picker span | Collateral | As munzutb0 | As munzutb0 |
| muo2b224 | none (`flow_lane.result_refuted`) | - | - | - | All 16 actions ran. Final-state oracle failed |
| muo2gyob | s8 click (7) | Swatch | Collateral | Napkins page, variant 250 Count (screenshot 00016) | As muo0ks69 |

### Causes, ranked by runs failed

**1. The store switch is not in the Flow (8 runs: munymcpf, munzl2eh, muo00owc, muo06beo, muo18781,
munzutb0, muo0wf2q, muo2690x).**

In every one of these builds, the evidence-loop trace has the same three steps: the chip click succeeds,
then the next click is `rejected.action_failed`, then the model clicks the chip again.

- The screenshots show the failed click did land. munymcpf `00004` (10:27:13, after iteration 7's
  failed click at 10:27:10) shows the chip reading Millbrook with the flyout open. munzutb0 `00003`
  (11:01:07, after the failed click at 11:01:04) shows "Pickup today at Millbrook Crossing Supercenter".
- "Set as my store" disables itself, awaits `mutate('set-store')`, then calls `location.reload()`
  (`client/shell-script.ts:105-108`).
- A command that answers anything but `succeeded` is thrown as a refusal (`domain/src/runtime/llm-evidence/node-run/run.ts:357-375`).
  The refusal's draft statement carries `replay: undefined` (`run.ts:541-551`), so the step can never
  enter the Flow.
- The existing reload handling (`run.ts:384-393`, `captureAfterAction`) and its test
  `node-run/tests/reload-click.test.ts` cover only the other ordering: the click answers `succeeded` and
  the *look* after it meets the reload. They do not cover the click's own answer being lost to the reload.
- The build's completion dry runs start from the build's own state, with Millbrook already chosen (t174
  D1). So the post-switch chip step replays there and the missing switch is not caught.

At playback the chip reads Carden, and resolution then fails in one of two ways:

- **Chip form (5 runs).** s4 has opened the flyout, so the selector `button` matches 4 visible buttons.
  Scoring gives the chip 0.363 (name overlap 3/7 = 0.43) and each "Set as my store" -0.116. The chip is
  above the 0.35 floor and 0.48 ahead of the runner-up, but its name is not an exact agreement, so it is
  `unmatched`.
- **Span form (3 runs).** The selector's one match is refused by the veto (contradicted, -0.116). The
  stable-name reading needs at least 2 text runs and a span has one. The span family is empty.

The refusal is right in both forms. Pressing the Carden chip only toggles the flyout, and the store
would stay wrong.

**2. A step replays on a page the Flow does not reach (4 runs: muo0ks69, muo12lnk, muo2gyob,
munwdydi).**

- The swatch step targets the paper-towel page, but playback is on the napkins page. The path selector
  lands on napkins' second swatch, "250 Count$6.48", and the veto correctly refuses it on the name.
- The same build pattern appears here: navigating clicks come back `rejected.action_failed` and are
  dropped. In muo12lnk, iterations 18, 21 and 22 are clicks that failed after the search typing, and the
  Flow keeps `s12`/`s13 type Search` with no submit. In muo2gyob, the click at iteration 9 failed and the
  Flow keeps `s4 type Search`.
- muo0ks69's `s5 Options` resolved by scored-candidate among 46 at 0.643 (not in the table above, where
  it succeeded). Its `listPosition` scope chose a rail item on a home page listed for Carden, not for
  Millbrook. Plausibly this is again the missing store switch (not verified).
- munwdydi's own authored order puts `s10 navigate` to `/cart` before `s11 Add to cart`. This lane's
  earlier debug `t193-wI` also records that its store steps were amended out.

**3. A control whose label is its state, recorded after its state changed (1 run: muny76m9).**
The rail button becomes "Added" after a press (`shell-script.ts:160`). The Flow has no press before
s4 that would make it read "Added" at playback.

No run failed because of a generated class name or a changed structural path on the redesigned page.

### Code path of the refusals, with lines

- `apps/extension/src/content/action-runtime/resolve-target.ts`:
  - `:305-347`, exact strategies. A single match goes to the veto (`:320`). A score refusal gets one more
    chance through `stableNameMatch` (`:325`), and only there.
  - A multi-match pool is scored (`:345`). **At `:347` every non-`resolved` outcome, `unmatched`
    included, is thrown as `TARGET_AMBIGUOUS`, and neither the fingerprint strategy nor family scoring
    runs after it.** That is why the chip at 0.36 against rivals at -0.12 reads as "ambiguous": it was
    not a tie. It was one uncorroborated leader.
  - `:359-362` is family scoring when every exact strategy missed. It produced the "best scored -0.12"
    in the not-found messages.
- `identity/veto.ts:223-236`. Rule 0 is the record; rule 1 is `score < TARGET_VETO_FLOOR` (0, `:150`),
  which gives "contradicted"; rule 2 is `corroboratesExactly` (`:235`), which gives "uncorroborated".
- `identity/score.ts:196-205`:
  - floor `TARGET_SCORE_FLOOR` 0.35 (`:152`), margin 0.2 (`:161`), corroboration `:204`, which gives
    `unmatched`;
  - `comparableFingerprint` (`:235-251`) passes `classNames` only when the recording has them (`:249`),
    and none do here.
- `identity/corroboration.ts:63-69` requires a text, name, label, id or test-id contribution at a
  similarity of at least 0.92.
- `identity/candidates.ts`:
  - `candidateFingerprint` (`:205-230`) gives a candidate a selector only from an id, test id or `name`
    (`:269-274`). So a recorded path selector is always charged "missing structural path" (-0.25 × 14 = -3.5).
  - `CANDIDATE_SELECTOR` (`:120-123`) excludes a bare `span`/`div`, which gives family 0 for the span.
- `identity/stable-name.ts:88-120`. At least 2 text runs are required (`:92`). It is only reached from
  `resolve-target.ts:325`, the single-match path.
- Core `packages/fluxiq/src/programs/automation-studio/fingerprinting/element-fingerprint.ts`:
  - weights `:90-110` (text 24, selector 14, tag 7, visibility 4, classNames 5);
  - `compareTextSignal` `:267-272`: below 0.35 similarity is charged -0.55;
  - `textSimilarity` `:337-343`: word Jaccard, with 0.82 for containment;
  - normalization `:178`.
- **The recorded store name does contribute (fix H's territory).** The chip's recorded name holds the
  post-switch store. Against "Carden Falls" it agrees on 3 of 7 words, which is the whole reason it is
  uncorroborated. Fix H rescues this only when the chip is the sole match: muo06beo s13 and munwmt25 s15
  resolved at 0.643 that way. It is not consulted when the flyout is open.

### Proposed fixes

**P1 (cause 1, and probably part of cause 2): keep a navigating press whose own answer was lost to
the navigation.**

- Where: domain `runtime/llm-evidence/node-run/run.ts`, the `result.status !== "succeeded"` branch
  (`:357-375`).
- Rule: when the command went out (`record.acted`) and its failure is the lost-document kind (the
  channel closed under the command, like the `PORT_CLOSED` look in `reload-click.test.ts`), run
  `captureAfterAction`. If the page it reads is a changed document, return the success path, with the
  step applied and its `replay` statement set. Any other failure, or an unchanged page, is refused as
  today.
- First confirm the failure code: `resultReason` is blank for these `action_failed` steps and the
  artifacts do not carry the click's error text. Adding it to the build trace is the cheapest check.
- Tests, extending `domain/src/runtime/llm-evidence/node-run/tests/reload-click.test.ts`:
  - (a) the click itself answers `failed` with the port-closed error, and the page after names
    Millbrook: applied, with `replay` present and the step in the draft;
  - (b) the same failure with the page unchanged: refused, `replay` absent;
  - (c) a non-lost-document failure (for example `target_not_found`) while a timer changes the page:
    still refused.
- Live proof: this task on the variant, where the Flow should contain Millbrook's "Set as my store"
  (card-scoped per wE/wH) and the chip steps should match exactly.
- **Owner already named elsewhere:**
  - t174's report routes "the keep-across-reload defect (evidence-loop draft recording plus the domain
    click post-condition across a reload)" to **t175** (run-6 row), and names **t189 and t175** as
    owners (next steps, item 3);
  - its R2 ("a refused attempt's page change as its own optional, replayable step") is routed to **t195**
    (t174 if t195 declines);
  - its D1 (dry runs start from build state, which hides this) is an open supervisor decision in
    **t189's** area.
  - The supervisor should give P1 to one of them rather than open a fourth owner.

**P2 (label only; covers the 5 chip runs' wording): an `unmatched` scoring of a multi-match pool is a
miss, not a tie.**

- Where: `resolve-target.ts:345-347`.
- Rule: only when `decided.outcome === "ambiguous"`, throw `ambiguous(...)`. On `unmatched`, push
  `${attempt.description} (… scoring 0.36 with nothing the recording named agreeing exactly)` into
  `misses` and `continue`.
- Test in `action-runtime/tests/resolve-target.test.ts`: a shadow root holding the chip (reading
  Carden) and three visible "Set as my store", with the recording `{button, "Pickup or delivery?Millbrook
  Crossing Supercenter", selector "button", shadowHosts}`, expects `TARGET_NOT_FOUND` and no element.
  Two byte-identical twins stay `TARGET_AMBIGUOUS`.
- Caveat: `node-run/replay.ts` makes an ambiguous replay `core.replay.failed` and a missing target
  `unreproducible`, and t174 N1 found the dry-run gate waves `unreproducible` through. Do P2 only after
  N1 is fixed, or not at all. It changes no click either way.

**Do not do:**

- **Do not extend stable-name to the multi-match path.** It would press the Carden chip, the flyout
  would toggle, and the Flow would carry on at the wrong store without a word. Once P1 keeps the switch,
  the chip reads Millbrook at playback and matches exactly, so no extension is needed.
- **Do not change class weighting.** Class names do not reach this decision at all.
- **Do not change the floor, the margin or corroboration.** They are what make the moved Add to cart
  (0.643, exact name) the only winner and Buy now (-0.116, uncorroborated) a loser.

**P3 (regression guard, no behaviour change): pin Add to cart over Buy now.**

- Where: `action-runtime/tests/resolve-target.test.ts`. No such test exists today: a grep for
  "Buy now" and "atc" under `content/**/tests` found none.
- Fixture: the redesigned fragment, with the buy-box `<button>Add to cart</button>` (no test id) and
  the bar's `<button>Buy now</button>`. Recording: `{button, "Add to cart", selector
  [data-testid="atc"]}`.
- Expected: resolves the buy-box button as `scored-candidate` at 0.643. With the buy-box button
  removed: `TARGET_NOT_FOUND`, and Buy now is never returned.

## What changed and why

Only this report was written, at
`docs/working/language-driven-flow-loop-plan/reports/t193-wJ-armed-target-resolution.md`. The brief is
read-only analysis. Scratch scripts are in the session scratchpad (`wj-sum.js`, `wj-score.mjs`,
`wj-brute.mjs`), outside the repository.

## Commands run and observed results

- **Per-run summary.** `node wj-sum.js` over the 20 `snapshots/flow-lane.json`, printing authored
  nodes, per-attempt `hostTargetResolution`, `failure` and `recoveredFailures`. This produced the table
  above: 13 resolution failures (5 `web.target.ambiguous`, 8 `web.target.not_found`), 4
  `core.result.does_not_answer_request`, 3 with no failure record (munwmt25 succeeded but its oracle
  failed; munyzo8z stopped without a failed attempt; muo2b224's result was refuted).
- **Recorded fields across the slot.** A key tally over every authored element in `t193-slot-2`: 189
  element steps, whose keys are only `accessibleName`, `visibleText`, `tagName`, `inputType` and
  `context`, with `selector` withheld. There is no `classNames`, `role` or `testId`.
- **Scoring with Core's matcher.** `node wj-score.mjs` and `wj-brute.mjs` import Core's built
  `dist/.../fingerprinting/element-fingerprint.js`.
  - The brute force over recorded-signal shapes finds that 0.643 is produced only by `{one of
    name/text, tagName, selector}` with no class names and no role, against a visible candidate that
    has no selector.
  - The same shape gives -0.107 or -0.116, depending on visibility, for a contradicting name. With the
    recorded selector present and the candidate lacking one, the chip scores 0.427 at 88 weight when
    both text signals are recorded. With the observed name-only shape it computes to 0.363. That was
    checked by hand from the same constants, not run separately.
- **Build traces.** `grep` of `logs/core.log` for `replay.*` and `amend=`. Every one of these builds had
  `core.replay.failed` and/or `core.replay.unreproducible` in its own completion dry runs, followed by
  `amend=…:optional`.
- **Screenshots read:** munymcpf `00004`, munzutb0 `00003`, muo2gyob `00016`, muo0ks69 `00019`,
  muo12lnk `00016`, munwdydi `00022`. Each is aligned to its build or playback step by timestamp from
  `review/timeline.json` and the `core.log` tool start and end lines.
- **Add to cart resolutions.** A tally over the playback actions whose recorded name is "Add to cart":
  9 runs resolved it at least once, always `scored-candidate@0.643` (n = 7, 8 or 9). The only failure
  on it was munwdydi on `/cart`; munzpdlu and muo1dxrj also show a failed row, but that is the judge
  failure appended to the attempt.

## Not verified

- **The click's own failure text.** Which error the "Set as my store" and search-submit clicks returned
  is not in the artifacts: `resultReason` is blank. Port-closed across the reload is inferred from the
  timing and from `reload-click.test.ts`'s model of the page.
- **Buy now was never pressed in the 9 runs.** This is shown by the scoring arithmetic and, for munwdydi,
  by the cart holding an item. The other 8 were not checked one by one.
- muo0ks69's "Options" choosing the Carden rail's item (cause 2) is plausible, not verified.
- muny76m9's missing preceding press, and whether it was an `action_failed` drop, were not traced.
- None of P1, P2 or P3 was implemented or run.
- The chip's 0.363 was computed by hand from Core's constants, not by the script.

## Open questions or contradictions found

- **The variant's manifest and the current resolver disagree.**
  `manifest/primary-workflow.ts:60` says a provider-free run of `redesigned-buy-box` "fails with
  target_not_found" and "only a repair can pass". In these runs the moved Add to cart is recovered by
  name at Level 2 with no repair. So the variant no longer forces a repair whenever the recording has
  the button's name. The Lab owner should decide whether the variant still tests what it claims.
- **The brief's picture does not match the recorded data.** The brief says every generated class name
  changes, including the picker's. That is true of the site, but no Flow step records or selects by a
  class, so the rename is inert for resolution in every one of these runs.
- **A possible relaunch loop, not investigated.** `t193-slot-2` holds at least 28 more (the listing was cut at 60 rows)
  `bigbox-retail-pickup-cart-redesigned-after-creation` run directories after `run-muo2gyob`
  (`run-muo2mibg` through `run-muo48k8o`), about 2 minutes apart, whose `flow-lane.json` status is null.
  This looks like the relaunch loop the latest dev commit mentions, and cost was not checked.
