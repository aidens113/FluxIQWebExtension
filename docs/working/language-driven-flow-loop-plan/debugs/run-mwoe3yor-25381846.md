# Debug: run-mwoe3yor-25381846

| | |
| --- | --- |
| Status | Stopped by the campaign supervisor before any model call: 0 steps, no spend. Not a product result. |
| Campaign | 2026-11-19 evening, lane B (`fxwork/t960`, instance `campaign-b`) |
| Source | dev, extension f9a462369 and Core db17d59c5 |
| Site and task | job-board, `job-board-remote-easy-apply`, on Haiku with the ladder |
| Stopped | 02:59Z, with `pnpm lab stop campaign-b`, while the Lab was "starting an isolated Core" |
| Why | The lead put a hold on every launch. Lane A's run run-mwodpw10-3d5748ab had just shown two t963 judge defects that hit every multi-attempt run (F10: the judge's trail grows past the provider's limit; F11: the judge runs on the climbed model). |

Rerun job-board-remote-easy-apply in lane B once the judge fix lands.
