# W2 recording playback/reuse live report

## Result

Status: **passed**. The same recording-generated Flow ran twice from the real
production panel in headless Chromium across separate owned Core/browser
lifetimes. Both routed to the same saved graph, all four durable action attempts
succeeded, both submitted-page oracles passed, and neither run produced LLM,
intervention, adaptation, or change-proposal activity.

No playback source repair was needed. The previously proven uncommitted
recording predicate repair in `demo-workspace/flow-document.ts` was preserved
unchanged.

## Environment and isolation

- Downstream candidate: `F:\fxlab\t027-recording-panel\!FluxIQWebExtension`.
- Core candidate: `F:\fxlab\t027-recording-panel\!FluxIQ`.
- Workspace/profile root:
  `F:\fxlab-runs\t027-recording-panel\workspace`.
- Production panel/gateway: isolated loopback ports 34127/49127.
- Browser: headless Chromium with the unpacked production extension build.
- Credentials were supplied process-locally from the already-authorized local
  source with environment-file target loading disabled. No secret was printed
  or added to evidence.
- Each `runDemoWorkspaceFlow` invocation owned and closed its Core and browser.
  No listener remained on either isolated port after completion.
- The user panel/profile/data, Core/product source, provider, batch, repair, and
  recording-generation lanes were untouched.

## Identity continuity

Both runs used exactly this saved identity:

| Object | ID |
|---|---|
| Project | `a60071d7-b6c2-4815-a938-eaa49087084d` |
| Flow | `flow.1f033294-788d-4ce6-a722-2fd82332f89e` |
| Subflow | `subflow.dbe246cd-43b8-4ae4-bcc8-d47e0ea3db08` |
| Graph Flow | `flow.1f033294-788d-4ce6-a722-2fd82332f89e.subflow.dbe246cd-43b8-4ae4-bcc8-d47e0ea3db08.graph` |
| Router | `router.51afd19e-d06c-431f-a827-12516a7a2ace` |

The saved recording identity also remained unchanged. No regeneration path ran.

## Live run matrix

| Check | Playback 1 | Playback 2 |
|---|---:|---:|
| Runtime run ID | `7799d88f-93e1-46e7-b250-808766be6466` | `70bf1457-8ffa-4e2c-9c5b-8d5befaabb57` |
| Core terminal status | succeeded | succeeded |
| Action attempts | 4 | 4 |
| Succeeded actions | 4 | 4 |
| Submitted-page oracle | passed | passed |
| Normalized provider calls | 0 | 0 |
| Interventions | 0 | 0 |
| Adaptation IDs | 0 | 0 |
| Change-proposal IDs | 0 | 0 |
| Summary adaptation count | 0 | 0 |
| Sanitized evidence verdict | passed | passed |
| Evidence events/screenshots | 115 / 100 | 115 / 100 |
| Evidence-run duration | 26,547 ms | 25,145 ms |
| Panel runtime-run step | 16,003 ms | 15,790 ms |

The first invocation plus its separate post-stop durable query completed in
40,317 ms. The second playback function returned in 32,428 ms; its separate
post-stop query brought the combined observation to 39,574 ms.

## Provider accounting interpretation

Core omits the optional `providerCallCount` field for these deterministic,
non-LLM runtime records rather than serializing numeric zero. This report uses
the repository's established `(detail.providerCallCount ?? 0)` normalization,
not an inference from success alone. It corroborated that zero with all of the
following from each exact run detail:

- no interventions;
- no adaptation IDs;
- no change-proposal IDs; and
- zero summary adaptations.

The panel evidence independently includes the `runtime-no-llm` checkpoint on
both invocations. The first strict inspection initially rejected the absent
optional field; no product or driver mutation followed because repository code
defines absence as zero for this deterministic path.

## UI and durable evidence boundary

Each invocation exercised the production surfaces in this order:

1. open the extension controls, panel, and saved project/Flow;
2. pair/connect the unpacked extension;
3. reopen the exact parent Flow and recording-generated Subflow;
4. assert the rendered saved graph layout;
5. reopen Runtime Debug and start the Flow from the panel;
6. wait for the visible submitted result in an extension-controlled scenario
   tab; and
7. verify the exact routed runtime record and every action attempt after the
   owned runtime stopped.

The evidence bundles are:

- `demo-playback-2026-09-21T00-34-27-532Z-93ce2a`
- `demo-playback-2026-09-21T00-36-14-892Z-860fd8`

Only sanitized summaries/timelines and the saved workspace state were used for
this report. No recorded page data, selectors, cookies, pairing tokens, or
credentials are included.

## Validation and mutation boundary

- Live panel playback/reuse: passed twice.
- Exact identity, action, oracle, and zero-LLM checks: passed twice.
- Playback-driver edits: none.
- Focused tests: not needed because no playback code changed.
- Broad tests/full suites: not run by instruction.
- Commits/pushes: none.
- Core candidate remains clean. Downstream still contains only the earlier
  recording predicate diff owned by the preceding live brief.
