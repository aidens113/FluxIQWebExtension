# W2 Semantic Actionables Live Probe

Status: Complete; production live probe passed and the proposed new query node is rejected
Updated: 2026-09-20
Owner: `w2-semantic-actionables-live-probe`

## Result

The existing `web.dom.capture_snapshot` -> `web.inspect` path already provides
the reusable behavior proposed for `web.dom.query_actionables`. On the
controlled `ambiguous-targets` `form-context` page, two native buttons had the
same accessible name and no published selector, but the evidence packet gave
them distinct semantic form context and distinct opaque targets. Both targets
resolved through the ordinary generated-plan parameter resolver to distinct
private addresses, and their handles stayed unchanged on an immediate
recapture.

**Recommendation: reject a new `web.dom.query_actionables` node.** It would be
a second public surface over evidence the current inspection seam already
captures, bounds, sanitizes, stabilizes, and resolves. Explicit role and
actionable-state fields were not present for these native buttons; if later
live evidence proves either is necessary, extend the existing inspection
projection instead of adding a parallel node. This run did not prove such a
need.

## Isolation and live path

- Disposable paired source:
  `F:\fxlab\t029-semantic-actionables\!FluxIQWebExtension` at downstream
  `954fb49a5af6a0871ec0a1e1196e166b6e00a815` (`dev`) and sibling Core at
  `2d3e69aa6edaedfe81fc746cf14c91dc780857e8` (`dev`).
- Final confirmation run: `semantic-actionables-muami5lz` under
  `F:\fxlab-runs\t029-semantic-actionables-live\runs`; its persistent browser
  profile was isolated inside that run root.
- Browser/build: Playwright persistent Chrome `134.0.6998.35`, headed, loading
  the unpacked Chromium E2E production extension from
  `apps/extension/dist/e2e-chromium`.
- Page: Scenario Lab `ambiguous-targets`, armed to `form-context` before load.
  The fixture deliberately gives two native buttons the same accessible name
  and distinguishes them only by semantic form/fieldset context.
- Production path: the authenticated production panel returned HTTP success
  and opened in the same isolated browser; the extension paired with the owned
  gateway; `web.inspect` dispatched `web.dom.capture_snapshot` through Core,
  the real gateway, and the production extension twice.
- Deterministic network guard observed zero violations. All owned panel,
  gateway, Scenario Lab, browser, and extension processes were stopped after
  each attempt. No user profile, user store, port 3000, or t029 product source
  was used.

No provider credential was loaded into the browser process, no provider API
was called, and provider call count was zero.

## Exact observed evidence

The final `web-llm-evidence.v2` packet was 1,879 serialized UTF-8 bytes and
contained 15 elements. `truncated`, `captureTruncated`,
`elementsTruncated`, and `budgetTruncated` were all false.

Exactly two candidates had `tag: button`. Each candidate contained these keys,
and no others:

`controlType`, `form`, `heading`, `landmark`, `name`, `tag`, `target`.

Observed semantic behavior, without recording page values or selectors:

- `name` was present on both and held the same accessible name. The sanitizer
  intentionally normalizes `accessibleName`/`name` into this one field; no
  separate `label` field was published.
- `form` was present on both and differed, which distinguished the otherwise
  same-named candidates. `heading` and `landmark` were also present.
- `target` was distinct for each candidate, contained no selector, and stayed
  attached to the same semantic candidate on the second capture.
- Both handles resolved through `resolvePlanNodeParameters` for the existing
  click node, and the two resolved private addresses were different. The
  addresses themselves were neither logged nor placed in this report.
- `role` was absent for both native buttons. Their actionable kind was still
  explicit from `tag: button` plus `controlType`; the evidence helper treats a
  native button tag as actionable without needing an explicit ARIA role.
- None of `checked`, `disabled`, `enabled`, `expanded`, `focused`, or
  `selectedValue` appeared on the two candidates. The probe therefore does not
  claim that inspection publishes general actionable state.
- No raw DOM, HTML, selector, form/name value, page text, screenshot, or
  captured payload was written to the driver summary or this report.

This is sufficient for creation/repair to distinguish and address the two
actionable candidates without raw DOM/HTML. It also preserves the honest
negative boundary: when a page supplies no distinguishing semantic context,
opaque handles can name two positions but cannot tell a model which one has
the user's intended meaning.

## Contract bounds inspected

The production capture and inspection contracts apply these independent
bounds:

- per-frame snapshot: at most 2,000 ranked candidates after scanning at most
  50,000 elements;
- merged tab snapshot: at most 4,000 elements across frames;
- sanitized inspection packet: at most 40 elements;
- exploration bytes: 6,000 by default and never more than 12,000;
- strings: text/name 300, tag 40, role 80, private selector 500, attribute 200,
  placement 80;
- select options: 20; page dialogs: 3.

The packet publishes explicit capture-, element-, and byte-truncation flags.
Selectors and record addresses remain in domain-private maps keyed by the
opaque target; they do not enter the evidence packet.

## Build and validation record

- `pnpm install --frozen-lockfile` in both disposable worktrees: passed.
- Initial package-only Core `pnpm --filter fluxiq build`: failed because the
  fresh worktree had not built `@fluxiq/contracts` first. This was build order,
  not a product result.
- Core `pnpm -r build`: passed, including the production web panel build.
- Scenario Lab build: passed.
- Chromium E2E production extension build: passed.
- Domain panel-host build: passed.
- Test-contracts, domain, test-evidence, and test-runner recursive build:
  passed.
- First headless-shell attempt: failed before opening a page because that
  Playwright executable disabled/crashed with extension loading. The probe
  switched to the facility's established headed persistent-Chromium path.
- Three headed live probes passed; the final run above is the evidence claim.

No product source, test, shared branch, user data, provider setting, or worker
report was edited. Only this report was authored in t029; the disposable probe
driver and generated run/profile data remain under
`F:\fxlab-runs\t029-semantic-actionables-live`. No commit or push was
performed.
