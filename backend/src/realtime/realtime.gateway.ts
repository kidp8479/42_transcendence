import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { ConfigService } from "@nestjs/config";
import { Socket, Server } from "socket.io";
import { VaultRuntimeService } from "../vault/vault-runtime.service";
import { ProjectsService } from "../projects/projects.service";

// TEMPORARY auth: validates the socket using the same session cookie +
// introspection endpoint as AuthGuard (backend/src/auth/auth.guard.ts),
// deliberately duplicated instead of shared. Andrei's WebSocket ticket
// system (auth ticket 7.7) will replace this entirely - delete this
// check once that lands, don't extract/reuse it in the meantime.
// nginx.conf only routes "/ws" to the backend (Socket.io's default path is
// "/socket.io", which nginx never forwards) - without this, no client could
// ever reach this gateway through nginx.
@WebSocketGateway({ path: "/ws" })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly configService: ConfigService,
    private readonly vaultRuntime: VaultRuntimeService,
    private readonly projectsService: ProjectsService
  ) {}

  @WebSocketServer() server: Server;

  async handleConnection(client: Socket): Promise<void> {
    const appOrigin = this.configService.getOrThrow<string>("APP_ORIGIN");
    if (appOrigin !== client.handshake.headers.origin) {
      client.disconnect(true);
      return;
    }
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

    client.data.userId = result.userId;

    // WS-specific logic starts here: auth above is just "who is this",
    // this part is "what should this connection receive". Joining a room
    // per project means we can later broadcast to everyone on a project
    // (client.join is the same Socket.io method any future feature will use).
    const projects = await this.projectsService.findAll(result.userId);
    for (const project of projects) {
      await client.join(`project:${project.id}`);
    }
    await client.join(`user:${result.userId}`);
  }

  handleDisconnect(): void {
    // nothing to do here - Socket.io removes a disconnected socket from
    // every room it had joined automatically.
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
