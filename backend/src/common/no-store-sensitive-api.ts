import type { Request, Response } from "express";

export function setNoStoreForSensitiveApi(
  request: Request,
  response: Response
) {
  const path = request.path;
  if (
    path.startsWith("/api/public/v1/") ||
    /^\/api\/projects\/[^/]+\/api-tokens(?:\/|$)/.test(path)
  ) {
    response.setHeader("Cache-Control", "no-store");
  }
}
