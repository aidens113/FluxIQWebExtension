/** Offline recording may have no Core control; any paid-capable or authenticated lane must attest. */
export function requiresCoreRuntimeIdentity(live: boolean, flowLane: boolean, control: unknown): boolean {
  return live || flowLane || control !== undefined;
}
