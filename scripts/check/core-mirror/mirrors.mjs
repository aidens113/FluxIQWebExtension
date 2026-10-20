// The files this repository copies verbatim from FluxIQ Core.
//
// Each entry is one mirror set: the paths it covers (a path ending in `/`
// covers every file under that directory) and the paths inside them that are
// per-repository by design and so are never compared. Paths are POSIX and
// relative to each repository's root; the same path is read on both sides.
// A later mirror (a leftover build-cache or task copy) is one more entry.

export const CORE_MIRRORS = Object.freeze([
  Object.freeze({
    name: "structure-audit",
    include: Object.freeze(["scripts/structure-audit.mjs", "scripts/structure-audit/"]),
    exclude: Object.freeze(["scripts/structure-audit/config.mjs"])
  })
]);
