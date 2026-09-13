# w25-wait-mapper — a wait before a click whose target a DOM addition produced (domain)

Worker report, 2026-09-13. Brief: `briefs/finish-week1.md`, "w25-wait-mapper", with
the fifteenth-dispatch amendment. Built on `e8a725e` (w19-d1); HEAD at the end was
`c49a75d`. Core read at the `F:\!FluxIQ` working tree; Core was not built or edited.

## Outcome

Done. A recorded DOM addition now proposes `web.dom.wait_for_selector` for the next
click's target, from the mutation's own mapper call. A click's `action` entry still
maps to `null`, so Core's fallback click is untouched, and w19-d1's landing claim is
unchanged. All seven option-2 rows are covered. Six guards each have a mutation proof,
and every broken file was restored byte-identical. The checkbox comment in
`input-model.ts` is corrected. delayed-ui's `expected.actions` needed no change.

Three deviations or judgement calls need the supervisor's eye. They are explained under
"Open questions":
1. The mapper returns the wait as a single candidate, not `{ candidates: [...] }`.
2. At Core `c0e0ce9` a live click carries no URL, so "same document" is inferred on the
   live path rather than proved.
3. The candidate also has `confidence: 0.9` and `label: "Wait for element"`.

## What changed and why

**New builder: `domain/src/recording/proposals/late-target-wait.ts`**, exporting
`webAutomationLateTargetWait(step, following)`. It has a barrel,
`domain/src/recording/proposals/index.ts`, and a test,
`domain/src/recording/proposals/tests/late-target-wait.test.ts` (9 tests).
- **Starts from:** a step whose event type is `input.event`, whose
  `payload.latestEvidence.kind` is `dom.mutation`, and whose `mutation.added` is a
  number above 0.
  - The shape was confirmed in Core: `bridge.ts:606-613` passes the state update's
    `state` as the payload, and `io-bridge.ts:53-62` writes it as
    `observationType: "input.event"`.
  - The mapper's `recordedStep` unwraps that to `{ latestEvidence }`.
- **Walks `following` to the first executable entry.**
  - An `action` entry counts by its `outputId`, or `actionType` if that is missing.
  - Any other entry counts when `webAutomationRecordedAction` maps it.
  - Everything else is evidence and is skipped.
- **Proposes the wait only when that entry is a `web.dom.click` with a non-empty
  `selector`, in the same document.**
  - The click's `browserFrameId` is absent or 0. The wait names no frame, so it runs
    in the top document.
  - When the click carries its own `url` (the recorded-event form), that URL equals the
    mutation's `latestEvidence.url`, ignoring the fragment.
  - No skipped evidence names a different URL (its `payload.url` or
    `latestEvidence.url`).
- **Returns** `{ outputId: "web.dom.wait_for_selector", parameters: { selector, wait: { condition: "present" } }, confidence: 0.9, label: "Wait for element" }`.
  It has no `timeoutMs`, no `sourceInputIds` and no `expectedConfirmation`.
- **The output is valid for Core.**
  - `web.dom.wait_for_selector` is in `WEB_AUTOMATION_ACTION_TYPES`
    (`actions/types.ts:393`), so the mapper declares it.
  - It is a registered output: `io/manifest-definitions.ts:12` maps every action
    definition.
  - Its schema accepts `wait.condition: "present"` (`actions/schemas.ts:65-73`,
    `:111-119`), and the content script handles `present`
    (`wait-conditions.ts:58`).

**`domain/src/web-panel-host.ts`, the mapper only.**
- Imports the builder through the new barrel.
- `if (!action) return null;` became
  `if (!action) return webAutomationLateTargetWait(step, (context?.following ?? []).map(recordedStep)) ?? null;`.
- Adds four doc-comment lines.
- w19-d1's click-landing line is untouched. The mapper's return type is unchanged.
- The structure baseline's `imports` entry for this file (2) did not move, because the
  new import goes through a barrel.

