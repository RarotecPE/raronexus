import { z } from "zod";
import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { ConstantService } from "@/lib/api/services/constant-service";
import { updateConstantSchema } from "@/lib/api/validators/constant";
import { auditClient, getRequestContext } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };
const idSchema = z.string().uuid();

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 90, 60_000, "constants-admin");
    const context = await new AuthService().authenticate(request);
    const { id } = await params;
    return ok(await new ConstantService().getAdminDetail(context, idSchema.parse(id)));
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000, "constants-admin");
    const context = await new AuthService().authenticate(request);
    const { id } = await params;
    const validId = idSchema.parse(id);
    const input = updateConstantSchema.parse(await request.json());
    const existing = await new ConstantService().getSummary(context, validId);
    const updated = await new ConstantService().update(context, validId, input);

    auditClient.log({
      system: "raronexus",
      category: "constants",
      action: "constant.versioned",
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
          type: "constant",
          id: updated.id,
          label: updated.name,
        },
      ],
      context: getRequestContext(request),
      diff: {
        before: {
          name: existing.name,
          is_public: existing.is_public,
          version: existing.current_version,
          content_hash: existing.content_hash,
          original_size: existing.original_size,
        },
        after: {
          name: updated.name,
          is_public: updated.is_public,
          version: updated.current_version,
          content_hash: updated.content_hash,
          original_size: updated.original_size,
        },
      },
      details: {
        name: updated.name,
        previous_version: existing.current_version,
        current_version: updated.current_version,
        is_public: updated.is_public,
      },
    });

    return ok(updated);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 10, 60_000, "constants-admin");
    const context = await new AuthService().authenticate(request);
    const { id } = await params;
    const validId = idSchema.parse(id);
    const existing = await new ConstantService().getSummary(context, validId);
    const result = await new ConstantService().remove(context, validId);

    auditClient.log({
      system: "raronexus",
      category: "constants",
      action: "constant.deleted",
      severity: "WARNING",
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
          type: "constant",
          id: validId,
          label: existing.name,
        },
      ],
      context: getRequestContext(request),
      details: {
        name: existing.name,
        last_version: existing.current_version,
      },
    });

    return ok(result);
  });
}
