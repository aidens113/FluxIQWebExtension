# Completed phases, archived from Current State

Moved out of `mvp-week2-automation-loop-plan.md` on 2026-09-16 to keep
`## Current State` inside its 150-line budget. Every phase below is built,
supervisor-verified and pushed in both repositories; none of it is work anyone
still has to do. It is kept because it records what each phase actually
established, which the one-line summary that replaced it cannot.

**The four investigations are delivered, not just recorded.** Their findings —
that the exploration loop already existed and only needed a registry and its
other entry points, that Core's repair target was a CSS selector, that success
was inferred from silence in seven places, that a `delete_node` inverse dropped
cascaded edges, and that the PIN guarded one program rather than destruction —
are all now built as Phases H, T, D, G and P. The evidence, with file:line
detail, is in `reports/w2-a` through `w2-d` and the two scoping reports. One
finding is still open: flow bootstrap refuses any flow that is not blank, so the
"improve an existing flow" entry point cannot reuse it unchanged.

**Done and supervisor-verified** (each re-run by the supervisor, not accepted
from a report): both scoping reports, this plan and its Core pair, and the four
investigations. **Phase SEC** — three rounds, closing `create-session`,
`create-user`, the TOTP pair, `update-user` on its authority-changing path, and
a vault unlock that proved nothing. **Phase G** — rollback restores the whole
graph, with all eight operation inverses audited and a second instance fixed in
`restoreSnapshot`. **Phase T** — the repair target is opaque and the evidence
packet no longer describes selectors to the model, asserted on the serialized
payload with an exhaustive key allowlist. **Phase P** — every endpoint declares
whether it destroys, and omitting or misspelling that is a compile error.

**Phase D** — success is constructible only from an executed-and-compared run,
with a third vacuous path found beyond the two the plan named, and
`edit_recovery` failing closed rather than reporting a repair that never
happened. **Phase H** — a registry of harness options and Core's first neutral
ones. **Phase S** — a fixed order of work a domain extends but cannot reorder,
and Core's sanitizers no longer carrying browser nouns. **Phase 2.1** — the
recovery context, which records what was withheld and why. All of it is pushed
in both repositories.

**Phase 2.2** — a deterministic diagnosis gate, a structured diagnosis, a plan
stage and a recovery trace. **Phase 2.3** — closed exploration outcomes, a
budget over wall clock and actions, a whole-recovery deadline, and the web
domain's own harness options refused semantically per L3. The model now actually
receives the recovery context, and there is a named channel for a structured
diagnosis. Everything above is pushed in both repositories and both audits pass.
