# Report: w1-capability-docs

Brief: `### Brief: w1-capability-docs` in `../briefs/wave-1.md` (Phase 1.1
step 5, current-state documentation). Includes the supervisor's mid-task
note on w1-domain-mappings, which is reflected here.

## Outcome

Done.
- New page: `docs/architecture/web-capabilities.md`.
- `docs/architecture/extension-client.md`: the stale claims are corrected,
  and every correction was checked against source first.
- There is no architecture index, so no index line was added.
- All 22 relative links in the two pages resolve.
- No matrix row changed state from the audit.

## What changed and why

### `docs/architecture/web-capabilities.md` (new, 229 lines, untracked)

- **Opening paragraph.** Says the page is current-state design, updated at
  every phase close. It links the audit it came from, the Week 1 plan, and
  `extension-client.md`.
- **Reading The Matrix.** Defines the four states, the "Outcome validated"
  column, and the "Changed by" column.
- **Summary.** 1/10/3/10; represented 14, executed 14, observed 13,
  validated 0 of 24.
- **How An Action Runs.** The gateway → domain → runtime → content-dispatcher
  path, using the decomposed file paths.
- **Capability Matrix.** 24 rows. Each row gives state, outcome validated,
  representation, owning files, the Phase 1.2 step that changes it, and the
  reason.
- **Actions Outside The 24.** `capture_snapshot` and the legacy aliases.
- **Behaviour Across All Rows.** Five subsections:
  - Action type resolution. Unknown types are rejected with
    `status: "rejected"`, `code: "ACTION_REJECTED"`. The extension half is
    marked **pending**: `runtime/result-mapping.ts` casts the rejection, and
    the content dispatcher fails it as `Unsupported action type`.
  - Safety classification: one registry.
  - Recorded actions:
    - one mapper, `webAutomationRecordedAction`, keeps the fingerprint;
    - the completeness gate means an event lacking a required parameter is
      evidence only;
    - scroll is keyed on `dom.scroll`;
    - the hub accepts a top-level `domainId`.
  - Recorder trust and runtime confirmations.
  - Results and failures.

### Matrix rows whose state changed from the audit

None. I checked each Wave 1 change against the rows:
- **Unknown-type rejection and the safety registry** are cross-cutting, not
  capability rows. They are described in their own sections.
- **The recorder's `isTrusted` guard and the `type`/`select` confirmation
  values** change the recording path, not whether a capability executes.
- **The scroll input fix** makes a recorded user scroll executable. The
  Scroll row keeps "Partially supported" because its execution limits are
  unchanged: absolute window offsets only. I added that sentence to the row.
- **The content-script decomposition.** I re-checked each audit reason in the
  new files:
  - `content/actions/click.ts:9` still calls `.click()`.
  - `keypress.ts:9-10` sends a `KeyboardEvent` with `key` only.
  - `select.ts:9` does `element.value =`.
  - `type.ts:9-10` uses the setter plus one dispatch.
  - `scroll.ts:7` uses `window.scrollTo`.
  - `action-runtime/waits.ts:4,24` has a 10 s default and a `MutationObserver`.
  - `action-runtime/results.ts:29-52`: `success()` is unconditional.
  - `action-runtime/resolve-target.ts:11,16,22,36-37` resolves one element
    and throws on a miss.
  - `runtime/action-runner.ts:23` still sets `forceNew = true`.
  - Nothing produces `timed_out`/`cancelled` (grep empty).
  - The manifests have no `downloads`/`debugger`.
  - There is no `chrome.downloads`, `tabs.remove`, `DataTransfer` or `.files`
    anywhere.
  - `schemas.ts:92` gives extract only `selectorSchema`; no `mode` or
    `attribute` appears in `schemas.ts`, `definitions.ts` or `payloads.ts`.
  - `gateway-mapping.ts:107-119` sets no `tabId` or `frameId`.

Row text I updated without changing state:
- **Owning files** now point at `content/actions/<verb>.ts` and
  `content/action-runtime/<part>.ts`.
- **Extract attributes** also names the unreachable `"html"` mode
  (`action-runtime/extract.ts:8`), which the audit did not list.
- **Form interaction** says a recorded checkbox or radio change maps to type
  and a recorded submit maps to no input. This matches current
  `domain/src/io/input-model.ts`.

### `docs/architecture/extension-client.md` (+62/-11)

Each stale-claim correction, with the source that proves it:

