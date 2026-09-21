import { z } from "zod";
import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ConstantService } from "@/lib/api/services/constant-service";

type Params = { params: Promise<{ constantId: string; version: string }> };
const idSchema = z.string().uuid();
const versionSchema = z.coerce.number().int().positive();
const PUBLIC_CACHE_SECONDS = 15 * 24 * 60 * 60;

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    const rawParams = await params;
    const constantId = idSchema.parse(rawParams.constantId);
    const versionNumber = versionSchema.parse(rawParams.version);
    const service = new ConstantService();
    const { constant, version } = await service.getVersion(constantId, versionNumber);

    if (constant.is_public) {
      rateLimit(request, 600, 60_000, "constants-public-content");
    } else {
      const identity = await service.authenticatePrivateConsumer(request);
      rateLimit(request, 240, 60_000, "constants-private-content", identity);
    }

    const etag = `"${version.content_hash}"`;
    const commonHeaders: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      ETag: etag,
      "X-Constant-Version": String(version.version),
      "X-Constant-Hash": version.content_hash,
      "X-Constant-Name": constant.name,
      "Cache-Control": constant.is_public
        ? `public, max-age=${PUBLIC_CACHE_SECONDS}, s-maxage=${PUBLIC_CACHE_SECONDS}, immutable`
        : "private, no-store",
    };
    if (constant.is_public) commonHeaders["Access-Control-Allow-Origin"] = "*";

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: commonHeaders });
    }

    const content = await service.readContent(version.storage_path, version.content_hash);
    return new Response(content, { status: 200, headers: commonHeaders });
  });
}
