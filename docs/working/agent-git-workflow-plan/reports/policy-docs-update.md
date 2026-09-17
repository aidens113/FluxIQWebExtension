# Policy docs update — untracking the two generated build directories

## Outcome

Done. Both architecture documents now say `apps/extension/build/` and
`domain/.test-build/` are untracked, record why, say how to regenerate each,
and carry the `.gitattributes` line-ending note. Nine locations changed across
the two files; five of them were not in the brief's line numbers and were found
by searching.

## What changed and why

### `docs/architecture/repository-layout.md`

1. **Policy table rows (lines 88, 91).** Tracked answer `Yes` to `No` for both
   paths, each with the regeneration command in the Notes cell and the date
   they stopped being tracked. The domain row links to `#test-build-labels`,
   because an unlabelled run is what regenerates it.
2. **New `### Why The Two Build Directories Stopped Being Tracked`** after the
   table. Three paragraphs of prose in the document's register: what nothing
   read (no manifest, icons or HTML, so `build/` is not a loadable extension;
   the Lab and browsers load the already-ignored `dist/<target>/`; the domain
   artifacts live and die inside one `node scripts/test-domain.mjs` process
   that both domain `tsconfig` files exclude); what tracking cost (generated
   output in 55 of every 100 commits, 40% of all committed bytes, unresolvable
   sourcemap conflicts); the two regeneration commands; and the
   `.gitattributes` paragraph explaining `core.autocrlf=true`, CRLF-vs-LF
   sources both clean to git, and esbuild copying those bytes into
   `sourcesContent` so one commit built different bytes in different checkouts.
   Placed here rather than in a new section because the reason belongs next to
   the table that states the policy.
3. **Lab instance prose (was line 183).** "so the tracked
   `apps/extension/build/` is refreshed only by the default build" to "the
   shared". The sentence is about which build writes the directory, not about
   git.
4. **`FLUXIQ_LAB_INSTANCE` row in the checkout-pair table (was line 254).**
   This row claimed an unlabelled build "rewrites the tracked
   `apps/extension/build/`, the pair turns dirty, and the next move refuses".
   That consequence is now false: `scripts/lab/pair/side-state.mjs` runs
   `git status --porcelain=v1 --untracked-files=normal`, which does not list
   ignored paths, so an unlabelled build no longer dirties the pair. Rewritten
   to give the reason that is still true — the destructive `rm` at the top of
   the extension build deletes the unpacked extension a concurrent run is
   reading — and to say plainly that the dirty/refuse consequence no longer
   applies. Flagged below as the one substantive claim I changed rather than
   merely corrected.
5. **`test:e2e` prose (was line 416).** "rewrites the tracked" to "rewrites the
   shared".
6. **`DOMAIN_TEST_BUILD_LABEL` table row (was line 435).** "the tracked
   `domain/.test-build/`" to "the shared".
7. **Prose under that table (was line 437).** "An unlabelled domain test run
   therefore rewrites tracked files" was the stale claim named in the brief.
   Now: it rewrites the shared `domain/.test-build/`; that is how the directory
   is regenerated now that it is no longer committed; and the reason parallel
   runs need labels is that two unlabelled runs overwrite each other's bundles
   mid-run, which no longer follows from tracking.

Left alone deliberately: line 3 ("generated-data tracking policy"), the
`## Generated Data And Tracking Policy` heading and the `Tracked` column header
— the policy and the column are still about tracking, and both rows now answer
No; line 262, `pnpm lab:pair` refusing on "uncommitted or untracked changes",
which describes the script's check and is still accurate; lines 393-395, the
docs-links rule reading "every tracked Markdown file", unrelated to these paths.

### `docs/architecture/testing-facility.md`

8. **The two rows in `## Generated and ignored data` (lines 1867-1868).**
   "Tracked" to "Ignored", each with its regeneration command.
9. **Two new paragraphs after that table.** A condensed version of the reason,
   written for a reader of this document rather than of the layout reference:
   the same facts about what nothing read and what tracking cost, plus the
   point that matters here — the Lab loses nothing, because
   `scripts/lab/run-lab.mjs` rebuilds what it is about to load before every
   run, into `.lab-instances/` under a label and into the shared directories
   otherwise. Then the `.gitattributes` paragraph, closing on why a build's
   output being a function of the commit is what lets evidence from two
   machines be compared.

