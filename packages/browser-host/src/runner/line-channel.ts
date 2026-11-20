import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

/** One newline-delimited text channel: the next line (null once the input ended), and a line to send. */
export type LineChannel = {
  next(): Promise<string | null>;
  send(line: string): void;
};

/** A line channel over a readable and a writable stream (a socket, or standard input and output). */
export function lineChannel(input: Readable, output: Writable): LineChannel {
  const lines: string[] = [];
  const waiting: ((line: string | null) => void)[] = [];
  let ended = false;
  const reader = createInterface({ input, crlfDelay: Infinity });
  reader.on("line", (line) => {
    const waiter = waiting.shift();
    if (waiter) waiter(line);
    else lines.push(line);
  });
  reader.on("close", () => {
    ended = true;
    for (const waiter of waiting.splice(0)) waiter(null);
  });
  return {
    next: () => {
      const line = lines.shift();
      if (line !== undefined) return Promise.resolve(line);
      if (ended) return Promise.resolve(null);
      return new Promise((resolve) => waiting.push(resolve));
    },
    send: (line) => { output.write(`${line}\n`); }
  };
}
