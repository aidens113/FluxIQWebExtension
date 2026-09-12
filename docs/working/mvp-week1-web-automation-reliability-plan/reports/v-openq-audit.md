# v-openq-audit — audit of open-questions.md against the tree

## Outcome

Done. All 50 entries in
`docs/working/mvp-week1-web-automation-reliability-plan/open-questions.md` are
audited and tagged. **26 were settled** — 18 of them silently, having been
closed by `ed6ab74`, `ee25ac9` or `11d2ed3` with no marking, exactly the failure
that produced this task. **6 were live but wrongly described**, each in a way
that would have sent a worker at the wrong files. No source, test, or
configuration was touched.

## What changed and why

One file changed: `open-questions.md`. Every entry now carries a status tag on
its lead line and a closing paragraph naming the file and line that was read to
reach that conclusion. No entry's original text was altered or deleted — a
line-level diff of the sorted before/after files shows exactly 50 removed lines,
which are the 50 lead lines, each reappearing with its tag prefixed.

A legend was added to the header explaining the five tags, plus the reason they
exist: an unmarked settled entry is indistinguishable from a live one and costs
a whole worker. It also states the rule this audit kept finding reasons for — a
worker's report is not evidence that an entry is closed, because three entries
were settled by commits whose own reports had claimed something narrower or
wider than what the tree actually did.

### The four leads in the brief, checked

Every one of them had a matching entry, and every one was already closed:

- **Verb dispatcher awaiting every branch.** `content/actions/execute.ts:55-99`
  — all fifteen branches are `return await`; header rewritten at lines 7-25;
  `content/actions/tests/execute.test.ts` exists. **The entry named the wrong
  branches**: it said "extract-list, upload, dialog and assert", but `upload`
  and `dialog` are synchronous and never had the defect, while `scroll` is
  asynchronous and did. `execute.ts:19-22` now records the correct three.
- **End-to-end specs type-checked.** `apps/extension/tsconfig.test.json` include
  is `["src/**/*.ts", "e2e/**/*.ts"]`, exclude `[]`.
- **Domain lifting every action parameter.** `gateway-mapping.ts:138` spreads
  `webAutomationLiftedActionParameters`; `gateway-action-parameters.ts:61-70`
  lifts all ten Wave 2 parameters plus the four envelope fields.
- **One page-scheme rule.** `background/connection/browser-state.ts:39-45` calls
  `unsupportedAutomationPageReason` from `runtime/unsupported-page.ts` and maps
  only the wording locally.
- **Disabled/hidden/covered refused with a reason.** `select.ts:52`,
  `type.ts:37`, `clear.ts:29`, `keypress.ts:33` all call
  `deps.checkActionability`; the disabled *option* case the entry is named for is
  refused at `select.ts:81-90`.

### The six entries that were live but wrongly described

This is the category the brief called most valuable, so each is spelled out.

1. **Credentials at replay.** The mechanism landed and is used by nothing.
   `flow-lane/declared-secrets.ts` resolves secrets from the environment and
   fails closed; `run-flow-lane.ts:79` merges them into the Flow run's inputs;
   `packages/test-contracts/src/scenario.ts:158` declares `secrets` on the
   manifest contract. But a grep for `secrets:` across every manifest returns
   nothing, and `auth-gate/manifest.ts:19-20` still carries the password as a
   literal. Inert wiring, the same shape as the run-manifest join.
2. **The extension latches idle on `recording.project_required`.** "The user sees
   no reason" is no longer true — `connection.ts:597-601` now writes a
   `RecordingBlockState` titled "Project Required", carried on the status
   (`protocol.ts:146`) and rendered by `popup/index.ts:454`, which the side panel
   inherits (`sidepanel/index.ts` is one line: `import "../popup/index";`). What
   remains is only that `clearPendingRecordingStart()` at `connection.ts:589`
   still kills the 750 ms fallback, and the block is not a classified failure.
3. **The expired auth-gate workflow (W19).** The cause is unchanged
   (`io/input-model.ts:109-112` still requires `transition === "typed"`), but the
   entry's stated blocker is gone: both closers it named now exist —
   `web.dom.assert` shipped in Wave 2, and the expectation evaluator is bound at
   `host-runtime.ts:102`. It is unbriefed work, not blocked work.
