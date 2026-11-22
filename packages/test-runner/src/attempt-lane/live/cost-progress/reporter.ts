import { AttemptCostProgress } from "./reader.js";
import { formatAttemptCostProgress } from "./format.js";

/** Emits changed estimates during polling and flushes each ending before moving to the next attempt. */
export class AttemptCostReporter {
  private readonly reader: AttemptCostProgress;
  private readonly emitted = new Map<string, string>();
  private ordinal = 1;

  constructor(directory: string, private readonly log: (line: string) => void) {
    this.reader = new AttemptCostProgress(directory);
  }

  async poll(includeEmpty = false): Promise<void> {
    for (const line of formatAttemptCostProgress(await this.reader.read(this.ordinal, includeEmpty))) {
      const key = /^\[cost\] attempt (\d+):/u.exec(line)?.[1] ?? "source";
      if (this.emitted.get(key) === line) continue;
      this.emitted.set(key, line);
      this.log(line);
    }
  }

  async finish(ordinal: number): Promise<void> {
    await this.poll(ordinal === this.ordinal);
    // An ending whose scoring failed may be reported again; it must not advance attribution twice.
    this.ordinal = Math.max(this.ordinal, ordinal + 1);
  }
}
