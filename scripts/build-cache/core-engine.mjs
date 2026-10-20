// FluxIQ Core's build-cache engine, loaded from the Core beside this checkout.
//
// Core owns the engine: fingerprints, stamps, the per-step lock, the shared
// store, the CLI and the coverage proof. This repository keeps only its
// configuration (`repository.mjs`: its registry, its resolver and its
// Core-package resolution layer) and binds the engine to it
// (`bound-engine.mjs`). Before 2026-10-19 this directory held a fork of the
// engine that had drifted from Core's on both sides.
//
// The repository binding (`build-cache-for.mjs`) is the newest part of Core's
// engine this checkout needs, so it is loaded first: a Core too old to have it
// fails here, through `importCoreScript`, with what to do about it (merge
// Core's dev into the worktree's Core, or update the main checkout's Core),
// rather than later with a missing export.

import { importCoreScript } from "../core-scripts/index.mjs";

await importCoreScript("scripts/build-cache/build-cache-for.mjs");

export const coreEngine = await importCoreScript("scripts/build-cache/index.mjs");
