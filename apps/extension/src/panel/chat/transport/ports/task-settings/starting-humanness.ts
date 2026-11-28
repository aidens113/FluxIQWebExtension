import { AUTOMATION_PANEL_MESSAGES } from "../../../../../shared/protocol";
import type { PanelStore } from "../../../../state";
import { asRecord, payloadOf, refusalOf } from "../../reply";

/**
 * The person's starting humanness, read from Core through the background
 * (`startingHumanness`, `identity-access` `get-my-preferences`) each time it is
 * wanted, so a change made in the FluxIQ panel shows on the next read. A whole
 * number from 0 to 100; none set, a failed read, or anything else reads as 0,
 * the last of Core's precedence. Never throws.
 */
export async function startingHumanness(request: PanelStore["request"]): Promise<number> {
  try {
    const reply = await request({ type: AUTOMATION_PANEL_MESSAGES.startingHumanness });
    if (refusalOf(reply) !== undefined) return 0;
    const payload = payloadOf(reply);
    if (!payload.ok) return 0;
    const value = asRecord(payload.value)?.startingHumanness;
    if (typeof value !== "number" || !Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, Math.round(value)));
  } catch {
    // A read that cannot be made is "none set": the card shows the last of Core's precedence.
    return 0;
  }
}
