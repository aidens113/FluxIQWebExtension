/** Only closed observation flags leave the installed test extension. */
export async function observeNativeSurface(configuration, ordinaryId, readyTabs) {
  const tabs = await chrome.tabs.query({});
  const candidates = tabs.filter(tab => tab.id !== ordinaryId && [configuration.ordinaryUrl, configuration.alternateUrl].includes(tab.url));
  const native = candidates.length === 1 ? candidates[0] : undefined;
  let isolated = "not_visible";
  let main = "not_visible";
  if (native) {
    try {
      const answer = await chrome.tabs.sendMessage(native.id, { type: "fluxiq.ping" });
      isolated = answer?.ok === true && answer.active === true ? "present" : "absent";
    } catch { isolated = "refused"; }
    try {
      const result = await chrome.scripting.executeScript({ target: { tabId: native.id }, world: "MAIN", func: () => ({ dialog: window.__fluxiqDialogOverrideInstalled === true, requests: window.__fluxiqRequestStartsInstalled === true }) });
      main = result[0]?.result?.dialog === true && result[0]?.result?.requests === true ? "present" : "absent";
    } catch { main = "refused"; }
  }
  return { nativeMatches: candidates.length, ordinaryVisible: tabs.some(tab => tab.url === new URL("team", configuration.ordinaryUrl).href), isolated, main, contentReady: native ? readyTabs.has(native.id) : false };
}
