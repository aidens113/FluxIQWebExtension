// Whether this repository's own compiled output is older than the source it was
// built from, asked of the two builds a live run actually loads.
//
// Core already has this guard (`core/build/staleness.mjs`), and it exists
// because the Lab runs compiled output rather than source, so a fix sitting in
// a working tree is a run that silently measures the previous build. The same
// hazard is here twice over and was unguarded:
//
//   - `domain/dist`, which the host loads for the web domain's nodes,
//     rejections and extraction summaries.
//   - `apps/extension/dist/e2e-chromium`, which the browser loads.
//
// It cost two runs on 2026-09-26, both after Core was rebuilt and the domain
// was not. `run-muhp2yip-3a0f198b` hung for 675 s on its first provider call
// and produced nothing; `run-muhs8hx3-6fd929e6` came back HTTP 400 from the
// provider on its build. Neither was a product result and neither said why,
// and the supervisor diagnosed the first one wrongly before spotting the
// pattern on the second.
//
// Modification time, coarse on purpose, for the reason Core's guard gives: a
// false alarm costs one rebuild, and a miss costs a run that measures nothing
// and reads as a product result.

import path from "node:path";
import { scanNewest } from "./core/index.mjs";

/**
 * The builds a run loads from this repository, each with the source that
 * produces it and the command that rebuilds it.
 *
 * `apps/extension/dist` is per build label, so the root is passed in rather
 * than assumed: a run against one label must not be failed by another's output.
 *
 * @param {string} repositoryRoot
 * @param {string} extensionBuildRoot
 */
export function repositoryBuilds(repositoryRoot, extensionBuildRoot) {
  return [
    {
      name: "domain",
      sourceRoot: path.join(repositoryRoot, "domain", "src"),
      outputRoot: path.join(repositoryRoot, "domain", "dist"),
      rebuild: "pnpm --filter @fluxiq-web-extension/domain build"
    },
    {
      name: "extension",
      sourceRoot: path.join(repositoryRoot, "apps", "extension", "src"),
      outputRoot: extensionBuildRoot,
      rebuild: "pnpm --filter @fluxiq-web-extension/extension build"
    }
  ];
}

/**
 * The first build whose output is older than its source, or `null` when every
 * one of them is current.
 *
 * First rather than all, because the answer is the same either way -- rebuild
 * and run again -- and naming one file the reader can check beats a list they
 * have to read past.
 *
 * A build with no output at all is not reported here: that is absence, not
 * staleness, and the callers that need the output say so themselves in words
 * that fit what they were about to do.
 *
 * @param {ReturnType<typeof repositoryBuilds>} builds
 * @returns {Promise<{ name: string, behindMs: number, message: string, rebuild: string } | null>}
 */
export async function staleRepositoryBuild(builds) {
  for (const build of builds) {
    const [sources, output] = await Promise.all([scanNewest(build.sourceRoot), scanNewest(build.outputRoot)]);
    if (!sources.newestPath || !output.newestPath) continue;
    const behindMs = sources.newestMs - output.newestMs;
    if (behindMs <= 0) continue;
    const minutes = Math.round(behindMs / 60_000);
    return {
      name: build.name,
      behindMs,
      rebuild: build.rebuild,
      message: `The ${build.name} build is ${minutes} minute(s) behind its source: ${sources.newestPath} is newer than anything in its output (newest ${output.newestPath}). A live run loads the compiled output, so this run would exercise the old build and report the result as the product's.`
    };
  }
  return null;
}
