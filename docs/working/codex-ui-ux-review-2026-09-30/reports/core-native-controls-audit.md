# Core native controls audit

Status: Complete (bounded read-only audit; source/test implementation held)
Owner: runtime_contracts
Date: 2026-10-01

## Written brief

- Core full/build gates active: no source/test mutation. Own only this report; keep login source and completed JSON brief frozen.
- Read parent Current State. Inspect exact Core apps/web/src/features/programs/components/controls/{Button,IconButton,ActionLink,Field,Combobox,Segmented}.tsx and directly owning tests/actual consumer call sites only when needed to prove a defect (bound further discovery to two consumers).
- Audit user journeys across keyboard/native semantics, disabled/busy controls, correct accessible labels/relationships, selected state and long-label/empty-option behavior. Prior Menu/Clipboard changes are settled; do not redesign them or reread old MVP scope.
- Distinguish directly confirmed source defects, contracts intentionally owned by caller, and browser/layout/assistive hypotheses. Avoid cosmetic tests that mirror implementation or unrequested large visual redesign.
- Return ranked findings, concrete reproduce matrix and exact disjoint source/test briefs for real fixes; preserve architecture and current call compatibility. No source/test edits or commands that mutate/build/start anything, no broad/browser/provider/private data/commits/shared docs.

## Findings

Read the six exact primitive source files and only relevant sections of directly owning `features/programs/tests/component-contracts.test.tsx`. Further consumer discovery/read was bounded to `live-views/production-runner.tsx` and `live-views/deployment-sync.tsx`, specifically their Segmented/Field usage. No executing/rendering/test/build commands, source changes, actual data or browser inspection occurred. Parent Current State was read during the immediately preceding bounded preparation; source remains frozen during full/build gates.

## Prioritized source findings

### 1. High: disabled Combobox leaves its open options executable

`Combobox` puts disabled only on its input. Its `defaultOpen` state or an already-open list survives `disabled=true`; options are divs whose onClick calls `choose`, and choose calls onChange without checking disabled. Thus a supported configuration `defaultOpen disabled` still presents clickable choices, and disabling a previously-open control does not stop current option selection. This is a confirmed primitive source path, not a claimed backend authorization bypass. No actual application Combobox consumer was inspected or proved affected.

Proposed exact two-path fix: `components/controls/Combobox.tsx` and NEW `components/controls/tests/Combobox.test.tsx`. Render-effective expanded state must be `open && !disabled`, used consistently for list, aria-expanded and aria-activedescendant; disabled state masks options on the same render. Also gate input change/click/key and choose paths so programmatically retained callbacks cannot call onQueryChange/onChange while disabled. A local current-props/action lease should reject retired option callbacks after options/onChange ownership replacement or unmount; require the captured option is still a member of the current options before selecting it. Keep caller-controlled value, query callback contract, native input focus, click/Enter selection, Escape restore and blur semantics. Loading alone is not an authorization/disabled flag and must not silently disable existing choices.

Required meaningful tests: disabled+defaultOpen renders no interactive list; update enabled/open to disabled and invoke captured option/input/key handlers, asserting no selection/query callback; reenable, explicitly reopen and make one selection; replace options and invoke a captured removed-option callback, asserting no change; ordinary click/Enter/typing/Escape/blur remain functional. Preserve shared original contract test without source-string substitutions.

### 2. Medium: Field label uses a different ID than its actual child

`Field` computes controlId from props.id/generated ID but preserves a child-supplied id when cloning. The label always uses controlId. Valid usage `<Field label="Name"><input id="existing-name" /></Field>` therefore produces `htmlFor="field-..."` with actual input id `existing-name`. Supplying distinct wrapper and child IDs has the same mismatch. Nesting the input inside the label does not make the explicit target accurate; this audit establishes mismatched rendered relationships without claiming an observed assistive-technology outcome.

Proposed exact two-path fix: `components/controls/Field.tsx` and NEW `components/controls/tests/Field.test.tsx`. Derive one effective control ID using the existing child's ID first (preserve current cloning compatibility), then wrapper id, then generated id. Use it for label htmlFor, cloned child id and hint/error IDs. Preserve existing aria-describedby merging, caller aria-invalid/aria-required when no wrapper override, required indicator, error feedback and direct-child cloning contract.

