# g-w19-docs — the architecture pages W19's changes left unwritten

Worker report for brief `g-w19-docs` in [finish-week1.md](../briefs/finish-week1.md)
("Eighth dispatch"), with its two amendments (twelfth and seventeenth
dispatches). Written 2026-09-13 against this repository at `32b4324` and Core at
`5845f5d`. No code changed, nothing committed.

## Outcome

**Done.** Both pages now describe what the code at HEAD does for W19:
- **E1:** a click's explained landing, and the event id that names the click.
- **D1 and D1b:** the URL claim a recorded click proposes, for both ways a
  click is recorded, and what the claim never carries.
- **E2:** a failed URL claim on a sign-in gate reports `auth_required`.
- **E3:** an assert is sent once more when its tab was navigating, and no other
  verb is.

The failure taxonomy's stale `AUTH_REQUIRED` and Dispatch bullets are corrected.

**The domain-event half of the D1 paragraph depends on `g-mapper-stored-payload`.**
- The page describes the behaviour the code is designed to have when a click is
  recorded as a click domain event.
- At HEAD that path claims nothing on a real Core recording. The mapper reads a
  stored domain event's payload one level too shallow: `recordedEventPayload`,
  `domain/src/web-panel-host.ts:152-157`, against Core's
  `{ target?, payload }` wrapper at `model/recording-domain.ts:193-196`.
- The page does not describe that defect as intended. The domain-event bullet
  is true of real recordings only once that fix lands.
- The action-entry half is true at HEAD, since `storedStep` (`:200-204`) already
  reads the landing where Core puts it.

## What changed and why

### `docs/architecture/extension-client.md` (+130 lines, no deletions)

- **Action Surface, after the dispatch-rejection paragraph.** Two new paragraphs:
  - **E3.**
    - The `executeAction` message is built once (`action-runner.ts:216-218`) and
      sent by `sendAction` (`:237-250`).
    - Only a `web.dom.assert` is resent (`:246`). The trigger is a refusal
      matching Chrome's no-receiver or closed port/channel wording (`:226`).
    - The resend waits on `waitForTabReady` first, then sends the same message
      to the same frame once (`:247-248`).
    - Every other verb is sent once. A refusal that is not retried is thrown.
      `command-router.ts:29-34` answers it through `browserActionFailure`,
      which builds `web.action.failed` (`action-runner.ts:81-88`).
    - Nothing in the result marks a resend: `sendAction` returns the second
      send's result as-is.
  - **E2.**
    - `authGateFailure` (`results.ts:278-286`) runs over every result
      (`:399`).
    - It needs both halves (`:280`): a sign-in gate (`signInGatePresent`,
      `:374-375`), and either a target matching nothing or a URL claim that
      names a URL (`namedUrlClaim`, `:289-291`).
    - The record's `expected` is the claim (`:283`) and its `actual` is fixed
      words (`:281,284`), never the page's address.
    - A URL claim with no URL is malformed (`assertion-evaluation.ts:170,174`)
      and stays `STATE_MISMATCH` (`results.ts:240-241`).
    - The domain evaluator sends the claim as a `web.dom.assert`
      (`evaluate.ts:114-118`) and keeps a client record whose code is in the
      set (`:145-146`).
