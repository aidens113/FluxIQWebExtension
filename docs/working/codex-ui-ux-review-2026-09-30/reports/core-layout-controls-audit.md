# Core layout controls audit

Status: Complete — source audit only; no product defect fix or browser certification claimed
Owner: deployment_docs_audit
Date: 2026-10-01

## Written brief

- Database JSON and Field source/tests remain frozen for root owning/broad Core gates. Own only this downstream report; no source/test/check commands. Read parent Current State and your completed database JSON report only as needed for continuation.
- Bounded exact Core reads under apps/web/src/features/programs/components/layout: Splitter.tsx, Toolbar.tsx, Panel.tsx, Breadcrumb.tsx, Tooltip.tsx and directly owning tests/shared component-contracts relevant sections. Bound actual consumer discovery to two call sites only when needed to establish a real defect; do not read unrelated UI/backend history.
- Audit actual keyboard/native semantics, pointer capture/teardown, accessibility relationships, disabled/retired handlers, resize constraints and overflow behavior. Distinguish source-confirmed functional bugs from browser/layout hypotheses and caller contracts. No speculative cosmetic redesign or implementation-mirroring tests.
- Return ranked confirmed findings with precise triggers, user impact and exact independent product/test implementation partitions. Preserve established component API and source ownership; name cross-module dependencies rather than duplicating generic behavior.
- No implementation, shared docs/commits, heavy/broad/browser/Lab/providers/panel/private inspection. Record source evidence/proposed meaningful tests and remaining browser limitations. Root coordinates any later source release after current Core gates close.

## Reads and evidence boundary

Read downstream parent Current State; exact five paired Core layout sources; directly relevant shared component-contracts tooltip, toolbar/breadcrumb/splitter and CodeViewer assertions. There is no layout/tests directory and filename discovery found no directly owning layout functional suites. Two actual consumers only: components/data/CodeViewer.tsx in full, and relevant Breadcrumb header call sites in app/programs/[programId]/ProgramWorkspace.tsx. Filename/reference discovery did not become broader consumer reads. No tests or check commands ran; database JSON, Field and shell paths remain frozen.

No active resize, pointer teardown, breadcrumb routing, or panel rendering regression was confirmed in this bounded source review. The ranked gaps below distinguish observed missing behavior from hypothetical impact. Shared snapshots assert roles and attributes; they do not exercise keyboard focus, native pointer behavior, browser layout or tooltip visibility.

## Ranked findings

### L1: Toolbar has no shared keyboard focus/navigation policy — active source-confirmed gap, product policy needed

`Toolbar.tsx` emits only a labelled role=toolbar div and orientation; it neither handles keys nor manages focus entry. Actual CodeViewer places a search input, wrap toggle, clipboard control and optional download button inside it. Native Tab visits those native controls; no Toolbar logic moves focus with arrows or maintains a toolbar entry. Existing component-contracts verifies only role and label. This is an observable missing interaction, not proof that Save/Copy/Download activation is broken or that keyboard users cannot reach them.

Before implementation root must decide the shared policy for toolbars that contain native editing controls. Arrow interception must preserve search input caret/selection and modifier/composition/defaultPrevented semantics. Blindly assigning one tab stop to all descendants would risk making this existing search input difficult to reach. Source discovery also found other toolbar call-site filenames, not read because of the two-consumer limit; this report does not infer their child structure or approve a global behavioral change.

Conditional independent implementation partition: exact `components/layout/Toolbar.tsx` + NEW `components/layout/tests/Toolbar-keyboard.test.tsx`, preserving public label/orientation/children API. Written release must define navigation eligibility, editing-control behavior, initial entry, caller-set tabIndex preservation and child lifecycle semantics. Meaningful tests should render the actual toolbar with search and action controls, show expected focus moves without activating actions, preserve native editing keys and disabled/hidden/inert descendants, and prevent retained detached handlers from stealing focus. A real CodeViewer-level integration regression would be a separate exact test path requiring root ownership approval; this audit does not authorize it.

### L2: Tooltip dismissal/overflow is unverified — CSS and browser follow-up, not a confirmed defect

