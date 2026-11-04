// Replays Core's loop detector over the saved runs and prints the table:
// `node packages/test-runner/dist/loop-replay/cli.js <lab-runs directory> [--by-handle]`,
// `--by-handle` keying a control on its handle rather than its fingerprint, to
// measure what the fingerprint costs.
// No provider, no browser, no Lab: it reads step logs and prints codes and counts.

import { renderLoopReplayTable, replayLoopCorpus } from "./corpus.js";

const root = process.argv[2];
if (!root) {
  process.stderr.write("usage: loop-replay <lab-runs directory> [--by-handle]\n");
  process.exit(2);
}
process.stdout.write(`${renderLoopReplayTable(await replayLoopCorpus(root, { byHandle: process.argv.includes("--by-handle") }))}\n`);