- **Recording Evidence, after the domain-event mapping paragraph.** New
  navigation paragraphs, for E1:
  - **General rules.** Only top-frame commits count, and a reload is dropped
    (`recorded-event-intake.ts:117`). The debounce is 250 ms
    (`navigation-recorder.ts:7,82-90`). A commit before the recording started,
    or a return to the starting URL within 10 s, is dropped (`:98-103`). A
    typed navigation is kept unless it repeats the last URL (`:111-115`). Any
    other navigation is dropped inside a click or submit window (`:111`).
  - **A page's own navigation.** A `link` or `form_submit` commit is sent only
    as the landing of an executable click in the same tab within 5 s (`:12,57-59,106-107`).
    - A submit keeps the click it follows only when that click was in the
      submit's own window (`:71-77`).
    - A click that cannot be replayed names nothing
      (`recorded-event-intake.ts:169`). A new recording forgets the last one's
      clicks (`navigation-recorder.ts:135-139`).
  - **What the landing carries** (`recorded-event-intake.ts:137-151`):
    - `transition: "explained"`, `explainedBy` (the click's sequence), and
      `explainedByEventId`;
    - the id is read off the click's own gateway event (`:59-62`), which is
      spelled `web.<sequence>.<eventTimestampMs>` (`gateway-mapping.ts:66`);
    - the URL cut to origin and path, and dropped for an opaque origin
      (`recorded-event-intake.ts:68-75`).
  - **Where the landing goes.**
    - It is sent as a recording event, then as evidence (`:191-194`). It is not
      counted, since only executable events are (`:171-172`).
    - It has no input id, so its metadata crosses untouched
      (`gateway-payloads.ts:75-77`). The domain maps only `typed` to an input
      (`input-model.ts:110-113`).
    - Core stores it as a domain event (`bridge.ts:403-419`).
- **Recording Evidence, after the primary-user-actions paragraph.** New D1 and
  D1b paragraphs:
  - **What the mapper sees.** Core shows it each entry plus up to 32 after it
    (`proposal-candidates.ts:17,38`). The last naming landing wins
    (`click-landing.ts:62-64`).
  - **The claim.** It is exact and path-only (`:67`). It is judged as a
    substring of the page's address (`assertion-evaluation.ts:166-167`).
  - **A click recorded as an `action` entry** (the seventeenth-dispatch
    amendment):
    - it is the live path, because a click is sent with its input id
      (`gateway-payloads.ts:75-77`, `bridge.ts:391-402`);
    - Core stores `metadata.eventId` on the entry (`bridge.ts:400`,
      `io-bridge.ts:24-30,71-78`);
    - a landing matches that stored id verbatim and non-blank
      (`click-landing.ts:57,60,100-103`);
    - the candidate is Core's fallback plus the claim
      (`web-panel-host.ts:174-193`, mirroring `service.ts:5726-5749`);
    - the same-path exclusion cannot apply, since the entry has no URL
      (`click-landing.ts:58-59,66`).
  - **A click recorded as a click domain event:** the id is rebuilt from the
    sequence and timestamp (`:89-93`), with the same-tab sequence fallback
    (`:74-82,110-113`) and the same-path exclusion (`:66`).
    - I added one sentence on the fallback: it reads the tab from
      `metadata.sourceId`, which Core's bridge puts on neither entry
      (`bridge.ts:411,414-418`; Core strips top-level `sourceId` at
      `proposal-candidates.ts:170`).
    - Every landing this extension sends carries the event id, so without that
      sentence the page would describe a live rule that never fires.
  - **Every unlinked click keeps Core's own candidate** (the same amendment):
    - an unlinked, non-click or `policyEligible: false` action entry maps to
      `null` (`web-panel-host.ts:133,175,178,180`);
    - the W25 wait is refused for anything but `input.event`
      (`late-target-wait.ts:68`);
    - so Core's fallback stands (`service.ts:2411`). An unlinked click event
      keeps the mapper's candidate with no expected state
      (`web-panel-host.ts:159-161`).
  - **After a proposal.**
    - Appending a proposal to a Flow writes the claim to
      `parameterValues.expectedState` (`proposal-candidates.ts:90-106`).
    - Core evaluates it only after a succeeded attempt
      (`transition-comparison.ts:105-110`), through the evaluator the host
      binds (`host-runtime.ts:71,102`).

### `docs/architecture/failure-taxonomy.md` (+33, -11), Who Produces What only

- **Result builders bullet, the `AUTH_REQUIRED` clause** (twelfth-dispatch
  amendment):
  - it now gives both halves and both shapes, and says the record never quotes
    the page's address;
  - a URL claim naming no URL, or failing on a page with no gate, stays
    `STATE_MISMATCH`;
  - `page-identity.ts:111-118` never replaces `AUTH_REQUIRED` with
    `PAGE_CHANGED`;
  - it names the heuristic's known false positive: a sign-up or
    password-change form.
- **Dispatch bullet** (the same amendment):
  - it names `USER_INTERVENTION_REQUIRED` for an unsupplied value, whose record
    names paths, never values (`gateway-mapping.ts:350-355`);
  - it gives the checking order: unknown type, unsupplied value, unreadable
    required field (`:120-122,130-149`);
  - it says each refusal goes back as a `failed` result carrying its record
    (`result-mapping.ts:36-46`, called from `gateway-session.ts:28,277`).
- **Worker-side verbs bullet.**
  - It adds `runtime/command-router.ts` as the `ACTION_FAILED` producer for a
    thrown send.
  - It says an assert that met a navigating page is sent once more first (E3).
- **The sentence after the list** ("Two rows of the table have producers the
  list above does not name") now reads "names only in part, or not at all".
  The Dispatch bullet now names one of `USER_INTERVENTION_REQUIRED`'s three
  producers, so the old wording had become false.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`; exit codes captured by redirecting to a file.

1. `git diff --stat HEAD` before any edit printed nothing, so tracked files
   equalled HEAD. Core's `git log --oneline -3` showed `5845f5d`, `187f40d`,
   `73a81e9`.
2. The domain files were read at HEAD with `git show HEAD:<path> | nl -ba`,
   because `g-mapper-stored-payload` edits domain code in parallel:
   `domain/src/runtime/expectation/click-landing.ts` and
   `domain/src/web-panel-host.ts`. By the end, `git status --short` showed
   `domain/src/web-panel-host.ts` modified by that worker. Every line number
   cited for it here and on the page's reasoning is HEAD's.
3. **`pnpm docs:check` does not exist here.** Grep for `docs:check` across every
   `package.json` found no matches, and `grep -c '"docs:check"' package.json`
   printed `0`. The root scripts are `check`, `structure:check`,
   `structure:baseline` and `structure:test`.
4. `node scripts/structure-audit.mjs` was run after the main edits and again
   after the last edit. Both printed `audit-exit=0` and
   `structure-audit: passed (39 warning(s), 17 baselined).` No line names
   `docs/architecture`.
5. **Link targets.** `test -f` from `docs/architecture` printed `ok` for every
   file the new text links to or names by relative path:
   - `action-runner.ts`, `results.ts`, `evaluate.ts`;
   - `navigation-recorder.ts`, `web-panel-host.ts`, `click-landing.ts`;
   - `failure-taxonomy.md`, `command-router.ts`, `result-mapping.ts`,
     `page-identity.ts`.

   Anchors: `## Who Produces What` is at `failure-taxonomy.md:111`, and
   `## Action Surface` at `extension-client.md:108`.
   `domain/src/client/gateway-action-parameters.ts` exists.
6. **Line endings.** Every line of both pages ends in CRLF (467 of 467 and 222
   of 222), and `core.autocrlf` is `true`. Git's "LF will be replaced by CRLF"
   warning is the normal autocrlf message. The diff shows only my hunks, not
   whole-file churn.
7. **Final `git diff --stat`** on the two pages:
   `extension-client.md | 130 +`, `failure-taxonomy.md | 44 +-`,
   `163 insertions(+), 11 deletions(-)`. Hunks sit only in Action Surface and
   Recording Evidence (`extension-client.md`) and in Who Produces What
   (`failure-taxonomy.md`).
8. **Every file:line cited above was opened at HEAD.** Extension files by Read
   or Grep with the tree equal to HEAD; domain files by `git show HEAD:`; Core
   files by Read or Grep at `5845f5d` with a clean tree.

## Not verified

- **The pages were not rendered in a Markdown viewer.** List and code-fence
  structure were checked by reading the diff only.
- **The domain-event path on a real recording.** It claims nothing until
  `g-mapper-stored-payload` lands (see Outcome). If that fix is dropped or
  changes the design, the "As a click domain event" bullet must be revised.
- **Core's `readableTokenValue("web.dom.click")`** was not opened. The page
  spells the fallback label `Web Dom Click` from the domain constant
  (`web-panel-host.ts:164`), which `w19-d1b`'s Core row pins.
- **Proposal approval.** The page says only that appending a proposal to a Flow
  carries the claim. The path that approves a proposal as a node definition,
  which the plan says drops `expectedState`, was not read and is not described.
- **E3 on Firefox.** Firefox's wording for a closed channel is unchecked, so the
  page names Chrome's wording only.
- **No live browser or Lab run.** Every statement rests on code at HEAD and on
  the workers' unit and harness rows, not on an observed recording.

## Open questions or contradictions found

1. **How I read "the producer paragraphs".** I took it to mean the Who Produces
   What section, so I also edited the worker-side verbs bullet (for E3) and one
   sentence of the paragraph after the list (`:167-168`). If the supervisor
   meant something narrower, revert those two edits. The sentence's old wording
   became false once the Dispatch bullet named `USER_INTERVENTION_REQUIRED`.
2. **`failure-taxonomy.md:5`** still reads "verified against source on
   2026-09-12". That line is outside my sections.
3. **A URL claim's `validation.actual` still quotes the full address**
   (`assertion-evaluation.ts:171`, `the page URL is ${href}`).
   - The failure record does not, which is what the pages describe.
   - The taxonomy's Comparison Text section says `expected` and `actual` are
     never raw page content. It is scoped to the failure record, but a reader
     could take it to cover validation too.
   - `w19-e2` raised this too. It needs an owner of `assertion-evaluation.ts`.
4. **The same-tab sequence fallback is inert live** (item on the page). Making
   it work would need Core to copy `sourceId` into a landing's metadata
   (`bridge.ts:414-418`). This is `g-core-action-entry-identity` open question
   1, and not Week 1 work as far as I know.
5. **A stale comment in `apps/extension/src/content/actions/assert.ts:34-43`**,
   raised by `w19-e2`, was not re-checked. It is outside this brief.
6. **Structure baseline:** no entry needs changing.
