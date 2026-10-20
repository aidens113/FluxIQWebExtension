# Report: lane-t-p3-d1-parity-runs (t742, downstream test-runner)

## Outcome

Done. Five saved Flows were replayed once each: headed, provider-free, tracing on. Every replay's trace then went through Core's own replay harness. Four Flows passed. job-board's Flow comes from a build that failed, and it failed judging as expected.

| scenario | exit | verdict | receipt | trace events | parity | compared / matched | divergences by class |
| --- | --- | --- | --- | --- | --- | --- | --- |
| crossborder-marketplace | 0 | passed | replay-mvgtuz2n-f0c2ff23 | 127 | matched | 127 / 127 | none |
| bigbox-retail | 0 | passed | replay-mvgu02ib-12336505 | 307 | matched | 307 / 307 | none |
| everything-store | 0 | passed | replay-mvgu1yd3-d45276f3 | 295 | diverged | 295 / 284 | capture_gap 10, nondeterminism 1, intake_defect 0 |
| social-network-feed | 0 | passed | replay-mvgu4s4v-d385e1c4 | 222 | diverged | 222 / 221 | nondeterminism 1 |
| job-board (weak Flow) | 1 | failed | replay-mvgu6wvc-48840c13 | 115 | matched | 115 / 115 | none |

**No intake defect was found:** 1,054 of 1,066 delivery points matched. The 12 divergences have two Core causes:

- **One capture defect.** The screening sink drops the session reference whenever it rewrites a redacted event.
- **One false positive.** The card-number backstop matched a sha256 digest, which turned a page-artifact reference into a "secret".

There is also one declared replay difference: sequential feeding makes two concurrently received state updates look reordered.

Every trace was `complete` by Core's evaluator, with 0 issues, and 0 model calls were made. The secret search covered 3 secrets per replay (controller token, authorization password, the extension's gateway token, as UTF-8 and UTF-16LE) and found 0 hits in events and artifacts.

**Configuration caveat.** Every replay ran with `FLUXIQ_DOMAIN_ID=web-automation`. This is a run setting, not a code change, and P2's sweep D used it too. The P2 Core defect is still in this Core: `apps/web/src/lib/fluxiq.ts:171-179` builds a second FluxIQ instance and discards the first, which leaves the live gateway with no trace source. In the Lab's default configuration the traces would hold 0 events, and parity would be vacuous.

## What changed and why

All paths are in `packages/test-runner/src/`. Each file has one purpose, and the directory has a barrel.

- **New `trace-parity/`:**
  - **`check-project-trace-parity.ts`, `checkProjectTraceParity`.** Opens the project store through Core's `AutomationStudioProjectDatabasePool` and `AutomationStudioProjectGatewayTraceStore`. For each selected manifest, it runs Core's `replayClientGatewayTrace({ store, traceId })`. The harness only reads the store and records its replay into its own memory store.
    - Each trace has a deadline, 180 s by default. The timer is deliberately not unref'd, so a hung harness still reaches the deadline and the receipt is still written.
    - A thrown error is reported by its kind only ("the harness threw Error (text withheld)"). One failed trace never stops the next.
  - **`summarize-parity.ts`, `summarizeTraceParity`.** The projection the Lab may write, per trace:
    - verdict (`matched`/`diverged`/`failed`);
    - delivery points: compared, matched, diverged, outside;
    - divergences counted by class;
    - groups, keyed by class, kind, message type, field set (array positions shown as `[*]`) and reason, each with a count and its first 8 sequences;
    - divergence rows (sequence, replaySequence, class, kind, messageType, field names, reason), capped at 400 with an omitted count;
    - names of the normalized fields, the replay event count and the duration.

    The replay's own capture (`report.replayEvents`) and every payload stay behind.
  - **`parity-reason.ts`, `screenParityReason`.** Reduces Core's `detail` to a closed vocabulary:
    - Core's fixed sentences, and pointer-only "<paths> was withheld at capture ..." reasons, are kept.
    - Reasons that end in free text (thrown-error text, minted-field lists, capture-loss detail) keep only their fixed head.
    - Anything else becomes "reason withheld: it matches no known template".
  - **`types.ts`, `index.ts`.**
  - **Tests in `trace-parity/tests/`.** `gateway-session.ts` records a real session through Core's `ClientGatewayService` and tap into the real SQLite project store. It pairs before the trace opens, as the extension does. The tests check:
    - a recorded session replays to `matched` at every point;
    - a mutated recorded result gives an `intake_defect` at its disposition, with field `payload.value.delivered.result` and no payload text in the output;
    - a P2-shaped trace (no session references) gives `capture_gap`;
    - a throwing or hanging harness gives `failed`, with closed text;
    - the filter skips what it should;
    - the reason screen behaves as described above.
