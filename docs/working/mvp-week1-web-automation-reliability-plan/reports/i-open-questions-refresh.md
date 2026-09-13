# i-open-questions-refresh — every open question and ruled-out item, with its true status

Brief: "## i-open-questions-refresh" in `briefs/finish-week1.md`. Read-only. "Archive" means
`archive/2026-09-12-finish-week1-ledger.md`, cited by heading. Code was read in the working tree at
`HEAD 0257357`, where only docs files are modified. No page data or secret value is quoted.

## Outcome

**Done.**
- **The open entries.** `open-questions.md` holds 59 entries, and 33 of them carry a tag that is not
  SETTLED. Of those 33:
  - 21 are settled at HEAD;
  - 4 are ruled out of Week 1 by a ledger or archive decision (E12, E25, E41, E51);
  - 2 are open only as Lab proof or documentation (E32, E52);
  - 6 were raised as the user's or the supervisor's own decision and have no ruling (E2, E53, E54,
    E55, E57, E58). Rulings are drafted for them below.
- **The settled entries.** The other 26 are SETTLED, and every one of those tags still holds.
- **The ruled-out list.** Current State omits 16 archive rulings. The replacement below is 12 lines.
- **A contradiction.** PB10b is **not** ruled out. It moved into Week 1 and landed as `w19-c2`, so
  `i-ranking-draft` section 2 is wrong to list it (Contradiction 1).

## 1. Each entry in `open-questions.md`

Entries are numbered E1-E59 in file order. Each block gives:
- **Tag:** the replacement for the entry's leading bracket.
- **Resolution:** a paragraph to paste as the entry's new last paragraph.

A new tag needs a row in the tag table, pasted after the `[SUPERSEDED …]` row:

```
| `[RULED OUT OF WEEK 1 …]` | Not closed, and not Week 1's to close. The closing paragraph names the ruling's heading and reason. Do not brief it in Week 1. |
```

The header sentence at lines 10-11 changes as well:

```
**Every entry carries a status tag, audited 2026-09-12 by v-openq-audit against
the tree at `11d2ed3`, and re-audited 2026-09-13 by i-open-questions-refresh at `0257357`.**
```

### 1a. Entries whose tag changes

**E1. Credentials at replay.**
- Current tag: `[OPEN — description corrected 2026-09-12]`.
- True status: settled.
- Tag: `[SETTLED 2026-09-13]`
- Resolution:
  ```
  **Settled 2026-09-13 by i-open-questions-refresh.** `auth-gate/manifest.ts:107` declares the
  password as a secret, and the Flow lane supplies it once, under its node's path (archive
  "f-w18-secret-leg" and "f-runner-secret-input"); `l-stage2c` passed W18 3 of 3 on each lane with
  the declared value found 0 times in Core's kept workspace, SQLite included.
  ```

**E2. Selector-keyed patch lane vs fingerprint-first doctrine.**
- Current tag: `[OPEN]`.
- True status: ruled out of Week 1. It was raised as a Week 2 contract decision.
- `domain/src/runtime/llm-evidence/tools.ts:91` still takes `target: { selector: string }`.
- **No ledger line rules it explicitly.** The supervisor's ranking entry should record the ruling.
- Tag: `[RULED OUT OF WEEK 1 — a Week 2 contract decision]`
- Resolution:
  ```
  **Ruled out of Week 1, 2026-09-13.** `tools.ts:91` is still selector-keyed; whether the patch lane
  becomes fingerprint-shaped belongs with Week 2's run-time Flow changes (archive "i-leftover-sizing
  and i-week2-entry-points"; ranking R19).
  ```

**E3. The extension latches idle when Core refuses a recording start.**
- Current tag: `[OPEN — description corrected 2026-09-12]`.
- True status: settled.
- What the code does now:
  - `background/connection/recording-start/refusal.ts:32-107` sorts a refusal into `transient`
    (`context_stale`) or `persistent` (`project_not_selected`, `project_mismatch`).
  - `handshake.ts:17-32` re-sends a transient refusal after bounded delays (about 4 s in total), each
    send with a fresh acceptance window.
  - `active-recording.ts:359-369` and `refusal.ts:112-117` surface the block with the retry count.
- The modules were committed in `ab736a1` and wired by archive "f-connection-split: `connection.ts`
  764 lines to 344".
- Tag: `[SETTLED 2026-09-13]`
- Resolution:
  ```
  **Settled 2026-09-13 by i-open-questions-refresh.** A refusal is now classified
  (`recording-start/refusal.ts:32-107`: transient `context_stale`, persistent `project_not_selected`
  or `project_mismatch`), a transient one is retried within a bound (`handshake.ts:17-32`), and a
  persistent one locks the recorder with its reason on the panel (`active-recording.ts:359-369`),
  wired by archive "f-connection-split". A refused start is not an action, so its closed reason set,
  not the Phase 1.5 action codes, is the right classification.
  ```

