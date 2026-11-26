# Brief: why two scripted company-website runs failed on dev with W3 (diagnosis only)

**Goal.** Find the root cause of each failure below from its recorded run. Classify each as a product defect (Core,
domain or extension), a Lab defect, or a scripted-model defect. Name the exact file and line, and the smallest
general fix. Make no edits: four tasks are editing Core in parallel, and the lead assigns the fix once the cause is
known. Both runs ran on `dev` at fluxiq 0.54.25, after W1 (page diffs), W2 (native decisions) and W3 (the
framework drafts the Flow). They ran in lane `C:/Users/osrs_/FluxStuff/fxwork/t1015-paid-bigbox`, provider-free
with the scripted model and `--attempts 4`. The same round's bigbox run passed 4 of 4 (run-mwwvelrb-46358790), as
a reference.

Run folders are under `.../t1015-paid-bigbox/test-runs/instances/paid-bigbox/attempts/`. Each step's exact request,
reply and page view are under `steps/`. The Lab logs are in
`C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1bda39b1-1940-4a03-9ca6-eeeb61191390/scratchpad/scripted-round/<task>.log`.

1. **company-website-saturday-certificate, `run-mwwwr1ty-d36c4ce1`.** Attempt 1, request 3 (`evidence_tool_decision`):
   the script refused with `The page shows nothing matching /^t\d+ (?!link )[^"]*"Wrenfield\b/u for "Choose the
   Wrenfield branch."` (`packages/test-runner/src/attempt-lane/scripted-model/scripts/evidence.ts:79`; the page comes
   from `currentPageOf`, which applies page-diff deliveries with `page-changes.ts`).
   - Was the Wrenfield control on the page and in the delivered views? If so, did a diff drop or rename it (D1/D2
     stable keys), or did `applyPageChanges` misapply a group?
   - If it was not on the page, why not: the step before, the site, or the script's expected path?
2. **company-website-apprentices, `run-mwwwf7pb-c646fefb`.** Attempt 1 ended with the right answer (14 calls, Flow
   "unproven"). Attempt 2 did not run the saved Flow. It made decisions until request 25, which the script does not
   expect, and the script refused it. AGENTS.md: a later attempt that strays from the saved Flow is a defect to trace
   to its root.
   - What did attempt 1 save: its Flow, and why it is "unproven"?
   - Why did attempt 2 not take the run of the saved Flow? Is the cause in W3's drafting, the result read, the
     continuation proof, or the script's expectation for attempt 2?
   - Compare with bigbox, whose attempt 2 ran the Flow.

**Must not.** Edit anything except your report, run any paid run, or use git or `node -e`. You may re-run a single
scripted run of one of these two tasks in the t1015 lane if the recording cannot settle a question. Use
`FLUXIQ_LAB_INSTANCE=paid-bigbox` through `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run
<label> -- pnpm lab attempt company-website --task <task> --authoring-mode answer-first --scripted-model --attempts 4`.
Say so if you do, and why.

**Report.** `C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/docs/working/page-diff-delivery-plan/reports/scripted-round-diagnosis.md`.
For each failure give:
- its cause, with file and line;
- its class;
- the evidence: the step files and the quoted lines;
- the proposed fix;
- whether it will hit the other scripted tasks: crossborder-marketplace, everything-store, local-classifieds,
  professional-network, social-network-feed.

End with the return contract.
