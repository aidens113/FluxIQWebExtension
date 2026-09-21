# Integrated Dev UI Smoke

Status: Passed end to end on pushed integrated `dev`; two disposable Lab-observer defects were diagnosed and rejected as product failures
Updated: 2026-09-20
Owner: `w2-integrated-dev-ui-smoke`

## Result

The current production panel plus loaded unpacked Chromium extension completed
the provider-free path end to end from a fresh isolated identity and store:
project/Flow/Subflow/Router creation, recording, deterministic Subflow
generation and persistence, Core/browser restart, Flow execution from Runtime
Debug, the visible fixture oracle, durable 4/4 action evidence, and the selected
Runtime Debug detail's in-place terminal refresh all passed.

Runtime Debug was already showing the selected detail before the terminal run
response. Without reloading or reopening it, the same view changed to
`Succeeded`, showed four actions and four action rows, while its stage header
showed `1 run`. There were zero panel main-frame navigations between opening the
runtime view and observing its terminal detail.

No product or test source was changed. No automated suite, provider call,
commit, or push was run.

## Environment

- Downstream source: isolated read-only worktree at pushed
  `954fb49a5af6a0871ec0a1e1196e166b6e00a815`
- Core source: isolated read-only worktree at pushed
  `2d3e69aa6edaedfe81fc746cf14c91dc780857e8`
- Passing evidence workspace/profile/store:
  `F:\fxlab-runs\t027-integrated-dev-ui-smoke\workspace-inspect`
- Production panel/gateway/Scenario Lab: isolated ports `32175`, `47175`, and
  allocated scenario port `53242`; ports `3000` and `49100` were untouched
- Browser: headless Chromium with the unpacked Chrome production extension
  build and separate extension/panel persistent profiles
- Authentication: fresh process-local disposable credentials; no user store,
  user browser profile, or provider credential was read
- Live evidence runs:
  `demo-record-2026-09-21T02-40-11-279Z-9354c8` and
  `integrated-dev-ui-smoke-2026-09-21T02-40-44-968Z-983fbd`

## Exact UI checkpoints

1. The production panel authenticated against the fresh isolated store and
   opened Automation Studio.
2. Panel dialogs created the project, deterministic parent Flow, primary
   Subflow, and Flow-owned Router.
3. The real extension control UI opened its settings, received the isolated
   panel/gateway endpoints, connected, and selected the fixture tab.
4. `Start recording` entered recording state. The fixture received the name,
   plan selection, notes, and submit actions, and displayed `Submitted`.
5. `Stop recording` returned the extension to idle. The panel opened the
   recording, authorized deterministic generation, generated the Subflow, and
   rendered the saved four-node graph after refresh.
6. After a full managed Core/browser restart, the production panel reopened the
   persisted Flow, the extension reconnected, and the Subflow layout rendered
   with four non-overlapping nodes.
7. Runtime Debug selected `No LLM intervention` and started the Flow through its
   `Run` button. Its selected Action Log opened before the terminal execute
   response.
8. The scenario again displayed `Submitted`; Core's routed detail contained
   four of four successful `builtin.policy.action` attempts and matching
   summary counts.
9. In the still-mounted selected Action Log, the terminal UI showed:
   `Succeeded`; `4 actions`; four visible action rows; Recovery `0`; LLM Calls
   `0`; Tokens `0`; Cost `$0`; Adaptations `0`; Durable `no`. The enclosing
   Runtime Debug header showed `1 run`.

The result oracle was therefore 1/1 visible `Submitted`, and the executable
action oracle was 4/4 successful actions. The durable route-decision and
Subflow-entry assertions also passed before the UI snapshot was read.

## Stage timings

All values below are one live observation, measured from the start of the
passing evidence attempt; they are not a performance benchmark.

| Checkpoint | Cumulative | Delta from prior checkpoint |
| --- | ---: | ---: |
| Recording, generation, and saved workspace complete | 36.292 s | 36.292 s |
| Replay Core ready after restart | 41.083 s | 4.791 s |
| Replay authentication complete | 41.911 s | 0.828 s |
| Panel, extension, and fixture browser pages ready | 44.086 s | 2.175 s |
| Persisted project and Flow open | 45.883 s | 1.797 s |
| Extension connected to replay session | 47.400 s | 1.517 s |
| Four-node rendered layout verified | 50.717 s | 3.317 s |
| Runtime UI terminal response received | 68.866 s | 18.149 s |
| Visible `Submitted` oracle observed | 68.869 s | 0.003 s |
| Durable routed 4/4 detail observed | 68.960 s | 0.091 s |
| No-reload Runtime Debug DOM snapshot | 73.974 s | 5.014 s deliberate observation wait |

The selected Action Log reported the run itself as `14776ms`.

## No-reload and no-provider evidence

- The selected runtime detail became visible before the execute response, so
  the terminal DOM was not an initially loaded historical result.
- The panel main frame navigated zero times from immediately before the Runtime
  Debug run through the terminal DOM snapshot.
- The selected detail remained the Action Log for the same run and exposed the
  terminal status/action metrics in place; neither a Back action nor a run-row
  reopen was issued.
- `No LLM intervention` was selected before Run. Provider variables were not
  supplied to the Lab process. Runtime Debug reported LLM Calls `0`, Tokens
  `0`, Cost `$0`, and Adaptations `0`.

## First failures and ownership diagnosis

Two failures occurred in disposable Lab setup/observation, neither in the
production path:

1. The first launch used gateway port `49873`. Core's Next panel reached Ready
   on `32173` in 637 ms, but gateway bind failed with
   `listen EACCES: permission denied 127.0.0.1:49873`; the lane then timed out at
   108.101 s. Windows' TCP exclusion table places `49873` inside the excluded
   `49776-49875` range, and no process owned that port. No browser, recording,
   or provider path ran. Moving the disposable gateway to a non-excluded port
   removed the failure.
2. The initial post-terminal observer composed Playwright `hasText`/relative
   `has` locators incorrectly and timed out after the production run had
   already succeeded. A direct DOM projection then recorded the exact eight
   Runtime Debug metrics above, four visible rows, pre-terminal selection, and
   zero navigation at 73.974 s. The wrapper subsequently repeated the bad
   locator and marked its evidence bundle `failed`; that verdict is a harness
   artifact, not the observed product result.

Recommendation: accept the integrated production UI smoke as passed and do not
build a product fix. If this one-off observer becomes reusable test code, select
the metric's child `span`/`strong` text directly and allocate the gateway port
through the existing loopback allocator instead of pinning a Windows-excluded
port.

No secrets, pairing tokens, recorded field values, selectors, or captured page
content are reproduced in this report.
