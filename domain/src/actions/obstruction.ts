// What stood in the way of an action, as an action result reports it (CC7,
// interface I2 of the heavy-lifting plan).
//
// `clearedLayers` (`./cleared-layers.ts`) says what the extension pressed after
// the fact. This says what is in the way *now*: on a result whose target was
// covered, or that failed because a layer stood over the page, and on a
// rate-limit refusal (CC8). It carries the layer's generic kind, its stable id
// and name, and the ways out the client found on it, each with an intent --
// `dismiss` (closes the layer, acts on nothing), `accept` (answers it in the
// page's favour: a consent given, a request confirmed) or `neutral` (the client
// cannot tell) -- and the durable target of the control as the parameters a
// click runs with (`controlRef`, `{ selector, element }`). Core presses the first way
// out whose intent is `dismiss`, else `neutral`, and never one that `accepts`.
//
// The intent is computed from the layer's structure and the extension's own
// press guard, never from a scenario's words. This module copies and bounds
// what the client sent; it computes nothing.

import { webAutomationClearedKindValue, webAutomationControlRefValue, webAutomationLayerIdValue, type WebAutomationClearedLayerKind } from "./cleared-layers";

export const WEB_AUTOMATION_OBSTRUCTION_INTENTS = ["dismiss", "accept", "neutral"] as const;
export type WebAutomationObstructionIntent = (typeof WEB_AUTOMATION_OBSTRUCTION_INTENTS)[number];

/** One way out of an obstruction. */
export type WebAutomationObstructionWayOut = {
  intent: WebAutomationObstructionIntent;
  /** The control's durable target, as a click takes it at run time. */
  controlRef?: Record<string, unknown> | undefined;
  /** The node definition a step pressing it runs; the dispatcher says it (`io/gateway-output-dispatcher.ts`). */
  definitionId?: string | undefined;
  action?: "back" | undefined;
};

export type WebAutomationObstruction = {
  id?: string | undefined;
  name?: string | undefined;
  kind: WebAutomationClearedLayerKind;
  /** What the layer covers, in at most 80 characters of structure (a region word), never page prose. */
  covers?: string | undefined;
  /** A `rate_limit` only, and only when the page stated a time: 1 to 600000. */
  retryAfterMs?: number | undefined;
  dismiss: WebAutomationObstructionWayOut[];
};

/** Bounds, interface I2. */
export const WEB_AUTOMATION_OBSTRUCTION_WAYS_MAX = 6;
export const WEB_AUTOMATION_OBSTRUCTION_COVERS_MAX = 80;
export const WEB_AUTOMATION_OBSTRUCTION_NAME_MAX = 120;
export const WEB_AUTOMATION_OBSTRUCTION_RETRY_MAX_MS = 600_000;

const DEFINITION_ID = /^[A-Za-z0-9._:-]{1,120}$/u;

/** The obstruction as it may travel: known words, bounded, and nothing a producer put beside them; none when it is not well formed. */
export function webAutomationObstructionValue(value: unknown): WebAutomationObstruction | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const entry = value as Record<string, unknown>;
  const kind = webAutomationClearedKindValue(entry.kind);
  if (kind === undefined) return undefined;
  const id = webAutomationLayerIdValue(entry.id);
  const name = boundedWords(entry.name, WEB_AUTOMATION_OBSTRUCTION_NAME_MAX);
  const covers = boundedWords(entry.covers, WEB_AUTOMATION_OBSTRUCTION_COVERS_MAX);
  const retry = entry.retryAfterMs;
  const retryAfterMs = kind === "rate_limit" && typeof retry === "number" && Number.isInteger(retry) && retry >= 1 && retry <= WEB_AUTOMATION_OBSTRUCTION_RETRY_MAX_MS ? retry : undefined;
  const ways = Array.isArray(entry.dismiss) ? entry.dismiss : [];
  const dismiss: WebAutomationObstructionWayOut[] = [];
  for (const way of ways) {
    if (dismiss.length >= WEB_AUTOMATION_OBSTRUCTION_WAYS_MAX) break;
    const read = wayOutValue(way);
    if (read) dismiss.push(read);
  }
  return {
    ...(id ? { id } : {}),
    ...(name ? { name } : {}),
    kind,
    ...(covers ? { covers } : {}),
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    dismiss
  };
}

function wayOutValue(value: unknown): WebAutomationObstructionWayOut | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const { intent, controlRef, definitionId, action } = value as Record<string, unknown>;
  if (typeof intent !== "string" || !(WEB_AUTOMATION_OBSTRUCTION_INTENTS as readonly string[]).includes(intent)) return undefined;
  const ref = webAutomationControlRefValue(controlRef);
  const definition = typeof definitionId === "string" && DEFINITION_ID.test(definitionId) ? definitionId : undefined;
  return {
    intent: intent as WebAutomationObstructionIntent,
    ...(ref ? { controlRef: ref } : {}),
    ...(definition ? { definitionId: definition } : {}),
    ...(action === "back" ? { action: "back" as const } : {})
  };
}

function boundedWords(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const collapsed = value.replace(/\s+/gu, " ").trim().slice(0, max).trimEnd();
  return collapsed.length > 0 ? collapsed : undefined;
}

/** The failure code a page's refusal for going too fast carries (`runtime/failure/codes.ts` `RATE_LIMITED`). */
const RATE_LIMITED_CODE = "web.action.rate_limited";

/**
 * The obstruction a result reports. What the client sent, copied through its
 * bounds; and, for a rate-limit refusal that sent none (CC8, interface I4), the
 * kind alone: a failure coded `web.action.rate_limited`, or a list read whose
 * pagination stopped `rate_limited`, is a rate limit whether or not a notice
 * was over the page. `retryAfterMs` comes from the failure record, which holds
 * it only when the page stated a time.
 */
export function webAutomationResultObstruction(result: {
  obstruction?: unknown;
  failure?: { code?: unknown; retryAfterMs?: unknown } | undefined;
  extraction?: { paginationStop?: unknown } | undefined;
}): WebAutomationObstruction | undefined {
  const sent = webAutomationObstructionValue(result.obstruction);
  if (sent) return sent;
  const failed = result.failure?.code === RATE_LIMITED_CODE;
  const stopped = result.extraction?.paginationStop === "rate_limited";
  if (!failed && !stopped) return undefined;
  return webAutomationObstructionValue({ kind: "rate_limit", ...(failed ? { retryAfterMs: result.failure?.retryAfterMs } : {}), dismiss: [] });
}
