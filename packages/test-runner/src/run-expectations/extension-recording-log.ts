const RECORDED_KIND = /^(?:dom|browser|action|content)\.[a-z_]+$/u;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

/**
 * Tallies the extension's own recording log by recorded event kind (`dom.click`,
 * `dom.input`, ...), prefixing evidence-only entries with `evidence:`. Only the
 * kind and the evidence marker are read; labels and details carry page data and
 * are never copied. Other activity (pairing, tab, connection) is skipped.
 */
export async function readExtensionRecordingLog(send: (message: Record<string, unknown>) => Promise<unknown>): Promise<Record<string, number>> {
  const tally: Record<string, number> = {};
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await send({ type: "fluxiq.getRecordingLog", page, pageSize: PAGE_SIZE });
    const log = isRecord(response) && isRecord(response.log) ? response.log : undefined;
    const items = log && Array.isArray(log.items) ? log.items : [];
    for (const item of items) {
      if (!isRecord(item) || typeof item.kind !== "string" || !RECORDED_KIND.test(item.kind)) continue;
      const key = `${typeof item.label === "string" && item.label.startsWith("Evidence:") ? "evidence:" : ""}${item.kind}`;
      tally[key] = (tally[key] ?? 0) + 1;
    }
    if (items.length < PAGE_SIZE) break;
  }
  return tally;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
