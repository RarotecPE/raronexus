import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { EmailService } from "@/lib/api/services/email-service";
import { emailEndpointSchema, sendEmailSchema } from "@/lib/api/validators/email";

export async function POST(request: Request, { params }: { params: Promise<{ endpoint: string }> }) {
  return handleApi(async () => {
    rateLimit(request, 60, 60_000);
    const { endpoint } = await params;
    const endpointKey = emailEndpointSchema.parse(endpoint);
    const input = sendEmailSchema.parse(await request.json());
    return ok(await new EmailService().sendFromApplication(request, input, endpointKey));
  });
}
