// Tier 2 for the offline-trial experiment (trace plan P5, D34): the web
// domain's offline reevaluator (`createWebOfflineReadReevaluator`) over a
// Playwright snapshot page running the extension's production content code
// (`../../offline-snapshot-page/`), both watched (`./recording-*.ts`) so a
// report can say what was asked and what the page saw. Headed by default: a
// browser test on this machine runs visibly. The content code must be built
// and current, or this refuses before any browser is launched.

import { createWebOfflineReadReevaluator, type WebSnapshotPage } from "@fluxiq-web-extension/domain/node";
import type { ClientGatewayTraceReevaluator } from "fluxiq/client-gateway";
import { loadExtensionContentCode, openWebSnapshotPage, type SnapshotBrowserChannel } from "../../offline-snapshot-page/index.js";
import { recordingReevaluator, type ReevaluationAsk } from "./recording-reevaluator.js";
import { recordingSnapshotPage, type SnapshotEvaluationSummary } from "./recording-snapshot-page.js";

export type Tier2Reevaluation = Readonly<{
  channel: SnapshotBrowserChannel;
  /** The snapshot page itself, for a read evaluated over its own snapshot. */
  page: WebSnapshotPage;
  /** The page's evaluations since the last call, each handed over once. */
  takeEvaluations(): SnapshotEvaluationSummary[];
  reevaluator: ClientGatewayTraceReevaluator;
  asks(): readonly ReevaluationAsk[];
  close(): Promise<void>;
}>;

export async function openTier2Reevaluation(input: { extensionDir: string; channel?: SnapshotBrowserChannel | undefined; headless?: boolean | undefined }): Promise<Tier2Reevaluation> {
  const content = await loadExtensionContentCode({ extensionDir: input.extensionDir });
  const channel = input.channel ?? "chrome";
  const snapshotPage = openWebSnapshotPage({ content, channel, headless: input.headless ?? false });
  const watched = recordingSnapshotPage(snapshotPage);
  const recording = recordingReevaluator(createWebOfflineReadReevaluator(watched.page), watched.take);
  return Object.freeze({
    channel, page: watched.page, takeEvaluations: watched.take, reevaluator: recording.reevaluator, asks: recording.asks,
    close: () => snapshotPage.close(),
  });
}