**`domain/src/tests/domain.test.ts`, new rows only (+12 lines).** They sit after the D1
block. The entries are shaped as Core hands them to the mapper: the mutation as an
`observation` with payload `{ type, observationType: "input.event", payload: { latestEvidence } }`
(`proposal-candidates.ts:169-171`), and the click as an `action` entry whose
`parameters` are `webAutomationOutputPayload("web.dom.click", …)` (`io-bridge.ts:31-49`).
The rows:
- a mutation that added nodes, with the click after it, gives exactly the wait;
- a mutation with `added: 0` gives `null`;
- a mutation with no context gives `null`;
- the click's `action` entry gives `null`.

**`domain/src/io/input-model.ts`, the checkbox comment only (`:181-184`).**
- **Old text:** "Until the recorder reports the state … the toggle stays evidence".
  It was stale: the recorder now reports it (`reports/g-recorder-signals.md` items 1-2).
- **Checked at HEAD:** `content/describe-element.ts:69-70` sets `descriptor.checked`,
  and `:170-174` returns `undefined` for a sensitive control.
- **New text:** the recorder reports a checkbox's `checked`, `recordedCheckedState`
  (`payloads.ts`) reads it, and a sensitive control withholds it, so that toggle stays
  evidence.
- The file grew from 3 lines to 4. It is not a line-baselined file.

**delayed-ui: no change.** `packages/test-runner/src/flow-lane/expectations.ts:7-19` loops
over the expected entries. It requires only that `actions.some(...)` has the same
`actionType` and `status` for each one. Order, count and extra attempts are ignored.
- **Unarmed**, `[click succeeded, wait succeeded]` (`scenario.ts:41`), is satisfied by
  the three generated attempts: click, wait, click.
- **`too-slow`**, `[click succeeded, wait failed]` (`:49`), is satisfied by the first
  click and then the failed wait.
- Listing the second click would add nothing, because the first click already matches
  `web.dom.click:succeeded`.

**How the seven option-2 rows are covered.**

| Row | Where |
| --- | --- |
| Mutation then click, same document → wait | unit tests 96 and 98; the `domain.test.ts` W25 row 1 |
| `added: 0` → none | unit test 99; `domain.test.ts` W25 row 2 |
| Next executable is a type → none | unit test 100, in both forms, with a click after the type |
| Coordinates-only click → none | unit test 101 (no selector; empty selector) |
| Different document or frame → none | unit test 102: click URL; unparseable mutation URL; evidence between; live and recorded child frame; frame 0 still waits |
| No following entry → none | unit test 103; `domain.test.ts` W25 row 3 |
| An `action` click still maps to `null` | unit test 104; `domain.test.ts` W25 row 4 |

Unit test 97 pins the absence of `timeoutMs`, `sourceInputIds` and
`expectedConfirmation`.

## Commands run and observed results

Every command was run alone, with output redirected to a scratch file and `$?` echoed.

| Command | Observed |
| --- | --- |
| `pnpm check` in `domain` | `exit=0` (`tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`) |
| `DOMAIN_TEST_BUILD_LABEL=wwm pnpm test` in `domain` | `exit=0`; `# tests 373`, `# pass 373`, `# fail 0`; "Web automation domain smoke test passed."; `ok 96` … `ok 104`, the nine new unit tests |
| Structure audit with the three new files added to a scratch `GIT_INDEX_FILE` (copied from `.git/index`) | `exit=0`; "structure-audit: passed (39 warning(s), 17 baselined)". No finding names `proposals`, `web-panel-host`, `domain.test` or `input-model` |
| Final rerun of the same domain tests on the restored files | `exit=0`; `# tests 373`, `# pass 373`, `# fail 0` |

