# Lane H, brief H1 (t727): restricted-references structure-audit rule

## Outcome

Done. A new rule, `restricted-references`, now fails the build when a provider host, provider SDK import or provider key read appears anywhere in the web extension outside an allowlist of exact files. The rule lives in Core and is copied byte-for-byte into the extension. Core's config lists nothing, so the rule does nothing there. The extension's config holds one "model provider" entry. Both audits pass, and a provider URL planted in `apps/extension/src` fails the audit with a message naming its file and line.

## What changed and why

Core tree (`C:/Users/osrs_/FluxStuff/fxwork/t727/!FluxIQ`):
- `scripts/structure-audit/rules/restricted-references.mjs` (new). It is a generic rule driven by `CONFIG.restrictedReferences`, a list of entries shaped `{ name, imports, strings, names, allow, reason, remedy }`. It reads every script file, tests included, through the TypeScript syntax tree, so comments and regular-expression literals are never read. What it checks:
  - `imports`: the specifier of every import, export-from, `import()`, `require()`, `import x = require()` and type `import("...")`. It also checks every key of `dependencies`, `devDependencies`, `peerDependencies` and `optionalDependencies` in every package.json the audit sees, and reports the line of that key.
  - `strings`: string literals and the literal pieces of templates. Module specifiers are left out, so a specifier is reported once, as an import.
  - `names`: property-access names, element-access keys written as literals, and keys read in a destructuring pattern. I added destructuring beyond the brief because `const { KEY } = process.env` is a common way to read a key.
  - Each finding has severity fail and ratchet false. The message gives file:line, the matched text, the entry's reason and remedy, and where to allowlist a file. One finding is reported per entry, line and text, so `env["KEY"]` is reported once rather than as both a name and a string.
  - An `allow` item is an exact file or a directory prefix, and it skips that entry only. An empty or missing config makes the rule inert. The `lastIndex` of each pattern is reset before every test, so a `g` flag cannot break a later match.
  - The header comment states the gaps: hosts or keys built at run time, and files that are neither scripts nor package.json, are not seen.
- `scripts/structure-audit/rules/tests/restricted-references.test.mjs` (new, 15 tests). It follows the fake-ctx pattern of `imports.test.mjs` and `shared-temp-root.test.mjs` and audits in-memory fixture repositories. The fixtures use made-up hosts, packages and key names on purpose: the same file is audited in the extension, and a real provider host in it would be a finding there.
- `scripts/structure-audit/config.mjs`: `restrictedReferences: []`, with a comment saying Core owns provider calls.
- `AGENTS.md` (Enforcement paragraph) and `docs/architecture/code-structure.md` (new Anti-Patterns item): both now describe the rule. These are the Core docs that list audit rules.

