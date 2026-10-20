// This repository as a repository of Core's build cache: what it hands the
// engine (`bound-engine.mjs`), in the shape Core's
// `scripts/build-cache/repository/core-repository.mjs` describes.
//
//   root            this checkout
//   steps           its registry (`steps.mjs`)
//   resolveStep     its resolver (`workspace/resolve-step.mjs`): generated
//                   directories, relocatable output bases, undeclared reads,
//                   outputs no dependant reads, the FluxIQ Core packages each
//                   step links, and the structure audit for a step that holds
//                   its config to the bundle
//   storeNamespace  null: its entries sit at the top of the shared store and
//                   Core's under `core/`, each part with its own format
//                   directory, temporary directory and pruning
//   proofListings   esbuild's inputs for every step that bundles
//                   (`bundle-listings.mjs`), beside the tsc listings the proof
//                   takes for every step

import { bundleListings } from "./bundle-listings.mjs";
import { REPOSITORY_ROOT } from "./repository-root.mjs";
import { STEPS } from "./steps.mjs";
import { resolveExtensionStep } from "./workspace/index.mjs";

export const WEB_EXTENSION_REPOSITORY = Object.freeze({
  name: "the FluxIQ web extension",
  root: REPOSITORY_ROOT,
  steps: STEPS,
  resolveStep: resolveExtensionStep,
  storeNamespace: null,
  proofListings: bundleListings
});
