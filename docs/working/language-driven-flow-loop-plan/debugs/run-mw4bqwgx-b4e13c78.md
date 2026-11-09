# Debug: run-mw4bqwgx-b4e13c78

Status: Failed before any model call, $0. A facility failure of my own making, not the product: a worker edited Core while the run built Core's web panel.
Source: t875 branch with A1-A7 (Core 1bdc15c48 / d9ca4eea3; Downstream cb1cf3caa), plus a worker's uncommitted Core edits that began during the prelude.
Task: bigbox-retail-napkins-for-delivery, unchanged, `--attempts 2`, the rerun after A5 (chat rule) and A7 (stuck evidence).
Provider: Anthropic claude-sonnet-5-5 via CLAUDE_API_KEY; `--llm-max-cost-usd 5`, normal guards and no overrides. Instance t875-live, slot-1.

## Result and distance reached

It got no further than the prelude. `{"status":"failed","category":"process.startup"}`: "Core's build inputs changed while the web panel was building (key 0e862ee3… became 82216de3…), so the build was not published". It made no model call, typed nothing and spent nothing.

## Cause

While this run was building, I had a worker (the "a yes must stand on the rows" judge fix) editing files under `packages/fluxiq/src` in the same Core worktree. The Lab's build-input check did its job and refused to publish a web build whose inputs had changed under it.

## Repair

No product change. This lane now keeps Core edits and live runs apart: no worker edits Core while a run is building or in its prelude. The lead's merges follow the same "ready" handshake.

## Next

The napkins pair on Sonnet, once the judge work is finished, verified and rebuilt.
