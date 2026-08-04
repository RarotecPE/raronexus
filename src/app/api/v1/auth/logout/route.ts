import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { GLOBAL_SESSION_COOKIE_NAME, GlobalSessionService } from "@/lib/api/services/global-session-service";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 60, 60_000);
    const service = new GlobalSessionService();
    const token = service.getTokenFromCookie(request);
    const result = token ? await service.revokeToken(token) : { revoked: false };
    const response = ok(result);
    response.cookies.delete(GLOBAL_SESSION_COOKIE_NAME);
    return response;
  });
}
