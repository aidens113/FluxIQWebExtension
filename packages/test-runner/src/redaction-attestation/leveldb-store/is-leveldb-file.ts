/**
 * The files a LevelDB database directory holds: its write-ahead logs
 * (`000003.log`), its sorted tables (`000005.ldb`, or `.sst` from older
 * writers), its manifests (`MANIFEST-000001`), and `CURRENT`, `LOCK`, `LOG` and
 * `LOG.old`. The logs and tables are binary, so the text scan would fail closed
 * on them; they are searched byte for byte instead (`searchLevelDbFile`).
 */
const levelDbFileName = /^(?:\d+\.(?:log|ldb|sst)|MANIFEST-\d+|CURRENT|LOCK|LOG(?:\.old)?)$/u;

/** Whether a file's base name is one a LevelDB database directory holds. */
export function isLevelDbFile(baseName: string): boolean {
  return levelDbFileName.test(baseName);
}
