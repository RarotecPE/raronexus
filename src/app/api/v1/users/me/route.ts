import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { UserService } from "@/lib/api/services/user-service";
import { profileSchema } from "@/lib/api/validators/user";

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request);
    const context = await new AuthService().authenticate(request);
    return ok(await new UserService().me(context));
  });
}

export async function PUT(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = profileSchema.parse(await request.json());
    return ok(await new UserService().updateMe(context, input));
  });
}