`Tooltip.tsx` creates a unique ID, merges caller aria-describedby with it on one valid direct child and renders its full content in a role=tooltip span. Actual CodeViewer wraps its wrap and download IconButtons with it. It has no explicit open/dismiss state or Escape handler. Visibility is therefore outside this source's state, likely authored styling; the permitted reads did not include styles. Without the visibility rules, a claim that a visible tooltip cannot be dismissed, clips, blocks input, or persists after focus loss is unsupported. Its description is correctly supplemental in the existing shared assertion, and native child handlers are preserved by cloneElement.

Next partition is read-only first: root must name the exact authored tooltip style module/selector ownership and authorize it, then establish hover/focus/overflow/zoom behavior. Only a confirmed interaction issue would release `components/layout/Tooltip.tsx` + NEW `components/layout/tests/Tooltip-interaction.test.tsx`; authored style changes or consumer changes would need additional exact paths. Proposed eventual tests must prove caller descriptions persist, dynamic content remains associated, Escape suppression lasts for the current visible interaction, and later intentional interaction can reopen. Browser evidence is required for position, clipping, zoom and native hover/focus behavior. No CSS source or styles were changed/read here.

### L3: Splitter keyboard guards are absent, but the primitive has no active production caller

Exact reference search under apps/web/src excluding tests found only Splitter's definition and layout barrel. It is not used by the bounded actual UI consumers. The component implements orientation-specific arrows with clamping, Shift ten-step, Home/End bounds and optional Enter/double-click reset. It does not check defaultPrevented, composition or Ctrl/Alt/Meta before interpreting matching keys. A retained handler captures prior value/bounds/onChange; no lifecycle lease exists. These are direct source facts, but there is no actual production trigger or verified user impact in this checkout. Do not report a currently broken hierarchy resize or silently add owner state to an unused primitive.

PointerDown is explicitly a supplied caller callback: pointer capture, movement, cancellation and teardown are not owned by this small controlled primitive. Absence of those mechanisms here is not itself a defect. Numeric finite/in-order bounds are also caller contract assumptions; no real invalid caller was found. aria-valuenow is rounded rather than clamped; currently no production input can establish a mismatch.

Conditional later partition, only when an actual caller/contract is released: `components/layout/Splitter.tsx` + NEW `components/layout/tests/Splitter-keyboard.test.tsx`. Tests should demonstrate real directional/clamped moves, no change on consumed/composing/modified keys, exact reset policy and meaningful retired-handler semantics if required by the released caller. Pointer capture/teardown implementation must belong to that actual resize owner, whose exact paths are presently unknown. No speculative pointer helper is proposed.

## No-change conclusions

`Breadcrumb.tsx`: current final item is a span with aria-current=page; non-current href items use native Next Link and preserve the optional callback, and action items use a type=button. Both actual ProgramWorkspace branches pass a real backHref and current program title. No custom click prevention, synthesized keyboard activation or broken current-item navigation is present in this component. A non-current item with neither href nor onClick would produce an inert enabled button, but no such real caller was established; treat that as optional future contract design, not a verified regression.

`Panel.tsx`: a native section with h2, optional caller action and children. It owns no async work, event handlers, state or pointer lifecycle. Region labelling/heading-level customization may be future API design, but an h2 and section are not evidence of a functional or accessibility failure. Overflow constraints belong to styling and callers and were not inspected.

`Toolbar.tsx` and `Tooltip.tsx` do not implement async ownership or mutation behavior; this audit found no reason to copy backend/read leases into them. Generic retirement/focus behavior should be defined at the appropriate shared interaction owner and validated against real consumers.

## Return and limitations

Only this report changed. No source/tests/shared docs, heavy or broad gates, browser/Lab/provider/panel operations, commits, or private data inspection occurred. Ranked L1 is a real absent toolbar keyboard policy; L2 and L3 require further ownership/evidence before product release. Existing native Tab, Link and button behavior remains available based on source; actual browser focus, pointer capture, responsive layout, tooltip clipping, keyboard delivery and assistive technology behavior were not exercised. Root owns further exact-path releases and independent verification after frozen database/floating Core gates.
