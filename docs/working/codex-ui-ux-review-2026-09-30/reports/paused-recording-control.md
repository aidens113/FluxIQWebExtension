# Paused recording Start control

Status: Active — corrected owning tests passed; extension full gates pending
Owner: Codex supervisor
Date: 2026-10-01

Paused recording is an active lifecycle in the existing review model, but recordControl hid Start recording only for recording. The new regression failed on original source: connected paused state incorrectly returned visible/enabled. The remaining six original cases passed.

The narrow correction treats paused and recording alike, before connection/page/workload availability checks. The new regression verifies all twelve paused combinations across connected/disconnected/reconnecting, supported/unsupported pages and working/not-working; the original six behavior cases remain unchanged.

Corrected owning suite: 7/7 passed, native exit0, 119.8275ms. Bundled/run through the shared heavy wrapper in ignored codex-t224-paused scratch output. No background/protocol/shell behavior changed. No live browser validation; full extension gates wait for the settings worker to freeze.
