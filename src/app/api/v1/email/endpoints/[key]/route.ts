import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { EmailService } from "@/lib/api/services/email-service";
import { emailEndpointInputSchema, emailEndpointSchema } from "@/lib/api/validators/email";

export async function PUT(request: Request, { params }: { params: Promise<{ key: string }> }) {
  return handleApi(async () => {
    rateLimit(request, 30, 60_000);
    const context = await new AuthService().authenticate(request);
    const { key } = await params;
    const endpointKey = emailEndpointSchema.parse(key);
    const input = emailEndpointInputSchema.parse(await request.json());
    return ok(await new EmailService().updateEndpoint(context, endpointKey, input));
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ key: string }> }) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000);
    const context = await new AuthService().authenticate(request);
    const { key } = await params;
    const endpointKey = emailEndpointSchema.parse(key);
    return ok(await new EmailService().deleteEndpoint(context, endpointKey));
  });
}
