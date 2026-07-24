import { NextResponse } from "next/server";
import type { ApiError, ApiSuccess } from "./types";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data }, init);
}

export function fail(message: string, code = "ERROR", status = 400) {
  return NextResponse.json<ApiError>(
    { success: false, message, code },
    { status },
  );
}

export function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
