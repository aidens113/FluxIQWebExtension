// Repository-specific configuration for structure-audit. This is the only
// file that differs between FluxIQ Core and this downstream web-extension
// repository; the entry point, context, baseline, and rules are mirrored
// from F:\!FluxIQ\scripts\structure-audit and must be changed there first.

import { PROVIDER_SECRET_ENVIRONMENT_VARIABLES } from "../provider-secret-environment.mjs";

// The provider key names come from the one list the Lab strips from every
// child environment, so this entry never restates it.
const PROVIDER_KEY_NAME = new RegExp(`^(${PROVIDER_SECRET_ENVIRONMENT_VARIABLES.join("|")})$`, "i");

export const CONFIG = {
  repository: "web-extension",

  // Directories whose basename marks a test root. Test files must live
  // directly inside one of these. "e2e" is a runner-owned root, not
  // co-location.
  testRootDirNames: ["tests", "e2e"],

  // Import specifiers that must never appear in this repository's sources.
  forbiddenImports: [],

  // Directory-scoped import boundaries: files under `from` must not import
  // anything resolving under `to`. AGENTS.md: domain code must not depend on
  // extension UI or browser implementation modules.
  importBoundaries: [
    {
      from: "domain/src",
      to: "apps/extension/src",
      reason: "domain code must not depend on extension UI or browser implementation modules."
    }
  ],

  // Where browser bundles enter this repository, for the browser-imports rule:
  // nothing reachable from these by a value import may import a Node built-in
  // or an undeclared package. These are the sources of the extension's five
  // browser bundles; apps/extension/scripts/check-extension.mjs fails when they
  // stop matching the entries build-extension.mjs bundles.
  //
  // FluxIQ Core's specifiers are owned elsewhere: Core's own copy of this rule
  // walks from the modules this bundle enters Core through, and the same check
  // fails when the bundle enters Core through one Core does not list.
  browserBundles: {
    consumer: "the web extension's browser bundles",
    entries: [
      "apps/extension/src/background/index.ts",
      "apps/extension/src/content/index.ts",
      "apps/extension/src/page-world/index.ts",
      "apps/extension/src/popup/index.ts",
      "apps/extension/src/sidepanel/index.ts"
    ],
    ownedElsewhere: [{ pattern: /^fluxiq(\/|$)/ }, { pattern: /^@fluxiq\// }],
    browserPackages: []
  },

  // Paths whose files build values that must satisfy an external wire
  // contract, where no property may arrive through a spread. TypeScript runs
  // no excess-property check on a property a spread brings in, so a renamed or
  // deleted contract field leaves the wire with every gate green; that defect
  // shipped three times in the page-evidence contract before anyone noticed,
  // and 46 conditional spreads across the two producers below were removed to
  // close it. Each entry is a directory prefix or a single file, and its
  // `reason` and `remedy` go into the message a developer sees.
  //
  // Deliberately not the whole repository: an object spread is idiomatic and
  // harmless nearly everywhere, and there are ~1,460 of them here. What is out,
  // and why. The rest of `apps/extension/src/background/connection/` assembles
  // gateway payloads, runtime status and recording envelopes rather than the
  // evidence contract, and holds 47 spreads that this change does not touch;
  // `domain/src/client/` (the gateway mapping) and
  // `domain/src/runtime/llm-evidence/` (the sanitized downstream packet) are
  // wire-adjacent but would each need their own cleanup before they could be
  // listed; `apps/extension/src/shared/present.ts` itself builds by iterating
  // entries rather than by literal, so a spread there could not name a contract
  // field; `packages/test-runner/` is harness code that produces no contract.
  //
  // Configure a path only once it is clean. The finding is ratcheted like every
  // other rule's and `--update` never adds an entry, so a dirty path stays red
  // until it is fixed rather than being recorded away.
  contractSpreadPaths: [
    {
      path: "apps/extension/src/content/evidence",
      reason: "this directory is the content script's producer of the page-evidence wire contract",
      remedy: "Write each field by name through `present<T>()` (apps/extension/src/shared/present.ts), which omits the ones that are undefined and makes a deleted field a compile error."
    },
    {
      path: "apps/extension/src/background/connection/dom-snapshot.ts",
      reason: "this file is the second producer of that contract, rebuilding and merging every frame's evidence",
      remedy: "Write each field by name through `present<T>()` (apps/extension/src/shared/present.ts): its parameter type requires every contract key to be mentioned, which is what makes the merge exhaustive."
    },
    {
      path: "domain/src/runtime/llm-evidence",
      reason: "this directory builds the sanitized, bounded packet that is the only page data a language model ever sees, and a field that stops arriving there fails nothing -- the model simply reasons with less",
      remedy: "Write each field by name through `present<T>()` (domain/src/runtime/llm-evidence/present.ts), which omits the ones that are undefined and makes a renamed or deleted field a compile error."
    },
    {
      path: "domain/src/page-evidence",
      reason: "this directory is the contract's own home -- its declaration, its wire reader, and the checked-in captures the producers are measured against",
      remedy: "Write each field by name, so a rename here fails to compile rather than changing what the readers silently accept."
    }
  ],

  // Path prefixes whose source must stay neutral about any single domain: the
  // web-vocabulary rule reads every name declared or read under them and fails
  // on a web or DOM word that is not already baselined.
  //
  // Empty here, which makes the rule inert, and it has to be. That rule exists
  // to keep one domain's vocabulary out of the framework every domain shares.
  // This repository *is* that domain: a selector, an xpath, a browser tab, a
  // click and an iframe are its subject matter, and its whole job is to map
  // them onto Core's neutral contracts. A list of paths here would fail on
  // nearly every file and mean nothing.
  //
  // It is mirrored rather than deleted for two reasons. The rule and its tests
  // are byte-identical across the two repositories, so `pnpm structure:test`
  // here proves the copy Core runs is the copy that was tested; and if this
  // repository ever vendors a package that must stay domain-neutral, the guard
  // is already here and needs one path added. Core lists `packages`.
  domainNeutralPaths: [],

  // Path prefixes exempt from the depth limit because a framework dictates
  // their layout. None here; Core exempts its Next.js app router.
  depthExemptPrefixes: [],

  // Filenames (without extension) and directory names that name nothing.
  bannedBasenames: ["utils", "helpers", "misc", "common", "shared-ui"],
  bannedDirectoryNames: ["utils", "helpers", "misc", "common"],

  // Directory prefixes whose Markdown the docs-links rule checks: every local
  // link must resolve to a tracked file, and every `#fragment` to a heading
  // that still exists. Like contractSpreadPaths, a prefix is configured once it
  // is clean -- the finding does not ratchet, so a listed directory stays
  // resolvable rather than accumulating dead links behind a recorded number.
  //
  // All of docs/ is in, and clean: docs/architecture/ and docs/working/ both.
  // Architecture documents exist to tell the next engineer why a rule is there,
  // and a link is how one hands the reader to that reason, so a moved file or a
  // renamed heading loses the reason silently. Working documents are this
  // repository's agent memory, where a link is the only way one agent's finding
  // reaches the next, and they cross-reference far more heavily -- a plan to its
  // briefs, a brief to its reports, a report to another report's finding -- so
  // they rot faster and cost more when they do.
  //
  // docs/working/ was excluded while it held 15 breakages, all in the week-1
  // plan's tree; they were fixed in x4h and this widened to ["docs"], which is
  // what Core already runs. Their four shapes are worth knowing, because each
  // recurs: a path written as if from docs/working/ by a document already inside
  // archive/; a link to a directory holding no README.md; a link to a document
  // that lives in FluxIQ Core, not here, which must read as a cross-repository
  // reference rather than resolve to a local file that happens to exist; and a
  // fragment spelling an em dash in a heading as a double hyphen, when GitHub's
  // slug leaves one. The record is in
  // docs/working/first-class-data-extraction-plan/reports/x4h-working-doc-links.md.
  //
  // The repository root's own Markdown stays out: AGENTS.md links sideways into
  // the FluxIQ Core checkout, which is not this repository's to resolve.
  docsLinkDirs: ["docs"],

  // References that may appear only in the files an entry allows, for the
  // restricted-references rule (mirrored from Core, where the list is empty
  // because Core owns provider calls).
  //
  // Model providers. This repository never calls a model provider: every LLM
  // call goes through Core's gateway with a key held in Core's Secret Keys.
  // Before this entry the only thing that stopped a provider call here was the
  // Lab's runtime network policy (audit finding 12, extension-core boundary
  // audit); a provider URL written into the extension would type-check, test
  // and build clean. The entry covers provider API hosts, provider SDK module
  // specifiers (in code and in every package.json), and the provider key
  // environment variables of scripts/provider-secret-environment.mjs, read as a
  // property (`process.env.X`, `env["X"]`, a destructured key) or written as a
  // string.
  //
  // `allow` lists exact files, each one a place that legitimately names a key
  // or host today, found by running the rule on the tree. Never allow
  // apps/extension or domain/src: neither has any business naming a provider.
  restrictedReferences: [
    {
      name: "model provider",
      imports: [
        /^openai(\/|$)/, /^@openai\//, /^@anthropic-ai\//, /^@ai-sdk\//, /^ai(\/|$)/,
        /^langchain(\/|$)/, /^@langchain\//, /^@google\/generative-ai(\/|$)/, /^@google\/genai(\/|$)/,
        /^@google-cloud\/vertexai(\/|$)/, /^@mistralai\//, /^groq-sdk(\/|$)/, /^cohere-ai(\/|$)/,
        /^ollama(\/|$)/, /^deepseek/i, /^@deepseek/i, /^together-ai(\/|$)/, /^@openrouter\//,
        /^openrouter/i, /^@aws-sdk\/client-bedrock/, /^@azure\/openai(\/|$)/, /^replicate(\/|$)/,
        /^@huggingface\//, /^@fireworks-ai\//, /^llamaindex(\/|$)/
      ],
      strings: [
        /api\.deepseek\.com/i, /api\.openai\.com/i, /api\.anthropic\.com/i, /openrouter\.ai/i,
        /generativelanguage\.googleapis\.com/i, /aiplatform\.googleapis\.com/i, /api\.mistral\.ai/i,
        /api\.groq\.com/i, /api\.together\.(xyz|ai)/i, /api\.x\.ai/i, /api\.cohere\.(ai|com)/i,
        /api\.fireworks\.ai/i, /api\.perplexity\.ai/i, /bedrock-runtime/i, /openai\.azure\.com/i,
        /api-inference\.huggingface\.co/i, /router\.huggingface\.co/i, /api\.replicate\.com/i,
        PROVIDER_KEY_NAME
      ],
      names: [
        PROVIDER_KEY_NAME
      ],
      allow: [
        // The provider-key strip list: the names every Lab child process and
        // build environment is stripped of, so the extension never inherits one.
        "scripts/provider-secret-environment.mjs",
        // The Lab's key-install path into Core's Secret Keys. The runner reads
        // the operator's DeepSeek key once (process environment, then .env,
        // then .env.local) and types it into Core's Secret Keys UI, after which
        // only Core holds it and only Core calls the provider.
        "packages/test-runner/src/live-llm/provider-credential.ts",
        "packages/test-runner/src/secret-keys-ui.ts",
        "scripts/setup-demo-llm-key.mjs",
        // The interactive driver's allowlist of secret environment names it
        // may type into a field -- how an operator's key reaches Core's Secret
        // Keys form without ever being written into a request.
        "packages/test-runner/src/interactive-session.ts",
        // The pair launcher reports whether a live run from the pair would
        // find its key, by source and never by value.
        "scripts/lab/pair/provider-key.mjs",
        // Tests of the files above: they name the key to assert it is read
        // from the right source, carried by name only, and never printed.
        "packages/test-runner/src/live-llm/tests/call-rows.test.ts",
        "packages/test-runner/src/live-llm/tests/canonical-judge-spend.test.ts",
        "packages/test-runner/src/live-llm/tests/core-default-model.test.ts",
        "packages/test-runner/src/live-llm/tests/live-llm-run.test.ts",
        "packages/test-runner/src/live-llm/tests/provider-credential.test.ts",
        "packages/test-runner/src/tests/cli-llm.test.ts",
        "packages/test-runner/src/tests/environment.test.ts",
        "packages/test-runner/src/tests/interactive-session.test.ts",
        "scripts/lab/pair/tests/instructions.test.mjs",
        "scripts/lab/pair/tests/provider-key.test.mjs",
        // Tests the saved-Flow replay's provider-absence check, which names any
        // provider credential set (never its value) so a zero-call replay can
        // refuse to start with one present.
        "packages/test-runner/src/saved-flow-replay/tests/provider-absence.test.ts",
        // The guarded browser's lane network policy admits only the Lab, the
        // panel and the gateway; its test names a provider host to prove a
        // lane's browser can never reach one.
        "packages/test-runner/src/guarded-browser/tests/lane-network-policies.test.ts"
      ],
      reason: "This repository never calls a model provider: every LLM call goes through FluxIQ Core with a key held in Core's Secret Keys, and naming a provider host, SDK or key here is how a direct call starts.",
      remedy: "Ask Core for the model call through the gateway instead; a Lab file that installs a key into Core's Secret Keys belongs in the allow list."
    }
  ],

  workingDocsDir: "docs/working",
  workingDocsIndexKind: "ext"
};
