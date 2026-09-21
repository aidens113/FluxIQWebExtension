import { buildClassNames } from "../../../build-classes.js";
import type { RenderContext, ScenarioRouteResponse } from "../../../types.js";
import { widgetScript, type WidgetData } from "../client/index.js";
import { BOOKABLE_SERVICES, BRANCHES, COMPANY, DEPOSIT_PENCE, formatPence, longDate, shortDay, slotsFor } from "../data/index.js";
import type { CompanyWebsiteState } from "../types.js";

/** The vendor's CSP: its own origin for everything, and framing by any loopback page, as a booking widget allows any customer site. */
const WIDGET_CSP = "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors http://127.0.0.1:* http://localhost:*";

const WIDGET_ROLES = [
  "shell", "brandBar", "steps", "stepOn", "panel", "tile", "tileOn", "pill", "pillOn", "week", "weekNav", "day", "dayHead",
  "slot", "slotFull", "slotOn", "note", "field", "input", "actions", "primary", "secondary", "summary", "error", "done",
] as const;

/**
 * Slotwise, the third-party booking widget: a document of its own on the
 * vendor's origin, framed by the "Book a service" page. Branches, services
 * and slots are all `div`s; the dates are British, day first; the last step
 * takes a deposit from a card the widget says is saved on this device.
 *
 * Every slot the calendar can show is computed here, with the run's own
 * bookings already taken out, and handed to the widget's script.
 */
export function bookingWidget(state: CompanyWebsiteState, context: RenderContext): ScenarioRouteResponse {
  const w = buildClassNames(`slotwise:${context.seed}`, WIDGET_ROLES);
  const data: WidgetData = {
    branches: BRANCHES.map(({ id, name, address }) => ({ id, name, address })),
    services: BOOKABLE_SERVICES.map(({ id, service, variant, pence }) => ({ id, service, variant, price: formatPence(pence) })),
    slots: Object.fromEntries(BRANCHES.map(({ id }) => [id, slotsFor(id, state.bookings).map((slot) => ({ ...slot, day: shortDay(slot.date), long: longDate(slot.date) }))])),
    today: COMPANY.today,
    deposit: formatPence(DEPOSIT_PENCE),
    confirmedPath: `${COMPANY.root}booking/confirmed?ref=`,
  };
  const body = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><link rel="icon" href="data:,"><title>Slotwise booking</title>
<style>
body{margin:0;font:15px/1.45 system-ui,sans-serif;color:#1a1f36;background:#fff}
.${w.shell}{padding:16px 20px}
.${w.brandBar}{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e6e8f0;padding-bottom:10px;margin-bottom:12px}
.${w.steps}{display:flex;gap:10px;font-size:13px;color:#8a90a6;margin-bottom:14px;flex-wrap:wrap}
.${w.stepOn}{color:#4f46e5;font-weight:700}
.${w.tile}{border:1px solid #d7dbe8;border-radius:8px;padding:10px 12px;margin:8px 0;cursor:pointer}
.${w.tileOn},.${w.pillOn},.${w.slotOn}{border-color:#4f46e5;background:#eef0ff}
.${w.pill}{display:inline-block;border:1px solid #d7dbe8;border-radius:999px;padding:6px 12px;margin:4px 6px 4px 0;cursor:pointer}
.${w.weekNav}{display:flex;justify-content:space-between;align-items:center;margin:6px 0}
.${w.weekNav} div{cursor:pointer;color:#4f46e5;user-select:none}
.${w.week}{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.${w.day}{border:1px solid #eef0f5;border-radius:6px;padding:6px;min-height:150px}
.${w.dayHead}{font-weight:700;font-size:13px;margin-bottom:6px}
.${w.slot}{border:1px solid #d7dbe8;border-radius:6px;padding:4px 6px;margin:4px 0;text-align:center;cursor:pointer;font-size:13px}
.${w.slotFull}{color:#b3b8c9;text-decoration:line-through;cursor:not-allowed;background:#f7f8fb}
.${w.note}{font-size:12px;color:#8a90a6}
.${w.field}{display:block;margin:10px 0}
.${w.input}{display:block;width:100%;box-sizing:border-box;border:1px solid #d7dbe8;border-radius:6px;padding:8px}
.${w.actions}{display:flex;justify-content:space-between;margin-top:16px}
.${w.primary}{background:#4f46e5;color:#fff;border:0;border-radius:6px;padding:10px 16px;font:inherit;font-weight:600;cursor:pointer}
.${w.secondary}{background:#fff;color:#4f46e5;border:1px solid #c7cbe0;border-radius:6px;padding:10px 16px;font:inherit;cursor:pointer}
.${w.summary}{display:grid;grid-template-columns:140px 1fr;gap:4px 12px}
.${w.error}{color:#b42318;min-height:1.2em}
.${w.done}{text-align:center;padding:40px 0}
</style></head>
<body><div class="${w.shell}" id="slotwise-root"></div>
<script type="module">${widgetScript(context.runToken, w, data)}</script></body></html>`;
  return { status: 200, headers: { "content-security-policy": WIDGET_CSP }, body };
}
