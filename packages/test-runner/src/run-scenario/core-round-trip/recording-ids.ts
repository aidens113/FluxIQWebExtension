/**
 * The recording ids in a Core `list_recordings` response, whatever shape that
 * response arrived in.
 *
 * Core has answered this call as `payload.recordings`, as `payload.items` and as
 * a bare `payload` array across versions, and an item has carried its id as both
 * `recordingId` and `id`. A reader that knew only one shape did not fail: it
 * returned an empty set, which reads exactly like "this project has no
 * recordings" and let a run conclude that Core had persisted nothing. So every
 * shape is accepted here, and a response in none of them still yields an empty
 * set -- the caller compares against a baseline and fails on the count, which is
 * where that answer becomes a real failure with a message.
 */
export function recordingIds(response: any): Set<string> {
  const values = response?.payload?.recordings ?? response?.payload?.items ?? response?.payload;
  if (!Array.isArray(values)) return new Set();
  return new Set(values.flatMap((item: any) => {
    const id = item?.recordingId ?? item?.id;
    return typeof id === "string" && id ? [id] : [];
  }));
}
