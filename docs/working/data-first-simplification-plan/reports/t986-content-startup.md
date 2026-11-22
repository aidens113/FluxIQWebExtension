# Content harness startup protocol follow-up

Owner: Lead; bounded part of t986, separate from the worker snapshot owners.
Changed: apps/extension/e2e/content/runtime-stub.ts answers the exact production own-page-address query with a fresh `{ok:true,addresses:[]}`. This harness runs no panel/gateway; the content own-document guard remains unchanged. Other messages still receive no background response.
Validation: `git diff --check -- apps/extension/e2e/content/runtime-stub.ts` passed.
Validation: gated `pnpm --filter @fluxiq-web-extension/extension test:content select.spec.ts --grep '^by value: selects the option' --workers=1` exited1 with `Error: No tests found.` The anchored full-title selector matched no test; no browser behavior was exercised.
Next validation: same command with `--grep 'selects the option and validates'` queued as t986-content-startup-selected. Uses isolated Everything Store fixture; provider-free protocol/page-action smoke only, not four-attempt task acceptance.
Durable ignored logs: `.heavy-slots/t986-content-startup.log` and `.heavy-slots/t986-content-startup-selected.log`.
Validation: corrected existing Everything Store browser selection case ->1/1 passed,11.0s, exit0; content readiness and selected page value verified. No four-attempt/live model task success claim.

Independent snapshot-owner validation: `node --test --test-concurrency=1 test-runs/t986-post-reboot-validation/snapshot-stub/tests/sandbox-runtime-stub.test.js test-runs/t986-post-reboot-validation/snapshot-stub/tests/content-world-source.test.js` through normal gate ->exit0,6/6 passed. Root reviewed exact production query reply and malformed/unknown/mutable-response negatives.
