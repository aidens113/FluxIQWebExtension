# Recording Panel Live Validation

Status: Recording-to-generated-Subflow boundary live-proven after one Lab predicate repair; playback and reuse not run by instruction
Updated: 2026-09-20
Owner: `w2-recording-panel-live`

## Result

The production panel plus loaded unpacked Chromium extension completed the real
recording path through generated-Subflow rendering. The first attempt exposed a
stale deterministic-fixture acceptance predicate: the recorder and generator
correctly preserved a supported `dom.scroll` event, but the Lab accepted only
the four required form actions and an optional navigation. This was not a
recording or generation defect.

I changed only
`packages/test-runner/src/demo-workspace/flow-document.ts` so the fixture accepts
the exact required action multiset plus at most one supported scroll and/or one
navigation. The otherwise-identical live `demo:record` lane then passed. Per the
stop instruction, I did not proceed to playback or reuse and did not run unit or
broad test suites.

## Environment

- Isolated downstream pair: `F:\fxlab\t027-recording-panel\!FluxIQWebExtension`
- Isolated Core pair: `F:\fxlab\t027-recording-panel\!FluxIQ`
- Isolated workspace/profile root: `F:\fxlab-runs\t027-recording-panel\workspace`
- Panel/gateway: production panel on isolated ports 34127/49127
- Browser/extension: headless Chromium with the unpacked Chrome production build
- Authentication: supplied process-locally from the authorized local source;
  environment-file target loading disabled; no credential was printed or
  persisted in evidence

## Before: exact first failure

- Evidence run: `demo-record-2026-09-21T00-16-23-064Z-f5e124`
- Outcome: failed at generated-graph acceptance after 40,365 ms
- Evidence volume: 154 sanitized events and 118 screenshots
- Durable result before rejection: parent Flow, generated Subflow, graph, and
  Router were all created
- Generated graph observation: 5 nodes, 4 edges, five distinct positions,
  valid nodes and edges, and outputs comprising click, select, two type actions,
  and one scroll
- Failure: the Lab rejected the scroll-inclusive graph as not being the expected
  deterministic unedited recording-derived graph

The extension controls opened and paired; Start and Stop completed; the scenario
form reached its visible submitted state; the panel opened the recording detail;
and the generation dialog, confirmation input, and submit all completed before
the predicate rejected the durable result. The run therefore failed after the
product mutation, not while recording or generating.

## Ownership diagnosis

The failure was a stale Lab expectation:

- the content recorder intentionally emits `dom.scroll` while recording;
- the domain input model maps that event to the executable `web.dom.scroll`
  output when numeric coordinates are present;
- the web-panel host exposes the canonical scroll candidate; and
- focused mapping coverage already pins the event-to-input-to-output chain.

Bringing an offscreen control into view can produce a real scroll during the
otherwise deterministic form scenario. The generated graph's scroll node was
therefore valid recorded behavior. The repaired predicate remains strict: it
compares exact sorted action multisets, so duplicate or unrelated actions still
fail; it does not weaken provenance, topology, type, or layout checks.

## After: identical live proof

- Evidence run: `demo-record-2026-09-21T00-20-49-653Z-c06ded`
- Outcome: passed
- Whole run: 18,872 ms
- Evidence volume: 109 sanitized events and 90 screenshots, with no duplicates
- The existing project, parent Flow, Subflow, graph, and Router identities were
  retained; a fresh durable recording identity was used
- The panel refreshed the generation result, reopened the parent Flow, opened
  the Subflow, and passed the rendered-layout assertion

The regenerated graph passed all of these invariants:

- exact required click/select/two-type multiset, with only the supported optional
  navigation and/or scroll additions;
- 4–6 nodes and exactly `nodes - 1` edges;
- every node is a built-in policy action with a recording proposal id and action
  entry id;
- every node's evidence references the exact fresh recording;
- every edge carries recording provenance;
- all node positions are distinct;
- the graph has the expected Subflow ownership and parent Router fallback.

The rendered-layout profile independently constrained the observed rendered
graph to four or five nodes. The sanitized pass output did not publish the exact
second-run output list, so this report does not infer a more precise count.

## Selected live timings

| Stage | Before failure | Passing rerun |
| --- | ---: | ---: |
| Extension connect | 217 ms | 97 ms |
| Start recording | 786 ms | 678 ms |
| Fill name | 75 ms | 74 ms |
| Select plan | 121 ms | 98 ms |
| Fill notes | 88 ms | 80 ms |
| Submit form | 150 ms | 100 ms |
| Stop recording | 1,881 ms | 108 ms |
| Generation refresh | 294 ms | 166 ms |
| Recording search/open | 561 ms | 217 ms |
| Generation dialog/confirmation | 151 ms | 149 ms |
| Generation submit | 3,247 ms | 2,089 ms |
| Result refresh | not reached | 131 ms |
| Subflow search/open | not reached | 176 ms |
| Whole run | 40,365 ms | 18,872 ms |

These are individual live observations, not a performance benchmark. The page
oracle reached its visible submitted state before Stop on both attempts.

## UI and durable evidence boundary

- Extension UI: panel opened, paired, and completed Start/Stop recording.
- Scenario UI: the real form interactions completed and the submitted state was
  visible.
- Panel UI: project/Flow/Subflow setup, recording search/detail, generation
  dialog and submission, result refresh, and generated Subflow rendering were
  exercised.
- Durable control evidence: the parent recording identity, Subflow ownership,
  Router fallback, graph topology, and per-node/per-edge recording provenance
  were corroborated without publishing recorded page data.

The recording detail was visibly opened, but the driver did not assert an exact
timeline row count; that remains unverified rather than inferred from event
totals.

## Scope and remaining work

- One downstream test-runner source file changed; Core and product runtime code
  were not changed.
- `git diff --check` passed for the source repair and this report.
- No playback, reuse, unit tests, broad suite, commit, merge, or push was run.
- The original full recording-panel definition of done remains partial until a
  separately authorized lane exercises playback and reuse. The approved stopping
  point for this run was the first repaired boundary, now live-proven.

No secrets, pairing tokens, recorded field values, selectors, or page evidence
are included in this report.
