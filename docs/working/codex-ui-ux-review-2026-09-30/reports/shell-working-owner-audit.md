# Shell working-state owner audit

Status: Active
Owner: Codex supervisor
Date: 2026-10-01
Scope: Source-only follow-up for the shell's separate activity feed and working hold.

## Current State

Mounted Chat and automation owner recovery do not reset the shell's separate
activity/working gate. Root source inspection confirms this distinct dependency.
No shell/working/feed source changed here. Chat's new owner helper is actively
owned by another worker; do not depend on an unfinished helper in validation.

## Source-confirmed behavior

`shell/mount-panel.ts` constructs one activity feed, starts it once, and rereads
only when connection becomes connected. Every status observation calls
workingInput(current status, retained shell activity snapshot). It does not
observe gateway/Core/client/project/pairing owner changes. A same-connected
replacement retains the old relay's display/history; pending old reads/push
handlers remain current to that feed instance.

`working-input.ts` intentionally trusts a ready live paced display over volatile
runtime state. Consequently an old owner's live working display can keep the
new owner's Record/Extract/Run blocked even when the new status is idle, until
some newer shell-feed observation arrives. An old idle live display can also
mask the new runtime's running fallback. These are source call-order findings;
no live incident or exact blocking duration is claimed.

`working-hold.ts` deliberately delays working400ms and idle1200ms to avoid
flicker. stop() only cancels a pending timer; it does not reset raw or displayed
state, and a same raw observation afterward does not schedule again. Merely
calling stop on owner replacement is therefore insufficient. Same-owner
runtime/session reconnect churn must preserve the verified stable hold policy.

## Proposed exact follow-up

After Chat freezes and its focused owner helper is independently reviewed,
reuse the same confirmed tuple/lease policy in mount-panel rather than inventing
a second context definition. Scope a root/worker brief to mount-panel.ts,
working-hold.ts and two new owning shell tests (working-owner integration and
hold-reset). Existing hold/input/navigation assertions remain unchanged.

On an actual owner replacement, stop and replace the shell activity feed;
mask foreign activity before controls consume it. New callbacks and request
wrapper capture the current owner/instance. Add an explicit hold reset contract
that cancels timer/raw/shown together and publishes only when needed; then
observe current-owner runtime fallback and await the new paced feed. Preserve
normal holding cadence and recording/automation disabled-state contracts.

Visible lifecycle and reconnect policy must match the actual shell rather than
pretend Chat activation owns this separate feed. Do not cancel an issued
background command or abandon durable recording/pick state. Do not clear
current user drafts/navigation or reclaim focus on status observation.

## Required verification

Tests-first synthetic A working/B idle and A idle/B running across same-connected
replacement; old read/push/timer after replacement; A/B/A leases; same-owner
volatile context/reconnect stability; omitted optional settings retain confirmed
Core; paired loss; current runtime fallback then current paced authority.
Verify unchanged20-runtime-flip hold/input/record/extract/Run histories and shell
navigation. New helpers/extra callers need an exact separately reviewed release.
No source changes or reproduction tests executed yet; browser behavior remains
unverified. Root retains this plan as durable next work.
