# t745-u1-keyring report

## Outcome

Done. Each project now gets its own content-address keyring in Core worktree
`C:/Users/osrs_/FluxStuff/fxwork/t745/!FluxIQ` (branch `task/t745-keyed-content-addresses`), as design
note D1, D3 and D6 describe. Nothing was committed.

P = `packages/fluxiq/src/programs/automation-studio/storage/project/`.

## What changed and why

New directory `P/content-address/`. Each file exports one thing, and the directory has its own barrel:

- `migration.ts`: `AUTOMATION_STUDIO_CONTENT_ADDRESS_MIGRATION`, id `0033_content_addresses`.
  - Table `content_address_keys`, with the columns the brief listed. `key_id` has a CHECK that it is `cak.`
    followed by 16 lower hex, and `encryption` has a CHECK that it is non-empty.
  - At most one current key: a partial unique index
    `content_address_keys_current_idx on ((retired_at_ms is null)) where retired_at_ms is null`.
  - `objects.content_address` has a CHECK that it is null or 64 lower hex.
  - `objects.content_address_key_id` has a CHECK `(content_address is null) = (content_address_key_id is null)`.
    SQLite 3.52.0 (the bundled `sqlite3`) accepts a CHECK that names another column on `add column`. I tested
    this first and the migration test covers it, so the both-null-or-both-set rule is in the schema, not in code.
  - Index `objects_content_address_idx` is non-unique and only covers rows with an address.
  - Index `objects_sealed_unaddressed_idx` is on `(object_id)` where `encryption is not null and content_address is null`.
- `key-media-type.ts`: `AUTOMATION_STUDIO_CONTENT_ADDRESS_KEY_MEDIA_TYPE = "application/vnd.fluxiq.content-address-key"`.
- `keyring.ts`: the class `AutomationStudioContentAddressKeyring` and the closed union type
  `AutomationStudioContentAddressDomain` (the union sits beside the class, which is the only thing that uses it).
  - Public members: `projectId`, `currentKeyId`, `holds`, `address`, `addressWith`.
  - Keys sit in a `#keys` private field. The constructor makes its own copies and requires each key to be exactly
    32 bytes and the current key to be held.
  - Addresses are HMAC-SHA256 over u32-BE length-prefixed fields: `fluxiq.content-address.v1`, domain, projectId,
    context (`""` when absent), content. Content may be bytes or a UTF-8 string.
  - At runtime the domain is checked against a `Record` of all domains, so the compiler fails if a domain is
    added to the union but not to the check.
  - `toJSON` and `util.inspect.custom` show the project id, the current key id, the key ids and
    `keys: "[redacted]"`.
  - Errors name only a key id, or no value at all.
- `keyring-input.ts`: the shared input type `AutomationStudioContentAddressKeyringInput`
  (`{ database, projectId, protection, now? }`) and `assertContentAddressKeyringInput`.
  - The check refuses a `database` whose `projectId` differs from `projectId`. **This is an addition the brief
    did not ask for.**
- `new-key-row.ts` (internal, not exported from the barrel): `sealNewContentAddressKey` and
  `insertContentAddressKeyRow`.
  - The key id is `cak.` plus 16 random hex. The key is `randomBytes(32)`, sealed with `protection.seal` under the
    key media type, and zeroed in a `finally`.
  - Two refusals: a seal result with an empty envelope, and a sealed form that still contains the raw key (this
    guards against a provider that does not actually encrypt).
- `open-keyring.ts`: `openAutomationStudioContentAddressKeyring`.
  - It loads all key rows. If none is current, it seals a new key outside the transaction. Then, inside
    `database.transaction` (`begin immediate`), it checks again for a current row and inserts only if there is
    none.
  - It always reloads the rows afterwards and uses what is stored, so concurrent creators end up on the same key.
    The generated key is never kept.
  - Every row, retired ones included, is opened with `protection.open`. If any row fails to open it throws
    `Content address key <id> could not be opened.`, without passing on the provider's error as a cause. If a
    row is not 32 bytes it is zeroed and the open throws.
  - The temporary key buffers are zeroed in a `finally` once the keyring has made its copies.
