import type { BigboxClasses } from "../theme/index.js";

/**
 * The support widget, inside its own shadow root, on every page. Its launcher
 * sits in the bottom-right corner, raised clear of the bottom edge -- except
 * on the cart page, where nobody raised it, so it lies across the checkout
 * bar's button. On a product page a proactive card opens in that corner a few
 * seconds after load, over the pinned Add to cart, until someone closes it.
 */
export function supportChatMarkup(c: BigboxClasses, raised: boolean): string {
  return `<vr-assist><template shadowrootmode="open"><style>
.${c.chatPill}{position:fixed;right:24px;bottom:${raised ? 96 : 12}px;width:240px;height:56px;border-radius:999px;background:#1d1d1d;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 10px 0 18px;box-sizing:border-box;z-index:900;cursor:pointer;font:600 14px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3)}
.${c.chatPill}[hidden],.${c.chatCard}[hidden],.${c.chatPanel}[hidden]{display:none}
.${c.chatPillClose}{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#333;font-size:16px}
.${c.chatCard}{position:fixed;right:16px;bottom:16px;width:360px;height:210px;box-sizing:border-box;border-radius:14px;background:#fff;color:#1d1d1d;box-shadow:0 8px 28px rgba(0,0,0,.3);padding:18px;z-index:910;font:14px/1.45 system-ui,sans-serif}
.${c.chatCardClose}{position:absolute;right:12px;top:8px;font-size:20px;cursor:pointer;color:#555}
.${c.chatPanel}{position:fixed;right:16px;bottom:16px;width:360px;height:440px;box-sizing:border-box;border-radius:14px;background:#fff;color:#1d1d1d;box-shadow:0 8px 28px rgba(0,0,0,.3);padding:14px;z-index:920;display:flex;flex-direction:column;gap:8px;font:14px/1.45 system-ui,sans-serif}
.${c.chatLog}{flex:1;overflow:auto;list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.${c.chatInput}{border:1px solid #999;border-radius:999px;padding:8px 12px;font:inherit}
button{border-radius:999px;border:0;background:#0b4f4a;color:#fff;font-weight:700;padding:8px 16px;cursor:pointer;font:inherit}
</style><div class="${c.chatCard}" hidden><div class="${c.chatCardClose}">×</div><strong>Hi, I'm Val, ValueRidge's virtual assistant.</strong><p>Not sure which pack is the better deal? I can compare sizes, prices and pickup times for you.</p><button type="button">Chat now</button></div><div class="${c.chatPill}"><span>Chat with us</span><span class="${c.chatPillClose}">×</span></div><div class="${c.chatPanel}" hidden><div class="${c.chatCardClose}">×</div><strong>Val · virtual assistant</strong><ul class="${c.chatLog}"><li>Hi! What can I help you with today?</li></ul><input class="${c.chatInput}" type="text" placeholder="Type a message"><button type="button">Send</button></div></template></vr-assist>`;
}
