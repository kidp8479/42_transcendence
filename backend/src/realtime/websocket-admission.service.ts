import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { VaultRuntimeService } from "../vault/vault-runtime.service";

export interface WebSocketAdmission {
  active: true;
  sub: string;
  sid: string;
  username: string;
  avatarUrl: string | null;
}

@Injectable()
export class WebSocketAdmissionService {
  private readonly authServiceUrl: string;

  constructor(
    config: ConfigService,
    private readonly vaultRuntime: VaultRuntimeService
  ) {
    this.authServiceUrl = config
      .getOrThrow<string>("AUTH_SERVICE_URL")
      .replace(/\/$/, "");
  }

  async consume(ticket: string): Promise<WebSocketAdmission> {
    const response = await this.request("/auth/internal/ws-ticket/consume", {
      ticket,
    });
    if (!response.ok) {
      throw new Error("WebSocket ticket was rejected");
    }
    const result = (await response.json()) as Partial<WebSocketAdmission>;
    if (
      result.active !== true ||
      typeof result.sub !== "string" ||
      typeof result.sid !== "string" ||
      typeof result.username !== "string" ||
      (result.avatarUrl !== null && typeof result.avatarUrl !== "string")
    ) {
      throw new Error("Auth service returned an invalid WebSocket admission");
    }
    return result as WebSocketAdmission;
  }

  async isSessionActive(subject: string, sessionId: string): Promise<boolean> {
    const response = await this.request(
      "/auth/internal/ws-session/revalidate",
      { sub: subject, sid: sessionId }
    );
    if (response.status === 401) {
      return false;
    }
    if (!response.ok) {
      throw new Error("WebSocket session could not be revalidated");
    }
    const result = (await response.json()) as { active?: unknown };
    if (result.active !== true) {
      throw new Error("Auth service returned an invalid session status");
    }
    return true;
  }

  private request(path: string, body: object): Promise<Response> {
    return fetch(`${this.authServiceUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.vaultRuntime.getInternalToken(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(2000),
    });
  }
}
