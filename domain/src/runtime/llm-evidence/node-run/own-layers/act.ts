// The act on the page a layer memory is told about (`./memory.ts`): which
// control it was on, and what kind of act it was, as `../run.ts` holds them.

/** One act of the build on the page it stays on. */
export type WebNodeLayerAct = {
  /** The handle of the control acted on, as the call named it; absent where it named none. */
  handle: string | undefined;
  /** The action the node runs (`web.dom.click`, `web.dom.type`, ...). */
  actionType: string;
  /** The parameters as written, before any binding is resolved: `submit` on a type is read from them. */
  parameters: Readonly<Record<string, unknown>> | undefined;
};
