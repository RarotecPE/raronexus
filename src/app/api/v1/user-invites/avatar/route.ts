import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { UserService } from "@/lib/api/services/user-service";
import { inviteTokenSchema } from "@/lib/api/validators/user";
import { ApiException } from "@/lib/api/errors";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000);
    const formData = await request.formData();
    const input = inviteTokenSchema.parse({ token: formData.get("token") });
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiException("Arquivo nao informado.", "FILE_REQUIRED", 422);
    }

    return ok(await new UserService().uploadInviteAvatar(input, file));
  });
}
