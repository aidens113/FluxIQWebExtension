# t026 — Live field entry and target stability

Status: In progress; live behavior proven, integration gates pending.
Date: 2026-09-20

## Outcome

Exploration can now enter a string into an observed textarea/text input or
select an observed option through one `enter_field` tool. The runtime infers
the browser action from the observed control, so the model does not choose a
low-level verb or supply a selector.

The downstream execution result may carry `targetsUnchanged`. Authoring sets it
true only when the page location is identical and every handle in the pre-action
binding still maps to the same selector afterwards. Added controls are safe;
removed or rebound controls are not. Navigation is always false. Recovery is
also false for now because recovery captures intentionally renumber handles.

## Live proof first

Command:

`pnpm --filter @fluxiq-web-extension/extension test:content -- exploration-state/tests/field-entry-target-stability.spec.ts --workers=1`

Chromium loaded the social-scheduler fixture and used the real content-script
action/capture path. It inspected the queue, pressed `New post`, then entered
post text, account, date, and time. The first run exposed an invalid fixture
account value; after correcting it, all four actions executed. The final run
passed 1/1 in 22.1 seconds of test time.

Observed contract:

- opening the composer returned `targetsUnchanged: false` because the modal
  hides controls that were actionable in the prior packet;
- each of the four field entries returned `targetsUnchanged: true`;
- the live DOM contained all four requested values;
- entered text/date/time were represented only as `hasValue`, not copied into
  their evidence fields.

## Narrow validation after live success

- downstream domain TypeScript check: passed;
- target-stability unit: 3/3 passed;
- Core evidence-loop unit: 23/23 passed, including acceptance of the optional
  result member;
- integration gates: pending.

## Next

Integrate t026 in both repositories, then reconcile t021's optional
multi-action decision onto current Core. The decisive live comparison must use
the same scenario and code with batching disabled/enabled, complete at least
one batch of two or more actions, and report provider calls, executed actions,
batch stops, elapsed time, cost, and Flow/oracle outcome.
