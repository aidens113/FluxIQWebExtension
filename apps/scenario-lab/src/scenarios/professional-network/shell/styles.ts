import type { NetworkClasses } from "./classes.js";

/**
 * The site's stylesheet over its generated class names. The geometry is the
 * point, not the colours: the global bar is fixed, the three-column layout is
 * 1,128 pixels wide, the messaging list docks at the bottom right, and a
 * conversation opens to its left, 336 by 400 pixels, which is exactly where the
 * right-hand end of a results list and its pager sit once the page is scrolled
 * to them. The cookie banner covers the bottom 96 pixels of every page until
 * it is answered.
 */
export function networkStylesheet(c: NetworkClasses): string {
  return `
*{box-sizing:border-box}
[hidden]{display:none!important}
body{margin:0;background:#f4f2ee;font:14px/1.42 -apple-system,system-ui,"Segoe UI",Roboto,sans-serif;color:#191919}
a{color:inherit;text-decoration:none}
button{font:inherit;cursor:pointer}
.${c.vh}{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:-1px;padding:0;border:0}
.${c.nav}{position:fixed;top:0;left:0;right:0;height:52px;background:#fff;border-bottom:1px solid #e0dfdc;z-index:100}
.${c.navInner}{max-width:1128px;margin:0 auto;height:52px;display:flex;align-items:center;gap:8px}
.${c.logo}{width:34px;height:34px;border-radius:4px;background:#0b5c46;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center}
.${c.searchBox}{position:relative;width:280px}
.${c.searchInput}{width:100%;height:34px;border:0;border-radius:4px;background:#edf3f8;padding:0 12px 0 36px}
.${c.searchMenu}{position:absolute;top:38px;left:0;width:420px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.2);border-radius:8px;padding:8px 0}
.${c.searchMenuItem}{display:block;padding:8px 16px}
.${c.searchMenuItem}:hover{background:#f3f2ef}
.${c.navList}{display:flex;margin:0 0 0 auto;padding:0;list-style:none;height:52px}
.${c.navItem}{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:80px;color:#666;position:relative;font-size:12px;border:0;background:none}
.${c.navItemActive}{color:#191919;box-shadow:inset 0 -2px 0 #191919}
.${c.navIcon}{width:24px;height:24px}
.${c.badge}{position:absolute;top:4px;left:44px;background:#cb112d;color:#fff;border-radius:10px;font-size:11px;padding:0 5px;min-width:16px;text-align:center}
.${c.premiumLink}{color:#915907;font-size:12px;width:90px;text-align:center;text-decoration:underline}
.${c.meMenu}{position:absolute;top:50px;right:0;width:260px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.2);border-radius:8px;padding:8px 0;z-index:110}
.${c.layout3},.${c.layout2},.${c.layoutSearch}{max-width:1128px;margin:0 auto;padding:76px 0 180px;display:grid;gap:24px;align-items:start}
.${c.layout3}{grid-template-columns:225px 555px 300px}
.${c.layout2}{grid-template-columns:300px 804px}
.${c.layoutSearch}{grid-template-columns:804px 300px}
.${c.card}{background:#fff;border-radius:8px;box-shadow:0 0 0 1px rgba(0,0,0,.08);margin-bottom:8px;position:relative}
.${c.cardTitle}{font-size:16px;font-weight:600;padding:12px 16px;margin:0}
.${c.main}{min-width:0}
.${c.rail}{min-width:0}
.${c.avatar}{width:48px;height:48px;border-radius:50%;background:#c7d7e9;flex:none;display:flex;align-items:center;justify-content:center;font-weight:600;color:#38434f}
.${c.avatarLarge}{width:152px;height:152px;border-radius:50%;background:#c7d7e9;border:4px solid #fff;margin-top:-100px}
.${c.muted}{color:#666}
.${c.small}{font-size:12px}
.${c.link}{color:#0a66c2;font-weight:600}
.${c.dock}{position:fixed;right:16px;bottom:0;width:288px;background:#fff;border-radius:8px 8px 0 0;box-shadow:0 0 0 1px rgba(0,0,0,.08),0 4px 8px rgba(0,0,0,.15);z-index:900}
.${c.dockBar}{display:flex;align-items:center;gap:8px;height:48px;padding:0 8px;cursor:pointer}
.${c.dockTitle}{font-weight:600;flex:1}
.${c.dockBody}{height:420px;overflow:auto;border-top:1px solid #e0dfdc}
.${c.dockRow}{display:flex;gap:8px;padding:10px 12px;border-bottom:1px solid #f0efec}
.${c.bubble}{position:fixed;right:304px;bottom:0;width:336px;height:400px;background:#fff;border-radius:8px 8px 0 0;box-shadow:0 0 0 1px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.2);z-index:900;display:flex;flex-direction:column}
.${c.bubbleHead}{display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #e0dfdc}
.${c.bubbleBody}{flex:1;overflow:auto;padding:12px}
.${c.bubbleMsg}{margin:0 0 12px}
.${c.bubbleComposer}{border-top:1px solid #e0dfdc;padding:8px;display:flex;gap:8px;align-items:flex-end}
.${c.iconButton}{width:32px;height:32px;border:0;border-radius:50%;background:none;display:inline-flex;align-items:center;justify-content:center;color:#666}
.${c.iconButton}:hover{background:#ebebeb}
.${c.consent}{position:fixed;left:0;right:0;bottom:0;height:96px;background:#fff;box-shadow:0 -2px 8px rgba(0,0,0,.2);z-index:1000;display:flex;align-items:center;justify-content:center;gap:24px;padding:0 24px}
.${c.consentText}{max-width:720px;font-size:13px}
.${c.primaryBtn}{background:#0a66c2;color:#fff;border:0;border-radius:16px;padding:6px 16px;font-weight:600}
.${c.secondaryBtn}{background:#fff;color:#0a66c2;border:1px solid #0a66c2;border-radius:16px;padding:5px 15px;font-weight:600}
.${c.textBtn}{background:none;border:0;color:#666;font-weight:600;padding:6px 8px;border-radius:4px}
.${c.scrim}{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2000;display:flex;align-items:flex-start;justify-content:center;padding-top:72px}
.${c.modal}{background:#fff;border-radius:8px;width:552px;max-width:92vw;box-shadow:0 8px 24px rgba(0,0,0,.3)}
.${c.modalHead}{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 12px 24px;border-bottom:1px solid #e0dfdc}
.${c.modalHead} h2{font-size:20px;font-weight:600;margin:0}
.${c.modalBody}{padding:16px 24px}
.${c.modalFoot}{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #e0dfdc}
.${c.toastHost}{position:fixed;left:24px;bottom:24px;z-index:3000;display:flex;flex-direction:column;gap:8px}
.${c.toast}{background:#fff;border-left:4px solid #057642;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.25);padding:12px 16px;min-width:280px}
.${c.footerLinks}{font-size:12px;color:#666;text-align:center;padding:12px;line-height:2}
.${c.adFrame}{width:100%;height:250px;border:0;display:block}
.${c.skeleton}{display:flex;gap:12px;padding:16px;border-bottom:1px solid #f0efec}
.${c.skeletonLine}{height:12px;border-radius:6px;background:linear-gradient(90deg,#eee,#f6f6f6,#eee);margin:6px 0}
.${c.spinner}{width:24px;height:24px;border-radius:50%;border:3px solid #cfe0f3;border-top-color:#0a66c2;animation:spin 1s linear infinite;margin:12px auto}
@keyframes spin{to{transform:rotate(360deg)}}
.${c.pillBar}{display:flex;gap:8px;align-items:center;padding:12px 16px;background:#fff;border-bottom:1px solid #e0dfdc;position:sticky;top:52px;z-index:50;flex-wrap:wrap}
.${c.pill}{border:1px solid #666;border-radius:16px;padding:4px 12px;font-weight:600;color:#666;cursor:pointer;background:#fff;user-select:none;position:relative}
.${c.pillOn}{background:#01754f;border-color:#01754f;color:#fff}
.${c.dropdown}{position:absolute;top:36px;left:0;width:320px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.25);border-radius:8px;z-index:60;color:#191919;font-weight:400;cursor:default}
.${c.dropdownFoot}{display:flex;justify-content:flex-end;gap:8px;padding:8px 12px;border-top:1px solid #e0dfdc}
.${c.checkRow}{display:flex;align-items:center;gap:8px;padding:6px 16px}
.${c.pager}{display:flex;justify-content:flex-end;align-items:center;gap:4px;padding:12px 16px;border-top:1px solid #e0dfdc}
.${c.pagerBtn}{min-width:32px;height:32px;border:0;background:none;border-radius:4px;font-weight:600;color:#666}
.${c.pagerBtnOn}{background:#e8e8e8;color:#191919}
.${c.resultList}{list-style:none;margin:0;padding:0}
.${c.resultItem}{display:flex;gap:12px;padding:16px;border-bottom:1px solid #f0efec}
.${c.resultBody}{flex:1;min-width:0}
.${c.resultName}{font-size:16px;font-weight:600}
.${c.resultTitle}{font-size:14px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.${c.resultSub}{font-size:14px;color:#666}
.${c.resultMeta}{font-size:12px;color:#666;margin-top:4px}
.${c.resultInsight}{font-size:12px;color:#666;margin-top:4px}
.${c.promotedTag}{font-size:12px;color:#666}
.${c.degreeTag}{color:#666;font-weight:400;font-size:14px}
.${c.actionBtn}{align-self:center;background:#fff;color:#0a66c2;border:1px solid #0a66c2;border-radius:16px;padding:5px 16px;font-weight:600}
.${c.challenge}{padding:48px 24px;text-align:center}
.${c.fakeCheck}{display:inline-flex;align-items:center;gap:12px;border:1px solid #d3d3d3;border-radius:4px;padding:14px 18px;background:#f9f9f9;cursor:pointer;margin:16px 0}
.${c.feedList}{list-style:none;margin:0;padding:0}
.${c.feedPost}{background:#fff;border-radius:8px;box-shadow:0 0 0 1px rgba(0,0,0,.08);margin-bottom:8px;padding:12px 16px}
.${c.postHead}{display:flex;gap:8px;align-items:center}
.${c.postBody}{margin:12px 0}
.${c.postFoot}{display:flex;justify-content:space-between;color:#666;font-size:12px;border-top:1px solid #e0dfdc;padding-top:8px}
.${c.sectionHead}{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #e0dfdc}
.${c.tabs}{display:flex;border-bottom:1px solid #e0dfdc}
.${c.tab}{padding:12px 16px;font-weight:600;color:#666;border:0;background:none}
.${c.tabOn}{color:#01754f;box-shadow:inset 0 -2px 0 #01754f}
.${c.inviteList}{list-style:none;margin:0;padding:0}
.${c.inviteRow}{display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid #f0efec;align-items:center}
.${c.inviteText}{flex:1;min-width:0}
.${c.inviteActions}{display:flex;gap:8px;align-items:center}
.${c.showMore}{display:block;margin:12px auto 16px;background:#fff;border:1px solid #666;border-radius:16px;padding:5px 24px;font-weight:600;color:#666}
.${c.errorLine}{text-align:center;color:#b24020;padding:8px}
.${c.profileHeader}{padding:0 24px 24px}
.${c.profileName}{font-size:24px;font-weight:600;margin:8px 0 0}
.${c.profileSection}{padding:12px 24px}
.${c.grid}{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:12px 16px}
.${c.gridCard}{border:1px solid #e0dfdc;border-radius:8px;padding:12px;text-align:center}
.${c.jobCard}{display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid #f0efec}
.${c.upsell}{background:linear-gradient(135deg,#f8c77e,#e7a33e);border-radius:8px 8px 0 0;padding:24px;text-align:center}
.${c.noteBox}{width:100%;min-height:120px;border:1px solid #666;border-radius:4px;padding:8px;font:inherit}
.${c.honeypot}{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden}
.${c.counter}{text-align:right;font-size:12px;color:#666}
.${c.typeahead}{border-top:1px solid #e0dfdc;padding:8px 16px}
.${c.typeaheadItem}{padding:6px 8px;border-radius:4px;cursor:pointer}
.${c.typeaheadItem}:hover{background:#f3f2ef}
.${c.resultCount}{padding:12px 16px 0;color:#666}
.${c.sentinel}{height:1px}
.${c.threadList}{list-style:none;margin:0;padding:0}
.${c.threadRow}{display:flex;gap:8px;padding:12px;border-bottom:1px solid #f0efec}
`;
}
