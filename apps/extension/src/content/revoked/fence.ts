// What makes a command's reply safe across a revocation. A reply begun before
// the document was revoked and finished after it is dropped for the page-free
// refusal: the page it was read from is no longer one FluxIQ may report.

import type { ContentRoute } from "../own-document";
import { revokedEpoch } from "./epoch";
import { contentRevokedRefusal } from "./refusal";

/**
 * `route` with its reply fenced. A command answered after a revocation is
 * refused without starting (`before-dispatch`); one begun before it and
 * finishing after it is answered `interrupted`, whatever it computed. The
 * liveness ping and the revocation itself are never fenced.
 */
export function revokedFence(route: ContentRoute): ContentRoute {
  return {
    answer: (sendResponse) => {
      const begunAt = revokedEpoch.current();
      if (begunAt > 0) {
        sendResponse(contentRevokedRefusal("before-dispatch"));
        return;
      }
      route.answer((response) => {
        sendResponse(revokedEpoch.current() === begunAt ? response : contentRevokedRefusal("interrupted"));
      });
    }
  };
}
