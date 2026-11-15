import { probeConfiguration } from "./config.js";
import { createProbeFlow } from "./flow.js";
import { observeNativeSurface } from "./observe.js";
import { captureNativeSurface } from "./capture.js";

const flow = createProbeFlow(probeConfiguration);
const readyTabs = new Set();
const boot = crypto.randomUUID();
let ordinaryId;
const controlUrl = chrome.runtime.getURL("probe.html");

async function nativeTab() {
  const candidates = (await chrome.tabs.query({})).filter(tab => tab.id !== ordinaryId && [probeConfiguration.ordinaryUrl, probeConfiguration.alternateUrl].includes(tab.url));
  if (candidates.length !== 1) throw new Error("probe.ambiguous");
  return candidates[0];
}

async function dispatch(command) {
  if (command === "ready") return { ok: true, boot };
  if (command === "control") {
    ordinaryId = (await chrome.tabs.create({ url: new URL("team", probeConfiguration.ordinaryUrl).href, active: true })).id;
    return { ok: true };
  }
  if (command === "start") {
    flow.start();
    return { ok: true };
  }
  if (command === "status") return { ok: true, ...flow.status() };
  if (command === "observe") return { ok: true, ...await observeNativeSurface(probeConfiguration, ordinaryId, readyTabs) };
  if (command === "capture") return { ok: true, ...await captureNativeSurface(await nativeTab()) };
  if (command === "complete") {
    await flow.complete((await nativeTab()).id);
    return { ok: true };
  }
  if (command === "close") {
    await chrome.tabs.remove((await nativeTab()).id);
    return { ok: true };
  }
  if (command === "cancel") {
    flow.cancel();
    return { ok: true };
  }
  if (command === "alternate") {
    await chrome.tabs.update((await nativeTab()).id, { url: probeConfiguration.alternateUrl });
    return { ok: true };
  }
  if (command === "reload") {
    setTimeout(() => chrome.runtime.reload(), 0);
    return { ok: true };
  }
  return { ok: false, code: "unknown_command" };
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === "fluxiq.contentReady" && sender.id === chrome.runtime.id && Number.isSafeInteger(sender.tab?.id)) readyTabs.add(sender.tab.id);
  if (sender.id !== chrome.runtime.id || sender.url !== controlUrl || message?.type !== "native-probe") return false;
  void dispatch(message.command).then(respond, () => respond({ ok: false, code: "operation_refused" }));
  return true;
});