4. **`pnpm lab` deletes tracked build artifacts.** The chain drifted. Root `lab`
   no longer chains `pnpm build`; it chains the extension's `test:e2e:build`,
   which *is* `pnpm build` (`apps/extension/package.json:11` → `:7`) → 
   `build-extension.mjs:58` `rm(buildDir, { recursive: true, force: true })`. The
   trap is intact and the count is now ten tracked files, not eight.
5. **"Corrected: the fingerprint does reach the content script."** Its remaining
   ask half-landed into a worse state than either end. The declared field exists
   (`domain/src/actions/types.ts:189`, populated at `gateway-mapping.ts:137`) but
   **nothing reads it**: `resolve-target.ts:362-366` still reads only
   `action.options?.element`. The typed path is write-only, so deleting the
   untyped blob would silently cost the resolver every identity signal with the
   compiler green.
6. **"Half of the headline audit finding is now closed."** The candidates half is
   described as blocked on Core packaging. It is not: `11d2ed3` closed the
   packaging problem and Level 2 landed, so the content script now enumerates
   candidates and scores them with Core's own matcher in the browser
   (`content/identity/score.ts`, `resolve-target.ts:27-42`). What is still true
   is narrower — nothing populates `candidates` on the *wire*
   (`gateway-mapping.ts:178-181` still says so) — and it is now a design question
   about whether the wire ever needs them, not a blocked task.

## Commands run and observed results

All verification was reading the tree; no build or test gate was run, because
the brief forbids touching source and several workers are editing concurrently.

- `git log -1 --format=%B ed6ab74 | ee25ac9 | 11d2ed3` — read all three; each
  names work that closed entries here.
- Roughly forty `grep`/`sed` reads across `apps/extension/src`,
  `apps/extension/e2e`, `domain/src`, `packages/test-runner/src`,
  `apps/scenario-lab/src`, `docs/architecture/`, `scripts/structure-audit/` and
  the package manifests. Each settled entry's closing paragraph names what was
  read.
- `node scratchpad/mark-openq.mjs` → `entries marked: 50`.
- `diff <(sort before) <(sort after) | grep "^<" | wc -l` → `50`, i.e. the only
  lines removed are the 50 lead lines that were re-emitted with tags. File grew
  613 → 1053 lines.
- `grep -c` per tag → SETTLED 26, OPEN 21 (5 bare, 10 qualified, 6 corrected),
  PARTLY SETTLED 2, SUPERSEDED 1. Total 50.
