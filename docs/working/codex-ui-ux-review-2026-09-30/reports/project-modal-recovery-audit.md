# Project modal recovery audit

Status: Complete - bounded source audit; no implementation or checks
Owner: deployment_docs_audit
Date: 2026-10-01

## Brief and scope

Root released a read-only ProjectModal readiness audit while Core full/build gates are active. Own only this report. Read exactly three paired Core files: `apps/web/src/features/automation-studio/hierarchy/ProjectModal.tsx`, its owning `hierarchy/tests/ProjectModal.test.ts`, and only the direct caller props/wiring region of `project/ProjectCatalogSurface.tsx`. No protected controller/backend/storage implementation, private state, product/test/shared-doc edits, checks, browser/live operations or commits.

Discovery/context output incidentally included short nearby inline `run`/category-finish snippets in the direct caller. This was disclosed to root. The controller was not subsequently read, and these incomplete snippets are not evidence that request, rejection or owner handling is safe or defective.

## Actual presentation and return contracts

`AutomationProjectModalView` is controlled presentation: it has no local draft, async operation, effect or request state. It returns JSX. Its action callbacks (`onCreate`, rename/delete/move and category equivalents) return `void`; the view neither awaits a result nor clears fields after a result. `projectModalConfig` returns title, description, action label and consequence text, not a mutation result. The file's grouping and category-reorder exports are pure presentation helpers rather than request ownership.

Create/rename readiness uses trimmed nonempty project/category names. Name/category inputs have native maxLength 120, description maxLength 500. Delete PIN readiness requires configured current-user PIN and at least four entered characters; the direct caller sanitizes PIN to ASCII digits with a 12-character maximum. Existing PIN/authorization and destructive confirmation wording must remain unchanged. These are visible UI constraints, not proof of server-side validation or compatibility with arbitrary externally supplied values.

The view passes `busy`, `closeOnEscape={!busy}`, and the supplied close callback to Modal. Cancel is disabled when busy. The primary action receives busy, content/PIN readiness, and the selected mode callback. Therefore the allowed source establishes intended native button/Modal busy safeguards. It does not establish the external operation's duplicate lock, response validation or rejection behavior.

## Draft, busy and owner findings

**No new duplicate submission or lost-draft-on-rejection defect is confirmed in the allowed scope.** Unlike the separately audited hierarchy transaction, the project view has no reducer edit that resets submission status. The direct field callbacks patch only their named controlled fields in the same studio UI store; they do not visibly clear `projectActionBusy`. Applying the hierarchy duplicate diagnosis here would be unsupported.

All name, description, category and PIN fields remain editable while busy. This is a source-confirmed policy gap: the UI permits a draft to diverge from a previously issued operation while its primary action remains busy. Whether later settlement overwrites those edits, preserves them, or applies an immutable issued payload is external to this view and was not inspected. Pending editing alone is not sufficient evidence to recommend a product change. Root should choose a freeze-edit policy only with an explicit submitted-payload/draft-preservation contract.

The actual `AutomationProjectModalBoundary` supplies API, catalog, current user, open-project callback and studio UI store to its boundary, then supplies controlled modal mode, target, fields, status, busy and void action wrappers to the view. The view invocation has no React key or request/API owner epoch. Field callback closures patch the UI store without an explicit originating modal identity. A retained old field callback therefore has no presentation-level origin check, but whether that callback can be delivered after a replacement or whether its owning store rejects it remains unverified. This is a conditional contract gap, not a demonstrated browser failure or confirmed owner leak.

Mode/projectTarget/currentUser alone cannot identify a newly reopened create dialog or an A-B-A modal session. Ordinary callback replacement also cannot safely serve as a transaction lease: routine rerenders replace these wrappers. A complete request-lifetime fix, if later established necessary, needs an explicit session/transaction owner from the actual UI boundary and a separate contract for already issued operations. The API owner's identity and server completion semantics cannot be inferred from opaque `void` callbacks.

## Existing coverage and proposed next partition

The nearest owning test contains three source/contract checks: field autocomplete/PIN branch assertions (also reading the hierarchy source), delete-project full-history wording, and delete-category preservation of projects in Uncategorized. It does not mount this modal, defer a callback, reject an operation or replace a modal session. No existing assertions were changed and no checks were run.

Do not release a speculative two-path async recovery fix based on this audit. If root explicitly adopts pending-field freezing as product policy, the bounded presentation unit would be `hierarchy/ProjectModal.tsx` plus new `hierarchy/tests/ProjectModal-interaction.test.tsx`: actual rendered busy/nonbusy inputs, preserved drafts, readiness, native cancel/submit behavior and original PIN constraints. Keep the existing three checks unchanged. This unit would not certify callback rejection or external owner recovery.

For actual rejection/draft/session ownership, first authorize a separate narrow read of the UI boundary's request/settlement contract and its owning tests, preserving the protected controller/backend boundary. Require source-confirmed failing behavior before proposing implementation paths. Test an immutable issued payload, editable-or-frozen draft policy, same-session failure recovery, replacement session and A-B-A, ordinary callback rerender, and settlement of an already issued operation independently of UI retirement. Do not obtain those guarantees by treating callback reference identity as owner identity.

## Validation and limits

Source-only findings from the three bounded reads. No tests, types, build, browser, provider or private-state operations were performed. There is no claim about actual backend validation, rejection feedback, final draft clearing, API/project ownership or browser delivery of retained callbacks. Core source and tests remain frozen for supervisor gates.
