// Reads every stored cell of a SQLite database for a literal, through Node's
// built-in SQLite in a child process, because a byte search misses a literal
// SQLite has split across pages.
export * from "./read-sqlite-stores.js";