Extension tree (`C:/Users/osrs_/FluxStuff/fxwork/t727/!FluxIQWebExtension`):
- The rule and its test are copied byte-for-byte (LF line endings in both trees).
- `scripts/structure-audit/config.mjs`: one "model provider" entry.
  - `imports`: openai, @openai/*, @anthropic-ai/*, @ai-sdk/*, ai, langchain, @langchain/*, @google/generative-ai, @google/genai, @google-cloud/vertexai, @mistralai/*, groq-sdk, cohere-ai, ollama, deepseek*, @deepseek*, together-ai, @openrouter/*, openrouter*, @aws-sdk/client-bedrock*, @azure/openai, replicate, @huggingface/*, @fireworks-ai/*, llamaindex.
  - `strings`: the API hosts of deepseek, openai, anthropic, openrouter, generativelanguage and aiplatform (googleapis), mistral, groq, together (.xyz and .ai), x.ai, cohere (.ai and .com), fireworks, perplexity, bedrock-runtime, openai.azure.com, huggingface (inference and router) and replicate. Also the exact key names from `scripts/provider-secret-environment.mjs`, case-insensitive.
  - `names`: the same key names.
  - `allow`: 19 exact files, each with a comment saying why. No directories, and nothing under `apps/extension` or `domain/src`.
    - The strip list: `scripts/provider-secret-environment.mjs`.
    - The key-install path into Core's Secret Keys: `live-llm/provider-credential.ts`, `secret-keys-ui.ts`, `scripts/setup-demo-llm-key.mjs`, and `interactive-session.ts`. The last holds the allowlist of secret environment names the interactive driver may type into a field.
    - The pair's key-source report: `scripts/lab/pair/provider-key.mjs`.
    - Tests of those files: 5 in `live-llm/tests`, plus cli-llm, environment and interactive-session tests, and 2 pair tests.
    - `saved-flow-replay/tests/provider-absence.test.ts`.
    - The guarded-browser `lane-network-policies.test.ts`.
  - I built the allowlist by running the rule with an empty `allow`. It printed 59 findings in exactly those 19 files. I read each hit, and every one is Lab key handling or a test of it; none is a provider call.

## Commands run and observed results

- Core, `node --test scripts/structure-audit/rules/tests/restricted-references.test.mjs` printed `# tests 15`, `# pass 15`, `# fail 0`. The first run had 1 failure: a package.json dependency key written on the same line as its field was located at line 1. I fixed the line lookup and reran.
- Core, `node scripts/structure-audit.mjs` printed `structure-audit: passed (408 warning(s), 1152 baselined).` The only new lines are advisory: `scripts/structure-audit/rules/: 21 source files` (already over 15 before this) and `rules/tests/: 16 source files is past the 15-file advisory threshold`.
- Extension, the same test command printed `# tests 15`, `# pass 15`, `# fail 0`.
- Extension, `node scripts/structure-audit.mjs` printed `structure-audit: passed (213 warning(s), 635 baselined).`
- Extension, with `allow: []`, `node scripts/structure-audit.mjs --rule restricted-references` printed `structure-audit: 59 violation(s) across 1 rule(s).` These are the hits listed above.
- Planted proof in the extension. I added `apps/extension/src/planted-provider.ts` containing `fetch("https://api.deepseek.com/chat/completions")` and ran `node scripts/structure-audit.mjs --rule restricted-references`. It printed
  `FAIL  [restricted-references] apps/extension/src/planted-provider.ts:2: contains the string "https://api.deepseek.com/chat/completions", a restricted model provider reference. This repository never calls a model provider: ... add it to the "model provider" entry's allow list in scripts/structure-audit/config.mjs with a comment saying why.`
  followed by `structure-audit: 1 violation(s) across 1 rule(s).` and `exit=1`. After I deleted the file, the rerun printed `structure-audit: passed (0 warning(s), 0 baselined).` and `exit=0`.
- `diff` of the two rule files and of the two test files printed nothing. My shell printed `rule identical` and `test identical`.

## Not verified

- `pnpm check` and the full suites: not run, per the narrow-checks rule.
- The Core repository's own `structure:test` script was not run as a whole; only the new test file was.
- `.structure-baseline.json` is untouched in both trees. The rule does not ratchet, so it needs no baseline entry.

## Open questions or contradictions found

- The brief listed allowlist candidates that do not name a key or host today, so I left them out under "only files found by running the rule": `packages/test-runner/src/environment.ts`, `live-llm/secret-key.ts`, `flow-lane/creation/secrets.ts`, `run-scenario/resolve-run-secrets.ts`, `saved-flow-replay/core-provider-keys.ts`, `provider-credential-variables.ts` and `demo-llm-create-ui/flow-settings-ui.ts`. I also left out the speculative `packages/test-contracts/src/` directory: an unused directory allowance is a hole in the guard. If the strip list moves there, add that exact file.
- Another worker is editing files this config depends on in the same extension tree (`scripts/provider-secret-environment.mjs`, `packages/test-runner/src/environment.ts`, `environment.test.ts`, `packages/test-contracts/src/llm.ts`). Their in-flight edit removes the restated list from `environment.ts`, and the allowlist above was built against the tree with that edit in place. If that edit is dropped, `environment.ts` will fail the rule and must be added. If their edit removes the key names from `environment.test.ts`, its allowance becomes stale but harmless.
- The extension's AGENTS.md does not list individual audit rules, so I made no extension doc change; none was in my scope.
