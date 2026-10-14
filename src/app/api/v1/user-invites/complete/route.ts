import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { UserService } from "@/lib/api/services/user-service";
import { completeInviteRegistrationSchema } from "@/lib/api/validators/user";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000);
    const input = completeInviteRegistrationSchema.parse(await request.json());
    const result = await new UserService().completeInviteRegistration(input);

    auditClient.log({
      system: "raronexus",
      category: "users",
      action: "user.invite_completed",
      severity: "INFO",
      status: "SUCCESS",
      actor: {
        type: "user",
        userId: result.id,
        name: result.nome ?? result.email,
        email: result.email,
        role: result.is_admin ? "admin" : "user",
      },
      targets: [
        {
          type: "user",
          id: result.id,
          label: result.nome ?? result.email,
        },
      ],
      context: getRequestContext(request),
      details: {
        email: result.email,
      },
    });

    return ok(result, { status: 201 });
  });
}