- `rotate-key.ts`: `rotateAutomationStudioContentAddressKey` returns `{ keyId }`.
  - The new key is sealed first. Then one transaction sets `retired_at_ms = now` on the current row and inserts
    the new current row.
  - Nothing is ever deleted.
- `index.ts`: re-exports the migration, the media type, the keyring and domain type, the input type (type-only),
  open and rotate.
- `P/index.ts`: appended one line, `export * from "./content-address/index.ts";`.

The tests in `P/content-address/tests/` were written before the code:

- `keyring-fixture.ts`: test support. It provides a project database on its own pool, migrated with the
  administration migrations plus 0033, AES-GCM protections over synthetic keys, and a way to recover the raw
  address key through the protection.
- `keyring.test.ts`: marked `// @fluxiq-test-group real-sql`, 11 tests, covering:
  - a fresh project creates exactly one key, and reopening loads the same key and gives the same addresses;
  - the address matches an HMAC the test computes independently, which pins the framing;
  - six concurrent opens across two connections end up with one key and one row;
  - the same content gets different addresses in two projects that share one host key;
  - a key row copied into another project's database fails, naming only the key id, with no cause attached;
  - with no host key, nothing is created; with no key, the wrong key bytes or the wrong host key id, opening an
    existing project fails closed;
  - a database belonging to a different project is refused by both open and rotate;
  - the raw keys (bytes, hex and base64) appear in no file in the project directory, after a rotation;
  - domains and contexts give different addresses, field boundaries cannot be confused, and an unknown domain
    throws;
  - after rotation, `addressWith` under the retired key equals the address from before the rotation, `address`
    gives a different one, and a stale keyring refuses the new key id;
  - `JSON.stringify`, `inspect` with `showHidden` and `depth: Infinity`, and the not-held error contain neither
    the key bytes nor the content;
  - the migration's constraints and indexes behave as specified.

## Commands run and observed results

- From `packages/fluxiq`: `pnpm exec vitest run src/programs/automation-studio/storage/project/content-address`
  printed `Test Files  1 passed (1)` and `Tests  11 passed (11)`.
  - Before that, the first run failed one test, `SQLITE_CONSTRAINT: UNIQUE constraint failed: objects.sha256`.
    The test fixture had used the same `sha256` for every object; I gave each object its own.
- From `packages/fluxiq`: `pnpm exec tsc --noEmit -p .` printed nothing, and `tsc exit=0`.
  - The first run had found three TS2339 errors in a test's `.catch` narrowing. I fixed them and reran.
- From the worktree root: `node scripts/structure-audit.mjs` printed
  `structure-audit: passed (429 warning(s), 1152 baselined).` and exit 0.
  - None of the warnings mention a `content-address` file. I checked this with the `--json` output.
  - The one "baseline entries can be lowered" note is about `automation-studio/runtime/service.ts`
    (4316 lines against a recorded 4318), which is not a file I touched.

## Not verified

- I did not run the whole package suite or `pnpm check`. Under the repository's rule, those run as the
  twice-daily sweep.
- The migration is not yet in any store's migration list. The brief says the caller runs 0033, and later units
  own the stores that will list it.
- Convergence was tested across two connections in one process. Two separate OS processes were not exercised.
  They rely on the same `begin immediate` and the same unique index.
- A custom provider that returns a key of the wrong length is covered by code, but no test exercises it.

## Open questions or contradictions found

- The project-match guard (`database.projectId` must equal `projectId`) is my addition, not in the brief. If
  later units ever pass a database from a different project on purpose, they would need to remove it.
- `rotate` on a project that has no key yet simply inserts the first key. Nothing in the brief asked rotate to
  refuse that, so it does not.
- `objects.content_address_key_id` has no foreign key to `content_address_keys`. The brief did not ask for one,
  and keys are never deleted, so I left it to u2 to decide.