**E4. One harness spec file is shared by every verb brief and owned by none.**
- Current tag: `[PARTLY SETTLED — the stale sentence is fixed; the ownership is not]`.
- True status: settled.
- Tag: `[SETTLED 2026-09-12]`
- Resolution:
  ```
  **Settled 2026-09-12.** Archive "c-remaining inventory, and the scope it settles" rules
  `actions.spec.ts` supervisor-only (C4).
  ```

**E7. The TypeScript compiler crashes under parallel load.**
- Current tag: `[OPEN — environmental, standing]`.
- True status: settled, as standing guidance. The cause is this machine's faulty RAM.
- Tag: `[SETTLED 2026-09-13 — standing guidance, not a defect]`
- Resolution:
  ```
  **Settled 2026-09-13.** The cause is this machine's faulty RAM; the rerun-alone rule is in
  `live-validation-plan.md:99` and in Current State's operating rules, so nothing here remains to close.
  ```

**E9. `pnpm test:content -- --workers=4` silently runs no tests.**
- Current tag: `[OPEN — operational; see also the last entry in this file]`.
- True status: settled.
- Tag: `[SETTLED 2026-09-13]`
- Resolution:
  ```
  **Settled 2026-09-13.** `apps/extension/package.json:10` now drops a leading `--` before calling
  Playwright (archive "g-integration-small-fixes", where `test:content -- …identity-veto.spec.ts` ran
  `4 passed`); the finish-week1 binding rules record 12 tests run through that form on 2026-09-13.
  ```

**E12. The Firefox floor predates the main-world dialog override.**
- Current tag: `[OPEN — the user's decision]`.
- True status: ruled out of Week 1. `manifest.firefox.json:43` is still `109.0`.
- Tag: `[RULED OUT OF WEEK 1 — Firefox is Week 4; the floor stays the user's decision]`
- Resolution:
  ```
  **Ruled out of Week 1.** Archive "c-remaining inventory, and the scope it settles": Firefox is
  Phase 4.9, Week 4. The floor is unchanged (`manifest.firefox.json:43`) and stays the user's call then.
  ```

**E13. The recorder never reports a checkbox checked state.**
- Current tag: `[OPEN]`.
- True status: settled.
- Tag: `[SETTLED 2026-09-13]`
- Resolution:
  ```
  **Settled 2026-09-13 (B5).** `content/describe-element.ts:69-70,174-178` records `checked` for a
  checkbox or radio, never for a sensitive control, and `shared/protocol.ts:199-203` declares it; a
  recorded toggle now maps to an executable `web.dom.check` (archive "B3 and B5 land").
  ```

**E15. Landmark context carries a role but no name.**
- Current tag: `[OPEN]`.
- True status: settled.
- Tag: `[SETTLED 2026-09-13]`
- Resolution:
  ```
  **Settled 2026-09-13 (B5).** `shared/protocol.ts:242-245` declares `landmarkName`, filled at
  `content/identity/context.ts:67,119` (archive "B3 and B5 land"). W26 needs no landmark signal: it is
  CS1d, the twins resolved by position, and now reports `web.target.ambiguous` (archive
  "g-flow-lane-observation and g-identity-drift-mode land; W26 is CS1d" and
  "g-resolver-corroboration lands"). Its Lab proof belongs to criterion 3.
  ```

**E18. A recorded action can be silently dropped from the proposed Flow.**
- Current tag: `[OPEN — the most consequential open item in this file]`.
- True status: settled in code. The benches still watch for it.
- Tag: `[SETTLED 2026-09-13 — a short recording now fails loudly; the benches watch for it]`
- Resolution:
  ```
  **Settled 2026-09-13.** The cause was Core dropping what a client sent before its recording opened
  (archive "i-recording-loss"), fixed by "g-core-start-order". A loss can no longer pass silently: a
  proposal short of the recording's pinned events fails (B1, "g-flow-lane-observation"), and a Core
  count below the extension's fails as `recording.persistence` on both lanes
  (`run-expectations/recording-completeness.ts`, "g-recording-completeness"). `l-stage2d` saw no
  such failure in 18 Flow runs. Any `recording.persistence` failure in `l-stage3a` or `l-stage3b`
  reopens it as a Week 1 blocker (ranking R9).
  ```

**E19. The expired auth-gate workflow cannot report `auth_required` yet.**
- Current tag: `[OPEN — description corrected 2026-09-12: its blocker is gone]`.
- True status: settled.
- Tag: `[SETTLED 2026-09-13]`
- Resolution:
  ```
  **Settled 2026-09-13.** W19 took Option A, the click's own landing claim, rather than a navigation
  step (archive "g-domain-mapping: … W19 takes Option A"), built by "w19-e1", "w19-e2" and
  "w19-d1b". `l-stage2c` passed W19 `expired` 3 of 3 on the Flow lane with
  `auth_required/web.auth.required`.
  ```