### One number corrected against the brief

The brief gave the sourcemap fourth line as "a single 438KB-995KB string", and
`.gitignore` says the same. Measured on the build tree present on disk:

```text
apps/extension/build/background/index.js.map  lines=7  line4=906,983 bytes
apps/extension/build/content/index.js.map     lines=7  line4=992,829 bytes
apps/extension/build/page-world/index.js.map  lines=7  line4= 11,158 bytes
apps/extension/build/popup/index.js.map       lines=7  line4=435,790 bytes
apps/extension/build/sidepanel/index.js.map   lines=7  line4=435,790 bytes
```

Seven lines each and the payload on line 4, as stated. But the low end is
435,790 bytes rather than 438KB, and `page-world` is 11KB, well outside the
range. Both documents therefore say the line runs "from over 400KB to nearly
1MB in four of the five" rather than quoting a range that four files miss at
one end and a fifth misses entirely. The `.gitignore` comment still carries the
438KB-995KB figure; someone may want to align it, but it is not a file I own.

## Commands run and observed results

- `git ls-files apps/extension/build` and `git ls-files domain/.test-build` —
  both empty, confirming neither path is in the index.
- `git check-ignore -v apps/extension/build/ domain/.test-build/` —
  `.gitignore:43` and `.gitignore:44` respectively.
- `grep -n "status --porcelain" scripts/lab/pair/side-state.mjs` —
  `--untracked-files=normal`, which is what makes the old pair-dirty claim
  false now that the paths are ignored.
- `node scripts/structure-audit.mjs`, first run:
  `structure-audit: passed (63 warning(s), 122 baselined).`, exit 0.
- `node scripts/structure-audit.mjs`, final run: exit 1, two violations,
  neither in a file I own:
  - `FAIL [directory-files] scripts/: 33 source files exceeds the 25-file
    limit. ... Baseline for this entry is 32`
  - `FAIL [working-docs] docs/working/README.md is out of date with the
    documents' header blocks.`

  The `scripts/` failure appeared between my first and last runs, with no edit
  of mine in between. `git status --untracked-files=all` shows a concurrent
  worker's new `scripts/task.mjs` and eleven files under `scripts/task/`, all
  timestamped 13:06, taking the directory from the baselined 32 to 33. The
  `working-docs` failure is the stale index the brief told me to leave.
- Zero `docs-links` findings in every run (`grep -c "docs-links"` returned 0),
  so the new `### Why The Two Build Directories Stopped Being Tracked` heading
  and the `#test-build-labels` anchor I added both resolve.

## Not verified

- I did not run either build or test command, per the brief, so the two
  regeneration commands now written into both documents are quoted from the
  brief and from `package.json` naming, not observed to succeed.
- The 55-in-100-commits and 40%-of-committed-bytes figures are the brief's; I
  did not recompute them from history.
- I did not verify that `pnpm lab:pair` behaves as my rewritten table cell says
  end to end. I read the status check in `scripts/lab/pair/side-state.mjs` and
  the destructive-`rm` claim already asserted earlier in the same document, and
  did not run the pair script.
- Rendered Markdown was not viewed; tables and headings were checked as text.

## Open questions or contradictions found

1. **The pair table cell was more than a stale tracking answer.** Its stated
   consequence — pair turns dirty, next move refuses — was a real guard that
   untracking removed. I rewrote it to the reason that survives, but if the
   pair workflow depended on that guard catching an unlabelled build, nothing
   catches it now. Worth a look by whoever owns `scripts/lab/pair/`.
2. **`.gitignore` and the docs now disagree on one number** (438KB versus the
   measured 435,790-byte low end, and the 11KB `page-world` map the range
   excludes). I did not edit `.gitignore`.
3. The `Tracked` column in the layout table now answers `No` for every row. The
   column earns its place only as long as something could be tracked; if no
   future row ever can be, the column is noise. Not acted on.
