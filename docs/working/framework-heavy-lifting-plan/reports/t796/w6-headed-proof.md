# t796 w6 headed proof: act ledger on photo-social

## Outcome

Done. One new spec, `apps/extension/e2e/site-reset/tests/photo-act-ledger.spec.ts`, passes headed (Chromium, extension loaded) on the photo-social realistic scenario, provider-free (scripted provider, no model call, no Lab live run). The existing photo specs also pass alongside it: 8 of 8 in `site-reset/tests/photo-`.

## What the spec does

Request (spec-local): "Like the studio's three most recent posts and save them." The scripted builder opens the studio profile, detects the grid, reads the three unpinned posts (`extractList.where` + `maxItems: 3`), opens the first post, finds its Like and Save handles, then:

- (a) submits a looped Flow (`repeat most: 3`) whose Save step stands directly after an optional dismissal step and carries `only after: notice`;
- (b) submits the accepted shape: like and save unguarded in the loop, then the optional dismissal (its target is a profile-grid control, absent on a post's own page, so it is skipped on every pass), then a `builtin.timing.wait` guarded `only after: notice`; tests it;
- (c) the scripted judge says no (the wait never ran), the builder ends partial, the supervisor's first ending is refused (`project.completion_repair_first`), a repair brief resubmits and retests the Flow, and the supervisor ends partial. The ending row is read from Core's activity stream (`automationStudioActivityHub`), as `repair-first.spec.ts` does.

No product code, model guidance or other spec was touched. No helper added to `photo-build.ts`.

## Commands and results

1. Core's compiled build was stale (the e2e script's guard refused it); rebuilt with `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` in the Core worktree (exit 0). Not a git change.
2. `pnpm --filter @fluxiq-web-extension/extension test:e2e -- site-reset/tests/photo-act-ledger.spec.ts`: first failed on spec bugs and one finding below (12 iterations), final run passed.
3. `pnpm --filter @fluxiq-web-extension/extension test:e2e -- site-reset/tests/photo-` (the final run of the spec is inside it): `Running 8 tests using 4 workers`, `8 passed (6.3m)`, exit 0. The 8 are the 7 existing photo specs plus the new one.

All heavy runs used the shared lock `heavy-check.lock`, released each time.

## Observed (control names and post codes only)

(a) Refusal, issue code `bootstrap.instructed_act_only_optional`, path `flow.line.30`, step "save the post". Message contains: "This step does what the request asks, and `only after: notice` makes it run only on passes where notice was done; on a pass where notice finds nothing to press it is passed over and the act is not done. Take `only after:` out so it runs on every pass."

(b) The accepted Flow's trial: the liked posts after it are exactly the three newest unpinned (D1OKDvAEHfa, DgYZxS8LJOe, DPIEH3I491a). Feedback `leftOnSite`, per pass:

- `trial step 6, pass 1 of 3 "like the post" on "Like"`, `trial step 7, pass 1 of 3 "save the post" on "Save"`
- `trial step 13, pass 2 of 3 "like the post" on "Like"`, `trial step 14, pass 2 of 3 "save the post" on "Save"`
- `trial step 20, pass 3 of 3 "like the post" on "Like"`, `trial step 21, pass 3 of 3 "save the post" on "Save"`

The three like steps in `feedback.steps` are each `succeeded`. Top-level `feedback.notRun`:

```
{"label":"wait a moment after the notice","reason":"guarded","after":"close the notice if it shows","passes":[1,2,3],"of":3,"lasting":false,
 "said":"Not run on passes 1, 2 and 3 of 3: it runs only after \"close the notice if it shows\", which was skipped."}
```

(c) Ending row, title "FluxIQ stopped with the Flow only partly built.", text:

"The posts were liked and saved, but a step of the Flow did not run. The judged test run of the whole Flow from its start made 26 step runs, counting each pass of a repeat and stored 3 rows, but its step “wait a moment after the notice” never ran (on any of the 3 passes), and could not be confirmed to do what was asked. It was tried twice. These changes the build made are still on the site: ran the step “save the post” on the page “…/p/D1OKDvAEHfa/”, ran the step “like the post” on the page “…/p/DgYZxS8LJOe/”, ran the step “save the post” on the page “…/p/DgYZxS8LJOe/”, ran the step “like the post” on the page “…/p/DPIEH3I491a/”, ran the step “save the post” on the page “…/p/DPIEH3I491a/” and 1 more."

It does not contain "ran all N of its steps".

## Deviations from the brief (and why)

1. **"Like" is not a verb Core's act reader knows, so (a) cannot be proven on a like step.** With the request "Like the studio's three most recent posts." a like step behind `only after:` an optional step was accepted (revision accepted, trial ran). The act kinds are save, add_to, claim, submit, move (`instructed-acts/kind-words.ts`, `instruction-acts.ts`), and the declared-consequence path only matches verbs implying delete, move_money or send_or_publish (`act-consequence.ts`). So the spec's request adds "and save them", and the Save step carries the refusal. Real photo-social likes written as "Like ..." are not protected by this rule. This is a Core finding for the supervisor, not fixed here.
2. **The ending says "ran the step “like the post” on the page “…”", not "clicked “Like” on the page “…”".** Core names the act by the step's label here; the "clicked" wording did not appear. The assertions check the step-label form. The list is capped at five acts plus "and 1 more".
3. **(c) needed a failed judged run, not a clean one.** A supervisor `ended: partial` is refused (`project.completion_ended_too_soon`) unless a brief came back partial or blocked, and a builder cannot end partial after a yes. So the judge is scripted to answer no, and the supervisor must first send a repair brief (`project.completion_repair_first`). Consequence: the trial verdict reads `not_judged` and "It was tried twice" in the ending. What was proven is Core's wording of the ending when leftovers exist and a step did not run; a clean passing build whose guarded step never ran ends by completing, with no ending row, so no such text exists to check there.
4. **Selector-based optional step is refused.** The optional dismissal must name a handle (a `selector:` gives `web.handle.not_a_handle`). The spec uses a profile-grid control's handle, which is genuinely absent on each post page, so the step is skipped on all 3 passes. The skipped step reads "Its control was not on the page, so the step was skipped and what it does was not done." in the step feedback.
5. **Order matters for (a):** a guarded step not directly after its optional step is refused earlier as `flow_script.only_after_misplaced` (not the code under test). The spec places the Save directly after the dismissal.
6. Another observation: with the request wording "Send a like to ..." the Like needed the person's permission (`send_or_publish`), and the brief stopped as blocked with `person_ended`. That wording was abandoned.

## Not verified

- The full suites (`pnpm check`, `pnpm test`, Core's vitest) were not run, per the repo's validation rule.
- Firefox build, the extension UI/chat rendering of the ending row, and any live (paid) run.
- A guarded lasting step (not only a non-lasting wait) appearing in `notRun` with the "so what it does was not done" sentence: the spec's guarded step is the non-lasting wait, since a lasting guarded step is refused at submit by (a).
- Stability under repetition: each iteration ran once; the final run passed once (the 8-test run).

## Open questions

- Should "like" (and similar reaction verbs) be added to the act vocabulary so deviation 1 closes? The rule's intent (a requested act behind `only after:`) does not hold for photo-social's own like task today.
- Is the "ran the step “like the post” …" wording intended, versus a control-name wording ("clicked “Like”")?