**E20. A routine command deletes tracked build artifacts.**
- Current tag: `[OPEN — description corrected 2026-09-12]`.
- True status: settled for the hazard that mattered, concurrent Lab runs.
  - `scripts/lab/run-lab.mjs:48-52` passes `FLUXIQ_LAB_EXTENSION_BUILD_ROOT`.
  - `apps/extension/scripts/build-extension.mjs:13-19` then builds `build/` and `dist/` under that
    root, so an instanced run leaves the tracked directory alone. The instance support was
    committed in `ab736a1`.
- Unset, `:76` still rewrites the tracked `build/`. AGENTS.md "Generated Data" names that build as
  the way to update the directory.
- **No ledger heading records this choice** (Contradiction 2).
- Tag: `[SETTLED 2026-09-13 — Lab instances build elsewhere; a plain build refreshes the tracked copy by design]`
- Resolution:
  ```
  **Settled 2026-09-13 by i-open-questions-refresh.** A Lab instance builds the extension under its
  own root (`run-lab.mjs:48-52`, `build-extension.mjs:13-19`), so concurrent runs no longer delete the
  unpacked extension another browser loads. A plain `pnpm lab` still refreshes the tracked
  `apps/extension/build/` (`build-extension.mjs:76`), which AGENTS.md names as how that directory is
  updated.
  ```

**E25. The shared action-type reader adds calls to existing and clone runs.**
- Current tag: `[OPEN]`.
- True status: ruled out of Week 1.
  - `existing-flow-run.ts:106` still calls `readFlowActionTypes`.
  - `flow-lane/flow-action-types.ts:57` still throws `recording.contract`.
- Tag: `[RULED OUT OF WEEK 1 — the Week 1 bench runs isolated targets only]`
- Resolution:
  ```
  **Ruled out of Week 1.** Archive "g-lane-consistency": the existing and clone lanes stay as they
  are because the Week 1 bench runs isolated targets. The throw (`flow-action-types.ts:57`) and the
  extra calls (`existing-flow-run.ts:106`) remain unmeasured against a real server.
  ```

**E26. An unusable parameter has no rejection channel.**
- Current tag: `[OPEN — and now documented in the code as intended behaviour]`.
- True status: settled (B3).
- Tag: `[SETTLED 2026-09-13]`
- Resolution:
  ```
  **Settled 2026-09-13 (B3).** A refused required field rejects the whole command before dispatch as
  `web.action.invalid_parameter`, `graph_validation_or_unknown_node`, not retryable, stage `dispatch`
  (`gateway-mapping.ts:385`, `runtime/failure/codes.ts:71,136`; archive "B3 and B5 land"). A refused
  optional field is simply not applied (`gateway-action-parameters.ts:12-20`), by design.
  ```

**E28. The runtime error type has no producer, and its code is not a closed type.**
- Current tag: `[OPEN — both halves]`.
- True status: settled. The class was removed rather than given a producer.
- Tag: `[SETTLED 2026-09-12 — the class was removed, not given a producer]`
- Resolution:
  ```
  **Settled 2026-09-12.** `domain/src/runtime/errors.ts` no longer exists. `runtime/failure/carrier.ts:4-26`
  records why: every producer attached a failure record instead, and a record's `code` is the closed
  set, checked by the compiler at the throw (`1b6f5df`; row LR5 in `reports/c-remaining.md`, archive
  "c-remaining inventory").
  ```

**E32. There are three failure vocabularies, and the plan names two.**
- Current tag: `[OPEN — the engineering is right, the plan text is not]`.
- True status: open. Only the documentation remains (ranking R14).
- The plan's line numbers have moved. The runner's import has also moved, to
  `demo-llm-create-ui/generation-failure.ts:13`.
- Tag: `[OPEN — the plan text only; its lines have moved]`
- Resolution:
  ```
  **2026-09-13:** still open, as documentation only. The plan's stale sentences are now at `:501-502`
  and `:510-511`, and `:492-493` also still names the removed `WebAutomationRuntimeError`. The
  runner's allowlist import is now `demo-llm-create-ui/generation-failure.ts:13`.
  ```
- Proposed plan text, for whoever closes it:
  - `:501-502`, "Codes are a closed set in `codes.ts`; the test-runner's allowlist derives from it." becomes
    "Codes are a closed set in `codes.ts`. The test-runner's allowlist derives from a different
    vocabulary, the domain's evidence-loop result codes and tool ids."
  - `:510-511`, "allowlist generated from domain codes;" becomes
    "allowlist derived from `WEB_LLM_EVIDENCE_RESULT_CODES` and `WEB_LLM_EVIDENCE_TOOL_IDS` through
    `@fluxiq-web-extension/domain/node`;"
  - `:492-493`, "`domain/src/runtime/failure/{codes,classify}.ts` using `WebAutomationRuntimeError`)" becomes
    "`domain/src/runtime/failure/{codes,classify,carrier}.ts`, a producer attaching a failure record to what it throws)"

