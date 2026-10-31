import type { WebNodeFrozenCommand, WebNodeFrozenResult } from "../types";
import { webNodeDispatchObservers } from "./observers";
import { webNodeObservedDispatch } from "./observe";

/** Retain main-command correlation across the selected gateway's deterministic scope pins. */
export function webNodeForwardedDispatch(original: WebNodeFrozenCommand, forwarded: WebNodeFrozenCommand, execute: () => Promise<WebNodeFrozenResult>): Promise<WebNodeFrozenResult> {
  const observed = webNodeDispatchObservers.get(original);
  return observed === undefined ? execute() : webNodeObservedDispatch(forwarded, observed, execute);
}
