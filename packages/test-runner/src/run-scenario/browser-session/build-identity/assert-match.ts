import { RunnerFailure } from "../../../failure.js";
import { screenIdentity } from "./screen.js";
export function assertIdentityMatch(expected: unknown, background: unknown, content: unknown): void {
  const wanted = screenIdentity(expected);
  const worker = screenIdentity(background);
  const frame = screenIdentity(content);
  if (!wanted || !worker || !frame || JSON.stringify(wanted) !== JSON.stringify(worker) || JSON.stringify(wanted) !== JSON.stringify(frame)) {
    throw new RunnerFailure("extension.worker", "Running background/content build identity is missing or differs from the intended extension build; provider dispatch refused", { details: { extensionStage: "build-identity", expected: wanted, background: worker, content: frame } });
  }
}