**E37. The typed fingerprint field is write-only.**
- Current tag: `[OPEN — description corrected 2026-09-12: the declared field is now write-only]`.
- True status: settled.
  - `content/action-runtime/resolve-target.ts:571-572` reads
    `describedElement(action.element) ?? describedElement(action.options?.element)`.
  - `tests/resolve-target.test.ts:3-14,113` fails if the read drops `action.element`. The test
    arrived in `ab736a1`.
- **No ledger heading names this fix** (Contradiction 2).
- Tag: `[SETTLED 2026-09-12]`
- Resolution:
  ```
  **Settled 2026-09-12.** `recordedTarget()` prefers the declared `action.element` and falls back to
  `options.element` (`resolve-target.ts:571-572`), and `tests/resolve-target.test.ts:113` fails if
  the declared field stops being read.
  ```

**E38. Integration checklist accumulating from Wave 3 reports.**
- Current tag: `[PARTLY SETTLED — 2 of 6 closed; audited 2026-09-12]`.
- True status: closed, or ruled out of Week 1, item by item.
- Tag: `[SETTLED 2026-09-13 — items 1, 2, 4 and 5 closed; 3 ruled out of Week 1 as B4; 6 a lesson]`
- Resolution:
  ```
  **2026-09-13:** item 2 closed with E28 (the class is gone, `carrier.ts:4-26`); item 3 is B4, ruled
  out of Week 1 unless the Lab evidence run misses a child frame's items (archive "c-remaining
  inventory"; `runtime/action-runner.ts:234` still sends `topFrameOnly: frameId === undefined`); item
  4 closed, `domain/.test-build/` regenerated (archive "Integration: root gates pass here against Core
  built at `20bb3b4`").
  ```

**E39. Three Wave 3 briefs granted the same file with no partition inside it.**
- Current tag: `[OPEN — process lesson, no code state]`.
- True status: settled. The rule was promoted to AGENTS.md.
- Tag: `[SETTLED 2026-09-13 — the rule is in AGENTS.md]`
- Resolution:
  ```
  **Settled.** AGENTS.md:96 now reads "If two briefs need the same file, the work is serial."
  ```

**E41. The candidates half of the headline audit finding.**
- Current tag: `[OPEN — description corrected 2026-09-12: the stated blocker is gone]`.
- True status: ruled out of Week 1.
- Tag: `[RULED OUT OF WEEK 1 — scoring stays in the browser; Core's gate is inert for web]`
- Resolution:
  ```
  **Ruled out of Week 1.** Archive "i-resolver-safety: … D14 amended": for web, Week 1's floor is the
  browser's, Core's element-target floor stays inert, Core similarity metadata is not Week 1, and B.3
  is Week 2; restated in "Finish-Week-1 session: fifteen settled entries archived".
  `gateway-mapping.ts:218` still says nothing populates `candidates`.
  ```

**E42. The domain test runner aborts the whole suite on the first throw.**
- Current tag: `[OPEN]`.
- True status: settled.
- Tag: `[SETTLED 2026-09-13]`
- Resolution:
  ```
  **Settled 2026-09-13 (A3).** `domain/scripts/test-domain.mjs:54-72` imports each entry in its own
  `try`, names every entry that failed to load, runs the rest, and exits 1 (archive "g-small-fixes:
  C1, A3, A4, LR9 and C3").
  ```

**E43. The content harness fails under default Playwright concurrency.**
- Current tag: `[OPEN — standing operational guidance]`.
- True status: settled, as standing guidance.
- Tag: `[SETTLED 2026-09-13 — standing guidance, not a defect]`
- Resolution:
  ```
  **Settled 2026-09-13.** `e2e/playwright.content.config.ts` defaults to `workers: 4` (archive
  "g-small-fixes"), and the all-timeouts shape is in `live-validation-plan.md:101`.
  ```

**E48. `connection.ts` is close to its hard limits.**
- Current tag: `[OPEN — and now AT the limit, not near it]`.
- True status: settled.
- Tag: `[SETTLED 2026-09-12]`
- Resolution:
  ```
  **Settled 2026-09-12.** Archive "f-connection-split: `connection.ts` 764 lines to 344" (38 methods to
  20); the file is 360 lines at `0257357`.
  ```

**E50. Operational: `test:content -- --workers=4` runs nothing.**
- Current tag: `[SUPERSEDED — duplicate …]`.
- True status: settled, with E9.
- Tag: `[SETTLED 2026-09-13 — the same fix as the earlier --workers=4 entry]`
- Resolution: delete it at the next compaction. E9 carries the settlement.