**Mutation proofs.** Each file was copied to a scratch backup, broken with `sed`, run
through the full domain suite, then restored from the backup. The SHA-256 hashes before
and after are identical:
- `web-panel-host.ts`: `651b62af…4291f6a`;
- `late-target-wait.ts`: `87989b8e…34291f6a`, the full hash in the run logs being
  `87989b8e11e7aaeae93084198bfbcd45405a56a4931f761e4a39596c7f2295b1`.

| Run | Break | Observed |
| --- | --- | --- |
| A | M1, drop the builder call: `if (!action) return null;` | `exit=1`; "Domain test entry failed to load: src/tests/domain.test.ts"; "AssertionError [ERR_ASSERTION]: W25: a mutation that added nodes proposes waiting for the next click's target", with `+ null` against the expected wait |
| A | M4, `added > 0` weakened to `added >= 0` | "not ok 99 - a batch that added nothing proposes nothing" (the actual was the wait) |
| A | M6, the empty-selector guard removed | "not ok 101 - a click with no selector proposes nothing" (the actual was a wait with `selector: undefined`) |
| A | Totals | `# pass 371`, `# fail 2`, plus the one entry that failed to load |
| B | M5, the click-URL document check removed | `exit=1`; "not ok 102 - a click in another document or frame proposes nothing", error "the click names another URL"; `# pass 372`, `# fail 1` |
| C | M3, the check on skipped evidence naming another URL removed | `exit=1`; "not ok 102 …", error "evidence between them names another URL"; `# pass 372`, `# fail 1` |
| D | M2, the child-frame check removed | `exit=1`; "not ok 102 …", error "a live click in a child frame"; `# pass 372`, `# fail 1` |

M1, M4 and M6 were combined in run A because each breaks a different test. M5, M3 and
M2 share test 102, where the first failing assertion would hide the next, so each ran
alone.

## Not verified

**What a Lab run must show.** These are the report's option-2 proof. None was run, as
no Lab command was allowed.
- `delayed-ui --flow`, 3 of 3: actions `web.dom.click:succeeded`,
  `web.dom.wait_for_selector:succeeded`, `web.dom.click:succeeded`, with the wait node
  proposed before the late click.
- `delayed-ui --flow --variant too-slow`, 3 of 3:
  - failure `timeout` / `web.action.timeout`;
  - final state `late-action-absent`, read before the 20 s reveal.
  - The proposed wait has no `timeoutMs`, so the content default of 10 s applies, not
    the recording script's 1,000 ms. I did not check that a `wait_for_selector` timeout
    reports exactly that category and code.
- `modal-flows` interstitial, unarmed and `armed`, keep their verdicts.
- `iframe-checkout` has no wait node.
- The identity-drift variants and `ambiguous-targets` are unchanged. See open question 4.
- The recording lane still passes every row that pins `web.dom.mutated`.

**Also not verified:**
- **The recorder's ordering.** The rule depends on `f-recorder-mutation-flush`, which is
  finished but not committed, to put a mutation before the click it enabled. My rows
  build the timeline by hand and do not exercise the recorder.
- **Other packages.** Extension, scenario-lab, test-runner and the content harness were
  not run; I changed nothing there. Root `pnpm check`, `pnpm test` and `pnpm build` were
  not run. The tracked `domain/.test-build/` was not regenerated, since I used the
  private label.
- **Core's code.** Its shapes were read from the Core working tree, which the in-flight
  `g-core-action-entry-identity` is editing. At the time I read it, `io-bridge.ts:24-29`
  still had only `domainId`, `inputId`, `inputRole` and `envelopeId`. The copy of
  `eventId` and `sourceId` it adds does not change anything this rule reads.

## Open questions or contradictions found

