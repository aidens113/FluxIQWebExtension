# Debug: run-mvcw0qct-0f4257a5

- Instance: bf-slot-4 (live-lane-4), task `job-board-remote-easy-apply`, authoring mode `project`, breadth round
  (2026-10-17), downstream `5e59a563` / Core `76d66fe8`, lane tree `fxwork/t567`.
- Verdict: **passed**: Flow created, judged yes, oracle `extract-remote-easy-apply` passed (7 rows). $0.034 of $0.25,
  46 calls (build 36, judge 9, chat 1), largest single input 42,578 tokens; supervisor 12 calls $0.009, one brief,
  builder 32 calls $0.023. 6.5 minutes.
- Shape: 36 decide; 13 run_node; 10 find_on_page; 9 judge; 3 detect_repeating_structure; 3 test_subflow; 2
  submit_subflow. Playback: navigate x2, click (Remote), then a repeat of read list + next page over three pages.
- UI review (17 moments, side panel): plan and step cards read cleanly; a covered click is shown as "Didn't work: a
  popup or banner on the page was covering it", then the build closes the job-alert popup ("No thanks") and the
  Finch assistant overlay. Small wording defect: the overlay's close control is an icon-only button, and the chat
  calls it `Clicking "–"` / `Click · –`, its glyph, rather than an accessible name. End panel: "Records saved" after
  each page, "Check result: Passed: 7 rows came back", "Run finished".
- Cause of any failure: none.
