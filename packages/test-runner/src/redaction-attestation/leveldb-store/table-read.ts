/** What `tableBlocks` read from a sorted table: every data block decompressed, or why it could not. */
export type TableRead = { decoded: true; blocks: Buffer[] } | { decoded: false; reason: string };
