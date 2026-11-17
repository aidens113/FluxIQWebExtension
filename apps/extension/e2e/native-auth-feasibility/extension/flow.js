/** Test-only native identity call; callback material never leaves this closure. */
export function createProbeFlow(configuration) {
  let attempt;
  const state = "native-probe-state-0123456789";
  const code = "a".repeat(43);
  const callback = () => chrome.identity.getRedirectURL("connect/done");
  return {
    start() {
      if (attempt?.pending) throw new Error("probe.pending");
      const current = { pending: true, outcome: "pending", callbackMatched: false, lateResultDiscarded: false };
      attempt = current;
      void chrome.identity.launchWebAuthFlow({ url: configuration.ordinaryUrl, interactive: true }).then(url => {
        current.pending = false;
        if (current.outcome === "locally_cancelled") {
          current.lateResultDiscarded = true;
          return;
        }
        current.callbackMatched = url === `${callback()}#code=${code}&state=${state}`;
        current.outcome = "success";
      }, () => {
        current.pending = false;
        if (current.outcome !== "locally_cancelled") current.outcome = "rejected";
      });
    },
    status() { return attempt ? { ...attempt } : { pending: false, outcome: "idle", callbackMatched: false, lateResultDiscarded: false }; },
    cancel() { if (attempt?.pending) attempt.outcome = "locally_cancelled"; },
    complete(tabId) { return chrome.tabs.update(tabId, { url: `${callback()}#code=${code}&state=${state}` }); }
  };
}
