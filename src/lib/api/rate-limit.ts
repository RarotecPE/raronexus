import { ApiException } from "./errors";
import { getClientIp } from "./response";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(request: Request, limit = 120, windowMs = 60_000) {
  const key = getClientIp(request);
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  current.count += 1;
  if (current.count > limit) {
    throw new ApiException(
      "Muitas requisicoes em pouco tempo. Tente novamente em instantes.",
      "RATE_LIMITED",
      429,
    );
  }
}
