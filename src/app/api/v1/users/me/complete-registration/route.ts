import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { UserService } from "@/lib/api/services/user-service";
import { completeRegistrationSchema } from "@/lib/api/validators/user";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function PUT(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = completeRegistrationSchema.parse(await request.json());
    const updated = await new UserService().completeRegistration(context, input);

    auditClient.log({
      system: "raronexus",
      category: "users",
      action: "user.registration_completed",
      severity: "INFO",
      status: "SUCCESS",
      actor: {
        type: "user",
        userId: updated.id,
        name: updated.nome ?? updated.email,
        email: updated.email,
        role: updated.is_admin ? "admin" : "user",
      },
      targets: [
        {
          type: "user",
          id: updated.id,
          label: updated.nome ?? updated.email,
        },
      ],
      context: getRequestContext(request),
      details: {
        email: updated.email,
        nome: updated.nome,
      },
    });

    return ok(updated);
  });
}
