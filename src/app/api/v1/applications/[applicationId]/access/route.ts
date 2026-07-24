import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { ApplicationService } from "@/lib/api/services/application-service";
import { AuthService } from "@/lib/api/services/auth-service";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request);
    const { applicationId } = await params;
    const context = await new AuthService().authenticate(request);
    return ok(await new ApplicationService().checkAccess(context, applicationId));
  });
}
