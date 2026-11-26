import type { AutomationNodeParameter } from "fluxiq/components/automation";

// The child frame a DOM step acts in, declared on its node (t1062).
//
// Three writers already put these two keys on a web node's parameters: the
// recorder (`./payloads.ts`), plan resolution for an element a handle named in
// a child frame (`../runtime/llm-evidence/plan-resolution/resolve-plan-node.ts`)
// and list detection (`../runtime/llm-evidence/structure/detect.ts`); the
// gateway lifts them onto the command (`../client/gateway-action-parameters.ts`).
// No definition declared them, so Core's check of the plan refused every step
// that ran inside an iframe as `bootstrap.unknown_parameter`, and no Flow with a
// step in an embedded widget could be saved (run `run-mwxdk1el-9dcfa4be`).
// Frame targeting is the web's concept, so the web's nodes declare it and Core's
// check stays strict.
//
// **The path is the frame's address; the id is not.** A browser frame id
// belongs to one tab and is given again each time the frame's document loads,
// so the id a build saw names no frame, or the wrong one, once a later attempt
// has reloaded the start page. `browserFrameUrlPath`, the pathname of the
// frame's document, survives that, and every reader finds the frame by it
// (`../runtime/target-reacquire/identity/step-frame-scope.ts` in the domain,
// `apps/extension/src/runtime/frame-address.ts` in the extension); the saved id
// only breaks a tie between two frames at one path. A frame whose document has
// no http(s) path (`about:blank`, `srcdoc`) is saved with its id alone, which
// holds only while that document stands.
//
// Both are hidden from a model, which names an element by handle only, and take
// no state binding: a frame is where a step runs, never a value it reads.

/** What a DOM step's node declares about the frame it runs in; a top-frame step carries neither. */
export const WEB_AUTOMATION_FRAME_PARAMETERS: readonly AutomationNodeParameter[] = Object.freeze([
  {
    id: "browserFrameUrlPath",
    label: "Frame Path",
    description: "The path of the child frame's document the step runs in, which finds that frame again on a reloaded page.",
    valueType: "string",
    shownToModel: false,
    allowStateBinding: false,
    ui: { control: "text" }
  },
  {
    id: "browserFrameId",
    label: "Frame Id",
    description: "The browser's id for that frame when the step was saved; it only breaks a tie between frames at one path.",
    valueType: "number",
    shownToModel: false,
    allowStateBinding: false,
    ui: { control: "value" }
  }
]);
