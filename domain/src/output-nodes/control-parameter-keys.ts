/**
 * The parameter keys that name the control a web node acts on. A checked rerun
 * of a done lasting act may take new values for its other parameters, and never
 * one of these: the check ran nothing, so it cannot move the act to another
 * control (Core's `runtime/llm/node-tools/rerun-check.ts`).
 */
export const WEB_CONTROL_PARAMETER_KEYS: ReadonlySet<string> = new Set(["target", "selector", "element"]);
