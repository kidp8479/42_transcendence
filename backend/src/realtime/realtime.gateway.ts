import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { ConfigService } from "@nestjs/config";
import { Socket, Server } from "socket.io";
import { VaultRuntimeService } from "../vault/vault-runtime.service";
import { ProjectsService } from "../projects/projects.service";
import { PrismaService } from "../prisma/prisma.service";

interface FieldLock {
  userId: string;
  username: string;
  avatarUrl: string | null;
  // so handleDisconnect knows which room to broadcast field:unlocked to
  projectId: string;
}

@WebSocketGateway({ path: "/ws" })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly configService: ConfigService,
    private readonly vaultRuntime: VaultRuntimeService,
    private readonly projectsService: ProjectsService,
    private readonly prisma: PrismaService
  ) {}

  @WebSocketServer() server: Server;

  // those 3 methods are used for websocket, defining "priority" when someone edits the same resource
  // map to store all the locks, private because mutable
  private locks = new Map<string, FieldLock>();

  // grabs the lock for key, only if nobody else already has it
  private acquireLock(key: string, lock: FieldLock): boolean {
    if (this.locks.has(key)) {
      return false;
    } else {
      this.locks.set(key, lock);
      return true;
    }
  }

  // releases key, but only if userId is the one actually holding it
  private releaseLock(key: string, userId: string): void {
    const lock = this.locks.get(key);
    if (lock == undefined) {
      return;
    }
    if (lock.userId === userId) {
      this.locks.delete(key);
    }
  }

  // who's currently editing key, if anyone
  private getLock(key: string): FieldLock | undefined {
    return this.locks.get(key);
  }

  // TEMPORARY auth: validates the socket using the same session cookie +
  // introspection endpoint as AuthGuard (backend/src/auth/auth.guard.ts),
  // deliberately duplicated instead of shared. Andrei's WebSocket ticket
  // system (auth ticket 7.7) will replace this entirely - delete this
  // check once that lands, don't extract/reuse it in the meantime.
  // nginx.conf only routes "/ws" to the backend (Socket.io's default path is
  // "/socket.io", which nginx never forwards) - without this, no client could
  // ever reach this gateway through nginx.
  async handleConnection(client: Socket): Promise<void> {
    const appOrigin = this.configService.getOrThrow<string>("APP_ORIGIN");
    // Only enforce a match when Origin is actually sent. Socket.io's first
    // handshake goes through plain HTTP long-polling, and browsers don't
    // set Origin on a same-origin fetch/XHR - only cross-origin requests
    // reliably carry it, which is exactly the case this check needs to
    // catch. Rejecting on a missing header blocked every real connection.
    const origin = client.handshake.headers.origin;
    if (origin !== undefined && origin !== appOrigin) {
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

    // cached on the socket, avoids a DB query on every field:lock message
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: { username: true, avatarUrl: true },
    });
    client.data.username = user.username;
    client.data.avatarUrl = user.avatarUrl;

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

  // locks live in our own Map, not Socket.io's room state - release them
  // here or a dropped connection leaves them stuck forever
  handleDisconnect(@ConnectedSocket() client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (userId === undefined) {
      return;
    }
    for (const [key, lock] of this.locks) {
      if (lock.userId === userId) {
        this.locks.delete(key);
        this.server
          .to(`project:${lock.projectId}`)
          .emit("field:unlocked", { key });
      }
    }
  }

  // client wants to start editing key - rejects if client isn't a member
  // of body.projectId, same rule as every REST controller in the app
  @SubscribeMessage("field:lock")
  async handleFieldLock(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId: string; key: string }
  ): Promise<{ locked: boolean; lock: FieldLock | undefined }> {
    const userId = client.data.userId as string;
    if (!(await this.isMember(body.projectId, userId))) {
      return { locked: false, lock: undefined };
    }

    const lock: FieldLock = {
      userId,
      username: client.data.username as string,
      avatarUrl: client.data.avatarUrl as string | null,
      projectId: body.projectId,
    };

    const locked = this.acquireLock(body.key, lock);
    if (locked) {
      this.server
        .to(`project:${body.projectId}`)
        .emit("field:locked", { key: body.key, lock });
    }

    return { locked, lock: this.getLock(body.key) };
  }

  // client is done editing key
  @SubscribeMessage("field:unlock")
  async handleFieldUnlock(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId: string; key: string }
  ): Promise<void> {
    const userId = client.data.userId as string;
    if (!(await this.isMember(body.projectId, userId))) {
      return;
    }

    const lock = this.getLock(body.key);
    if (lock === undefined || lock.userId !== userId) {
      return;
    }

    this.releaseLock(body.key, userId);
    this.server
      .to(`project:${body.projectId}`)
      .emit("field:unlocked", { key: body.key });
  }

  // for a client opening something that was already locked before it connected
  @SubscribeMessage("field:query")
  async handleFieldQuery(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId: string; key: string }
  ): Promise<{ lock: FieldLock | undefined }> {
    const userId = client.data.userId as string;
    if (!(await this.isMember(body.projectId, userId))) {
      return { lock: undefined };
    }
    return { lock: this.getLock(body.key) };
  }

  private async isMember(projectId: string, userId: string): Promise<boolean> {
    try {
      await this.projectsService.assertMembership(projectId, userId);
      return true;
    } catch {
      return false;
    }
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
