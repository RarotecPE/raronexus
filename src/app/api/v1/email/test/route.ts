import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { ApplicationRepository } from "@/lib/api/repositories/application-repository";
import { AuthService } from "@/lib/api/services/auth-service";
import { EmailService } from "@/lib/api/services/email-service";
import { adminEmailTestSchema } from "@/lib/api/validators/email";
import { auditClient, getRequestContext } from "@/lib/audit";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = adminEmailTestSchema.parse(await request.json());
    const result = await new EmailService().testFromAdmin(context, input);
    const application = await new ApplicationRepository(createAdminSupabaseClient()).findById(input.application_id);

    auditClient.log({
      system: "raronexus",
      category: "email",
      action: "email.test_sent",
      severity: "INFO",
      status: "SUCCESS",
      actor: {
        type: "user",
        userId: context.profile?.id ?? context.authUserId,
        name: context.profile?.nome ?? context.email,
        email: context.profile?.email ?? context.email,
        role: context.profile?.is_admin ? "admin" : "user",
      },
      targets: [
        {
          type: "application",
          id: input.application_id,
          label: application?.nome ?? input.application_id,
        },
      ],
      context: getRequestContext(request),
      details: {
        to: input.to,
        application_id: input.application_id,
        message_id: result.message_id,
      },
    });

    return ok(result);
  });
}
