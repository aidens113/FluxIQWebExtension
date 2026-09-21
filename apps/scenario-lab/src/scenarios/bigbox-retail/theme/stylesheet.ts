import type { BigboxClasses } from "./theme.js";

/**
 * The emitted stylesheet. The first rule undoes the lab's shared page shell,
 * which is centred and narrow; a store is neither.
 *
 * Three pieces of geometry are the point, and all three are anchored to the
 * bottom-right corner of the viewport so they meet whatever the window size:
 * the product page's sticky bar puts Add to cart there, the cart's checkout
 * bar puts Continue to checkout there, and the support widget's launcher and
 * its proactive card sit there too, on top of both.
 */
export function bigboxStylesheet(c: BigboxClasses): string {
  return `
body{max-width:none;margin:0;padding:0;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d1d1d;background:#fff}
.${c.page}{min-height:100vh;display:flex;flex-direction:column}
.${c.header}{background:#0b4f4a;color:#fff;position:sticky;top:0;z-index:300}
.${c.headerRow}{display:flex;align-items:center;gap:16px;padding:10px 20px;position:relative}
.${c.logo}{color:#fff;font-weight:800;font-size:22px;text-decoration:none;display:flex;align-items:center;gap:6px}
.${c.logoMark}{display:inline-block;width:22px;height:22px;border-radius:50%;background:#f2a93b}
.${c.searchForm}{flex:1;display:flex;background:#fff;border-radius:999px;overflow:hidden;max-width:720px}
.${c.searchInput}{flex:1;border:0;padding:10px 16px;font:inherit;outline:none;min-width:0}
.${c.searchButton}{border:0;background:#f2a93b;width:48px;cursor:pointer;font-size:18px}
.${c.headerLinks}{display:flex;gap:18px;align-items:center}
.${c.headerLink}{color:#fff;text-decoration:none;display:flex;flex-direction:column;line-height:1.2}
.${c.headerSmall}{font-size:12px;opacity:.85}
.${c.cartLink}{position:relative;color:#fff;text-decoration:none;display:flex;flex-direction:column;align-items:center;padding:0 6px}
.${c.cartBadge}{position:absolute;top:-6px;right:-8px;background:#f2a93b;color:#1d1d1d;border-radius:999px;font-size:11px;font-weight:700;padding:0 6px}
.${c.cartTotal}{font-size:12px}
.${c.miniCart}{position:absolute;right:20px;top:58px;width:360px;background:#fff;color:#1d1d1d;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.2);padding:14px;z-index:400}
.${c.miniCart}[hidden]{display:none}
.${c.miniCartList}{list-style:none;margin:8px 0;padding:0;display:grid;gap:6px}
.${c.deptNav}{display:flex;gap:18px;padding:6px 20px;background:#0f625c;font-size:13px;overflow-x:auto}
.${c.deptLink}{color:#fff;text-decoration:none;white-space:nowrap}
.${c.main}{flex:1;padding:16px 20px 140px;max-width:1360px;width:100%;box-sizing:border-box;margin:0 auto}
.${c.footer}{background:#f4f4f2;padding:24px 20px 110px;font-size:13px;color:#444}
.${c.footerCols}{display:flex;flex-wrap:wrap;gap:14px 28px}
.${c.footerLink}{color:#444}
.${c.buildNote}{display:block;margin-top:14px;color:#888}
.${c.srOnly}{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.${c.hp}{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden}
.${c.btn}{border-radius:999px;border:1px solid transparent;padding:9px 18px;font:inherit;font-weight:600;cursor:pointer}
.${c.btnPrimary}{background:#0b4f4a;color:#fff}
.${c.btnSecondary}{background:#fff;color:#0b4f4a;border-color:#0b4f4a}
.${c.btnLink}{background:none;border:0;padding:0;color:#0b4f4a;text-decoration:underline;cursor:pointer;font:inherit}
.${c.btnQuiet}{background:#f1f1f1;color:#1d1d1d}
.${c.scrim}{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000}
.${c.consent}{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,92vw);background:#fff;border-radius:12px;padding:22px;z-index:1001;box-shadow:0 10px 30px rgba(0,0,0,.3)}
.${c.consentActions}{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
.${c.promo}{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,92vw);background:#fffbef;border-radius:14px;padding:26px 24px 18px;z-index:1101;box-shadow:0 10px 30px rgba(0,0,0,.35);text-align:center}
.${c.promoClose}{position:absolute;right:12px;top:8px;font-size:22px;line-height:1;cursor:pointer;color:#555;padding:4px}
.${c.promoForm}{display:flex;flex-direction:column;gap:10px;margin:14px 0}
.${c.promoDecline}{color:#555;font-size:13px}
.${c.toast}{position:fixed;left:50%;top:80px;transform:translateX(-50%);background:#1d1d1d;color:#fff;border-radius:8px;padding:8px 14px;z-index:1300}
.${c.hero}{position:relative;height:220px;border-radius:12px;overflow:hidden;margin-bottom:18px}
.${c.heroSlide}{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;padding:0 40px;color:#fff}
.${c.heroSlide}[hidden]{display:none}
.${c.heroDots}{position:absolute;bottom:10px;left:40px;display:flex;gap:6px}
.${c.heroDot}{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.5)}
.${c.rail}{margin:22px 0}
.${c.railHead}{display:flex;justify-content:space-between;align-items:baseline}
.${c.railList}{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:14px}
.${c.railItem}{position:relative;border:1px solid #e3e3e3;border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px}
.${c.searchLayout}{display:grid;grid-template-columns:230px 1fr;gap:22px}
.${c.sidebar}{font-size:13px}
.${c.facetGroup}{border:0;border-top:1px solid #e3e3e3;padding:10px 0;margin:0}
.${c.facetLegend}{font-weight:700;padding:0;margin-bottom:6px}
.${c.facetOption}{display:flex;gap:6px;align-items:center;padding:3px 0;cursor:pointer}
.${c.facetCount}{color:#777}
.${c.clearAll}{font-size:13px}
.${c.resultsHead}{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:10px}
.${c.resultsTitle}{font-size:20px;margin:0}
.${c.resultsMeta}{color:#666;font-size:13px}
.${c.chips}{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px}
.${c.chip}{border:1px solid #0b4f4a;border-radius:999px;padding:3px 10px;font-size:12px;color:#0b4f4a}
.${c.sortRow}{display:flex;gap:8px;align-items:center;font-size:13px}
.${c.grid}{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:18px 14px}
.${c.tile}{position:relative;display:flex;flex-direction:column;gap:5px;padding:8px}
.${c.sponsoredTag}{font-size:11px;color:#777}
.${c.badge}{align-self:flex-start;font-size:11px;font-weight:700;background:#e6f2f1;color:#0b4f4a;border-radius:4px;padding:1px 6px}
.${c.badgeRollback}{align-self:flex-start;font-size:11px;font-weight:700;background:#c62828;color:#fff;border-radius:4px;padding:1px 6px}
.${c.tileLink}{position:absolute;inset:0;z-index:1}
.${c.tileImage}{aspect-ratio:1;background:#f6f6f6;border-radius:6px;display:flex;align-items:center;justify-content:center}
.${c.img}{width:70%;height:70%;object-fit:contain}
.${c.priceBlock}{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 6px}
.${c.priceNow}{color:#2a7a2a;font-weight:700;font-size:13px}
.${c.priceMain}{font-size:22px;font-weight:700}
.${c.priceSup}{font-size:12px;vertical-align:.7em}
.${c.priceWas}{color:#777;font-size:12px}
.${c.unitPrice}{color:#555;font-size:12px;width:100%}
.${c.tileTitle}{font-size:13px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.${c.ratingRow}{display:flex;gap:4px;align-items:center;font-size:12px;color:#555}
.${c.ratingValue}{font-weight:600}
.${c.stars}{display:inline-block;width:70px;height:12px;background:linear-gradient(90deg,#f2a93b var(--pct),#ddd var(--pct))}
.${c.reviewCount}{color:#777}
.${c.fulfil}{font-size:12px;color:#333;display:flex;flex-direction:column}
.${c.fulfilLine}{white-space:nowrap}
.${c.addButton}{position:relative;z-index:2;align-self:flex-start;border-radius:999px;border:0;background:#0b4f4a;color:#fff;font-weight:700;padding:6px 16px;cursor:pointer}
.${c.optionsButton}{position:relative;z-index:2;align-self:flex-start;border-radius:999px;border:1px solid #1d1d1d;color:#1d1d1d;background:#fff;font-weight:700;padding:5px 14px;text-decoration:none}
.${c.pagination}{display:flex;justify-content:center;gap:6px;margin:26px 0}
.${c.pageLink}{min-width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#1d1d1d;text-decoration:none}
.${c.pageCurrent}{background:#0b4f4a;color:#fff}
.${c.pageArrow}{min-width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;color:#1d1d1d;text-decoration:none;font-size:18px}
.${c.pageArrowOff}{min-width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;color:#bbb;font-size:18px}
.${c.emptyResults}{padding:40px 0;text-align:center;color:#555}
.${c.list}{list-style:none;margin:0;padding:0}
.${c.row}{display:grid;grid-template-columns:110px 1fr 200px;gap:16px;padding:14px 0;border-bottom:1px solid #eee}
.${c.rowMedia}{aspect-ratio:1;background:#f6f6f6;border-radius:6px}
.${c.rowMain}{display:flex;flex-direction:column;gap:6px}
.${c.rowTitle}{color:#1d1d1d;font-weight:600;text-decoration:none}
.${c.rowBuy}{display:flex;flex-direction:column;gap:4px;align-items:flex-end}
.${c.rowPrice}{font-size:20px;font-weight:700}
.${c.adPill}{font-size:10px;border:1px solid #999;color:#666;border-radius:3px;padding:0 4px}
.${c.rowFulfil}{font-size:12px;color:#333}
.${c.breadcrumb}{font-size:12px;color:#666;margin-bottom:10px}
.${c.pdpLayout}{display:grid;grid-template-columns:1fr 380px;gap:28px}
.${c.gallery}{aspect-ratio:4/3;background:#f6f6f6;border-radius:10px;display:flex;align-items:center;justify-content:center}
.${c.buyBox}{display:flex;flex-direction:column;gap:12px}
.${c.pdpTitle}{font-size:22px;margin:0}
.${c.sellerLine}{font-size:13px;color:#444}
.${c.pdpPrice}{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.${c.variantLabel}{font-size:13px}
.${c.swatches}{display:flex;gap:8px;flex-wrap:wrap}
.${c.swatch}{border:1px solid #bbb;border-radius:8px;padding:8px 12px;cursor:pointer;font-size:13px;min-width:92px}
.${c.swatchOn}{border:2px solid #0b4f4a;padding:7px 11px;background:#f1f8f7}
.${c.swatchPrice}{display:block;color:#555;font-size:12px}
.${c.fulfilOptions}{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.${c.fulfilOption}{border:1px solid #bbb;border-radius:8px;padding:8px;cursor:pointer;font-size:12px}
.${c.fulfilOptionOn}{border:2px solid #0b4f4a;padding:7px;background:#f1f8f7}
.${c.fulfilOptionOff}{color:#999;border-style:dashed;cursor:not-allowed}
.${c.storeLine}{font-size:13px}
.${c.qtyStepper}{display:inline-flex;align-items:center;border:1px solid #bbb;border-radius:999px;align-self:flex-start}
.${c.qtyControl}{width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;user-select:none}
.${c.qtyValue}{min-width:26px;text-align:center;font-weight:700}
.${c.skeleton}{height:120px;border-radius:8px;background:linear-gradient(90deg,#eee,#f7f7f7,#eee);color:#999;display:flex;align-items:center;justify-content:center}
.${c.atcBar}{position:fixed;left:0;right:0;bottom:0;height:72px;background:#fff;border-top:1px solid #ddd;display:flex;align-items:center;justify-content:flex-end;gap:16px;padding:0 24px;z-index:500;box-sizing:border-box}
.${c.atcBarTitle}{flex:1;font-size:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.${c.atcButton}{width:220px;height:48px;border-radius:999px;border:0;background:#0b4f4a;color:#fff;font-weight:700;font-size:15px;cursor:pointer}
.${c.buyNowButton}{width:220px;height:48px;border-radius:999px;border:0;background:#f2a93b;color:#1d1d1d;font-weight:700;font-size:15px;cursor:pointer}
.${c.addedPanel}{position:fixed;top:0;right:0;bottom:0;width:min(400px,94vw);background:#fff;z-index:1201;box-shadow:-6px 0 24px rgba(0,0,0,.25);padding:20px;box-sizing:border-box;overflow:auto}
.${c.addedHead}{display:flex;justify-content:space-between;align-items:center}
.${c.about}{margin-top:26px}
.${c.specs}{border-collapse:collapse}
.${c.reviews}{margin-top:26px}
.${c.review}{border-top:1px solid #eee;padding:10px 0}
.${c.moreReviews}{margin-top:8px}
.${c.cartLayout}{display:grid;grid-template-columns:1fr 340px;gap:26px}
.${c.cartGroup}{border:1px solid #e3e3e3;border-radius:10px;padding:14px;margin-bottom:14px}
.${c.cartGroupHead}{font-weight:700;margin-bottom:6px}
.${c.cartLine}{display:grid;grid-template-columns:1fr auto;gap:12px;padding:10px 0;border-top:1px solid #f0f0f0}
.${c.cartLineMain}{display:flex;flex-direction:column;gap:4px}
.${c.cartLineActions}{display:flex;gap:14px;align-items:center;font-size:13px}
.${c.qtySelect}{padding:4px 8px;border-radius:6px}
.${c.summaryCard}{border:1px solid #e3e3e3;border-radius:10px;padding:16px;align-self:start}
.${c.summaryRow}{display:flex;justify-content:space-between;padding:4px 0}
.${c.summaryTotal}{display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid #ddd;font-weight:700}
.${c.checkoutBar}{position:fixed;left:0;right:0;bottom:0;height:72px;background:#fff;border-top:1px solid #ddd;display:flex;align-items:center;justify-content:flex-end;gap:16px;padding:0 24px;z-index:500;box-sizing:border-box}
.${c.savedSection}{margin-top:22px}
.${c.emptyCart}{padding:40px 0}
.${c.checkoutLayout}{display:grid;grid-template-columns:1fr 340px;gap:26px}
.${c.wall}{display:flex;justify-content:center;padding:30px 0}
.${c.wallCard}{width:min(420px,94vw);border:1px solid #e3e3e3;border-radius:12px;padding:22px;display:flex;flex-direction:column;gap:12px}
.${c.fieldRow}{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.${c.field}{display:flex;flex-direction:column;gap:4px}
.${c.input}{border:1px solid #999;border-radius:6px;padding:9px 10px;font:inherit}
.${c.label}{font-size:13px;font-weight:600}
.${c.section}{border:1px solid #e3e3e3;border-radius:10px;padding:16px;margin-bottom:14px}
.${c.sectionHead}{font-size:16px;margin:0 0 10px}
.${c.slotGrid}{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}
.${c.slot}{border:1px solid #999;border-radius:8px;padding:8px;background:#fff;cursor:pointer;font:inherit}
.${c.slotOn}{border:2px solid #0b4f4a;background:#f1f8f7}
.${c.slotFull}{color:#aaa;border-style:dashed;cursor:not-allowed}
.${c.spinner}{width:28px;height:28px;border-radius:50%;border:3px solid #ddd;border-top-color:#0b4f4a;animation:vrspin 1s linear infinite}
@keyframes vrspin{to{transform:rotate(360deg)}}
.${c.retry}{font-size:13px}
.${c.paymentOption}{display:flex;gap:8px;align-items:center;padding:6px 0}
.${c.paymentFrame}{width:100%;height:190px;border:1px solid #ddd;border-radius:8px}
.${c.placeOrder}{width:100%;height:48px;border-radius:999px;border:0;background:#0b4f4a;color:#fff;font-weight:700;font-size:15px;cursor:pointer;margin-top:12px}
.${c.errorBanner}{background:#fdecea;color:#8a1c1c;border-radius:8px;padding:10px 12px}
.${c.confirm}{max-width:760px}
.${c.confirmHead}{font-size:24px}
.${c.orderNumber}{font-weight:700}
.${c.pickupBox}{border:1px solid #e3e3e3;border-radius:10px;padding:14px;margin:12px 0}
.${c.orderItems}{list-style:none;padding:0;margin:0}
.${c.orderItem}{display:flex;gap:10px;justify-content:space-between;padding:8px 0;border-top:1px solid #f0f0f0}
.${c.totals}{display:grid;grid-template-columns:auto auto;justify-content:end;gap:4px 18px}
.${c.robotPage}{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5}
.${c.robotCard}{background:#fff;border-radius:12px;padding:28px;width:min(420px,92vw);text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.1)}
.${c.holdButton}{position:relative;overflow:hidden;margin:18px auto;width:220px;height:52px;border:2px solid #0b4f4a;border-radius:999px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#0b4f4a;user-select:none;cursor:pointer}
.${c.holdFill}{position:absolute;left:0;top:0;bottom:0;width:0;background:rgba(11,79,74,.2)}
.${c.robotNote}{font-size:13px;color:#666}
`;
}
