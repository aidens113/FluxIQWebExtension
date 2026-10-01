# Floating overlay entry focus implementation

Status: Complete (exact two paths frozen; supervisor verification pending)
Owner: runtime_contracts
Date: 2026-10-01

## Written brief

- Combobox is frozen. Read parent Current State and floating-overlay-close-intent-audit.md F3. Exact paired t224 Core ownership: apps/web/src/features/automation-studio/workspace/overlays/accessible-floating-overlay.tsx; NEW same directory tests/floating-entry-focus.test.tsx. Own only this report additionally.
- Fix actual explicit autofocus ordering: query eligible explicit candidates first, then eligible ordinary candidates, then panel fallback. Use panel.ownerDocument for registration/activeElement capture and eligibility. Bound native eligibility to existing environment/Modal policy; hidden/inert/disabled/effective disabled-fieldset/CSS/disconnected candidates do not win. Respect document focus/visibility and current mounted lifecycle; no extra exported helper, environment change, observers or styles.
- Tests first actual wrapper/effect with bounded synthetic React portal/document fixtures: Close before search autofocus, invalid autofocus candidate falls back, owner-document choice, unfocused/hidden and retired lifecycle. Preserve actual overlay-hardening/position/environment original assertions. Do not merely assert source selector strings.
- Close intent metadata, Surface callbacks, Drawer remount and arbitrary action-return policy remain held separate work. Do not change wrapper props or subscriber semantics here. Do not claim browser/assistive focus certification.
- Heavy wrapper for new tests and owning compatibility suites, exact actual-config two-root strict types; no broad gates, compiler/baseline/harness weakening, shared docs/commits/browser/Lab/providers/panel/private state. Ask exact path release if extra helper/export/fixture required. Record initial failures and final results, freeze source/test and return precise limitations.

## Progress

Read the exact wrapper, F3 audit, relevant ModalContent/environment eligibility policy and original overlay-hardening suite. Created only the new21-case actual-wrapper/effect fixture, using mocked portal/environment public boundaries and synthetic DOM candidates. Cases cover heading-before-explicit ordering, thirteen invalid candidate states, owner-document active element, data-autofocus priority, ordinary/panel fallback, hidden/unfocused document and panel retirement during acquire. Actual environment behavior remains separately exercised by unchanged compatibility suites. Product is unchanged; initial heavy tests-first call87b497/session10795 is waiting for a heavy slot with no result yet. No result is being inferred from waiting.

Tests-first session10795 completed after the slot wait: e92d48/native1,20fail/1pass out of21tests,195ms tests/1.66s Vitest. Failures establish explicit priority, candidate filtering, foreign/global document capture, fallback and hidden/unfocused/retired entry focus; ordinary heading fallback is the baseline passing case. Product remained unchanged for this reproduction.

Implemented exact Core source `apps/web/src/features/automation-studio/workspace/overlays/accessible-floating-overlay.tsx` and NEW owning `tests/floating-entry-focus.test.tsx` only. Registration/active-element capture now use panel.ownerDocument and focus-method eligibility instead of the global document/HTMLElement constructor. Entry selection searches eligible data-autofocus first, then native autofocus, then ordinary native/tabindex/contenteditable candidates, then eligible panel fallback. Local eligibility follows the existing Modal/environment native policy: connected same-document focusable element, effective :disabled rejection (including fieldset), hidden/inert/aria-hidden ancestors, hidden input, zero client rects and hidden/collapse CSS visibility. Entry focus also requires visible/focused owner document and connected root/eligible panel, including retirement during synchronous environment acquisition.

Existing wrapper props, close callbacks, busy/outside/Escape behavior, environment return policy, portal target, positioning/ResizeObserver/frame cleanup, subscribers and public exports remain unchanged. No new exported helper, environment change, observers or styles. Added five boundary cases for invalid data-autofocus falling through native autofocus and hidden/inert/CSS/zero-size panels; new26cases plus unchanged compatibility assertions remain required.

| Observed validation | Native outcome | Evidence |
| --- | --- | --- |
| First new+owning compatibility run | 0 | e8e436,5files116tests/367ms tests/2.41s Vitest |
| First scoped types | 1 | 08e3d8,one new-fixture node-mock props unknown annotation; corrected exact fixture cast |
| Final new+owning compatibility run | 0 | f47d36,5files121tests/366ms tests/2.79s Vitest |
| Final actual-config exact-two-root strict types | 0 | d516ba,0diagnostics/7.894s tool |
| Exact diff check and module review | 0 | 2ef616; product182lines/owning test114lines,below400advisory/800hard |

Compatibility run included unchanged overlay-hardening10, overlay-architecture5, actual environment focus65 and ModalContent-focus15 tests alongside the new26 actual-wrapper cases. Types used TEMP `codex-t224-floating-entry-types.mjs` and actual web tsconfig/options with all dependency diagnostics, no tracked config/emit. All heavy checks used the required wrapper. ReactTestRenderer emits its deprecation notice; fixture DOM methods and disabled-fieldset results are synthetic public-boundary representations, not measured browser behavior. Actual browser/assistive/native focus/positioning certification remains unperformed. Close intent/Surface callbacks/Drawer remount/action return remain held and unchanged. No broad/live/private/provider/panel commands or commits occurred. Source/test are frozen for root independent review and full integration gates after the disjoint database worker also freezes.
