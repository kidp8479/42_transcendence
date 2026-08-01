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
import { PrismaService } from "../prisma/prisma.service";

// Resolves the real projectId a lockable resource belongs to, given the id
// half of its key (the "checklist-item:" / "discovery-block:" prefix is
// stripped before calling this). Returns undefined if the resource doesn't
// exist. Each owning module registers its own via
// RealtimeService.registerKeyPrefixValidator - this file has no business
// knowing about EvaluationChecklistItem, DiscoveryBlock, or any future
// lockable model (Kanban cards, per useFieldLock's own comment).
type KeyPrefixValidator = (id: string) => Promise<string | undefined>;

interface FieldLock {
  userId: string;
  username: string;
  avatarUrl: string | null;
  // so handleDisconnect knows which room to broadcast field:unlocked to
  projectId: string;
  // scopes handleDisconnect's cleanup to the socket that actually held the
  // lock - without this, the same user's other open tab disconnecting (a
  // network blip, not the tab that's editing) would release this lock too,
  // since it only checked userId
  socketId: string;
}

@WebSocketGateway({ path: "/ws" })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly configService: ConfigService,
    private readonly vaultRuntime: VaultRuntimeService,
    private readonly prisma: PrismaService
  ) {}

  @WebSocketServer() server: Server;

  // those 3 methods are used for websocket, defining "priority" when someone edits the same resource
  // map to store all the locks, private because mutable
  private locks = new Map<string, FieldLock>();

  // registered by each owning module's service (see keyBelongsToProject)
  private keyPrefixValidators = new Map<string, KeyPrefixValidator>();

  registerKeyPrefixValidator(
    prefix: string,
    validator: KeyPrefixValidator
  ): void {
    this.keyPrefixValidators.set(prefix, validator);
  }

  // grabs the lock for key, only if nobody else already has it - the same
  // user re-acquiring their own lock always succeeds (idempotent), needed
  // for React StrictMode's dev-only double effect invocation (mount ->
  // cleanup -> mount), which releases then immediately re-requests the same
  // lock for the same user
  private acquireLock(key: string, lock: FieldLock): boolean {
    const existing = this.locks.get(key);
    if (existing !== undefined && existing.userId !== lock.userId) {
      return false;
    }
    this.locks.set(key, lock);
    return true;
  }

  // releases key, but only if this exact socket is the one holding it -
  // userId alone isn't enough: useFieldLock emits field:unlock on unmount,
  // so a second tab's unmount (route change, tab close) could otherwise
  // unlock a field the first tab is still actively editing
  private releaseLock(key: string, socketId: string): void {
    const lock = this.locks.get(key);
    if (lock == undefined) {
      return;
    }
    if (lock.socketId === socketId) {
      this.locks.delete(key);
    }
  }

  // who's currently editing key, if anyone
  private getLock(key: string): FieldLock | undefined {
    return this.locks.get(key);
  }

  // used by RealtimeService.isLockedByOther, so a REST service (e.g.
  // EvaluationChecklistItemsService.update) can enforce the same lock a
  // client's UI already shows as read-only - the field-lock hook is
  // otherwise only a UI hint, never checked before this on the write path.
  isLockedByOtherUser(key: string, userId: string): boolean {
    const lock = this.getLock(key);
    return lock !== undefined && lock.userId !== userId;
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
    // handleConnection is async (auth fetch + 2 Prisma calls + room joins
    // below), but a client can emit field:lock/unlock/query the instant it
    // connects - before any of that has finished. Handlers await this so
    // they never run against a socket that hasn't joined its rooms yet
    // (isMember would wrongly read as "not a member"). Left unresolved
    // forever on an early-disconnect return path below, which is fine: a
    // disconnected socket's own handlers never get their response delivered
    // either way.
    let resolveReady: () => void;
    client.data.ready = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

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
    // A plain membership lookup, not ProjectsService.findAll - that one
    // joins members/evaluationChecklistItems/_count to compute progress for
    // the projects list page, all of it wasted work here since only the
    // project ids are needed to join rooms.
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId: result.userId },
      select: { projectId: true },
    });
    for (const membership of memberships) {
      await client.join(`project:${membership.projectId}`);
    }
    await client.join(`user:${result.userId}`);
    resolveReady!();
  }

  // locks live in our own Map, not Socket.io's room state - release them
  // here or a dropped connection leaves them stuck forever.
  // Scoped to this socket's own locks (not every lock this userId holds) -
  // the same user can have two tabs open, one actively editing (holding a
  // lock) while the other's connection drops and reconnects; only the
  // disconnecting socket's own locks should be released.
  handleDisconnect(@ConnectedSocket() client: Socket): void {
    const userId = client.data.userId as string | undefined;
    if (userId === undefined) {
      return;
    }
    for (const [key, lock] of this.locks) {
      if (lock.socketId === client.id) {
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
    await this.waitUntilReady(client);
    const userId = client.data.userId as string;
    if (
      !this.isMember(client, body.projectId) ||
      !(await this.keyBelongsToProject(body.key, body.projectId))
    ) {
      return { locked: false, lock: undefined };
    }

    const lock: FieldLock = {
      userId,
      username: client.data.username as string,
      avatarUrl: client.data.avatarUrl as string | null,
      projectId: body.projectId,
      socketId: client.id,
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
    await this.waitUntilReady(client);
    if (
      !this.isMember(client, body.projectId) ||
      !(await this.keyBelongsToProject(body.key, body.projectId))
    ) {
      return;
    }

    const lock = this.getLock(body.key);
    if (lock === undefined || lock.socketId !== client.id) {
      return;
    }

    this.releaseLock(body.key, client.id);
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
    await this.waitUntilReady(client);
    if (
      !this.isMember(client, body.projectId) ||
      !(await this.keyBelongsToProject(body.key, body.projectId))
    ) {
      return { lock: undefined };
    }
    return { lock: this.getLock(body.key) };
  }

  // handleConnection's own body assigns client.data.ready synchronously as
  // its very first statement, so this is only ever undefined for a socket
  // NestJS hasn't called handleConnection on yet - not expected to happen
  // in practice, but awaiting nothing is a safe no-op if it ever did.
  private async waitUntilReady(client: Socket): Promise<void> {
    await (client.data.ready as Promise<void> | undefined);
  }

  // handleConnection joins this socket to a room per project the user
  // belongs to (project:<id>) - checking room membership is an in-memory
  // Set lookup instead of a DB round-trip per field:lock/unlock/query
  // message, and is the same authorization boundary: being in the room is
  // exactly what lets a client receive that project's broadcasts at all.
  private isMember(client: Socket, projectId: string): boolean {
    return client.rooms.has(`project:${projectId}`);
  }

  // isMember only proves the caller belongs to body.projectId - it says
  // nothing about whether body.key (an opaque client-supplied string) is
  // actually a resource IN that project. Without this, a member of project
  // A could pass projectId: A but key: "checklist-item:<id from project B>"
  // and lock/unlock/query a resource in a project they have no access to.
  // The prefix -> validator lookup itself comes from
  // registerKeyPrefixValidator, not a hardcoded per-model branch here.
  private async keyBelongsToProject(
    key: string,
    projectId: string
  ): Promise<boolean> {
    const [prefix, id] = key.split(":");
    if (id === undefined) {
      return false;
    }
    const validator = this.keyPrefixValidators.get(prefix);
    if (validator === undefined) {
      // unknown key shape - reject rather than silently allow a lock on
      // something no module has registered a validator for
      return false;
    }
    return (await validator(id)) === projectId;
  }

  // used when a lockable resource itself is deleted (e.g.
  // EvaluationChecklistItemsService.remove()) - the holder's own socket
  // never gets a field:unlock for a resource that no longer exists, so
  // without this the Map entry would sit there until they disconnect.
  forceReleaseLock(key: string): void {
    const lock = this.locks.get(key);
    if (lock === undefined) {
      return;
    }
    this.locks.delete(key);
    this.server.to(`project:${lock.projectId}`).emit("field:unlocked", { key });
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
