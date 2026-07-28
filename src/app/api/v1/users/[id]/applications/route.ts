import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { ApplicationService } from "@/lib/api/services/application-service";
import { AuthService } from "@/lib/api/services/auth-service";
import { updateUserApplicationAssignmentsSchema } from "@/lib/api/validators/application";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request);
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    return ok(await new ApplicationService().listUserApplications(context, id));
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    const input = updateUserApplicationAssignmentsSchema.parse(await request.json());
    return ok(await new ApplicationService().updateUserApplications(context, id, input));
  });
}