1. **A single candidate, not `{ candidates: [...] }`.**
   - **Why:** returning the brief's literal form would widen `mapWebRecordingObservation`'s
     return type to `AutomationStudioRecordingMapperResult`. That breaks compilation of
     existing `domain.test.ts` rows, which read `.outputId`, `.parameters`,
     `.sourceInputIds`, `.expectedConfirmation`, `.label` and `.expectedState` straight
     off the result (about `:48`, `:99-102`, `:124-132`, `:143-152`, `:164`). This brief
     owns new rows only.
   - **Behaviour is the same:** Core handles both forms identically
     (`service.ts:2406`: `"candidates" in mapped ? mapped.candidates : [mapped]`).
   - **Later:** if `w19-d1b` or a later brief needs several candidates from one call, it
     should own those existing rows as well.
2. **"Same document" cannot be proved for a live click at `c0e0ce9`.**
   - **What a live click carries:** Core's `action` entry payload is the entry minus its
     id, timestamp, sequence, `sourceId` and metadata (`proposal-candidates.ts:169-171`).
     Its `parameters` hold selector, element, visualTarget and `browserFrameId`
     (`payloads.ts:39-45`), and never a URL.
   - **After the Core change:** `g-core-action-entry-identity` adds `eventId` and
     `sourceId`, still with no URL.
   - **Why not require a URL:** requiring the click's own URL would make the rule inert
     on exactly the path W25 needs.
   - **What I did instead:** the click's frame must be the top document, the click's own
     URL must match when it has one, and no skipped evidence may name another URL.
   - **Remaining gap:** the mutation's `latestEvidence` carries no frame id.
     `recording-evidence.ts` puts `frameId` only on the state update's metadata, which
     `io-bridge.ts` drops. The state update's `sourceId` is
     `client.<id>.observations` (`bridge.ts:611`), which names no frame either.
   - **Effect of the gap:** a child frame's DOM addition, followed directly by a
     top-document click, would propose a wait for the top-document click's own selector.
     That wait succeeds whenever the click could, but it is a node the Flow does not
     need.
   - **Closing it** needs a frame on the recorded mutation evidence, which is an
     extension payload change, not something the domain can do.
3. **Two waits for one click are possible.** A debounced batch and then the flushed batch
   can both precede the same click, and each proposes a wait for the same selector. Both
   succeed once the target exists, and `expectations.ts` ignores count. I did not dedupe,
   because the brief did not ask for it. Should only the last addition before a click
   propose?
4. **The wait matches by CSS selector only.** The brief's parameters carry no element
   fingerprint. If a click's recorded selector no longer matches, but Core's fingerprint
   fallback would still find the element (the identity-drift variants), the wait could
   run out at 10 s before the click is attempted. That would turn a passing drift row
   into a `timeout`. The Lab checks above must show whether any drift variant records a
   DOM addition before its click.
5. **`confidence: 0.9` and `label: "Wait for element"` were not in the brief.**
   - **Confidence:** Core applies no confidence threshold to recording candidates. A
     grep found only 0-1 range validation, and `io-policy.ts:256`, which is policy
     matching. Without it, Core clamps a missing value to 0.5 (`proposal-candidates.ts:174-176`).
     0.9 matches every other domain candidate (`candidate()` in `web-panel-host.ts`).
   - **Label:** without it the node label would be the raw output id
     (`proposal-candidates.ts:100`).
6. **A recorded click with no selector counts as evidence, not as a stopping point.**
   Following "skipping evidence" literally, the scan passes over it to a later click.
   Only the `action` form, which a live recording never produces without a selector,
   stops on a click with no selector.
7. **`aria-checked` is still not captured.** A grep for `aria-checked` in
   `apps/extension/src/content` outside tests found nothing. So
   `payloads.ts:112-114`'s custom-toggle branch reads a field that never arrives. This
   was `g-recorder-signals`' open question; the corrected comment does not claim it.
8. **delayed-ui's comment is loose, but still holds.** `scenario.ts:16-19` says the armed
   delay is "twenty times the recorded 1,000 ms wait". The proposed wait now uses the
   10 s content default, not 1,000 ms; the comment's second reason (twice that default)
   still holds. Left as is, since the scenario is owned only if its expectations need
   changing.