1. **Focus/blur events** (old line 175, "click/input/change/submit/focus/blur").
   `installRecordingEventListeners` (`apps/extension/src/content/dom-events.ts:36-155`)
   registers these listeners and no focus or blur listener:
   - `pointerdown` :37
   - `click` :58
   - `input` :73
   - `change` :87
   - `submit` :103
   - `keydown` :110
   - `wheel` :126
   - window `scroll` :148

   Every emitted kind is one of:
   - `dom-events.ts:46,64,97,107,114,131,152`
   - `recorder.ts:37,49,94,102`
   - `runtime-status.ts:92-98`
   - `connection.ts:404,569,634`

   `dom.focus`/`dom.blur` are only declared (`apps/extension/src/shared/protocol.ts:228-229`)
   and mapped (`domain/src/io/input-model.ts:49-50`).

   In the same list I also fixed the attribution. Tab and navigation evidence
   comes from the background worker (`connection.ts:404,569`,
   `connection/browser-state.ts:41`), not the content script. I added the
   trust note:
   - guards at `dom-events.ts:39,60,75,89,112,128`;
   - none on `submit` (:103-108) or window `scroll` (:148-154).
2. **`client.recording_entry`** (old line 73 in the message list, and old
   lines 200-203).
   - The extension never sends it. A grep for
     `recording_entry|recordingEntry|RecordingEntry` over `apps/extension/src`
     and `domain/src` finds nothing. Its only hits are an unrelated
     `recordingEntryId` in `packages/test-evidence`.
   - Core defines it: `F:\!FluxIQ\packages\client-gateway-websocket\src\automation-studio.ts:54-55`.
   - What happens instead: `inputId` is stamped into the recording event's
     metadata at `apps/extension/src/background/connection/gateway-payloads.ts:67-69`.
     Core's bridge reads `metadata.inputId`
     (`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\client-gateway\bridge.ts:281-293`),
     and `recordGatewayInput` (`:405-430`) records it as that input when it
     is registered.
   - The message list was rebuilt from what the extension actually sends:
     - `client.start_recording` `connection.ts:260`
     - `client.stop_recording` `:304`
     - `client.state_update` `:360`, `:618`, `connection/recording-evidence.ts:108`
     - `client.recording_event` `:421`, `:674`
     - `client.action_result` `:631`
     - `client.snapshot` `recording-evidence.ts:90`, `:165`
     - `client.hello`, sent by Core's client on connect (`transport.ts:50`),
       from the extension's `clientHello()` (`gateway-session.ts:239`)
   - `client.error` was dropped from the list. Core offers `sendError`
     (`transport.ts:108-109`), but the extension never calls it; its
     `reportError` only sets `lastError` (`connection.ts:118`).
3. **Sensitivity claim.** `extension-client.md` contained no sensitivity
   claim. `grep -in "sensitiv|redact|password|filter"` matched only line
   193, which is about element-count filtering. The false claim the audit
   names (contradiction C) is in source,
   `apps/extension/src/content/describe-element.ts:4`, which I do not own
   and did not touch. It is still false. I added an accurate
   sensitive-values paragraph instead:
   - default `captureInputValues: true` (`shared/browser.ts:10`), passed on
     at `content/message-handler.ts:25`;
   - the value is gated only on that setting (`describe-element.ts:40-41`,
     `:105-112`), and the recorder sends it as `inputValue`
     (`recorder.ts:83,104`; `dom-events.ts:99`);
   - the sensitivity rule (`element-traits.ts:109-113`) is applied only at
     `describe-element.ts:49` (`hasValue`), `describe-element.ts:55`
     (`selectedValue`), and `runtime-status.ts:106-124` (the confirmation
     value);
   - the domain labels at `domain/src/recording/domain.ts:27,32`.

Also added, per the supervisor note and the w1-domain-mappings report:
- **Action Surface:** a paragraph on type resolution and rejection, with the
  extension half pending, and a link to `web-capabilities.md`.
- **Declared Inputs:** one sentence on the shared mapper and the evidence-only
  rule.

### Architecture index

None exists. `docs/architecture/` holds only the three pages. Root
`README.md:133` links `testing-facility.md` in prose, and `AGENTS.md` and
`repository-layout.md` link pages inline; none of these is an index. No
index was edited. The new page is linked from `extension-client.md`.

### Deviation from the reading scope

