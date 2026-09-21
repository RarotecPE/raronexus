import { z } from "zod";
import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { ConstantService } from "@/lib/api/services/constant-service";
import { updateConstantSchema } from "@/lib/api/validators/constant";

type Params = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 90, 60_000, "constants-admin");
    const context = await new AuthService().authenticate(request);
    const { id } = await params;
    return ok(await new ConstantService().getAdminDetail(context, idSchema.parse(id)));
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000, "constants-admin");
    const context = await new AuthService().authenticate(request);
    const { id } = await params;
    const input = updateConstantSchema.parse(await request.json());
    return ok(await new ConstantService().update(context, idSchema.parse(id), input));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 10, 60_000, "constants-admin");
    const context = await new AuthService().authenticate(request);
    const { id } = await params;
    return ok(await new ConstantService().remove(context, idSchema.parse(id)));
  });
}
