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

export type ProjectApiTokenPermission = "READ" | "READ_WRITE";

export interface ProjectApiTokenPrincipal {
  principalType: "PROJECT_API_TOKEN";
  tokenId: string;
  projectId: string;
  permission: ProjectApiTokenPermission;
}

export interface ProjectApiTokenRequest {
  headers: IncomingHttpHeaders;
  method: string;
  apiToken: ProjectApiTokenPrincipal;
}

// Machine writes are deliberately distinct from browser users. In particular,
// a project token must never be represented by a made-up User UUID.
export interface MachineTaskMutationActor {
  kind: "MACHINE";
  tokenId: string;
}
