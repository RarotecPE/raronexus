import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { UserService } from "@/lib/api/services/user-service";
import { completeInviteRegistrationSchema } from "@/lib/api/validators/user";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000);
    const input = completeInviteRegistrationSchema.parse(await request.json());
    return ok(await new UserService().completeInviteRegistration(input), { status: 201 });
  });
}
