# Debug: run-mvud43a2-445c7f17 (social-network-feed recent group posts, the user's demo run)

Status: Settled; the judge's no is refutable by membership evidence Core does not yet hold (P5b)
Run: `run-mvud43a2-445c7f17`, lane t566, instance `demo-slot-3`, workspace `claude-social-groups-t566-20261029-demo3`, 2026-10-29
Core and downstream at `dev` with t795 (computed facts), t796, t797, t800, t805 and the panel build fix 4d7c2264.
Cost: $0.1098 of the $0.25 build ceiling. 66 steps.

## Outcome

- `flowCreated: true`, **`oracleVerdict: passed`** (the saved Flow stored exactly the three expected rows),
  `reportedVerdict: unverified`, so the Lab verdict is `failed`.
- The build followed the user's lifecycle: steps 0009-0037 explored live (about ten `run_node` calls,
  `detect_repeating_structure`), 0039 `submit_subflow`, 0041 one `test_subflow`, judges 0045-0049
  (no, yes, no, no, yes), the Flow saved. One whole test, no per-step retesting.
- The Lab's judged run of the saved Flow (0052-0062: navigate, clicks, `extract_list`, `next_page`)
  stored the three right rows; its four judges (0063-0066) all answered `answersRequest: no`.

## The judges' no

Each named `asked_missing` rows by their group, for example 0063: Marcus Reid (Harbourside Council,
21 Sep 04:53), Rosa Delgado (Cycle Commuters of Harbourside, 21 Sep 04:00), Idris Bello (Urban Growers
Network, 20 Sep 09:40), arguing that condition 1 (`membership` starts with "Shared with Members of") drops
joined-group posts shown as "Shared with Public". The same judge's `changed` names the person's joined
groups as Riverside Allotment Society, Harbourside Runners and Old Town Bakers' Circle, none of which
holds a row it called missing. The oracle agrees: those groups are not joined, and their posts are rightly
left out.

## Cause

The no is self-contradictory and wrong, but Core cannot refute it: nothing in the run records which groups
the person belongs to. t795 refused to hold the ungrounded no as a failure (`unverified`, not `failed`),
yet a pass needs a model yes, which never came.

## Fix (P5b, next)

- Core refutes an `asked_missing` defect when the run's own evidence shows the row's entity is outside
  the asked-for set: the web side supplies membership as a per-item mark (CC2), for example a "Join group"
  control on a group the person has not joined, read during exploration.
- A no whose defect rows are refuted is re-asked with that evidence; a yes cites what it checked.
- Validation: replay this run's judge calls offline through the merged Core and expect `answers`.