- **`saved-flow-replay/stored-traces.ts`, `inspectReplayTraces`.** After the existing read-back, it runs the parity check on the same traces (same `include`, same store path). The receipt's `traces` gains:
  - `parity`: the `ProjectTraceParity` result;
  - `parityFailure`: `null`, or "not run: the trace store could not be read", or the thrown kind.

  The storage path is computed inside the `try`, so the "named failure, never a throw" contract still holds. My first version broke it, and `replay-saved-flow.test.ts` caught that; it is fixed.
- **`saved-flow-replay/tests/replay-tracing.test.ts`.** The existing expectations now include the two new fields. Two new tests: parity gets the same store path, project and filter as the read-back; and a throwing parity check keeps the read-back and names only the error's kind.

## Divergences, classified (evidence and Core sources)

### 1. everything-store, 10 x `capture_gap`: the screening sink drops `session`

- **Delivery points.**
  - Inbound `client.action_result` at sequences 149, 154, 157, 168 and 171.
  - Their dispositions at 150, 155, 158, 169 and 172.
- **What differs.** Field `event`: Core has no counterpart, because the replay did not feed the input. The reason is "the event does not say which session it belongs to" (`client-gateway/trace-replay/walk/walk.ts:346`).
- **Evidence (metadata read through the store API).** The trace has one session, `session-1`.
  - Exactly these 5 events lack the `session` key. They are also exactly the trace's 5 redacted events.
  - Every other event, the surrounding artifacts (148, 186) and the disposition at 150 included, carries `session: "session-1"`.
  - Each of the 5 has one redaction: `{ path: "/payload/metadata/trace/artifacts/4/sha256", reason: "secret" }`, with payload encoding `json` instead of the raw `text`.
- **Cause.** `programs/automation-studio/runtime/gateway-trace/screening-sink.ts:41-53`. When the screen finds anything, `record` rebuilds the event input field by field and leaves out `session`. The tap set that field, and the recorder copies it (`client-gateway/trace/recorder.ts:91,267`). The sink is installed for every episode at `gateway-trace/episodes.ts:191`.
- **Class.** Capture gap: the trace lacks what the replay needs.
- **Proposed fix (Core, not done).**
  - Build the screened input as `{ ...input, payload: screened.payload, referencedDigests: input.referencedDigests ?? [], redactions: [...] }`, so `session` and any later optional field survive.
  - Add a `screening-sink.test.ts` case asserting that `session` survives a redaction.

### 2. The same 10 points, after fix 1: a page-artifact digest screened as a card number

- **Prediction checked by probe.** I copied the trace into a memory store, put `session: "session-1"` back on the 5 events, and replayed it. All 10 stay `capture_gap`, now with the harness's reason "/payload/metadata/trace/artifacts/4/sha256 was withheld at capture, and Core's handling of the message depended on it" (`client-gateway/trace-replay/walk/inbound-text.ts:24`).
- **What the client sent.** It is gone. The screen re-encoded the result as JSON and replaced one leaf, so Core's delivered-result digest cannot be reproduced.
- **Evidence.**
  - Of the manifest's 73 artifact digests, exactly 1 matches Core's card-number rule. I tested this with a copy of the rule; no digest was printed.
  - Over 200,000 random sha256 hex digests, the rule matches 431 (0.22% each). A run that references tens to hundreds of artifacts (store: 430 references) will often contain one.
- **Cause.**
  - `programs/automation-studio/runtime/gateway-trace/payload-screen.ts:89-97` screens every string leaf with `screenAutomationStudioLlmEvidence`.
  - Its card backstop, `programs/automation-studio/runtime/llm/harness/evidence-screen.ts:88-89,96,105-114`, matches a 13-19 digit run whose only boundary rule is "no digit on either side". So a digit run inside a hex string, between letters, counts.
