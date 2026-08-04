import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { UserService } from "@/lib/api/services/user-service";
import { inviteTokenSchema } from "@/lib/api/validators/user";

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 30, 60_000);
    const url = new URL(request.url);
    const input = inviteTokenSchema.parse({ token: url.searchParams.get("token") ?? "" });
    return ok(await new UserService().validateInvite(input));
  });
}
