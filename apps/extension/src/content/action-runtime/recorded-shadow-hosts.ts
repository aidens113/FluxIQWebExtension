// The open shadow hosts a command's recorded target sits inside, if any.
//
// The recorder writes the host chain beside the element's selector
// (`selector/shadow/host-chain.ts`), because a selector written inside a
// shadow tree names nothing in the light document. `resolveTarget` has read it
// since that chain existed; a wait had no way to, so a Flow that waited for a
// widget's control before clicking it timed out and then clicked the control
// successfully a moment later.
//
// The chain is read from the same two places, in the same order, as
// `resolve-target.ts`'s `recordedTarget`: the declared `element` field first,
// then the untyped `options.element` the same description also travels in. The
// first *described* element decides, and an element that describes something
// without naming a host chain is a target in the light document rather than a
// reason to look at the description beside it. The two readings must agree --
// a wait scoped to one set of roots and a click scoped to another would
// resolve different controls -- and `tests/recorded-shadow-hosts.test.ts`
// holds them to it.

import type { BrowserActionCommand } from "../types";

/** The recorded host chain, outermost host first, or `undefined` when the target was recorded in the light document. */
export function recordedShadowHosts(action: BrowserActionCommand): readonly string[] | undefined {
  const element = describedElement(action.element) ?? describedElement(action.options?.element);
  const hosts = (element?.context as { shadowHosts?: unknown } | undefined)?.shadowHosts;
  if (!Array.isArray(hosts) || !hosts.length) return undefined;
  return hosts.every((host) => typeof host === "string" && host.length > 0) ? hosts as string[] : undefined;
}

/** A wire value that is an element description: an object carrying at least one signal, as `recordedTarget` reads it. */
function describedElement(value: unknown): { context?: unknown } | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.keys(value).length ? value as { context?: unknown } : undefined;
}
