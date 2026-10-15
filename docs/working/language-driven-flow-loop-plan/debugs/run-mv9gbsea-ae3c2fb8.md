# Debug: run-mv9gbsea-ae3c2fb8

- Instance: a8-slot-1, task `bigbox-retail-pickup-towels`, authoring mode `candidate` (A8 wave 8, 2026-10-15, pair
  downstream `003c3353` / Core `be766f29`), lane tree `fxwork/t563`. Steps: 42, 18 calls. Full analysis:
  `automation-project-agents-plan/reports/a8-towels-run-mv9gbsea-debug.md`.
- Verdict: failed (`runtime.behavior`): a Flow was created and judged yes, but the oracle failed it: 11 records, 9
  expected; $0.020.
- What happened: the Flow narrowed by the site's pickup and "Today" filters and stored the 9 right rows plus 2 whose
  tiles read "Pickup tomorrow" / "Delivery today" (the site's "Today" also counts delivery); it did not read each row's
  pickup text, so no condition of the read could leave them out. Three judges (0027, 0028, 0041) accepted the
  filters as meaning pickup today although the page views showed "Pickup tomorrow". Next behaved (page number, filters
  kept). No no was said, so no Core refutation rule (t629, t628, t607) fired: t629 did not cause this.
- Cause (product, Core judge): nothing checks that a site filter kept only what the request asks; Core's guidance
  warns only about filters that keep less than asked.
- Fix: to be briefed with the `project` towels debug of this wave.
