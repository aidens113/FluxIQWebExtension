import { fixtureClient } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { verifyScript } from "../client/index.js";
import type { MarketClasses } from "../styles/index.js";
import { FAVICON } from "./shell.js";

/**
 * The traffic screen's interstitial, served in place of a results page. It is
 * a bare document, as these are: no header, no search, nothing to click but
 * the check. Pressing it runs a two-second check and then reloads the address
 * that was asked for; reloading without pressing it just shows it again.
 */
export function renderVerifyPage(context: RenderContext, c: MarketClasses): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Security check</title><link rel="icon" href="${FAVICON}">
<style>body{margin:0;background:#f2f3f5;font:14px/1.5 system-ui,sans-serif;color:#191919}.${c.verifyBox}{max-width:460px;margin:80px auto;background:#fff;border-radius:12px;padding:28px;text-align:center}.${c.verifyCheck}{display:inline-flex;align-items:center;gap:10px;border:1px solid #ccc;border-radius:6px;padding:12px 18px;cursor:pointer;margin-top:12px;user-select:none}.${c.verifyCheck} i{width:18px;height:18px;border:2px solid #999;border-radius:3px;display:inline-block}.${c.spinner}{display:inline-block;width:16px;height:16px;border:2px solid #ddd;border-top-color:#e62e04;border-radius:50%;animation:s .8s linear infinite}@keyframes s{to{transform:rotate(360deg)}}</style></head>
<body>
<div class="${c.verifyBox}">
<div style="font-weight:800;font-size:22px;color:#e62e04">farbazaar</div>
<p><b>Sorry, we have detected unusual traffic from your network.</b></p>
<p>To continue shopping, please confirm you are not a robot.</p>
<div class="${c.verifyCheck}"><i></i><span>I'm not a robot</span></div>
<p style="font-size:12px;color:#888">Reference: ${Date.UTC(2026, 8, 21).toString(36).toUpperCase()}-FB</p>
</div>
<script type="module">
${fixtureClient(context.runToken, "crossborder-marketplace")}
const css = ${JSON.stringify({ verifyCheck: c.verifyCheck, spinner: c.spinner })};
${verifyScript()}
</script>
</body></html>`;
}
