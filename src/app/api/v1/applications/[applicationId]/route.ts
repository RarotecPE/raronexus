import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { ApplicationService } from "@/lib/api/services/application-service";
import { AuthService } from "@/lib/api/services/auth-service";
import { updateApplicationSchema } from "@/lib/api/validators/application";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function PUT(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000);
    const { applicationId } = await params;
    const context = await new AuthService().authenticate(request);
    const input = updateApplicationSchema.parse(await request.json());
    return ok(await new ApplicationService().update(context, applicationId, input));
  });
}
