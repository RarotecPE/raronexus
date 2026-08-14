import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { EmailService } from "@/lib/api/services/email-service";
import { sendEmailSchema } from "@/lib/api/validators/email";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 60, 60_000);
    const input = sendEmailSchema.parse(await request.json());
    return ok(await new EmailService().sendFromApplication(request, input));
  });
}
