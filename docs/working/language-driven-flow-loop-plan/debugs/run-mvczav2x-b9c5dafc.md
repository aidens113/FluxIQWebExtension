# Debug: run-mvczav2x-b9c5dafc

- Instance: bf-slot-4 (live-lane-4), task `job-board-halvard-careers-roles`, authoring mode `project`, breadth round
  (2026-10-17), downstream `fb3919e2` plus lane fix 1 (icon-only controls in the page view, uncommitted) / Core
  `76d66fe8`, lane tree `fxwork/t567`.
- Verdict: **passed**: Flow created, judged yes, oracle `extract-halvard-careers-roles` passed (6 roles). $0.014 of
  $0.25, 20 calls (build 16, judge 3, chat 1); supervisor 6 calls, one brief, builder 12 calls; largest input 23,413
  tokens; 4.2 minutes.
- Shape: 16 decide; 9 run_node; 1 find_on_page; 1 detect_repeating_structure; 1 submit_subflow; 1 test_subflow.
  Playback: navigate, type (title, Leeds), click the job, decline the job alert (optional, skipped: not there),
  follow "apply on the company site" into the careers tab, open "All open roles", read the list.
- UI review (10 moments): plan, steps and the ending read cleanly; "Skipped: not there, optional" is shown for the
  optional alert step; "Check result: Passed: 6 rows came back"; "Run finished". No defect seen.
- Cause of any failure: none.
