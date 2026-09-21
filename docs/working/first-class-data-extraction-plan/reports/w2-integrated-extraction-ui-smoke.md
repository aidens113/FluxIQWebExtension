# Integrated Extraction UI Smoke

Status: Complete; production UI path and full-restart replay passed
Updated: 2026-09-20
Owner: `w2-integrated-extraction-ui-smoke`

## Scope and isolation

- Downstream source: `F:\fxwork\t032-integrated-extraction-ui-smoke` at
  `ef5c1c8af6c18d22a4f297bc73dade7c2361ca7b`; paired read-only Core at
  `F:\fxwork\!FluxIQ` at `2d3e69aa6edaedfe81fc746cf14c91dc780857e8`.
- Definitive disposable state/profile:
  `F:\fxlab-runs\t032-integrated-extraction-ui-smoke\workspace-retry4`.
  No user store, browser profile, or credentials were read or changed.
- Production panel used `http://127.0.0.1:32232`; the production client
  gateway used `ws://127.0.0.1:47232/client`. Ports `3000` and `49100` were not
  used. Chromium `134.0.6998.35` loaded the unpacked production extension and
  the Scenario Lab `product-catalog` page.
- Provider credentials were removed from the child environment. Both runs used
  **No LLM intervention** and durable run detail reported zero provider calls.
- No product/Core file, unit/full suite, provider call, commit, or push was in
  scope. Extracted cell values were neither logged nor inspected for this
  report; the oracle retained only counts and export-file non-emptiness.

## Definitive live checkpoints

Elapsed times are from the start of the fresh `workspace-retry4` run.

| Checkpoint | Elapsed | Exact observation |
| --- | ---: | --- |
| Initial Core ready | 6.133 s | Fresh isolated durable store served the production panel and gateway. |
| Initial panel + unpacked extension + scenario ready | 9.959 s | Production UI topology live. |
| Extension connected | 21.217 s | Paired production session, selected Flow context, and catalog tab active. |
| Recording started | 22.398 s | Recorder accepted the fresh Flow context. |
| Repeating structure proposed | 25.196 s | 8 items; 7 proposed fields; 7 included; 0 excluded. |
| Extraction confirmed | 27.728 s | Picker reported 8 captured records. |
| Recording finalized | 32.578 s | Exactly one new durable recording finalized. |
| Extraction Flow saved | 39.263 s | Saved generated graph contained one `web.dom.extract_list` action. |
| Initial run and UI verified | 46.963 s | `succeeded`; 1/1 action; 1 dataset; 8 rows; 7 fields; all 8 preview rows rendered; CSV and JSON exports nonempty; 0 provider calls. |
| Full initial teardown complete | 47.557 s | Core process and both extension/panel browser contexts were closed. |
| Restarted Core ready | 52.156 s | Same isolated durable store reopened after a new Core process start. |
| Restarted panel + extension + scenario ready | 54.910 s | New browser contexts and unpacked extension instance live. |
| Saved Flow reopened | 62.778 s | Same project, Flow, Subflow, graph Flow, and source recording identities recovered. |
| Restart replay and UI verified | 69.555 s | `succeeded`; 1/1 action; 1 dataset; 8 rows; 7 fields; all 8 preview rows rendered; CSV and JSON exports nonempty; 0 provider calls. |
| Cleanup complete | 70.099 s | Restarted Core and browser contexts closed cleanly. |

## UI and durability evidence

The initial run remained in the already-open Runtime Debug view after dispatch:
there was no panel reload and Runtime Debug was not reopened. The mounted view
showed one stored dataset, its table rendered 8 rows across 7 confirmed fields,
and both **Export CSV** and **Export JSON** produced nonempty browser downloads.
The durable API independently returned the same one-dataset, 8-row, 7-field
counts. Thus the UI preview/export proof and durable counts refer to the same
completed run without disclosing row contents.

After the full Core/browser shutdown and restart, the panel reopened the same
saved Flow rather than regenerating it. Replay produced the identical action,
dataset, row, field, preview, and export counts. Durable identity checks also
showed the same project, parent Flow, primary Subflow, graph Flow, and source
recording across the restart.

## First categorized failure

The first exploratory attempt reached a connected production extension at
62.733 s, then the Start recording button stayed disabled for its 30 s wait.
Category: **test-facility / disposable-driver ordering**, not product. The
driver had foregrounded the extension control tab immediately before the
click; production correctly classified that extension page as unsupported and
disabled recording. The existing production helper contract keeps the catalog
scenario foregrounded while driving the extension control page. Correcting
only that disposable driver behavior produced recording acceptance in the next
fresh profile and the definitive pass above.

Two later disposable-oracle calibrations also stopped before the definitive
pass: the current generated graph is one extraction action rather than the
older report's three-action shape, and counts-only dataset reads require the
explicit `web-automation` domain scope. Neither was a product/UI failure; both
were corrected only in disposable run data, then the complete journey was
rerun from a fourth fresh store/profile.

## Handoff

- Result: **pass**. The first-class extraction journey is live through picker,
  confirmed fields, recording, saved Flow, execution, durable preview,
  CSV/JSON export, full restart, and same-Flow replay.
- Initial/replay equivalence: 1 action, 1 dataset, 8 records, 7 fields, 8 UI
  preview rows, both exports nonempty, and 0 provider calls on each run.
- Only this report is tracked in the t032 worktree. All driver files, profiles,
  logs, downloads, evidence, and stores remain disposable under
  `F:\fxlab-runs\t032-integrated-extraction-ui-smoke`.
