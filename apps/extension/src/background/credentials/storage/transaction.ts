import { HostedCredentialError } from "../failure";

/** Work may await IDB requests only; cryptography and external I/O precede the transaction. */
export function credentialTransaction<T>(database: IDBDatabase, mode: IDBTransactionMode, work: (transaction: IDBTransaction) => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try { transaction = database.transaction(["bindings", "mutations", "revocations"], mode, { durability: "strict" }); }
    catch {
      reject(new HostedCredentialError("storage_unavailable"));
      return;
    }
    let failure: HostedCredentialError | undefined;
    let result: T;
    let finished = false;
    transaction.oncomplete = () => finished ? resolve(result) : reject(new HostedCredentialError("storage_unavailable"));
    transaction.onabort = () => reject(failure ?? new HostedCredentialError("storage_unavailable"));
    transaction.onerror = () => { failure ??= new HostedCredentialError("storage_unavailable"); };
    Promise.resolve().then(() => work(transaction)).then(value => {
      result = value;
      finished = true;
    }, error => {
      failure = error instanceof HostedCredentialError ? error : new HostedCredentialError("storage_unavailable");
      try { transaction.abort(); }
      catch { reject(failure); }
    });
  });
}
