import { realpath } from "node:fs/promises";
import path from "node:path";
import { NativeAuthProbeError } from "../failure.js";
import type { ProbeAllocation } from "../model.js";

export async function assertProbeAllocation(allocation: ProbeAllocation): Promise<void> {
  if (path.dirname(allocation.root) !== allocation.parent || !/^probe-chrome-[A-Za-z0-9]+$/u.test(path.basename(allocation.root))
    || path.resolve(allocation.profile) !== path.join(allocation.root, "profile") || path.resolve(allocation.extension) !== path.join(allocation.root, "extension")
    || await realpath(allocation.parent) !== allocation.parent || await realpath(allocation.root) !== allocation.root
    || await realpath(allocation.profile) !== allocation.profile) throw new NativeAuthProbeError("allocation");
}
