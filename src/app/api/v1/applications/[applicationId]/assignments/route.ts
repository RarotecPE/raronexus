import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { ApplicationService } from "@/lib/api/services/application-service";
import { AuthService } from "@/lib/api/services/auth-service";
import { updateApplicationAssignmentsSchema } from "@/lib/api/validators/application";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request);
    const { applicationId } = await params;
    const context = await new AuthService().authenticate(request);
    return ok(await new ApplicationService().listAssignments(context, applicationId));
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const { applicationId } = await params;
    const context = await new AuthService().authenticate(request);
    const input = updateApplicationAssignmentsSchema.parse(await request.json());
    return ok(await new ApplicationService().updateAssignments(context, applicationId, input));
  });
}
