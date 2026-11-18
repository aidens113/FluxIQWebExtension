import { IDBFactory } from "fake-indexeddb";

/** Test-only inspection/corruption of an isolated fake database, never browser storage. */
export function rawStore(factory: IDBFactory, name: string, storeName: string, update?: (rows: Record<string, unknown>[]) => Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const opening = factory.open(name, 1);
    opening.onerror = () => reject(new Error("Test database open failed."));
    opening.onsuccess = () => {
      const database = opening.result;
      const transaction = database.transaction([storeName], update ? "readwrite" : "readonly");
      let rows: Record<string, unknown>[] = [];
      transaction.onabort = () => {
        database.close();
        reject(new Error("Test database transaction failed."));
      };
      transaction.oncomplete = () => {
        database.close();
        resolve(rows);
      };
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        rows = request.result as Record<string, unknown>[];
        if (update) for (const row of update(rows)) store.put(row);
      };
    };
  });
}
