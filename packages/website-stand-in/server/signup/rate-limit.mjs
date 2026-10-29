// Sliding-window limiter: per client address and in total.
export function createRateLimiter({ perIp, total, windowMs, now = Date.now }) {
  const byIp = new Map();
  let all = [];
  const prune = (list, t) => {
    let i = 0;
    while (i < list.length && list[i] <= t - windowMs) i += 1;
    return i ? list.slice(i) : list;
  };
  return {
    // Counts the attempt when allowed. {ok:true} | {ok:false, retryAfterSec}.
    check(ip) {
      const t = now();
      all = prune(all, t);
      const mine = prune(byIp.get(ip) ?? [], t);
      const full = mine.length >= perIp ? mine : all.length >= total ? all : null;
      if (full) {
        if (mine.length > 0) byIp.set(ip, mine);
        else byIp.delete(ip);
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil(((full[0] ?? t) + windowMs - t) / 1000)) };
      }
      mine.push(t);
      all.push(t);
      byIp.set(ip, mine);
      if (byIp.size > 10_000) {
        for (const [k, v] of byIp) if (prune(v, t).length === 0) byIp.delete(k);
      }
      return { ok: true };
    }
  };
}
