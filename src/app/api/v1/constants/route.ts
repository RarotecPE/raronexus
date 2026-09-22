import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { ConstantService } from "@/lib/api/services/constant-service";
import { createConstantSchema } from "@/lib/api/validators/constant";

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 90, 60_000, "constants-admin");
    const context = await new AuthService().authenticate(request);
    return ok(await new ConstantService().list(context));
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000, "constants-admin");
    const context = await new AuthService().authenticate(request);
    const input = createConstantSchema.parse(await request.json());
    return ok(await new ConstantService().create(context, input), { status: 201 });
  });
}
