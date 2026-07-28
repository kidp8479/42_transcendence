import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from "@nestjs/websockets";
import { ConfigService } from "@nestjs/config";
import { Socket } from "socket.io";
import { VaultRuntimeService } from "../vault/vault-runtime.service";

// TEMPORARY auth: validates the socket using the same session cookie +
// introspection endpoint as AuthGuard (backend/src/auth/auth.guard.ts),
// deliberately duplicated instead of shared. Andrei's WebSocket ticket
// system (auth ticket 7.7) will replace this entirely - delete this
// check once that lands, don't extract/reuse it in the meantime.
@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly configService: ConfigService,
    private readonly vaultRuntime: VaultRuntimeService
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const sessionCookieName = this.configService.getOrThrow<string>(
      "AUTH_SESSION_COOKIE"
    );
    const sessionToken = readCookie(
      client.handshake.headers.cookie,
      sessionCookieName
    );
    if (!sessionToken) {
      client.disconnect(true);
      return;
    }

    const authServiceUrl =
      this.configService.getOrThrow<string>("AUTH_SERVICE_URL");
    let response: Response;
    try {
      response = await fetch(`${authServiceUrl}/auth/internal/introspect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.vaultRuntime.getInternalToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionToken,
          requestMethod: "GET",
          origin: client.handshake.headers.origin,
        }),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      client.disconnect(true);
      return;
    }

    if (!response.ok) {
      client.disconnect(true);
      return;
    }

    const result = (await response.json()) as {
      active?: boolean;
      userId?: string;
    };
    if (result.active !== true || typeof result.userId !== "string") {
      client.disconnect(true);
      return;
    }

    // stored for brick 3 (joining project rooms based on this user's memberships)
    client.data.userId = result.userId;
  }

  handleDisconnect(): void {
    // nothing required yet, room cleanup is handled by brick 3
  }
}

function readCookie(
  cookieHeader: string | undefined,
  cookieName: string
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const name = part.slice(0, separator).trim();
    if (name === cookieName) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
