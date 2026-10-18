# Debug: run-mvcwf9u2-28bb44fd

- Instance: bf-slot-4 (live-lane-4), task `job-board-save-quillmark-remote`, authoring mode `project`, breadth round
  (2026-10-17), downstream `fb3919e2` / Core `76d66fe8`, lane tree `fxwork/t567`.
- Verdict: **failed** (`runtime.behavior`, `lab.chat_build_failed`, `project.build_blocked`): no Flow created.
  $0.029 of $0.25, 59 calls (build 58, chat 1); supervisor 5 calls, builder 53 calls over two briefs; largest input
  29,477 tokens; 4.4 minutes.
- How far it got: the builder searched Rolefinch for Quillmark, closed the job-alert offer and the assistant overlay,
  and had the Quillmark results showing (all three of Quillmark's remote UK jobs on page 1). It never saved anything:
  it looked for a save control (find_on_page x5, describe_element, opened My jobs to see what a saved job looks like),
  then clicked the Senior Rust Engineer title link `t117` three times "to open the detail panel and find its save
  control"; each repeat was refused (`repeat_refused`, same_result), and three in a row ended brief-1. The supervisor
  re-dispatched the same subflow; brief-2 went the same way (0110-0118). The supervisor then ended the build honestly
  as blocked (0119).
- Cause: **the save control is not in the model's page view.** On Rolefinch each result card's save control is the
  heart, `<span class="heart" style="cursor:pointer">` holding an unlabelled `<svg>`, right after the card's `h2`.
  The compact page view (0046 request, cards 1/7-5/7) lists the `h2 link`, company, location, salary, type and
  snippet of every card and nothing for the heart, so the builder told the truth when it said "the results list
  shows no save button". The page view drops a clickable element that has no text and no accessible name. This
  breaks the user's rule that the model sees every visible interactive element; an icon-only control (heart, star,
  bell, kebab, close cross) is common on real sites.
- Checked, not a cause: the chat step (0001) paraphrased the instruction into its `flow.createHere` command, but
  `project.read_task` (0002) gave the supervisor the person's exact words.
- UI review: the chat shows the plan, the two briefs and each click; the ending card reads "The build failed: the
  supervisor ended it because it could not finish the Flow ... both builders were stopped by the evidence loop before
  producing any proposal": honest, but it names internal machinery ("evidence loop", "subflow", "proposal").
- Fix: see the lane report's fix log (page view lists icon-only clickable elements with a derived description).
