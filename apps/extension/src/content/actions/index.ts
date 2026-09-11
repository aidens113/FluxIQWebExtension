// What each browser action type does, expressed against capabilities the caller
// supplies rather than against the DOM directly. `action-runtime/` provides
// those capabilities; the action-type strings in `execute.ts` are a contract
// with the domain action registry. One file per action verb, dispatched from
// `execute.ts`.

export type {
  BrowserActionCommand,
  BrowserActionResult,
  DomElementDescriptor,
  DomSnapshot,
  RectDescriptor
} from "../types";
export type { ContentActionDependencies } from "./types";
export { executeContentAction } from "./execute";
