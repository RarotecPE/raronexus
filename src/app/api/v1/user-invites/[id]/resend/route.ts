import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { UserService } from "@/lib/api/services/user-service";
import { resendInviteSchema } from "@/lib/api/validators/user";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 10, 60_000, "user-invites-resend");
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    const rawBody = await request.text();
    const parsedBody = rawBody.trim() ? resendInviteSchema.parse(JSON.parse(rawBody)) : undefined;
    return ok(await new UserService().resendInvite(context, id, request.url, parsedBody?.expires_in_hours));
  });
}
