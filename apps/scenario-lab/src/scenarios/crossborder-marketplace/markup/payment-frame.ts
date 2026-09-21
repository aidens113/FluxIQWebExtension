import { fixtureClient } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { paymentScript } from "../client/index.js";
import { formatMoney } from "../locale/index.js";
import type { MarketState } from "../state/index.js";
import type { MarketClasses } from "../styles/index.js";

/**
 * The payment provider's framed method picker. Four rows, and only one of
 * them can pay: the Mastercard has expired, the balance is empty, and adding a
 * card is switched off. Nothing is chosen when it loads; choosing the Visa
 * posts the choice and tells the checkout by message.
 */
export function renderPaymentFrame(state: MarketState, context: RenderContext, c: MarketClasses): string {
  const chosen = state.checkout?.paymentId ?? null;
  const row = (label: string, detail: string, selected: boolean) => `<div class="${c.payMethod}"><span class="${c.payRadio}"${selected ? ' style="border-color:#e62e04;background:radial-gradient(#e62e04 45%,#fff 50%)"' : ""}></span><div><b>${label}</b><br><span style="color:#777">${detail}</span></div></div>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Payment methods</title>
<style>body{margin:0;padding:4px;font:14px/1.4 system-ui,sans-serif}.${c.payMethod}{display:flex;align-items:center;gap:10px;border:1px solid #eee;border-radius:8px;padding:10px;margin-bottom:8px;cursor:pointer}.${c.payRadio}{width:16px;height:16px;border-radius:50%;border:2px solid #999;flex:none}.${c.errorTip}{color:#c40000;font-size:12px;min-height:16px}</style></head>
<body>
${row("Visa •••• 4417", "Expires 08/28 · Mara Lindqvist", chosen === "visa-4417")}
${row("Mastercard •••• 9021", "Expired 01/26", false)}
${row("Farbazaar balance", `${formatMoney(0, state.region)} available`, false)}
${row("+ Add a new card", "Visa, Mastercard, Maestro", false)}
<div class="${c.errorTip}"></div>
<script type="module">
${fixtureClient(context.runToken, "crossborder-marketplace")}
const css = ${JSON.stringify({ payMethod: c.payMethod, payRadio: c.payRadio, errorTip: c.errorTip })};
${paymentScript()}
</script>
</body></html>`;
}
