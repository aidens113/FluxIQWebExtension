import { escapeHtml } from "../../../html.js";
import { STORES, storeById } from "../catalog/index.js";
import type { BigboxClasses } from "../theme/index.js";

/**
 * The header's store chip and its flyout, inside a web component's shadow
 * root. Every store but the chosen one offers the same "Set as my store"
 * button, and nothing on those buttons says which store they belong to except
 * the card around them.
 */
export function storePickerMarkup(storeId: string, c: BigboxClasses): string {
  const current = storeById(storeId);
  const cards = STORES.map((store) => `<li class="${c.pickerCard}"><strong>${escapeHtml(store.name)}</strong><div>${escapeHtml(store.address)} · ${escapeHtml(store.distance)}</div><div>${escapeHtml(store.hours)}</div>${store.id === current.id ? `<span class="${c.pickerCurrent}">Your store</span>` : `<button type="button" class="${c.pickerSet}">Set as my store</button>`}</li>`).join("");
  return `<vr-fulfillment-picker><template shadowrootmode="open"><style>
:host{position:relative;display:block}
.${c.pickerChip}{display:flex;flex-direction:column;align-items:flex-start;background:#0f625c;color:#fff;border:0;border-radius:999px;padding:6px 16px;font:inherit;cursor:pointer;line-height:1.2}
.${c.pickerLabel}{font-size:12px;opacity:.85}
.${c.pickerStore}{font-weight:700;font-size:13px}
.${c.pickerFlyout}{position:absolute;left:0;top:48px;width:380px;background:#fff;color:#1d1d1d;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);padding:14px;z-index:350}
.${c.pickerFlyout}[hidden]{display:none}
.${c.pickerClose}{position:absolute;right:10px;top:6px;font-size:20px;cursor:pointer;color:#555}
.${c.pickerTabs}{display:flex;gap:8px;margin-bottom:8px}
.${c.pickerTab}{padding:4px 12px;border-radius:999px;border:1px solid #bbb;cursor:pointer;font-size:13px}
.${c.pickerTabOn}{border-color:#0b4f4a;background:#e6f2f1}
.${c.pickerList}{list-style:none;margin:0;padding:0;display:grid;gap:8px;max-height:320px;overflow:auto}
.${c.pickerCard}{border:1px solid #e3e3e3;border-radius:8px;padding:10px;font-size:13px;display:flex;flex-direction:column;gap:2px}
.${c.pickerSet}{align-self:flex-start;margin-top:6px;border-radius:999px;border:1px solid #0b4f4a;background:#fff;color:#0b4f4a;font-weight:700;padding:5px 12px;cursor:pointer;font:inherit}
.${c.pickerCurrent}{align-self:flex-start;margin-top:6px;font-weight:700;color:#0b4f4a}
</style><button type="button" class="${c.pickerChip}"><span class="${c.pickerLabel}">Pickup or delivery?</span><span class="${c.pickerStore}">${escapeHtml(current.name)}</span></button><div class="${c.pickerFlyout}" hidden><div class="${c.pickerClose}">×</div><div class="${c.pickerTabs}"><div class="${c.pickerTab} ${c.pickerTabOn}">Pickup</div><div class="${c.pickerTab}">Delivery</div></div><p>Stores near ${escapeHtml(current.address.split(", ").at(-1) ?? "")}</p><ul class="${c.pickerList}">${cards}</ul></div></template></vr-fulfillment-picker>`;
}
