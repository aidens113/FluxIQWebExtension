# Lab selector sync — moving the Lab's panel selectors to Core's renamed panel

Worker report. **In progress** (resumed after an interruption; no files had been
edited before it).

## Findings so far (Core HEAD c25c0fb)

- Hierarchy search text is `node.label + " " + node.kind`
  (`hierarchy/indexing.ts:42`). Every Lab search for an old section label
  ("Runtime Debug", "Router", "Subflows", "Instructions", "Adaptations") now
  matches nothing. Section ids are unchanged (`hierarchy/flow-generation.ts:106-117`),
  so `data-tree-item-id` selectors survive.
- Tree item `aria-label` is `node.label` (`hierarchy/components/TreeRows.tsx:73`),
  so `[aria-label="Instructions"]` / `[aria-label="Runtime Debug"]` are stale.
- Workspace tab name is `<view label>: <flow name>` for object tabs
  (`live/components/AutomationStudioSession.tsx:243`), so `Router: <flow>` is now
  `Choose a path: <flow>`; `Nodes` is now `Steps`.
- The authoring region `Build Flow from instructions` is now
  `Tell FluxIQ what to automate` and lives on the Steps landing pane, not Runtime
  Debug (`authoring/BlankFlowAuthoringPanel.tsx:241`).
- PIN/"Authorize and Save" dialogs removed for Flow settings, instruction save,
  Router saves and adaptation review (ws-c, panel-reconciliation).
- `Loading projects...` was already gone before today (Core b8bd363); the
  Lab's wait-for-hidden on it has been a silent no-op.

## Outcome

In progress.

## Not verified

- No Lab run was started (another worker owns the live-run slot).
