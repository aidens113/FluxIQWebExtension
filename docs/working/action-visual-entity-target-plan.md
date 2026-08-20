# Action Visual Entity Target Plan

## Goal

Let recorded and executed web actions explicitly identify the visual state entity
they interacted with, when one exists. Automation Studio can then highlight the
same entity in the visual editor instead of inferring it from labels, selectors,
or action text.

## Contract

Add a domain-level `WebAutomationActionVisualTarget` object carried by recording
payloads and action results:

- `namespace`: state namespace, normally `web`.
- `statePath`: fully qualified visual state path, such as
  `web.elements.button.save`.
- `selector`: CSS selector used to identify the element.
- `frameId`: preferred visual frame, normally `screen`.
- `layerId`: best-known region layer ID when it can be derived.
- `documentLayerId`: matching document-map layer ID when it can be derived.
- `bounds`: viewport bounds for screenshot overlays.
- `documentBounds`: document-map bounds.
- `anchor`: bounds anchor for generic renderers.
- `confidence`: confidence that the target maps to the captured state entity.
- `metadata`: extra element identity hints.

## Implementation Steps

- [x] Create this working doc.
- [x] Add target contract and builders in the domain package.
- [x] Carry the target through recording payloads, schemas, reducers, and gateway mappings.
- [x] Attach the target to browser action results.
- [x] Document the wire shape for extension and domain consumers.
- [x] Run domain and extension checks.

## Notes

The repo already builds `web.elements.*` state values and visual-frame layers
from compact DOM snapshots. The implementation should reuse the same state ID
algorithm for visual targets so the editor gets a deterministic state path.

## Verification

- `pnpm --filter @fluxiq-web-extension/domain check`
- `pnpm --filter @fluxiq-web-extension/domain test`
- `pnpm --filter @fluxiq-web-extension/extension check`
- `pnpm --filter @fluxiq-web-extension/extension build`
- `pnpm check`
