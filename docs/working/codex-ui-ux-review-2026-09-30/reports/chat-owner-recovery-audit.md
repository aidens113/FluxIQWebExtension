# Extension chat ownership audit

Status: Active
Owner: Codex supervisor
Date: 2026-10-01
Scope: Read-only source audit of conversation controller, mounted chat and relay context.

## Current State

Source confirms a separate backlog from automation-owner recovery. Root released
a bounded controller/new owning test brief. Original six new cases all failed
native1/162.9033ms: throwing/rejecting send, rejected read, disconnected stale
read, old-ask dispatch and cross-thread answer failure. Controller correction is
in progress; shell/relay/wire/feed/composer remain untouched. Three workers
implement other explicitly partitioned units.

## Findings

- `chat/chat-panel.ts` observes only connected/not-connected in `render(status)`;
  gateway, Core address, client, project and pairing owner changes do not reset
  its target, turns, activity history or callback leases. Shell does render Chat
  before Automations on every status observation. Automation's current worker
  does not own Chat and cannot make this a complete panel ownership fix.
- `chat/conversation/controller.ts` advances generation for a different thread,
  but not connection changes. An old pending read may still publish after a
  disconnect. A same-ID conversation after Core/project replacement needs a
  separate owner revision, not only a target comparison.
- `answer()` neither captures generation nor verifies that the ask is currently
  pending in confirmed turns. A retained control can answer an old ask under the
  currently shown project; its completion/error can change a different thread.
  `chat-panel.ts` turn controls capture ask ID but call the controller's current
  state. Existing target tests cover read masking and send routing, not this.
- `refresh`, `send` and `answer` assume injected request always resolves.
  Synchronous throws/rejections escape; read/send/answer in-flight state can
  remain stuck. Defensive fixed feedback must avoid exposing exception text and
  preserve ordinary PanelResult refusal/retry behavior.
- A stale send failure may set unsupported/refused fallback on the newly opened
  target. A send already accepted for its original thread must remain accepted;
  owner-bound publication and composer draft revisions need separate handling.
- Relay resolves explicit project IDs or the current session project per call.
  Frontend leases cannot cancel a command already accepted by the relay. A UI
  correction must not claim a backend authorization or dispatch guarantee.

## Proposed bounded sequence

1. Reproduce controller rejection recovery, stale answer completion and old-ask
   dispatch through synthetic requests before editing controller plus owning tests.
2. Add operation/generation leases with finally cleanup owned by the operation;
   retain normal target-switch send semantics and existing quiet read retry.
3. Separately brief mounted Chat owner observation, activity reset and retained
   rendered callbacks. Preserve drafts, scroll and same-owner passive names;
   define explicit behavior for drafts when owners change. Never log owner data.
4. Freeze affected source for scoped types, owning controller/composer/Chat/shell
   tests and full extension gates; no live-browser certification from these.

## Validation

Source inspection and original six failing reproductions observed as above.
Relevant existing tests: conversation/tests/{controller,target-switch,composer-draft}.test.ts,
chat/tests/chat-panel.test.ts and shell/tests/mount-panel-navigation.test.ts.

## Controller correction verified; mounted owner recovery remains queued

Root two-path correction catches injected transport exceptions through one typed
request wrapper (including tail reads), invalidates generation on connection
changes, prioritizes offline presentation, checks confirmed pending asks and
uses per-answer operation identities. New target/disconnect clears answer state;
late old operation cannot release a newer same-ID lock or publish a failure.
Accepted old-target sends still return success; stale refusal cannot publish
fallback into the new thread. Ordinary PanelResult detail/quiet retry behavior
and original composer/target/controller assertions stay intact.

Independent root four-suite run:43tests/native0/280.3953ms, including nine new
cases and unchanged originals. Actual strict test-config two-root check native0
after correcting TEMP typeRoots resolution (initial harness missing chrome/node
types, no source diagnostic); no compiler relaxation. Whitespace check native0.
Controller source frozen for coordinated full extension gates after automation
worker freeze. Authored extension-client records these contracts. No shell,
feed, composer, relay, wire, Core or actual private-data change; broader mounted
owner lifecycle, retained rendered controls and backend dispatch remain queued.
