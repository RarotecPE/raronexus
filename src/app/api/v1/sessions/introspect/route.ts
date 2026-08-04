import { z } from "zod";
import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { GlobalSessionService } from "@/lib/api/services/global-session-service";

const introspectSchema = z.object({
  token: z.string().min(32),
  client_id: z.string().min(1),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 180, 60_000);
    const input = introspectSchema.parse(await request.json());
    return ok(await new GlobalSessionService().introspect(input));
  });
}
