import type { IncomingHttpHeaders } from "http";

export interface AuthenticatedUser {
  id: string;
  sessionId: string;
  authenticationMethod: "LOCAL" | "FORTY_TWO" | "GOOGLE";
  assuranceLevel: number;
  authenticatedAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

export interface AuthenticatedRequest {
  headers: IncomingHttpHeaders;
  method: string;
  user: AuthenticatedUser;
}
