import { HostedCredentialError } from "../failure";
import { credentialTransaction } from "./transaction";

/** One private extension-origin database, with no local/sync or memory substitute. */
export class CredentialDatabase {
  private opening: Promise<IDBDatabase> | undefined;
  private database: IDBDatabase | undefined;
  private closed = false;
  private readonly pending = new Set<Promise<unknown>>();

  constructor(private readonly factory: IDBFactory, private readonly name: string) {}

  async run<T>(mode: IDBTransactionMode, work: (transaction: IDBTransaction) => Promise<T>): Promise<T> {
    if (this.closed) throw new HostedCredentialError("repository_closed");
    const database = await this.open();
    if (this.closed) throw new HostedCredentialError("repository_closed");
    const pending = credentialTransaction(database, mode, work);
    this.pending.add(pending);
    try {
      const result = await pending;
      if (this.closed) throw new HostedCredentialError("repository_closed");
      return result;
    } finally {
      this.pending.delete(pending);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.allSettled([...this.pending]);
    this.database?.close();
  }

  private open(): Promise<IDBDatabase> {
    this.opening ??= new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      let refused = false;
      try { request = this.factory.open(this.name, 1); }
      catch {
        reject(new HostedCredentialError("storage_unavailable"));
        return;
      }
      request.onerror = request.onblocked = () => {
        refused = true;
        reject(new HostedCredentialError("storage_unavailable"));
      };
      request.onupgradeneeded = () => {
        const database = request.result;
        database.createObjectStore("bindings", { keyPath: "key" }).createIndex("installId", "installId", { unique: true });
        database.createObjectStore("mutations", { keyPath: "key" });
        database.createObjectStore("revocations", { keyPath: "key" }).createIndex("bindingKey", "bindingKey");
      };
      request.onsuccess = () => {
        const database = request.result;
        if (refused || this.closed || !["bindings", "mutations", "revocations"].every(name => database.objectStoreNames.contains(name))) {
          database.close();
          reject(new HostedCredentialError(this.closed ? "repository_closed" : "storage_unavailable"));
          return;
        }
        this.database = database;
        database.onversionchange = () => {
          this.closed = true;
          database.close();
        };
        resolve(database);
      };
    });
    return this.opening;
  }
}
