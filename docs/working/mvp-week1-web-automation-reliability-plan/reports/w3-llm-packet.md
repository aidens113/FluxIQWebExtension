# Report: w3-llm-packet

Worker: `w3-llm-packet`. Wave 3, Phase 1.4 step 4 — split `llm-evidence.ts`,
then expose the new evidence items compactly, align the byte budgets with
Core's gates, match the state pipeline's frame coverage, and carry
`selectedText` and focus. Plus the mid-task addition from the supervisor:
publish the tool ids and result codes as **runtime values** so
`packages/test-runner`'s allowlist can derive from them.

## Outcome

**Done, with two seams the brief did not include.** The split is complete and
every gate I own is green: domain `check` exit 0, domain `test` exit 0 with
195/195 passing (38 of them mine, up from 15), and the structure audit reports
no finding naming any file under `domain/src/runtime/llm-evidence/`.

The supervisor's addition is done too, and is summarised on its own in
[The runtime vocabulary](#the-runtime-vocabulary-the-supervisors-addition) —
that section is the one to read for wiring the consumer.

The two seams are both the shape the wave's binding rules warn about —
ownership drawn around a file rather than around the change:

1. **Frame coverage cannot be fixed from the domain alone.**
   `apps/extension/src/runtime/action-runner.ts:73-77` sends
   `topFrameOnly: frameId === undefined`, so the action-result path the LLM
   tools use never receives a merged multi-frame snapshot. The packet now
   understands the merged shape correctly and is tested against it, but until
   that line changes the packet has no child-frame elements to describe.
   `w3-frame-plumbing` owns that file.
2. **The page-level evidence items are inert until `w3-evidence` emits them.**
   `apps/extension/src/content/evidence/` did not exist when I started and
   `DomSnapshot` still has no `dialogs`, `blockingOverlay`, `loading` or
   `navigation` field. I coded against the contract in
   [the field table](#the-contract-w3-evidence-must-meet) as instructed, read
   defensively, and every one of those fields is proven by a test — but the
   names are my proposal, not a reconciled contract.

Two smaller follow-ups the supervisor owns are in
[Open questions](#open-questions-or-contradictions-found).

## What changed and why

### The split

`domain/src/runtime/llm-evidence.ts` (449 lines) is gone. In its place,
`domain/src/runtime/llm-evidence/` with eleven modules and a barrel, 1,210
lines in total. Nothing outside the directory needed editing:
`runtime/index.ts`, `reusable-evidence.ts`, `reusable-evidence-coordinator.ts`
and `service.ts` all import `./llm-evidence`, which now resolves to the
directory's barrel.

| Module | Lines | Responsibility |
| --- | --- | --- |
| `limits.ts` | 59 | The byte budgets and per-field bounds, and the resolver that applies them |
| `untrusted-json.ts` | 42 | Bounded readers over the untrusted JSON a snapshot arrives as |
| `location.ts` | 32 | URLs stated so they carry no secrets |
| `elements.ts` | 235 | One page element as one compact evidence element |
| `page-evidence.ts` | 169 | The page-level items: frame, loading, navigation, dialogs, overlay, selection, totals |
| `sanitize.ts` | 132 | Assembling `web-llm-evidence.v1` and trimming it to budget |
| `tool-rejection.ts` | 44 | A deliberate refusal, its closed code set, and the content-free result it returns |
| `vocabulary.ts` | 48 | The closed sets put on the wire: tool ids and result codes, as runtime values |
| `reveal.ts` | 56 | Which observed element the reveal tool may click, and target-handle binding |
| `target-override.ts` | 42 | Whether a proposed target is one the model was actually shown |
| `tools.ts` | 303 | The three tools, the runtime factory, the host binder, the failure capture |
| `index.ts` | 48 | The barrel |

The barrel is a deliberate list of named exports rather than `export *`: the
bounded readers, the trim ladder and the target-handle bindings are how the
packet is built, not part of its contract, and a consumer reaching for them
would be assembling a second packet shape by hand.

The one 376-line test file moved with its subject and was split the same way,
into `llm-evidence/tests/{sanitize,page-evidence,limits,vocabulary,target-override,tools}.test.ts`.

### The runtime vocabulary (the supervisor's addition)

Everything below is exported from the barrel
`domain/src/runtime/llm-evidence/index.ts`, and therefore from
`domain/src/runtime/index.ts` and the package's `.` entry
(`@fluxiq-web-extension/domain`). It is **not** on `./client`, which is what
the extension imports — nothing here reaches the content bundle.

Defined in **`domain/src/runtime/llm-evidence/vocabulary.ts`**:

| Export | Kind | Value |
| --- | --- | --- |
| `WEB_LLM_EVIDENCE_TOOL_IDS` | `readonly` tuple | `["web.inspect_current_page", "web.navigate_same_origin", "web.reveal_safe"]` |
| `WebLlmEvidenceToolId` | type | `(typeof WEB_LLM_EVIDENCE_TOOL_IDS)[number]` |
| `WEB_LLM_INSPECT_TOOL_ID` / `WEB_LLM_NAVIGATE_TOOL_ID` / `WEB_LLM_REVEAL_TOOL_ID` | consts | the three tuple members, unchanged names and values |
| `WEB_LLM_INSPECT_RESULT_CODE` | const | `"web.inspect.succeeded"` |
| `WEB_LLM_ACTION_RESULT_CODE` | const | `"web.action.succeeded"` |
| `webLlmToolRejectionResultCode(code)` | function | `` `web.action.rejected.${code}` `` — the only place the prefix is written |
| `WEB_LLM_EVIDENCE_RESULT_CODES` | frozen `readonly` array | the two successes followed by one code per rejection: 8 entries |
| `WebLlmEvidenceResultCode`, `WebLlmToolRejectionResultCode` | types | derived from the above |

Defined in **`domain/src/runtime/llm-evidence/tool-rejection.ts`**:

| Export | Kind | Value |
| --- | --- | --- |
| `WEB_LLM_TOOL_REJECTION_CODES` | `readonly` tuple | `["invalid_input", "cross_origin", "no_progress", "target_unobserved", "target_unsafe", "sensitive_value"]` |
| `WebLlmToolRejectionCode` | type | now **derived** from that tuple rather than declared beside it |

The change is additive: every existing type keeps its name and its exact
shape, and every existing importer is unaffected. What changed underneath is
that `tools.ts` no longer writes any of these strings as a literal — it
imports the ids and the two success codes, and builds a rejection's result
code through `webLlmToolRejectionResultCode`. So a code that exists cannot
fail to appear in the set a consumer derives.

`tests/vocabulary.test.ts` is the guard that would have caught the reported
drift: it asserts the runtime's own `tools.map(t => t.toolId)` equals
`WEB_LLM_EVIDENCE_TOOL_IDS` in order (the missing `web.reveal_safe`), that
`WEB_LLM_EVIDENCE_RESULT_CODES` is exactly two successes plus one per
rejection with `web.action.rejected.no_progress` among them (the missing
result code), and that five result codes driven out of a live runtime — one
success and four different rejections, `no_progress` included — are all
members of the published set.

### Byte budgets

Two defaults, not one, because the two consumers are gated differently.

| Path | Default | Ceiling |
| --- | --- | --- |
| Exploration (the three tools) | 6,000 | 12,000 |
| Failure (`captureSanitizedFailureEvidence`) | 3,000 | **3,000** |

The failure number is `AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES`,
**imported from `fluxiq/automation-studio`, never restated**, so a Core change
reaches the packet instead of silently invalidating it. A test asserts the two
are equal.

The failure path is also *clamped* at that number, not merely defaulted to it.
That is the substantive change: Core's
`sanitizeAutomationStudioLlmFailureEvidence` throws on a packet over the gate,
and `AutomationStudioService` catches the throw and abandons the whole
diagnosis with `llm.failure_evidence_invalid`
(`runtime/service.ts:2966-2990`). Overshooting costs the intervention, not
just the surplus bytes, so a host asking for 9,000 on the failure path now
gets 3,000 rather than a packet Core will discard. `maxEvidenceBytes` on
`WebLlmFailureEvidenceRequest` became optional for the same reason: absent, it
falls back to the gate rather than to the exploration default.

Importing a Core *runtime value* into the domain is new for this module (it
previously imported only types). It is safe: `fluxiq` is external in both the
host build and the domain test build, and `domain/src/runtime/**` never
reaches the content bundle — the extension imports only
`@fluxiq-web-extension/domain/client`, whose barrel does not export
`llm-evidence`. `domain/src/output-nodes/native-runtime.ts` already imports
Core values the same way.

### The evidence items, and where they ride

The design decision worth recording: **the items that can be derived from an
element ride on the element, not in a page-level list.** Forms, landmarks and
repeating structure are all already present per element in `DomElementContext`
(`describeElement` derives `formId`, `formName`, `landmark`, `heading`,
`listPosition`, `tablePosition`; Phase 1.3 steps 1–2, done). Aggregating them
into `forms: [...]` or `regions: [...]` at the top of the packet would cost
more bytes, would need re-deriving after every budget trim, and would leave a
list pointing at target handles the packet no longer carries. Carried on the
element, they cost nothing when absent and disappear with their element.

New element fields: `frameId`, `focused`, `recent`, `changed`, `form`,
`landmark`, `heading`, `item {index,total}`, `cell {row,column,header}`.
`heading` is dropped when it only repeats the element's own name or text.

New page fields: `frame {isTop, childFrameIds}`, `loading`, `navigation`,
`dialogs`, `pendingNativeDialog`, `blockedBy`, `selectedText`, `elementTotal`.

### Frame coverage

The state pipeline consumes merged tab snapshots, in which
`background/connection/frame-geometry.ts:27-35` rewrites a child frame's
selector to `frame[<id>] >> <selector>` and stamps `data-fluxiq-frame-id`.
The packet now undoes that rewrite: `selector` goes back to the selector that
works *inside* the frame, and `frameId` carries the frame — which is exactly
what `w3-domain-contracts`'s `browserFrameId` needs. Left joined, the selector
is valid in no frame and a proposed target override could never be executed.
`frame.isTop` is carried too, so a capture taken inside an iframe is not
presented to the model as the whole page.

### `selectedText` and focus — a deliberate reversal

Two existing tests asserted the opposite: that page selection is dropped
(`doesNotMatch(/…|selectedText/)`, and `includes("PRIVATE_SELECTED_TEXT") ===
false` on the failure path). Phase 1.4 step 4 says carry it, so I changed
both, and the supervisor should see the argument rather than just the diff:
the packet already carries `visibleText` for up to 40 elements at 300
characters each, and a selection is a subset of visible page text. It adds no
new class of exposure, and it is bounded to the same 300 characters. If that
reasoning is rejected, the change is one line in `page-evidence.ts`.

Focus is carried as `focused: true` on the element rather than a packet-level
handle, so it cannot outlive the element it names. A focused **password field
is never announced**: the focused element runs through the same sanitizer, is
refused, and there is then no selector to match — asserted by a test.

`elementTotal` also changed a `deepEqual` fixture: a page with four captured
elements of which one is a password field now reports `elementTotal: 4`
alongside three elements, so the model knows a field was withheld rather than
concluding the login form has no password.

### The trim ladder

Over budget, the packet is trimmed rather than refused, lowest value first:
the ranked tail of elements down to one; then `selectedText`, `title`,
`navigation`, `loading`, `elementTotal`, `pendingNativeDialog`, `dialogs`,
`blockedBy`, `frame`; then the last element; then it throws. A dialog standing
in front of the page outlives the title and the selection because it is what
explains a failed click. Every removal sets `truncated`. The ordering is
proven by a self-calibrating test that asks for one byte less than each
previous packet needed, forcing exactly one more removal per rung.

### The contract `w3-evidence` must meet

Everything below is read defensively off the untrusted snapshot: an absent or
differently-named field costs nothing and reports nothing. These are the names
the packet reads.

| Snapshot field | Shape | Becomes |
| --- | --- | --- |
| `dialogs` | `Array<{ role?, name?, modal?: boolean, selector? }>`, first 3 kept | `dialogs` |
| `pendingNativeDialog` | `boolean` | `pendingNativeDialog` |
| `blockingOverlay` | `{ selector, tag? \| tagName?, role?, name? }` | `blockedBy` |
| `loading` | `{ readyState?: "loading"\|"interactive"\|"complete", busy?, spinner?, pendingNavigation? }` | `loading`, omitted when settled |
| `navigation` | `{ pending?: boolean, from?: url, to?: url }` | `navigation`, query and hash stripped |
| `elementTotal` | `number` — the pre-filter total | `elementTotal`, when it exceeds what is carried |
| `truncated` | `boolean` — the capture dropped something | folded into `truncated` |
| element `recentlyInteracted` | `boolean` | element `recent` |
| element `changed` | `boolean` | element `changed` |

Already produced today and now exposed: `frame.isTop`, `selectedText`,
`focusedElement`, element `context.{formId,formName,landmark,heading,listPosition,tablePosition}`,
and `data-fluxiq-frame-id` on merged elements.

## Commands run and observed results

`DOMAIN_TEST_BUILD_LABEL=w3-llm-packet` was set for every package command. No
`pnpm build` and no `pnpm lab` were run, per the wave's binding rules. Exit
status was captured by redirecting to a file and echoing `$?`, never through a
pipe.

- `pnpm --filter @fluxiq-web-extension/domain check` → **exit 0**. Output:
  `> tsc -p tsconfig.json --noEmit && tsc -p tsconfig.test.json`, no
  diagnostics. Run three times, the last after the vocabulary addition. The
  first run, mid-split, reported 17 errors, all of them in
  `src/recording/tests/web-state.test.ts` (a `w3-state-identity` file
  mid-edit) and none in mine. They were gone on the rerun.
- `pnpm --filter @fluxiq-web-extension/domain test` → **exit 0**.
  `# tests 195 / # suites 0 / # pass 195 / # fail 0 / # cancelled 0 /
  # skipped 0 / # todo 0` on the final run (188/188 before the vocabulary
  addition added seven). Run four times. One intermediate run was
  `# pass 187 / # fail 1`, my own trim-ladder test asserting a magic byte
  budget; it was replaced with the self-calibrating version described above
  and passes.
- `node scripts/structure-audit.mjs` with a scratch `GIT_INDEX_FILE` (a copy
  of `.git/index`; the real index was never written by the audit) →
  **exit 1**, one violation:
  `docs/working/README.md is out of date with the documents' header blocks`.
  No finding names any file under `domain/src/runtime/llm-evidence/`; the
  twelve modules and six test files are all under the 400-line advisory
  (largest: `tools.ts`, 303) and raise no warning, including none for
  exported-value count.
  A first audit run also reported
  `apps/extension/src/runtime/tests/result-mapping.test.ts: 1 import(s) reach
  into another directory's files … "../../content/evidence"`. That was an
  artifact of my scratch index: `w3-evidence`'s new `content/evidence/`
  barrel was on disk but not staged in it. Staging that directory too — the
  rerun the binding rules ask for — left only the README finding.
- `git status --short` for my paths → ` D domain/src/runtime/llm-evidence.ts`,
  ` D domain/src/runtime/tests/llm-evidence.test.ts`,
  `?? domain/src/runtime/llm-evidence/`. `git mv` and `git rm --cached`
  staged entries in the real index while I worked; I unstaged them with
  `git restore --staged` so the working tree is the only source of truth and
  nothing of mine is pre-staged for the supervisor's commit.

## Not verified

- **No live browser validation**, no `pnpm build`, no `pnpm lab` run — all
  three are the supervisor's under this wave's rules. Nothing here is proven
  against a real page.
- **The page-level field names are unreconciled.** Every one is covered by a
  test against a synthetic snapshot, which proves the reader works; it does
  not prove `w3-evidence` emits those names. If it emits different ones, the
  fields are silently absent and no gate fails — exactly the inert-change risk
  the binding rules name. The reconciliation is one table lookup, but somebody
  has to do it.
- **Child-frame handling is untested end to end.** It is proven against a
  synthetic merged snapshot shaped like `translateFrameElements`' output. No
  merged snapshot reaches this path in production today (see seam 1), so the
  behaviour has never run against a real iframe.
- **Core's structural bounds are proven only at the failure budget.** A test
  runs a rich failure packet through Core's own
  `sanitizeAutomationStudioLlmFailureEvidence` and asserts it comes back
  unchanged, which exercises the forbidden-key, string-length, depth and
  entry-count rules as well as the byte gate. Those rules are not applied by
  Core to the exploration packet, so a 12,000-byte exploration packet's entry
  count (~450 at 40 elements, against Core's 512 ceiling) is reasoned, not
  measured.
- **Extension and test-runner packages were not checked.** I own no file in
  either and touched neither. In particular the new vocabulary is proven to be
  correct and exported, but **not** proven to be reachable from
  `packages/test-runner`: that package has no dependency on
  `@fluxiq-web-extension/domain`, which the supervisor said is being handled
  at integration. Nothing I can run here exercises the consumer.
- **`domain/.test-build/` was not regenerated.** See below.

## Open questions or contradictions found

- **`domain/.test-build/` is tracked and is now stale.** It still holds
  `runtime/tests/llm-evidence.test.mjs`, whose source no longer exists, and
  holds no bundle for the five new test files. Regenerating it means running
  domain `test` *without* `DOMAIN_TEST_BUILD_LABEL`, which rewrites the shared
  directory and races every other worker — the exact thing the label exists to
  prevent. The supervisor should run it once at integration.
- **`docs/architecture/testing-facility.md:34` names
  `domain/src/runtime/llm-evidence.ts`**, which no longer exists. One line, in
  authored documentation, outside my Owns.
- **Frame coverage still cannot match the state pipeline.** Restated because
  it is the brief's own wording and only half of it was achievable here: the
  domain now handles merged frames correctly, but
  `action-runner.ts:76` still asks for `topFrameOnly` on every unaddressed
  command, including `web.dom.capture_snapshot`. Whether the LLM evidence
  capture *should* merge frames is a product decision with a cost (the merge
  polls every frame with a 150 ms timeout each), so I have not assumed it —
  but as it stands the plan's "frame coverage matches the state pipeline" is
  not true after this brief, and the remaining half belongs in
  `w3-frame-plumbing`'s file.
- **`w3-host-runtime` is told to bound its snapshots "by the same byte budget
  as the sanitized packet".** That budget is now
  `WEB_LLM_EVIDENCE_BYTE_BUDGETS`, exported from the runtime barrel — it
  should import that rather than restate 6,000 or 12,000. Its brief predates
  the constant existing.
- **The vocabulary's third set is Core's, not mine.** The consumer allowlist
  also needs to distinguish these codes from `failureCategories` in
  `@fluxiq-web-extension/test-contracts` and from the domain failure codes in
  `domain/src/runtime/failure` — three different axes with overlapping-looking
  strings. `WEB_LLM_EVIDENCE_RESULT_CODES` is the *tool execution* axis only:
  what one evidence tool call reports. `web.action.rejected.<reason>` here is a
  refusal of a **tool call**, not the `web.action.rejected` failure code in the
  `w3-failure-codes` set, which is a refused **browser action**. They are
  different strings (`web.action.rejected.cross_origin` versus
  `web.action.rejected`) but they will read as the same family, and merging
  them would be wrong. Worth stating in whatever the consumer's comment says.
- **Page selection is now carried on the failure path.** Flagged again here
  rather than only in the narrative, because it reverses an assertion a
  previous worker wrote deliberately and it is the one change in this brief
  with a security dimension. The argument is in
  [`selectedText` and focus](#selectedtext-and-focus--a-deliberate-reversal);
  the supervisor should either accept it or say so.
