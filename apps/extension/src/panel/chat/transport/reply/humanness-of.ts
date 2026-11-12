import type { ChatResult } from "@fluxiq/ui-components";
import type { PanelResult } from "../../../state";
import { namedFailureOf } from "./named-failure-of";
import { payloadOf } from "./payload-of";

/**
 * A humanness relay's reply (`background/panel/humanness-relay.ts`) as the
 * control's result: the own level Core holds, absent when it holds none. A
 * refusal keeps Core's own words, so a level out of range says why in them.
 */
export function humannessOf(result: PanelResult<unknown>): ChatResult<{ humanness?: number }> {
  const named = namedFailureOf(result);
  if (named !== undefined) return named;
  const payload = payloadOf(result);
  if (!payload.ok) return payload;
  const level = payload.value.humanness;
  return { ok: true, value: typeof level === "number" && Number.isFinite(level) ? { humanness: level } : {} };
}