The brief asks for "the Week 1 phase that changes" each row. Neither the
brief nor the audit gives that mapping. I therefore read, in the plan, its
headings, `### Phase 1.1` (lines 210-271) and `### Phase 1.2` (lines 342-405),
and nothing else.

Where the phase attribution is inference:
- **Extract attributes:** no step names it; the row says so.
- **`web.browser.tab`** is assumed to cover open, switch and close.
- **`web.dom.assert`** is assumed to cover URL, existence and nonexistence
  checks.
- **Phases 1.3-1.5** are characterized from their titles only.

## Commands run and observed results

- **Link check** (script at
  `<scratchpad>/w1-capability-docs-linkcheck.cjs`; it checks that each
  relative link's file exists, and that anchors match heading slugs):
  `node <script> docs/architecture/web-capabilities.md docs/architecture/extension-client.md`
  printed 22 `OK` lines, including `extension-client.md#recording-evidence`
  and `#recording-evidence`, then `checked 22 relative links, 0 failing`,
  `exit=0`.
- **`node scripts/structure-audit.mjs`**: `exit=0`,
  `structure-audit: passed (27 warning(s), 19 baselined)`, and
  `structure-audit: 1 baseline entries can be lowered.` Because
  `web-capabilities.md` is untracked, the audit does not see it.
- **`node scripts/structure-audit.mjs --json`**: `failures []`. The one
  lowerable entry is `imports` `domain/src/client/index.ts` recorded 2 →
  1 ("../runtime/capabilities" at line 7). It does not come from this
  docs-only work. I did not run `pnpm structure:baseline`.
- **Matrix tallies** (awk over the table): 24 rows, which are 1 Fully / 10
  Partially / 3 Unreliable / 10 Unsupported. Outcome validated: 14 "No"
  and 10 "—", so 0 of 24 are validated.
- **`git diff --stat -- docs/architecture/`**: `extension-client.md | 73`,
  62 insertions and 11 deletions. `wc -l`: extension-client 280,
  web-capabilities 229.
- **Post-edit grep for `recording_entry|focus|blur`** in
  `extension-client.md`: every remaining hit is the corrected text (lines
  79, 201-205) or "focused target" (222).
- **Source greps and reads** as cited above.
- **Tooling failure:** the first attempt to write the new page with a Bash
  heredoc failed at parse time (`unexpected EOF while looking for matching
  ''`) and wrote nothing. It was then written with the Write tool.

## Not verified

- **No build, test, or browser run.** Only docs changed. The behavioural
  claims carried from the audit were read from code, not observed:
  - untrusted events trigger no default action;
  - `contenteditable` fails;
  - native dialogs block the action;
  - file inputs reject a value.
- **The extension's handling of a rejection** (cast, then the content
  dispatcher fails it) was traced by reading the code, not by running it.
- **`extension-client.md`'s server message list** was not re-verified.
- **Headline counts** of 14/14/13 for represented, executed and observed
  come from the audit. They agree with the row states but were not
  re-derived.
- **Owning file names and line numbers** reflect the working tree at
  writing. w1-decompose-content is still in progress and may rename files
  in `content/actions/` or `content/action-runtime/`.

## Open questions or contradictions found

1. **Stale sensitivity comment in source.** The plan and brief expect a
   sensitivity claim in `extension-client.md`; there was none. The stale
   claim is `apps/extension/src/content/describe-element.ts:4`. Who fixes
   it: Phase 1.4, or a follow-up to recorder hygiene?
2. **Gaps in Phase 1.2's steps.** No step covers Extract attributes, yet
   Phase 1.2's exit check requires 24/24. No step adds a submit action
   either: Enter → `requestSubmit` exists only through keypress, and
   `dom.submit` stays unmapped.
3. **Probable duplicate recorded scroll** (not verified live). The window
   `scroll` listener (`dom-events.ts:148-154`) has no trust check, and a
   script-caused scroll fires a trusted event anyway. A replayed
   `web.dom.scroll` during recording would therefore likely record a user
   `dom.scroll` on top of its runtime confirmation (`runtime-status.ts:98`).
   A programmatic `submit` is recorded the same way.
4. **Follow-up once the extension-side rejection lands.** Update both pages:
   the "Pending, extension side" paragraph in `web-capabilities.md`, and the
   "does not yet return that rejection" sentence in `extension-client.md`.
5. **Links that will break.** `web-capabilities.md` links the plan and
   `reports/audit-actions.md` under `docs/working/`. These links break when
   the plan is archived.
