// The name of the one browser resource a web host lease grants: the paired
// extension's automation tab, keyed by the extension's client id. The client id
// is the extension's own and survives a service-worker restart, which opens a
// new gateway session; keying by the session would make every restart look
// like a different resource, and the extension's lease ledger
// (`apps/extension/src/background/connection/host-lease/`) would then never see
// a lower epoch as stale.

const RESOURCE_KEY_PREFIX = "web.automation:";

export function webAutomationHostResourceKey(clientId: string): string {
  return `${RESOURCE_KEY_PREFIX}${clientId}`;
}
