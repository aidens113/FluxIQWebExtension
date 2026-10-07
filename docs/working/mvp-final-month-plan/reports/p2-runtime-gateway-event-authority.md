# Runtime gateway event authority - t327

Status: implementing supervisor-owned isolated pair; default production execution remains legacy until the separate trusted-context joins land. Core base ad232818; downstream base51c1249a. No providers, panel, browser profiles or full suite.

## Inspected behavior and fail-first

Generic ClientGatewayRuntimeTransport forwarded every compatibility client.action_result as runtime command.result, including unknown IDs, late and duplicate results. RuntimeService separately emits command.result after awaiting dispatch. This can yield multiple authoritative-looking events for one actual dispatch.

Actual owning Vitest before fix:8cases4passed4failed,1.87s. State + unsolicited result produced command.result; unsolicited/duplicate failures produced3 runtime results; one actual RuntimeService dispatch plus duplicates/late result produced4 completions instead of1; cleared wait compatibility result also forwarded. Four existing paired-session/dispatch/rejection/failure-screening cases passed.

## Change and compatibility

Remove only compatibility action-result forwarding from generic runtime transport. Gateway client.action_result diagnostics remain, along with transport client lifecycle, state, snapshot, recording and error events. Actual awaited result retains validated failure and cleared-wait data. RuntimeService owns its one authoritative completion. Public external transport subscribers now receive fewer duplicate/out-of-band command.result events; no external-consumer audit claimed.

## Validation and remaining work

After fix actual owning transport8/runtime16/gateway16 tests passed40/40 zero skips2.20s. Actual nonincremental Core typecheck exit0; Core structure audit exit0 (281 warnings/349 baseline). Downstream integration structure gate follows. No package build required for this signature-preserving internal event removal; no artifact/browser proof claimed. No durable context propagation, run admission registration, executor consumption, receipt-aware bounds, resume/repair fence or activation is implemented by this unit. Next trusted ticket/context task must integrate t323 on both native and IO/domain paths.
