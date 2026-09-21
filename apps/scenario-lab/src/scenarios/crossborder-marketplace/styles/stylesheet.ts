import type { MarketClasses } from "./classes.js";

/**
 * The storefront's stylesheet, written against the hashed class names.
 *
 * Three pieces of geometry here are load-bearing, and the browser test holds
 * them: the buy bar is fixed to the bottom of the product page with "Add to
 * cart" at its right-hand end; the chat pill is fixed over the middle of that
 * button, leaving a sliver of it uncovered; and the consent banner, while
 * unanswered, sits above both. A click aimed at the centre of "Add to cart"
 * therefore lands on the chat until the chat is minimised, and on the banner
 * until the banner is answered.
 */
export function marketStylesheet(c: MarketClasses): string {
  const s = (role: keyof MarketClasses) => `.${c[role]}`;
  return `
*{box-sizing:border-box}
body{margin:0;font:14px/1.45 "Open Sans",system-ui,sans-serif;color:#191919;background:#f2f3f5;max-width:none;padding:0}
a{color:inherit;text-decoration:none}
${s("page")}{min-height:100vh;padding-bottom:120px}
${s("topbar")}{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid #e6e6e6}
${s("topInner")}{display:flex;align-items:center;gap:18px;max-width:1240px;margin:0 auto;padding:10px 16px}
${s("logo")}{font-weight:800;font-size:24px;color:#e62e04;letter-spacing:-.5px;display:flex;align-items:center;gap:6px}
${s("logoMark")}{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#ff4d00,#e62e04)}
${s("searchForm")}{flex:1;display:flex;border:2px solid #191919;border-radius:22px;overflow:hidden;background:#fff}
${s("searchCategory")}{border:0;border-right:1px solid #ddd;padding:0 10px;background:#fafafa;font:inherit}
${s("searchInput")}{flex:1;border:0;padding:9px 14px;font:inherit;outline:none;min-width:80px}
${s("searchButton")}{width:54px;background:#191919;cursor:pointer;display:flex;align-items:center;justify-content:center}
${s("searchButton")} svg{width:20px;height:20px;fill:#fff}
${s("shipTo")}{font-size:12px;color:#555;cursor:pointer;white-space:nowrap}
${s("account")}{position:relative;font-size:12px;cursor:pointer;white-space:nowrap}
${s("flyout")}{display:none;position:absolute;right:0;top:100%;width:380px;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.18);border-radius:8px;padding:12px;z-index:45}
${s("account")}:hover ${s("flyout")}{display:block}
${s("flyoutTitle")}{font-weight:700;margin:0 0 6px}
${s("flyoutLine")}{font-size:12px;border-top:1px solid #f0f0f0;padding:6px 0;list-style:none;margin:0}
${s("flyoutEmpty")}{font-size:12px;color:#888}
${s("cartIcon")}{position:relative;display:flex;align-items:center;gap:6px}
${s("cartBadge")}{position:absolute;top:-8px;left:12px;min-width:18px;height:18px;border-radius:9px;background:#e62e04;color:#fff;font-size:11px;display:flex;align-items:center;justify-content:center;padding:0 4px}
${s("subnav")}{display:flex;gap:20px;max-width:1240px;margin:0 auto;padding:6px 16px;font-size:13px;overflow:hidden;white-space:nowrap}
${s("subnavLink")}{color:#333}
${s("main")}{max-width:1240px;margin:16px auto;padding:0 16px}
${s("footer")}{background:#fff;border-top:1px solid #e6e6e6;margin-top:40px;padding:24px 16px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px;font-size:12px;color:#666}
${s("btn")}{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:20px;padding:8px 18px;font-weight:600;cursor:pointer;user-select:none;border:1px solid #ccc;background:#fff}
${s("btnPrimary")}{background:#e62e04;border-color:#e62e04;color:#fff}
${s("btnGhost")}{background:transparent;border-color:transparent;color:#555;text-decoration:underline}
${s("linkish")}{color:#0e6ecc;cursor:pointer}
${s("toastRegion")}{position:fixed;top:84px;left:50%;transform:translateX(-50%);z-index:95;display:flex;flex-direction:column;gap:8px}
${s("toast")}{background:#191919;color:#fff;border-radius:8px;padding:10px 16px;box-shadow:0 6px 18px rgba(0,0,0,.25)}
${s("spinner")}{display:inline-block;width:16px;height:16px;border:2px solid #ddd;border-top-color:#e62e04;border-radius:50%;animation:fbspin .8s linear infinite}
@keyframes fbspin{to{transform:rotate(360deg)}}
${s("consent")}{position:fixed;left:0;right:0;bottom:0;z-index:70;background:#fff;box-shadow:0 -6px 24px rgba(0,0,0,.2);padding:18px 24px;min-height:150px;display:flex;gap:24px;align-items:center}
${s("consentText")}{flex:1;font-size:13px;color:#333}
${s("consentActions")}{display:flex;gap:10px;flex-wrap:wrap}
${s("scrim")}{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:80;display:flex;align-items:center;justify-content:center}
${s("modal")}{position:relative;background:#fff;border-radius:14px;width:440px;max-width:92vw;padding:24px;text-align:center}
${s("modalClose")}{position:absolute;top:8px;right:12px;font-size:20px;color:#999;cursor:pointer;width:24px;height:24px;line-height:24px}
${s("modalTitle")}{font-size:20px;font-weight:800;margin:4px 0 8px}
${s("modalBody")}{font-size:13px;color:#444}
${s("couponTile")}{display:flex;justify-content:space-between;background:#fff1ec;border:1px dashed #e62e04;border-radius:8px;padding:10px 12px;margin:8px 0;text-align:left}
${s("notifyCard")}{position:fixed;top:78px;left:24px;width:340px;z-index:60;background:#fff;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:16px}
${s("chatPill")}{position:fixed;right:28px;bottom:14px;width:190px;height:40px;z-index:65;border-radius:20px;background:#0e6ecc;color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 8px 0 14px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}
${s("chatMinimized")}{position:fixed;right:16px;bottom:96px;width:44px;height:44px;z-index:65;border-radius:50%;background:#0e6ecc;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px}
${s("chatPanel")}{position:fixed;right:24px;bottom:14px;width:340px;height:420px;z-index:66;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.3);display:flex;flex-direction:column;overflow:hidden}
${s("chatHead")}{background:#0e6ecc;color:#fff;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;font-weight:600}
${s("chatBody")}{flex:1;padding:12px;font-size:13px;color:#333}
${s("flashModal")}{background:linear-gradient(160deg,#ff4d00,#c40000);color:#fff}
${s("homeGrid")}{display:grid;grid-template-columns:220px 1fr;gap:16px}
${s("catMenu")}{background:#fff;border-radius:10px;padding:8px 0;list-style:none;margin:0}
${s("catLink")}{display:block;padding:6px 14px;font-size:13px}
${s("hero")}{position:relative;height:260px;border-radius:12px;overflow:hidden;background:#222}
${s("heroSlide")}{position:absolute;inset:0;display:none;padding:40px;color:#fff;font-size:30px;font-weight:800}
${s("sectionTitle")}{font-size:20px;font-weight:800;margin:24px 0 10px}
${s("dealsRow")}{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
${s("feed")}{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
${s("feedStatus")}{display:flex;justify-content:center;align-items:center;gap:10px;padding:18px;color:#666}
${s("retry")}{color:#0e6ecc;cursor:pointer;text-decoration:underline}
${s("searchLayout")}{display:grid;grid-template-columns:230px 1fr;gap:18px}
${s("sidebar")}{background:#fff;border-radius:10px;padding:12px 14px;align-self:start}
${s("filterGroup")}{border-bottom:1px solid #f0f0f0;padding:10px 0}
${s("filterTitle")}{font-weight:700;margin-bottom:6px}
${s("filterOption")}{display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer;font-size:13px}
${s("filterBox")}{width:14px;height:14px;border:1px solid #999;border-radius:3px;display:inline-block}
${s("filterBoxOn")}{background:#e62e04;border-color:#e62e04}
${s("priceInputs")}{display:flex;gap:6px;align-items:center}
${s("priceInput")}{width:70px;padding:4px 6px;border:1px solid #ccc;border-radius:4px;font:inherit}
${s("resultsHead")}{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;flex-wrap:wrap}
${s("resultCount")}{font-size:13px;color:#555}
${s("chips")}{display:flex;gap:6px;flex-wrap:wrap}
${s("chip")}{background:#fff;border:1px solid #ddd;border-radius:14px;padding:2px 10px;font-size:12px;cursor:pointer}
${s("sortBar")}{display:flex;gap:4px;background:#fff;border-radius:8px;padding:4px}
${s("sortTab")}{padding:5px 12px;border-radius:6px;cursor:pointer;font-size:13px}
${s("sortTabOn")}{background:#191919;color:#fff}
${s("grid")}{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
${s("listView")}{display:flex;flex-direction:column;gap:10px}
${s("card")}{position:relative;background:#fff;border-radius:10px;overflow:hidden;min-height:330px}
${s("listView")} ${s("card")}{display:grid;grid-template-columns:150px 1fr 200px;min-height:150px}
${s("cardLink")}{display:block}
${s("cardImage")}{width:100%;aspect-ratio:1/1;object-fit:cover;background:#eee;display:block}
${s("cardBody")}{padding:8px 10px}
${s("cardTitle")}{font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;height:38px}
${s("price")}{font-size:20px;font-weight:800;margin-top:4px}
${s("price")} span:nth-child(3){font-size:14px}
${s("priceOriginal")}{font-size:12px;color:#999;text-decoration:line-through;margin-left:6px}
${s("discount")}{font-size:12px;color:#e62e04;margin-left:4px}
${s("metaRow")}{display:flex;align-items:center;gap:6px;font-size:12px;color:#666;margin-top:2px}
${s("stars")}{position:relative;display:inline-block;width:60px;height:11px;background:#ddd;border-radius:2px;overflow:hidden}
${s("starsFill")}{position:absolute;left:0;top:0;bottom:0;background:#191919}
${s("shippingNote")}{font-size:12px;color:#00875a;margin-top:2px}
${s("badges")}{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
${s("badge")}{font-size:11px;background:#f5f5f5;border-radius:3px;padding:0 4px}
${s("choiceBadge")}{font-size:11px;background:#ffe600;border-radius:3px;padding:0 4px;font-weight:700}
${s("storeName")}{font-size:12px;color:#666;margin-top:4px}
${s("adTag")}{position:absolute;top:6px;right:6px;font-size:10px;color:#fff;background:rgba(0,0,0,.35);border-radius:3px;padding:0 4px}
${s("skeleton")}{background:linear-gradient(90deg,#eee,#f7f7f7,#eee);background-size:200% 100%;animation:fbshine 1.2s infinite;min-height:330px;border-radius:10px}
@keyframes fbshine{to{background-position:-200% 0}}
${s("listAside")}{padding:10px;border-left:1px solid #f0f0f0}
${s("pager")}{display:flex;justify-content:center;align-items:center;gap:6px;margin:24px 0 12px;flex-wrap:wrap}
${s("pagerItem")}{min-width:32px;height:32px;border-radius:6px;background:#fff;display:inline-flex;align-items:center;justify-content:center;padding:0 10px;cursor:pointer}
${s("pagerCurrent")}{background:#191919;color:#fff}
${s("pagerDisabled")}{color:#bbb;cursor:default}
${s("pagerJump")}{display:inline-flex;gap:6px;align-items:center;font-size:13px}
${s("related")}{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
${s("breadcrumb")}{font-size:12px;color:#666;margin-bottom:10px}
${s("itemLayout")}{display:grid;grid-template-columns:380px 1fr 280px;gap:20px;background:#fff;border-radius:12px;padding:18px}
${s("gallery")}{display:flex;flex-direction:column;gap:8px}
${s("galleryMain")}{width:100%;aspect-ratio:1/1;background:#eee;border-radius:8px}
${s("thumbs")}{display:flex;gap:6px}
${s("thumb")}{width:56px;height:56px;border-radius:6px;background:#eee;border:1px solid #ddd}
${s("itemTitle")}{font-size:18px;font-weight:600;margin:0 0 6px}
${s("reviewLine")}{font-size:13px;color:#555;display:flex;gap:10px;align-items:center}
${s("priceBlock")}{background:linear-gradient(90deg,#fff1ec,#fff);border-radius:8px;padding:10px 12px;margin:10px 0}
${s("bigPrice")}{font-size:30px;font-weight:800;color:#e62e04}
${s("skuGroup")}{margin:12px 0}
${s("skuLabel")}{font-size:13px;margin-bottom:6px}
${s("swatches")}{display:flex;gap:8px;flex-wrap:wrap}
${s("swatch")}{width:52px;height:52px;border-radius:6px;border:2px solid #e5e5e5;cursor:pointer;overflow:hidden}
${s("swatch")} img{width:100%;height:100%;display:block}
${s("chipOption")}{border:2px solid #e5e5e5;border-radius:6px;padding:5px 12px;cursor:pointer;font-size:13px}
${s("optionOn")}{border-color:#191919}
${s("optionOff")}{opacity:.35;border-style:dashed;cursor:not-allowed}
${s("qtyRow")}{display:flex;align-items:center;gap:6px}
${s("qtyButton")}{width:30px;height:30px;border-radius:50%;background:#f2f2f2;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;user-select:none}
${s("qtyInput")}{width:52px;text-align:center;padding:5px;border:1px solid #ccc;border-radius:6px;font:inherit}
${s("stockNote")}{font-size:12px;color:#666}
${s("sideCard")}{border:1px solid #eee;border-radius:10px;padding:12px;margin-bottom:12px;font-size:13px}
${s("deliveryBox")}{font-size:13px}
${s("descFrame")}{width:100%;height:520px;border:0;background:#fff;border-radius:12px;margin-top:16px}
${s("reviewList")}{background:#fff;border-radius:12px;padding:16px;margin-top:16px}
${s("reviewItem")}{border-bottom:1px solid #f0f0f0;padding:10px 0;font-size:13px}
${s("buyBar")}{position:fixed;left:0;right:0;bottom:0;height:64px;z-index:50;background:#fff;box-shadow:0 -4px 16px rgba(0,0,0,.12);display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:10px 16px}
${s("buyTotal")}{margin-right:auto;font-size:13px;color:#333}
${s("buyNow")}{width:180px;height:44px;border-radius:22px;background:#ff9f1a;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none}
${s("addCart")}{width:180px;height:44px;border-radius:22px;background:#e62e04;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none}
${s("errorTip")}{color:#c40000;font-size:12px;min-height:18px}
${s("cartLayout")}{display:grid;grid-template-columns:1fr 320px;gap:18px}
${s("cartStore")}{background:#fff;border-radius:10px;padding:12px;margin-bottom:12px}
${s("cartLine")}{display:grid;grid-template-columns:24px 80px 1fr 120px 110px;gap:10px;align-items:center;padding:10px 0;border-top:1px solid #f3f3f3}
${s("cartCheck")}{width:18px;height:18px;border-radius:50%;border:1px solid #999;cursor:pointer}
${s("cartSummary")}{background:#fff;border-radius:10px;padding:16px;align-self:start;position:sticky;top:90px}
${s("checkoutLayout")}{display:grid;grid-template-columns:1fr 340px;gap:18px}
${s("panel")}{background:#fff;border-radius:10px;padding:16px;margin-bottom:12px}
${s("panelTitle")}{font-weight:800;font-size:16px;margin:0 0 10px}
${s("addressCard")}{border:1px solid #eee;border-radius:8px;padding:10px;font-size:13px}
${s("shipSelect")}{font:inherit;padding:4px 6px}
${s("noteBox")}{width:100%;min-height:54px;font:inherit;padding:6px;border:1px solid #ddd;border-radius:6px}
${s("trap")}{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden}
${s("payFrame")}{width:100%;height:250px;border:0}
${s("payMethod")}{display:flex;align-items:center;gap:10px;border:1px solid #eee;border-radius:8px;padding:10px;margin-bottom:8px;cursor:pointer;font-size:13px}
${s("payRadio")}{width:16px;height:16px;border-radius:50%;border:2px solid #999}
${s("summaryRow")}{display:flex;justify-content:space-between;font-size:13px;padding:4px 0}
${s("summaryTotal")}{display:flex;justify-content:space-between;font-size:18px;font-weight:800;padding:10px 0;border-top:1px solid #eee;margin-top:6px}
${s("placeOrder")}{height:46px;border-radius:23px;background:#e62e04;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;margin-top:10px}
${s("orderCard")}{background:#fff;border-radius:12px;padding:20px;max-width:760px;margin:0 auto}
${s("orderLine")}{display:grid;grid-template-columns:1fr auto;gap:10px;border-top:1px solid #f0f0f0;padding:10px 0;font-size:13px}
${s("orderMeta")}{font-size:13px;color:#555}
${s("verifyBox")}{max-width:460px;margin:80px auto;background:#fff;border-radius:12px;padding:28px;text-align:center}
${s("verifyCheck")}{display:inline-flex;align-items:center;gap:10px;border:1px solid #ccc;border-radius:6px;padding:12px 18px;cursor:pointer;margin-top:12px;user-select:none}
`;
}
