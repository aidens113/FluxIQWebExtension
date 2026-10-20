# Lane T, P2 E2: background capture, upload and result reference

## Outcome

Done. When Core marks a command as traced, its gateway result now carries `metadata.trace`
(`ClientGatewayTraceResultMetadata`). This works for browser actions and for fact checks. The capture comes from the
command's tab top frame. Each part is uploaded by HTTP PUT to `CLIENT_GATEWAY_TRACE_ARTIFACT_PATH/<sha256>`, and a
part this worker already uploaded to the same Core is not sent again. Untraced commands send exactly what they sent
before. Nothing is added to `BrowserActionResult`, the recorded event or the socket outbox. In the content script,
`carry-resources.ts` now counts CSS `url()` references it does not carry. Both typechecks, the tests beside each
change and the structure audit pass.

## What changed and why

- **New `apps/extension/src/background/trace-capture/`.** Each file exports one thing, and the directory has a
  barrel:
  - `is-trace-request.ts`: true only when `metadata.trace.artifacts === true`.
  - `traced-commands.ts`: `TracedCommands`, a bounded set of 256 ids. Each id is noted from the raw
    `server.execute_action` and taken once.
  - `request-page-capture.ts`: sends `TRACE_PAGE_CAPTURE_MESSAGE` to frame 0 within a time limit. It checks that the
    reply has the right shape, and it never rejects.
  - `hash-capture-parts.ts`: turns the document into UTF-8 bytes typed `text/html` with role `primary`, and decodes
    each resource from base64 with role `resource`. Every part is hashed with SHA-256 in lower-case hex.
  - `sha256-hex.ts`: the same hash as `state-assets.ts`.
  - `within-time.ts`: holds a promise to a time limit.
  - `upload-bounds.ts`: capture 18 s, each upload 10 s, all uploads together 10 s, concurrency 4.
  - `metadata-key.ts`: the metadata key.
  - `page-capturer.ts`: `TracePageCapturer`. It keeps an in-memory set keyed by Core address and digest, and uploads
    only digests not yet in it, a few at a time, up to the deadline. `unavailable` is the page's own count, plus
    unreadable parts, plus every part not stored. If the capture fails or the command has no tab, the answer is
    `{artifacts: [], unavailable: 1}`. If there is no token, nothing is sent and every part is counted.
  - `with-trace-metadata.ts`: copies the existing metadata key by key, then sets `trace`.
  - `types.ts`.
- **Core wire constants, imported as types only.** The extension cannot reach `@fluxiq/contracts` directly, and a
  value import from `fluxiq/client-gateway` would bundle Core's gateway service. So `TRACE_METADATA_KEY` and the PUT
  path are local constants declared as `typeof CLIENT_GATEWAY_TRACE_*`. If Core's value changes, the extension stops
  compiling. An in-memory esbuild of `background/index.ts` contains 0 Core `client-gateway/service` or `trace`
  modules.
- **`connection/server-command-channel.ts`.**
  - `handleMessage` notes traced command ids synchronously, as its first step. This is needed because the gateway
    session's action mapping drops `metadata`, and `ServerCommandPayload` has no field for it. The socket transport
    emits `message` before the typed `execute_action` (Core `client-gateway-websocket/src/transport.ts:160` vs
    `:172`), so the id is noted before the command starts.
  - `sendActionResult` awaits `traceFor` after the boundary hook and before mapping. The capture uses the command's
    tab, or the page's tab if the command names none. The trace is set only on the mapped `client.action_result`.
  - The fact-check path now goes through a new private `sendGatewayResult`. It uses the automation tab, or the page's
    tab, which is how `command-router.ts` reads.
  - A traced id is dropped on a lease refusal. A capture that throws is logged in the activity log and counted
    `unavailable: 1`.
  - The new dependency `traceCapture?` is optional. Without it, a traced command is handled like an untraced one.
- **`connection/core-api.ts`.** `uploadTraceArtifact` sends a PUT with the bearer token, `credentials: "omit"` and
  the content type set to the media type. It enforces its own time limit with an AbortController and timer, like
  `callCoreProgram`. Any status other than 2xx throws an error that names the status only.
- **`background/connection.ts`.** Two lines: the import, and
  `traceCapture: new TracePageCapturer({ credentials: () => this.coreApiCredentials() })`.
- **`content/trace-capture/carry-resources.ts`.** For each carried `text/css` or `text/html` resource, it reads
  every `url()` and resolves it against that resource's own address. It counts each distinct address that is not
  among the references, once.
  - `@import` is stripped before reading, because the serializer already lists imports as references.
  - `data:`, `blob:`, `about:`, `javascript:` and `#fragment` addresses are skipped.
- **Tests:**
  - new: `background/trace-capture/tests/{page-capturer,traced-commands,with-trace-metadata}.test.ts`
  - appended to `background/connection/tests/server-command-channel.test.ts` and `core-api.test.ts`; separate files
    would have put `connection/tests/` at 27 files, over the audit's 25-file limit
  - three cases added to `content/trace-capture/tests/carry-resources.test.ts`

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.json --noEmit` -> exit 0, no output.
- `pnpm --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.test.json --noEmit` -> exit 0, no output.
- `EXTENSION_TEST_BUILD_LABEL=t736-e2 node scripts/test-extension.mjs background/trace-capture/tests background/connection/tests/server-command-channel background/connection/tests/core-api content/trace-capture/tests background/tests/connection-status background/tests/scripted-navigation-control`
  (from `apps/extension`) -> `# tests 101`, `# pass 101`, `# fail 0`, `# cancelled 0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (214 warning(s), 618 baselined).` There are two new
  advisory warnings: `core-api.test.ts` is at 443 lines and `server-command-channel.test.ts` at 530. The source file
  was already over 400 lines, and is now 467.
- The in-memory esbuild of `src/background/index.ts` has 526 inputs: 11 from `background/trace-capture` and 0 from
  Core `client-gateway/(service|trace)`. The output contains the PUT path and the message name.
- Two problems came up during the work and were fixed:
  - A test stubbed fetch more than once in a loop. The stubs restored one another instead of the real fetch, which
    hung the later real-HTTP tests in `core-api.test.ts`.
  - With `AbortSignal.timeout`, Node let the event loop exit early, because that timer is unref'd. The upload now
    uses its own timer.

## Not verified

- No live browser or Lab run. I did not exercise the real content script answering in a loaded extension.
- No run against Core's trace-artifact route: `apps/web/.../client-gateway/trace-artifacts` does not exist yet in the
  t736 Core tree. What the route answers, whether it requires `x-content-sha256` (not sent), and how it matches media
  types are all unknown.
- Whether Core's command timeout leaves room for the extra wait on a traced command: up to about 28 s in the worst
  case (18 s for the capture plus 10 s for uploads).
- I did not run whole-package suites or the extension build, as the brief directs.

## Open questions or contradictions found

1. Media types. The document is sent as plain `text/html`, as the brief says. Resources keep the server's
   content-type, for example `text/css; charset=utf-8`. If Core's route matches media types strictly, it may refuse
   types that carry parameters. Either Core normalizes them, or the extension strips them.
2. The top document's own `<style>` blocks and `style` attributes are not counted for `url()`. `carryResources`
   never sees the document HTML. Counting them needs `capture-page.ts`, which this lane does not own, to pass the
   HTML to `carryResources`. That is a one-line change for its owner.
3. A CSS `url()` that points to an address the serializer already counted as cross-origin can be counted twice,
   because `carryResources` cannot see the collector's `unavailable` set.
4. Lane t737: `background/connection.ts` gained one import and one dependency line in the `ServerCommandChannel`
   construction.