**E51. A client's declared type and capabilities are self-asserted.**
- Current tag: `[OPEN — needs a Core decision]`.
- True status: ruled out of Week 1.
- Tag: `[RULED OUT OF WEEK 1 — a Core pairing-time decision, sized Later]`
- Resolution:
  ```
  **Ruled out of Week 1.** Archive "i-leftover-sizing and i-week2-entry-points" sizes Core's `hello`
  identity as Later. The redaction guards stay defence in depth against our own producers; criterion
  2's proofs do not assume a hostile client.
  ```

**E52. Every Flow-lane structured failure was deleted from the recorded history.**
- Current tag: `[OPEN — invalidates a class of measurement]`.
- True status: settled in code. The rate is still owed by the benches.
- The fixes:
  - `packages/test-evidence/src/redaction.ts:53,71,88` tracks ancestors and writes `[CIRCULAR]`
    (`ab736a1`).
  - Cause 2, the lost observation, was fixed in `a4564c5` (archive "g-flow-lane-observation and
    g-identity-drift-mode land").
- The plan ledger's `l-stage2d` read structured Flow-lane failures back from its bundles.
- Tag: `[OPEN — the records survive now; the classification rate is owed by both benches]`
- Resolution:
  ```
  **2026-09-13:** the loss is fixed (`redaction.ts:53,88`; the observation fix in archive
  "g-flow-lane-observation"), and `l-stage2d`'s bundles carry Flow-lane failures such as
  `output_not_observed` and `web.action.timeout`. What stays open is the rate: under "Rulings on how
  the criteria count", `l-stage3a` and `l-stage3b` must show the W14, W19 and W27 negative variants at
  90% or better (ranking R7).
  ```

**E56. On production-shaped recordings, the resolver clicks a plausibly wrong control.**
- Current tag: `[OPEN — the headline safety finding; needs the user's decision]`.
- True status: settled in code and harness, by the supervisor's design A. The Lab proof is owed.
  - `content/identity/corroboration.ts:22,46,67` requires a distinguishing recorded signal to agree
    at 0.92, or an equal id or test id.
  - The near-miss rows, identifier-less ones included, are at
    `e2e/content/tests/identity-resolution.spec.ts:417,463-467`.
  - W29 `save-and-exit`, R7's lone identifier-less button, is in `bench/corpus/week1.ts:58` and
    expects `target_not_found`.
- This entry's claim that the bench cannot express an identifier-less rendering is obsolete for this
  shape.
- **Whether the user accepted design A in place of deciding is not recorded** (Contradiction 3).
- Tag: `[SETTLED 2026-09-13 in code — W29 carries the Lab proof]`
- Resolution:
  ```
  **Settled in code 2026-09-13.** No floor could separate the cases, so a predicate does: a match that
  no distinguishing recorded signal agrees with exactly is refused (archive "i-resolver-safety … D14
  amended"; "g-resolver-corroboration lands"; `identity/corroboration.ts:46,67`). The accepted cost is
  a refusal where a label was shortened. W29 `save-and-exit` puts this shape in the week1 bench; its
  refusal in `l-stage3a` and `l-stage3b` is criterion 3's proof (ranking R6, R18).
  ```

**E59. Two facts that constrain any fix to the identifier-less exposure.**
- Current tag: `[OPEN — two facts …]`.
- True status: settled as a record.
  - Fact 1 is why the fix is a predicate (E56).
  - Fact 2, a generated id refusing at 0.306, is a refusal: design A's accepted cost class.
  - The `MAX_CANDIDATES` cap (`content/identity/candidates.ts:108`, 60) goes with E58.
- Tag: `[SETTLED 2026-09-13 — record; the fix became a predicate, and the cap goes with E58]`
- Resolution:
  ```
  **2026-09-13:** fact 1 is why design A is a predicate rather than a moved floor (archive
  "i-resolver-safety"); fact 2's outcome is a refusal, not a wrong click; `MAX_CANDIDATES` (still 60,
  `identity/candidates.ts:108`) is ranked with real-page capacity, E58.
  ```

### 1b. Entries that have no ruling, and are the user's or the supervisor's to decide

For each: its true status today, then a ruling drafted for pasting once the supervisor records it.
No ledger or archive heading rules any of them.

**E53. Redaction is signature-based, so an unmarked sensitive field is captured.**
- Current tag: `[OPEN — needs a product decision]`.
- True status: open, as the user's decision.
- **Option 1 is already done.** `docs/architecture/sensitive-values.md:226-229` states the signature
  limit. `testing-facility.md:936` states that the storefront's unmarked security code is
  deliberately not declared.
- Options 2 and 3 are unbuilt. They are ranked as a Week 2 entry (R17).
- Tag today: `[OPEN — the user's decision on options 2 and 3; option 1 is documented]`
- Tag if ruled: `[RULED OUT OF WEEK 1 — the limit is documented; warning or operator marking is Week 2]`
- Resolution if ruled:
  ```
  **Ruled out of Week 1, 2026-09-13.** Option 1 is in place (`sensitive-values.md:226-229`). Criterion
  2's leak checks cover declared, marked secrets. Options 2 and 3 are Week 2, unless the user
  chooses one for Week 1.
  ```

**E54. D13 moves candidates across Core's `destructive` gate.**
- Current tag: `[OPEN — a decision the supervisor took on an incorrect premise]`.
- True status: open, as the user's decision. **It has no web effect in Week 1**, because archive
  "i-resolver-safety" (b) and CS2c find that Core's element-target floor is never sent, and
  confidence never checked, for web.
- The premise this entry corrects is in `archive/2026-09-12-decisions-d13-d14.md:29-36`.
- Browser corroboration does not restore the old threshold: such a candidate agrees exactly, so it
  passes `corroboration.ts:67`.
- Tag today: `[OPEN — the user's decision; no web dispatch reaches Core's gate in Week 1]`
- Tag if ruled: `[RULED OUT OF WEEK 1 — Core's element-target gate is inert for web; decide with B.3]`
- Resolution if ruled:
  ```
  **Ruled out of Week 1, 2026-09-13.** Core's element-target floor stays inert for web (archive
  "i-resolver-safety", CS2c), so the loosened `destructive` rung gates no web action this week. The
  choice among the three options returns with B.3, Week 2.
  ```

**E55. Three product defects found by the `admin-console` fixture.**
- Current tag: `[OPEN — three product defects …]`.
- True status: open, with no ruling. Ranked Later (R21).
- `admin-console` is not in `packages/test-runner/src/bench/corpus/week1.ts`.
- Tag if ruled: `[RULED OUT OF WEEK 1 — the fixture is outside the week1 corpus]`
- Resolution if ruled:
  ```
  **Ruled out of Week 1, 2026-09-13.** The exit criteria are measured on the week1 corpus, which
  excludes `admin-console` by the decision this entry records; virtualised lists, open shadow roots
  and pane scrolling are Week 2 recorder and resolver work.
  ```

**E57. Snapshot and evidence capture cost seconds on a realistic page.**
- Current tag: `[OPEN — real-page viability, not correctness]`.
- True status: open, with no ruling. Ranked as a Week 2 entry (R20).
- `content/dom-snapshot.ts:46` is still `MAX_SNAPSHOT_CANDIDATES = 2_000`.
- Tag if ruled: `[RULED OUT OF WEEK 1 — real-page capture cost is Week 2; no week1 page is that size]`
- Resolution if ruled:
  ```
  **Ruled out of Week 1, 2026-09-13.** Criterion 5 compares bench A with bench B on the same small
  pages, so this cost cannot move a Week 1 figure; it becomes a Week 1 blocker only if a bench p95
  outside tolerance traces to capture (ranking R20).
  ```

**E58. Scale findings from the `member-directory` fixture.**
- Current tag: `[OPEN — scale findings …]`.
- True status: open, with no ruling (R20, R21).
- `member-directory` is not in the week1 corpus.
- Tag if ruled: `[RULED OUT OF WEEK 1 — capacity caps and harness blind spots are Week 2]`
- Resolution if ruled:
  ```
  **Ruled out of Week 1, 2026-09-13.** Neither cap is reached by a week1 page. The harness being more
  permissive than a real page, and the testid-only fact vocabulary, are Week 2 tooling work.
  ```

### 1c. Entries whose tag stands unchanged

These need no edit. Each was spot-checked only where a later change could have moved it.

| Entry | Tag | Checked |
| --- | --- | --- |
| E5 disabled option selectable | SETTLED 2026-09-12 | not re-read |
| E6 verb dispatcher `return await` | SETTLED 2026-09-12 | not re-read |
| E8 e2e specs type-checked | SETTLED — confirmed | not re-read |
| E10 `timed_out` survives the domain hop | SETTLED — re-verified | not re-read |
| E11 gateway mapping lifts parameters | SETTLED 2026-09-12 | not re-read |
| E14 domain accessible-name field | SETTLED — re-verified | not re-read |
| E16 two page-scheme lists | SETTLED 2026-09-12 | not re-read |
| E17 capabilities page | SETTLED 2026-09-12 | not re-read |
| E21 action type joined through the node | SETTLED 2026-09-12 | not re-read |
| E22 two dead dependency members | SETTLED — with residue | residue still true: `waits.ts:79,87` exported |
| E23 node join in the run manifest | SETTLED — re-verified | not re-read |
| E24 eight URL classes | SETTLED 2026-09-12 | not re-read |
| E27 expectation seam | SETTLED — re-verified | not re-read |
| E29 redaction exits | SETTLED — all four gaps | not re-read |
| E30 six content specs | SETTLED 2026-09-12 | not re-read |
| E31 domain package outside a bundler | SETTLED | import now at `demo-llm-create-ui/generation-failure.ts:13` |
| E33 three `truncated` flags | SETTLED 2026-09-12 | not re-read |
| E34 `elements.count` | SETTLED 2026-09-12 | not re-read |
| E35 per-reason rejection codes | SETTLED — re-verified | not re-read |
| E36 Level 2 scoring and Core packaging | SETTLED | not re-read |
| E40 `workerActionFailedFailure` | SETTLED — re-verified | not re-read |
| E44 assert rows that cannot fail | SETTLED 2026-09-12 | not re-read |
| E45, E46, E49 records | SETTLED — record | not re-read |
| E47 builder narrowing | SETTLED 2026-09-12 | its "one stale trace" is gone: `validation-outcome.ts` no longer says "bare `string`" (archive "g-small-fixes" edited its comments) |

## 2. Rulings missing from Current State's "Ruled out of Week 1" list

| Item | Reason | Heading |
| --- | --- | --- |
| C8 | Week 4 with Firefox, Phase 4.9 | archive "c-remaining inventory, and the scope it settles" |
| D5, `failure.ts` reading `cause.code` | Not Week 1 unless the bench shows `unknown` rows | archive "i-flow-lane-errors: a failing Flow-lane run loses its own observation" |
| Read-only `lab` commands skipping the build | Costs time, not correctness | archive "i-lab-campaign: what each criterion's Lab proof really needs" |
| B.3, a tier-aware floor in the browser | Week 2 | archive "i-resolver-safety: why the resolver acts wrongly, and D14 amended" |
| Core similarity metadata | The predicate reads Core's contributions as they are | same |
| Core's element-target floor for web (CS2c) | Stays inert; the browser's floor is Week 1's. Covers E41 | same; restated in "Finish-Week-1 session: fifteen settled entries archived" |
| CS1f, browser confidence on a Core record | Deferred unless a criterion 3 row fails live and needs it | archive "g-flow-lane-observation and g-identity-drift-mode land; W26 is CS1d" |
| A soft 404 served 200; a sign-in page served 401 | Week 2 | archive "w19-e4: a click that lands on a refused page fails as navigation_unexpected" |
| A sign-up or change-password form's URL claim as `auth_required` | Week 2 heuristic | archive "w19-e2 and the E1 event id land" |
| A Lab producer for paginated extraction | A recording never yields an extract node; authoring one is Week 2 | archive "g-flow-lane-expectations: the Flow lane judges only what a recording can produce…" |
| A literal split across freed SQLite pages | Known limit, because Core withholds before writing | archive "g-attestation-sqlite and g-attestation-sqlite-reader…" |
| Negative variants on the existing and clone lanes | Stays: the Week 1 bench runs isolated targets. Covers E25 | archive "g-lane-consistency: every lane judges an expected action alike…" |
| Timeout precedence; an appended recording's second root; duplicate edges; Core's `hello` identity; `dataDir` | Sized Later; none needs a Lab run | archive "i-leftover-sizing and i-week2-entry-points…" |
| A stored event's URL keeping its query | Week 2 entry; criterion 2 unaffected, since the leak check scans the whole workspace | same |
| Changing a Flow while it runs, and resume | Week 2; resume needs a design | same |
| W28's trailing-scroll fix | No verdict changes; ranked with recorder fidelity for Week 2 | plan ledger "l-stage2d: the fixes for W15, W25 `too-slow`, W17 and W28 hold live…" |

**Not a ruling, despite `i-ranking-draft` section 2:** PB10b moved **into** Week 1 and landed as
`w19-c2` (Contradiction 1).

The replacement list below is 12 lines. It replaces plan lines 83-91.

```
**Ruled out of Week 1, reasons in the ledger and its archive:**
- Firefox and C8 (Week 4); CS1b; B4, B7, C5, C7 and D4; D5 unless the bench shows `unknown`
  rows; raw snapshot bytes; per-lane distributions; read-only `lab` commands skipping the build.
- Resolver: B.3; Core similarity metadata; Core's web element-target floor stays inert;
  CS1f's Core-served confidence unless a criterion 3 row fails live.
- Core: `failureRoute`; node definitions dropping `expectedState`; `hello` identity; `dataDir`;
  timeout precedence; a second recording root; duplicate edges; changing a running Flow.
- W19's edges: a wrong landing served 200, a soft 404, a 401 sign-in, a sign-up form's URL claim.
- Evidence: a literal split across freed SQLite pages; a stored URL's query (Week 2 entry).
- Rows: W24 `unannounced`; W13 `banner-absent` (P7); W05 `short-catalog`; W28's trailing
  scroll; paginated extraction's Lab producer; negatives on the existing and clone lanes.
  W24, W13 and W05 stay in the corpus and are ranked.
```

If the supervisor rules E2, E53, E54, E55, E57 and E58 as drafted, the list needs the two lines
below. To stay within 12, replace the "W19's edges" and "Evidence" lines with them, and move those
two lines' items into the table above, where their reasons already are. E12 is already covered by
"Firefox", and E51 by "`hello` identity".

```
- Decisions left for Week 2: the patch lane's shape; redaction beyond marked fields; D13's
  `destructive` rung; realistic-fixture defects; real-page capture cost and candidate caps.
```

## 3. Open items that bear on an exit criterion

- **Criterion 1, actions reliable:**
  - E18's watch: any `recording.persistence` failure in either bench (R9).
  - W04's and W08's missing proposal (`i-w04-w08-no-proposal`). This is not an open-questions entry.
  - The archive's "g-recording-completeness" left one gap open: a paired-session discard naming a
    recording Core never created (its report, open question 3). No ruling was found.
- **Criterion 2, evidence useful:**
  - E53, only if the user picks option 2 or 3.
  - B4 reopens if `l-evidence` misses a child frame's items.
  - E51 is ruled Later and does not bear.
- **Criterion 3, deterministic fallback:**
  - E56's Lab proof: W29 refuses, and W20-W23 recover (R6).
  - The accepted cost of design A: W21 `text-only` may refuse. That needs a decision, not a fix.
  - E54, only if the supervisor does not rule it.
- **Criterion 4, failures classified:**
  - E52's rate (R7).
  - D5 reopens if a bench shows `unknown` rows.
- **Criterion 5, bench repeatable:**
  - No open entry bears directly.
  - The archive's "g-lane-consistency" found that a `fixture.invalid` manifest fails a whole bench
    with no run bundle. That is a risk to a complete A or B, and no ruling was found.
  - E57 bears only if a p95 traces to capture.
- **Criterion 6, blockers ranked:** E32's plan text (R14), plus pasting this report's ruled-out list
  and tags.

## What changed and why

- Wrote this report only. No tracked file was edited, and no command was run beyond reads.

## Commands run and observed results

- `git log --format='%h %ad %s' --date=short -3 -- <path>` over six files. It printed:
  - `refusal.ts`: `ab736a1`;
  - `handshake.ts`: `895d68b`, `ab736a1`;
  - `carrier.ts`: `1b6f5df`;
  - `resolve-target.test.ts`: `ba4a17b`, `ab736a1`, `1b6f5df`;
  - `lab-instance.mjs`: `ab736a1`;
  - `redaction.ts`: `ab736a1`, `5e9d97e`.
- Every other check was a Grep, Glob or Read. The results cited above are the ones observed:
  - the Glob for `domain/src/runtime/errors.ts` found no file;
  - a Grep for "bare `string`" in `validation-outcome.ts` found no match;
  - a line count of `connection.ts` gave 360.
- Nothing was built, tested or run in the Lab.

## Not verified

- Settled entries marked "not re-read" in 1c were not re-checked at HEAD.
- Whether `upload`'s files field is required in the action schema. That decides whether E26's
  original example, "a refused upload reaches the page with no files", is now a rejection.
- `playwright.content.config.ts`'s `workers: 4`, cited from the archive.
- `scenario-assertions.ts:62`, the testid-only fact vocabulary behind E56 and E58.
- Nothing in Core (`F:\!FluxIQ`) was read. E51 and E54 rest on the archive.
- The reports `c-remaining.md`, `i-leftover-sizing.md` and `i-week2-entry-points.md` were not
  opened, except one grep hit in `c-remaining.md` (row LR5).

## Open questions or contradictions found

1. **PB10b is recorded both ways.**
   - Archive "g-domain-mapping: … W19 takes Option A" moves PB10b into Week 1, and it landed as
     "w19-c2".
   - But "Finish-Week-1 session: fifteen settled entries archived" still lists PB10b among "not Week 1".
   - `i-ranking-draft` section 2 copies that second line.
   - The later ruling, and the code, say Week 1.
2. **Four settlements have no ledger heading.** E3's retry, E20's instance build root, E28's class
   removal and E37's `action.element` read landed in `ab736a1` or `1b6f5df`. The resolutions above
   cite code and commits. The supervisor may want one ledger line recording the settlements.
3. **Six rulings close items that were raised for the user.** E53, E54 and E56 were raised for the
   user, and E2, E55 and E57-E58 for the supervisor's own decision. The drafted rulings are reasoned
   from archive decisions, but the supervisor must decide whether a ruling may close a question the
   user was asked. E56 in particular is settled by the supervisor's design A, and no heading records
   the user accepting it.
4. **More stale tags than `i-ranking-draft` Q6 names.** Beyond its seven: E4, E7, E9, E12, E20, E25,
   E28, E37, E38, E39, E41, E42, E43 and E50.
