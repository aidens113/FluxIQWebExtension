#!/usr/bin/env node
// node scripts/build-cache/prove-inputs.mjs [--json] [step ...]
//
// The coverage proof for this repository's steps: every file a step's
// compiler or bundler actually loads is inside that step's fingerprint, or
// installed under this repository or a linked Core, whose lockfiles the
// fingerprint hashes. It asks `tsc -p <config> --listFilesOnly` for every
// project a step names, and esbuild for every browser entry of a step that
// bundles (`bundle-listings.mjs`). A file outside fails the proof, naming the
// step and the file. The cheap static counterpart that runs in `pnpm check`
// is tests/registry.test.mjs; this is the expensive one, run whenever the
// registry or a project's shape changes. Core's
// `scripts/build-cache/entry/prove-inputs.mjs` holds the details.

import { proveInputs } from "./bound-engine.mjs";

process.exit(await proveInputs(process.argv.slice(2)));
