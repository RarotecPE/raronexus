import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { UserService } from "@/lib/api/services/user-service";
import { createUserSchema } from "@/lib/api/validators/user";

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request);
    const context = await new AuthService().authenticate(request);
    const url = new URL(request.url);
    return ok(await new UserService().list(context, url.searchParams.get("search") ?? undefined));
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = createUserSchema.parse(await request.json());
    return ok(await new UserService().create(context, input), { status: 201 });
  });
}
