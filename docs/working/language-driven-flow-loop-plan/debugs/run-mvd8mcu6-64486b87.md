# Debug: run-mvd8mcu6-64486b87

- Instance: bf-slot-4 (live-lane-4), task `company-website-apprentices`, authoring mode `project`, breadth round
  (2026-10-17), downstream dev `48cdbfee` / Core dev `c1ed1bdd` (fixes 1-4 merged; Core libraries rebuilt by the lead at
  19:52 local, 8 minutes before the run), lane tree `fxwork/t567`.
- Verdict: **failed on the facility, before any model call** (`environment.missing`; facilityFailure boundary
  `finalized-bundle`, stage `scenario.execute`, reason `unclassified`). No Flow, no steps, no cost recorded ($0), 6.4
  minutes (03:00:02Z-03:06:26Z).
- How far it got: the prelude rebuilt scenario-lab, domain, extension and test-runner; Core's web app built and started
  ("Ready in 9.1s") and bound its client gateway; then Core's process exited with code 1 (`logs/core.log`, no error
  text captured) and the scenario never executed. The instruction was never typed.
- Cause: not the product. Core's compiled `dist` in this lane tree was being rebuilt by something else while the run
  used it: the reveal-by-scroll worker, working in the tree at the same time, recorded that "Core's dist was briefly
  missing mid-task (someone rebuilding it)" and its first typecheck failed on that; Core's `dist/index.js` now reads
  20:26 local, after the lead's 19:52 build. Core's library build begins by cleaning `dist`, so a Core server reading
  its modules during that window dies. Which process rebuilt it is not established (no lead or worker command in this
  lane ran a Core build after 19:52).
- Facility follow-up (not done): a live run should hold the lane's Core build stable for its duration (the Lab's
  `build-lock` covers the prelude; a Core library rebuild in the same tree during a run is not refused), and Core's
  stderr should reach `logs/core.log` so an exit says why.
- UI review: none possible; no panel or page was captured (`screenshotSuppressed: capture-unavailable`).
- Next: rerun on the same task once the tree is quiet; the reveal-by-scroll fix (lane fix 5, uncommitted) is ready for
  it. Not rerun: the session is wrapping up (supervisor, 2026-10-17).