- `git status --porcelain docs/` → the only file I modified is
  `open-questions.md`. (`docs/architecture/repository-layout.md` and nine
  untracked `reports/v-*.md` are other workers' concurrent work.)

## Not verified

- **Two entries are environmental and unverifiable by reading**: the `tsc`
  access violations under parallel load, and the content harness failing
  uniformly under default Playwright concurrency. I corroborated the second from
  both Wave 3 commit messages, which record the harness green only at
  `--workers=4`; I did not reproduce either.
- **`domain/.test-build/` staleness is inferred from timestamps**, not from a
  rebuild: `domain.test.mjs` is dated 2026-09-11 00:05, before every Wave 3
  domain change. Running the domain tests would have rewritten tracked files.
- **The `connection.ts` method count of 40** comes from a regex over
  class-indent declarations, so read it as 39 or 40. Either way it is at or on
  the `classMethods: 40` hard limit, not the 25-method advisory.
- **The three "recorded" entries** (page evidence live, joinery test, merged
  event size) I checked only for existence and consistency, not by re-tracing
  every link — they are records of resolved work, not live questions.
- **The tree is moving.** Thirty-odd source files were modified in the working
  tree while I read it. Every line reference is to the working tree as of this
  audit, not to `11d2ed3`.

## Open questions or contradictions found

Three stale statements elsewhere, noted as the brief asked and **not fixed** —
all confirmed by reading:

1. **Three verb headers describe a dispatcher that no longer exists.**
   `content/actions/assert.ts:57-59` ("`execute.ts` returns this verb's promise
   from inside its try block without awaiting it"), `extract-list.ts:9-12` ("The
   capability is awaited inside this verb rather than returned to `execute.ts`,
   whose `try` block does not await what it returns"), and `scroll.ts:19-22`
   ("`actions/execute.ts` returns its promise rather than awaiting it"). All
   three now contradict `execute.ts`, which awaits every branch. The defensive
   catches they describe are still correct and worth keeping — only the stated
   reason is wrong.
2. **`execute.ts:100` reports an unsupported action type as retryable
   `ACTION_FAILED`.** The `throw new Error(...)` falls to the catch at line 101 →
   `deps.failure` → `ACTION_FAILED`, which
   `domain/src/runtime/failure/codes.ts:114` binds to `action_failed`,
   **retryable: true**, stage `execution`. The set already carries
   `UNSUPPORTED_TYPE` (`web.action.unsupported_type`, line 47) bound to
   `blocked_by_capability_or_policy`, **retryable: false**, stage `dispatch` —
   defined verbatim as "The client does not implement the requested action type
   at all". So Core is currently told to retry a verb this client will never
   implement. The domain already returns the right rejection for an unknown type
   at the gateway (`gateway-mapping.ts:122-125`); only the content-script
   fallthrough disagrees.
3. **New find, same shape.** `content/action-runtime/validation-outcome.ts:24-28`
   still warns that the record type "types `code` as a bare `string`, because
   Core owns the categories". That is no longer true: `domain/src/actions/
   types.ts:284` declares `failure?: WebAutomationFailureRecord`, whose `code` is
   narrowed to the closed set at `failure/codes.ts:75`. The comment argues
   against reinstating deleted builders on a premise the tree has since fixed.

**One contradiction inside the file itself**: the runtime-error entry and
sub-item 2 of the Wave 3 integration checklist are the same open question
written twice, and the two `--workers=4` operational entries are the same defect
found twice by different workers. Both pairs are cross-referenced now; merge at
the next compaction.

---

## Counts

- **Entries audited: 50** (every entry in the file).
- **Settled: 26.** Eighteen of these were closed but unmarked — the file was
  claiming as live more than a third of what it held.
- **Still open, accurately described: 15.**
- **Still open but wrongly described, now corrected: 6.**
- **Partly settled (mixed sub-items): 2** — the shared `actions.spec.ts` entry,
  and the Wave 3 integration checklist, of whose six sub-items two are closed,
  three are live, and one is a process note.
- **Superseded: 1** (duplicate `--workers=4` operational entry).

## What to act on next, ranked by consequence

1. **The silently dropped recorded action.** Still open, still undiagnosed,
   still the only known defect where the product loses a user's action and
   reports success. Wave 5 cannot measure reliability against a number it cannot
   explain. Reproduce it deliberately before then.
2. **`connection.ts` is at the class-method hard limit** — 40 against
   `classMethods: 40`, and 745 of 800 lines. This does not warn; the next change
   to that file fails `pnpm check`. It will ambush whatever task touches it
   first. Split it as a task of its own, not inside another one.
3. **The fingerprint's declared field is write-only.** One line in
   `resolve-target.ts` `recordedTarget()` — prefer `action.element`, fall back to
   `action.options?.element`. Until then, any tidy-up that removes the untyped
   `options` blob silently destroys target resolution while the compiler stays
   green.
4. **`WebAutomationRuntimeError` has no producer and an open `code` type.**
   `errors.ts:2` is still `readonly code: string`, and the only constructions in
   the repository are in `classify.test.ts`. Two lines to narrow, plus a real
   producer — otherwise the classifier is dead code behind a permissive door.
   This is the entry the plan's own Wave 3 integration step 3 said the wave would
   close, and it did not.
5. **`action-runner.ts:218` sends `topFrameOnly` for `capture_snapshot`.** Frame
   coverage cannot match the state pipeline, which merges every frame. The
   evidence work of Wave 3 rests on that merge.
6. **W19 is unblocked and unbriefed.** Both closers landed. Brief it, or record
   the decision to leave the auth-gate expired lane failing.
7. **Credentials at replay: adopt the machinery that exists.** One manifest edit
   plus an environment variable turns built-and-untested into proven. Inert
   wiring is this plan's recurring defect; this is the cheapest instance of it.
8. **Regenerate the tracked `domain/.test-build/`.** One unlabelled domain test
   run on a still tree.
9. **Correct the plan's failure-vocabulary text** at
   `mvp-week1-web-automation-reliability-plan.md:591-592` and `:600-601`. The
   code is right; the plan still says the runner's allowlist derives from
   `codes.ts`, which is how the next brief repeats the conflation.
10. **Give `actions.spec.ts` an owner, and decide about `pnpm lab`.** Both are
    known traps with known fixes and no urgency.
