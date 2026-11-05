// The overlay's last place, kept for the content script. A content script cannot read
// `chrome.storage.local`, because the pairing credential is in it, so it asks here for the
// one value it needs. A content script runs beside pages that are not ours: only this key
// is ever read or written for it, and only a value small enough to be a placement.

const STORAGE_KEY = "fluxiq.activity.overlayPlacement";

function isSmallPlacement(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const { shape, anchor, offset, ...rest } = value as { shape?: unknown; anchor?: unknown; offset?: unknown };
  return Object.keys(rest).length === 0
    && typeof shape === "string" && shape.length <= 16
    && typeof anchor === "string" && anchor.length <= 16
    && (offset === undefined || typeof offset === "number");
}

export async function recallOverlayPlacement(): Promise<{ placement: unknown }> {
  return { placement: (await chrome.storage.local.get(STORAGE_KEY))[STORAGE_KEY] };
}

export async function keepOverlayPlacement(value: unknown): Promise<{ ok: boolean }> {
  if (!isSmallPlacement(value)) return { ok: false };
  await chrome.storage.local.set({ [STORAGE_KEY]: value });
  return { ok: true };
}
