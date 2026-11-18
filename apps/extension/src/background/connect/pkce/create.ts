import { cancelHostedPkce } from "./cancel";
import { HostedPkceContext } from "./context";
import type { HostedPkceOptions, HostedPkceProtocol } from "./model";
import { observeHostedPkce } from "./observe";
import { restoreHostedPkce } from "./restore";
import { startHostedPkce } from "./start";

/** Unwired protocol: privileged session-CAS/tab/privacy composition is required. */
export function createHostedPkceProtocol(options: HostedPkceOptions): HostedPkceProtocol {
  const context = new HostedPkceContext(options);
  return Object.freeze({ start: () => startHostedPkce(context), observe: input => observeHostedPkce(context, input), cancel: () => cancelHostedPkce(context), restore: () => restoreHostedPkce(context) });
}