Regression matrix: child id only; wrapper id only; both distinct with child id preserved; neither supplied (generated ID uniqueness); existing describedBy combined with current hint/error targets; required/error state preserved. These assert functional associations, not CSS snapshots. Custom components still must forward cloned id/ARIA props; fragments/multiple controls require caller-authored semantics and are not silently transformed into a single labelable control.

### 3. Medium: first ArrowDown skips the first option on a closed empty-query Combobox

`activeIndex` starts0, while closed input has no active descendant. First ArrowDown increments to1 before opening; with at least two options and no selected/query label, the second option becomes active and Enter chooses it. First ArrowUp chooses the final option, which is consistent with backward entry. The same source also retains activeIndex while filtering changes, clamping only when past the end.

Include this in the SAME Combobox source/test unit as finding1, never concurrent edits. Distinguish opening from moving: closed+ArrowDown enters at first filtered option, closed+ArrowUp enters at last, while arrows in an already-open list move/wrap. Empty lists retain no active descendant and Enter should not accidentally submit a form solely because an option is imagined. Preserve current no-option Enter behavior unless a product owner explicitly wants form suppression. After typed query changes, first filtered option can remain the intentional default; avoid treating every filter update as another arrow action.

Tests: first Down then Enter selects first; first Up then Enter selects last; subsequent arrows wrap; zero/one options never produce a nonexistent active descendant; query matches and descriptions remain searchable. Existing static markup test cannot exercise this journey. This is a source-confirmed ordering issue; browser key delivery and screen-reader announcements remain unverified.

## Controls and contracts with no confirmed implementation defect

- **Button:** native button type defaults to button, explicit type is preserved, busy disables activation and exposes aria-busy, spinner hidden from accessible name, children retained. Synchronous operation deduplication/retired handlers remain the action owner's job; busy rendering alone cannot stop a previously captured JavaScript callback. No blanket action lease is proposed for this primitive.
- **IconButton:** requires label and uses it for both accessible name and title, preserves caller native disabled/type/attributes. Empty label strings and decorative icon aria-hidden remain caller contracts. No actual unnamed consumer was proved in this bounded audit.
- **ActionLink:** preserves native anchor href/attributes/children. A caller needing an action without href should use Button; there is no disabled/busy anchor contract to retrofit silently. No actual missing-href consumer was inspected.
- **Segmented:** labelled role=group, native type=button items and aria-pressed expose current selection. Tab plus native button activation is a valid existing contract; do not convert it to tabs/radiogroup or introduce roving-arrow behavior without a chosen product contract. Empty options produce an empty group; duplicate/empty option strings remain unsupported-data concerns without a proved consumer failure. Production Runner and Deployment each use fixed, unique option lists. Their default group name "Options" is generic but does not itself establish a broken action, and no speculative caller-label edit is proposed during this audit.

## Reproduce and implementation partitions

| Unit | Exact product/test paths relative to Core apps/web/src/features/programs | Source-confirmed trigger | Validation after explicit release |
| --- | --- | --- | --- |
| Combobox disabled/entry recovery | `components/controls/Combobox.tsx`; NEW `components/controls/tests/Combobox.test.tsx` | Open list then disable; disabled+defaultOpen; first Down on empty-query multi-option list | New actual primitive suite plus unchanged `tests/component-contracts.test.tsx`; exact scoped types |
| Field control association | `components/controls/Field.tsx`; NEW `components/controls/tests/Field.test.tsx` | Direct child has id distinct from generated/wrapper id | New functional association suite plus unchanged shared contract suite; exact scoped types |

The two units are disjoint and could run in parallel after root release. Root owns shared contract suite reconciliation if genuinely required; workers do not edit it. Tests first with actual components and synthetic props, no broad/live commands. No helpers/barrels/config/baseline/style changes required. Field uses static rendering plus exact association assertions; Combobox needs actual mounted event/state tests and stable option identities.

Long-label clipping, popover viewport collisions, scrolling active option into view, zoom/keyboard visibility and real assistive-technology behavior cannot be confirmed from these six source files without styles/layout/browser evidence. Do not present them as fixed defects or add speculative redesigns. Combobox option IDs use caller value strings directly and keys assume unique values; changing IDs/normalizing values requires a separate bounded contract decision if real invalid-data consumers are established. Loading empty-list feedback exists, but live-announcement behavior has not been exercised.

All login, Database JSON, shared and product/test paths remain frozen. This audit is a claim for supervisor review, not independent validation or browser certification.
