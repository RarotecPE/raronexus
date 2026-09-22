import { NextResponse } from "next/server";
import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ConstantService } from "@/lib/api/services/constant-service";
import { CONSTANT_NAME_PATTERN } from "@/lib/api/validators/constant";
import { ApiException } from "@/lib/api/errors";

type Params = { params: Promise<{ name: string }> };

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    const { name } = await params;
    if (!CONSTANT_NAME_PATTERN.test(name) || name === "_content" || name === "content") {
      throw new ApiException("Nome de constante inválido.", "INVALID_CONSTANT_NAME", 400);
    }

    const service = new ConstantService();
    const constant = await service.resolveByName(name);
    if (constant.is_public) {
      rateLimit(request, 300, 60_000, "constants-public");
    } else {
      const identity = await service.authenticatePrivateConsumer(request);
      rateLimit(request, 180, 60_000, "constants-private", identity);
    }

    const target = new URL(
      `/api/constants/content/${constant.id}/${constant.current_version}`,
      request.url,
    );
    const response = NextResponse.redirect(target, 307);
    response.headers.set("Cache-Control", "no-store");
    if (constant.is_public) response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  });
}