- **Class.** Capture gap, produced by a false-positive redaction. It is not a secret leak, and not an intake defect.
- **Proposed fix (Core; lead's choice):**
  - (a) In `evidence-screen.ts`, do not count a digit run that has a letter on either side (`(?<![\dA-Za-z])` / `(?![ -]?[\dA-Za-z])`). This also stops the same false refusal of LLM evidence. Trade-off: a card number glued to letters is no longer caught.
  - (b) Narrower: in `payload-screen.ts`, exempt leaves that are exactly a lowercase hex digest (40 or 64 characters), or exempt the `metadata.trace.artifacts[*].sha256` path.
  - Either way, add a test with a Luhn-passing digest.

### 3. everything-store sequence 184 and social-network-feed sequence 8, `nondeterminism`: order under sequential feeding

- **Delivery points.** The disposition of `client.state_update`. Field `sequence`, reason "delivered in another order than recorded".
- **Evidence.**
  - Store: inbound 182 and 183 at logical ms 40155 and 40156; disposition 184 (cause 182) and 185 (cause 183), both at 40157.
  - Social: inbound 6 and 7 at 2154 and 2155; dispositions 8 (cause 6) and 9 (cause 7), at 2155.
  - The dispositions are in recorded order relative to each other. Live, the second frame was taken in before the first's disposition was recorded. The replay awaits each `receiveRaw` (`walk.ts:135-145`), so disposition(182) lands before inbound 183. The comparison's global order check (`client-gateway/trace-replay/comparison/parity-report.ts:146,153`) flags it.
  - The payloads and delivered digests of both dispositions match.
- **Class.** Nondeterminism: concurrency, transport-only. It is one of the harness's declared differences ("inbound messages are fed one at a time").
- **Proposed fix (Core harness, for the lead):** pick one.
  - Reproduce the recorded overlap: when the recording shows inbound N+1 before inbound N's disposition, start `receiveRaw` for N+1 before awaiting N.
  - Or check order per delivery chain (an input before its own disposition and result), not globally.

  Either way, these traces would read `matched` instead of carrying a standing divergence.

### Parity is not vacuous on real traces (negative controls)

I ran these on the crossborder trace, copied into a memory store:

- Unchanged: matched 127/127.
- First `client.action_result`'s status changed (sequence 9): 1 `intake_defect`, at disposition 10, fields `payload.value.delivered.result` and `payload.value.delivered.event`. The other 126 matched.
- Inbound `client.state_update` 12 removed: 2 `capture_gap`s, "sequence 12 is missing from the trace" and, at 13, "the message it answers is missing from the trace". The other 125 matched.

### job-board (Flow from the failed 10-13 build)

- **Run:** exit 1, receipt replay-mvgu6wvc-48840c13. Core reported the run `succeeded`: 16 attempts (navigate, click, three extract_list + next_page loops), 0 model calls.
- **Judging failed:**
  - "the records the Flow stored do not match the task's expected dataset";
  - 7 observed vs 7 expected, 0 matched (in order or in any order);
  - 28 of the expected fields present, plus 7 unexpected.
- **Parity:** matched 115/115. The Flow's wrong answer comes from its graph, not from intake.

## Commands run and observed results

1. Core build. `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` (Core tree):
   - contracts and client-gateway-websocket: `reuse`;
   - `fluxiq:build ... "build" ... inputs changed: packages/fluxiq ... ms":80427`, `Done`.
2. `node scripts/check/core-build.mjs` -> `core-build: FluxIQ Core's build at C:\Users\osrs_\FluxStuff\fxwork\t742\!FluxIQ is current with its source.`
3. `pnpm --filter @fluxiq-web-extension/extension build` -> `chrome: verified 22 files`, `firefox: verified 22 files`, `e2e-chromium: verified 22 files`.
4. Replays. Each ran as `FLUXIQ_TEST_ENV_FILES=none FLUXIQ_DOMAIN_ID=web-automation node scripts/lab/run-lab.mjs replay <scenario> --workspace t742-<scenario> --flow <id> --project <id> --instruction-task <task>`, with the ids from `lane-t-p3-d0-saved-flows.md`. Logs are in `test-runs/t742d1-logs/`, receipts in `test-runs/replays/`. No `--live-llm`, so nothing touched `lab-slots`.

   | scenario | exit | receipt | attempts | runMs | parity time | other |
   | --- | --- | --- | --- | --- | --- | --- |
   | crossborder | 0 | replay-mvgtuz2n-f0c2ff23 | 12 | 27,702 | 1,684 ms | playback goal held |
   | bigbox | 0 | replay-mvgu02ib-12336505 | 23 | 46,297 | 3,166 ms | |
   | store | 0 | replay-mvgu1yd3-d45276f3 | 30 | 79,752 | 6,240 ms | dataset 13 records |
   | social | 0 | replay-mvgu4s4v-d385e1c4 | 34 | 60,330 | 2,649 ms | 2 datasets of 4 records |
   | job-board | 1 | replay-mvgu6wvc-48840c13 | 16 | 26,080 | 933 ms | |

   - Each receipt's trace read-back: `completeness: complete`, 0 issues; `secretScan.eventHits 0, artifactHits 0`; `parityFailure: null`.
   - Parity results are as in the Outcome table.
5. `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json` -> exit 0 (final run after the last edit).
6. `node --test dist/trace-parity/tests/*.test.js dist/trace-inspection/tests/*.test.js dist/saved-flow-replay/tests/*.test.js dist/saved-flow-replay/provider/tests/*.test.js` -> `# tests 67 # pass 67 # fail 0` (final).
   - One earlier run gave `# pass 65 # fail 2`, both `replay-saved-flow.test.ts` "declared replay person ...", with `TypeError: The "path" argument must be of type string`. That was my regression (`path.join` outside the `try`), and it is fixed.
7. `node scripts/structure-audit.mjs` -> `structure-audit: passed (215 warning(s), 618 baselined).` (final).
   - An earlier run failed on an `as never` in my test support and a packed line in `replay-tracing.test.ts`. Both are fixed.
8. Probes. These are scratch scripts outside the repository. They read stores through Core's API and print only metadata, counts, classes and field names:
   - the mutation controls (above);
   - event metadata of store sequences 148-151 and 182-186;
   - the card-rule digest count and random rate;
   - the causes for social 5-9;
   - the session-restored replay.
9. Core tree: `git status --short` shows the same 44 entries as before I started. No Core source was edited.

## Not verified

- The Lab's default configuration, without `FLUXIQ_DOMAIN_ID`. Not run; going by P2, its traces would be empty.
- auction-marketplace, company-website, local-classifieds, professional-network and photo-social. They have no Flow in an allowed tree (D0). Only 5 of the 10 sites are covered.
- Live round-4 traces: none were named.
- Paths in Core's harness that these traces never exercised:
  - reconnects mid-trace;
  - pairing approval in a trace;
  - reconcile questions;
  - host-lease-stamped commands;
  - `answer_never_came`;
  - parse failures, of which these traces had none.
- That fixes 1 and 2 actually make store's 10 points match. The session-restored probe shows the remaining gap is fix 2's. I did not simulate an unredacted digest, because the original leaf is gone.
- Each Flow was replayed once. There was no off/on pair and no repeat, so run-to-run stability of parity was not measured beyond this single sample.
- Firefox.

## Open questions or contradictions found

1. **Fix 1 (screening sink keeps `session`) is a one-line Core change with a test.** It is needed before any trace with a redaction can reach parity.
2. **Fix 2 needs a decision.** The choice is between a broader card-rule boundary in `evidence-screen.ts`, which also affects LLM evidence, and a narrow digest exemption in `payload-screen.ts`.
3. **The harness's global order check makes ordinary concurrent intake a standing `diverged` verdict** (2 of 5 traces). Should P3 reproduce the overlap, or check order per delivery chain?
4. **Core's harness reason at `inbound-text.ts:24` embeds JSON pointers.** These are field names and positions. A secret-shaped key is already renamed at capture, so the screen keeps the reason only when its pointers use plain characters.
5. **The P2 Core defect is still open:** `apps/web/src/lib/fluxiq.ts:171-179`, the discarded first instance owns the trace source. The Lab default cannot produce parity evidence until it is fixed, or until the Lab sets `FLUXIQ_DOMAIN_ID`.
