# W2 panel run presentation live report

## Result

Status: **passed live with no source repair required**.

The production FluxIQ panel visibly presented the exact latest saved runtime
run and all four of its successful action attempts. The proof used the existing
isolated recording workspace and did not dispatch another run or infer the
result from an API response.

## Live boundary

- Downstream candidate: `F:\fxlab\t027-recording-panel\!FluxIQWebExtension`.
- Core candidate: `F:\fxlab\t027-recording-panel\!FluxIQ`.
- Saved workspace: `F:\fxlab-runs\t027-recording-panel\workspace`.
- Browser: headless Playwright Chromium, 1280 x 720.
- Panel: isolated loopback panel on port 34127.
- Evidence bundle:
  `demo-panel-run-presentation-2026-09-21T00-50-40-184Z-33dca6`.
- Exact durable run:
  `bc7f2efd-a9f2-4055-bd61-0da2c247db4b`.
- Exact Flow:
  `flow.1f033294-788d-4ce6-a722-2fd82332f89e`.

No user panel, profile, or data was used. No provider, extension, scenario,
recording generation, batch, repair, or Core mutation path was entered.

## Visible UI proof

The browser opened the saved project and Flow, selected the Flow-owned
`Runtime Debug` view, and used the panel's `Find a run` control to search for
the complete durable run ID.

The exact visible run row showed:

- the complete run ID;
- terminal status `Succeeded`;
- `4 actions` and `0 effects`; and
- a rendered duration of 13,832 ms.

Opening that row produced the real `Action Log` view. Its visible hero repeated:

- the exact durable run ID;
- the exact Flow ID;
- terminal status `Succeeded`;
- `4 actions`; and
- the same 13,832 ms duration.

The Action Log rendered exactly four `.automation-runtime-attempt-row` entries.
Each of attempt rows 1 through 4 visibly contained `Succeeded`. This binds the
four successful attempts to the durable run through the run row selected in
the panel and the exact run identity repeated in the Action Log hero.

## Timing and failure boundary

- Whole proof, including isolated Core/panel startup and shutdown: 14,610 ms.
- Last passed UI stage: `four-successful-attempts`.
- First failure: none.

## Change and validation boundary

The current panel presentation locators matched the live production UI, so no
driver, product, Core, or test source was changed. The existing isolated
candidate diffs from the prior recording and latency briefs were left
untouched. No unit test, broad suite, commit, or push ran; the real panel proof
was the required validation for this report-only brief.
