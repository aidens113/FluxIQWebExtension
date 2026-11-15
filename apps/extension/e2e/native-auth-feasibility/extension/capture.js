/** Synthetic fixture PNG is hashed in memory; no pixels/data URL leave this worker. */
export async function captureNativeSurface(tab) {
  await chrome.windows.update(tab.windowId, { focused: true });
  await chrome.tabs.update(tab.id, { active: true });
  let data;
  try { data = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }); }
  catch { return { outcome: "refused", bytes: 0, width: 0, height: 0, digest: "" }; }
  if (!data.startsWith("data:image/png;base64,")) return { outcome: "invalid", bytes: 0, width: 0, height: 0, digest: "" };
  const bytes = Uint8Array.from(atob(data.slice(data.indexOf(",") + 1)), character => character.charCodeAt(0));
  if (bytes.length < 24) return { outcome: "invalid", bytes: bytes.length, width: 0, height: 0, digest: "" };
  const view = new DataView(bytes.buffer);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const digest = Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
  return { outcome: "captured", bytes: bytes.length, width: view.getUint32(16), height: view.getUint32(20), digest };
}
