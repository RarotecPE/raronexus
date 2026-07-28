import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { UserService } from "@/lib/api/services/user-service";
import { updateUserSchema } from "@/lib/api/validators/user";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request);
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    return ok(await new UserService().find(context, id));
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    const input = updateUserSchema.parse(await request.json());
    return ok(await new UserService().update(context, id, input));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    return ok(await new UserService().deactivate(context, id));
  });
}
