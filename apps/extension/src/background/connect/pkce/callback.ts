import { FLUXIQ_CONNECT_PATHS, parseConnectDoneFragment, type ConnectDoneFragment } from "@fluxiq/contracts/platform";
import type { HostedPkceStoredAttempt } from "./model";
import { HostedPkceFailure } from "./failure";

export function readPkceCallback(record: Extract<HostedPkceStoredAttempt, { phase: "waiting" }>, input: Readonly<{ tabId: number; url: string }>): ConnectDoneFragment | null {
  if (input.tabId !== record.tabId) return null;
  let url: URL;
  try { url = new URL(input.url); }
  catch (error) {
    if (error instanceof TypeError) return null;
    throw new HostedPkceFailure("callback_refused");
  }
  if (url.origin !== record.binding.origin || url.pathname !== FLUXIQ_CONNECT_PATHS.done || url.search || url.username || url.password) return null;
  const result = parseConnectDoneFragment(url.hash);
  return result?.state === record.state ? result : null;
}
