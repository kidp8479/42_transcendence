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
import {
  AcquireFieldLockResult,
  FieldLock,
  FieldLockManager,
  ReleasedFieldLock,
} from "./field-lock-manager";

// Resolves the real projectId a lockable resource belongs to, given the id
// half of its key (the "checklist-item:" / "discovery-block:" prefix is
// stripped before calling this). Returns undefined if the resource doesn't
// exist. Each owning module registers its own via
// RealtimeService.registerKeyPrefixValidator - this file has no business
// knowing about EvaluationChecklistItem, DiscoveryBlock, or any future
// lockable model (Kanban cards, per useFieldLock's own comment).
type KeyPrefixValidator = (id: string) => Promise<string | undefined>;

@WebSocketGateway({ path: "/ws" })
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly configService: ConfigService,
    private readonly vaultRuntime: VaultRuntimeService,
    private readonly prisma: PrismaService,
    private readonly fieldLockManager: FieldLockManager
  ) {
    this.fieldLockManager.setExpirationHandler((released) => {
      this.emitFieldUnlock(released);
    });
  }

  @WebSocketServer() server: Server;

  // registered by each owning module's service (see keyBelongsToProject)
  private keyPrefixValidators = new Map<string, KeyPrefixValidator>();

  registerKeyPrefixValidator(
    prefix: string,
    validator: KeyPrefixValidator
  ): void {
    this.keyPrefixValidators.set(prefix, validator);
  }

  // grabs the lock for key, only if nobody else already has it - scoped by
  // socketId, not userId: two tabs signed into the same account are two
  // different sockets, and must not be able to silently steal or overwrite
  // each other's lock (that was the bug - re-acquiring by userId let a
  // second tab of the same account grab the lock while the first tab still
  // believed it held it, both able to save, last write wins). The same
  // socket re-acquiring its own lock still always succeeds (idempotent),
  // which is what React StrictMode's dev-only double effect invocation
  // (mount -> cleanup -> mount) relies on - that replay happens on the same
  // live connection, so its socketId is unchanged.
  private acquireLock(
    key: string,
    lock: Omit<FieldLock, "expiresAt">
  ): AcquireFieldLockResult {
    return this.fieldLockManager.acquire({ key, ...lock });
  }

  // releases key, but only if this exact socket is the one holding it -
  // userId alone isn't enough: useFieldLock emits field:unlock on unmount,
  // so a second tab's unmount (route change, tab close) could otherwise
  // unlock a field the first tab is still actively editing
  private releaseLock(
    key: string,
    socketId: string
  ): ReleasedFieldLock | undefined {
    return this.fieldLockManager.release(key, socketId);
  }

  // who's currently editing key, if anyone
  private getLock(key: string): FieldLock | undefined {
    return this.fieldLockManager.get(key);
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
    let resolveReady: (ready: boolean) => void;
    client.data.ready = new Promise<boolean>((resolve) => {
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
      resolveReady!(false);
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
      resolveReady!(false);
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
      resolveReady!(false);
      client.disconnect(true);
      return;
    }

    if (!response.ok) {
      resolveReady!(false);
      client.disconnect(true);
      return;
    }

    const result = (await response.json()) as {
      active?: boolean;
      userId?: string;
    };
    if (result.active !== true || typeof result.userId !== "string") {
      resolveReady!(false);
      client.disconnect(true);
      return;
    }

    client.data.userId = result.userId;

    // cached on the socket, avoids a DB query on every field:lock message
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: result.userId },
      select: { username: true, avatarUrl: true },
    });
    if (!client.connected) {
      resolveReady!(false);
      return;
    }
    client.data.username = user.username;
    client.data.avatarUrl = user.avatarUrl;

    // Join the user room before reading memberships. Member removal selects
    // sockets through this room, so it can evict a connection that is still
    // being admitted to project rooms.
    await client.join(`user:${result.userId}`);
    if (!client.connected) {
      resolveReady!(false);
      return;
    }

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
      if (!client.connected) {
        resolveReady!(false);
        return;
      }
      await this.fieldLockManager.withProject(
        membership.projectId,
        async () => {
          if (
            !client.connected ||
            !(await this.isCurrentProjectMember(
              result.userId,
              membership.projectId
            ))
          ) {
            return;
          }
          if (!client.connected) {
            return;
          }
          await client.join(`project:${membership.projectId}`);
        }
      );
    }
    resolveReady!(client.connected);
  }

  // locks live in our own Map, not Socket.io's room state - release them
  // here or a dropped connection leaves them stuck forever.
  // Scoped to this socket's own locks (not every lock this userId holds) -
  // the same user can have two tabs open, one actively editing (holding a
  // lock) while the other's connection drops and reconnects; only the
  // disconnecting socket's own locks should be released.
  async handleDisconnect(@ConnectedSocket() client: Socket): Promise<void> {
    const released = await this.fieldLockManager.releaseSocket(client.id);
    for (const lock of released) {
      this.emitFieldUnlock(lock);
    }
  }

  // client wants to start editing key - rejects if client isn't a member
  // of body.projectId, same rule as every REST controller in the app
  @SubscribeMessage("field:lock")
  async handleFieldLock(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId: string; key: string }
  ): Promise<{
    locked: boolean;
    lock: FieldLock | undefined;
    leaseToken: string | undefined;
  }> {
    if (!(await this.waitUntilReady(client))) {
      return { locked: false, lock: undefined, leaseToken: undefined };
    }
    const userId = client.data.userId as string;
    const result = await this.fieldLockManager.withProjectResource(
      body.projectId,
      body.key,
      async () => {
        if (!client.connected || !this.isMember(client, body.projectId)) {
          return {
            acquired: false,
            lock: undefined,
            token: undefined,
          };
        }

        const isCurrentMember = await this.isCurrentProjectMember(
          userId,
          body.projectId
        );
        const keyBelongsToProject = await this.keyBelongsToProject(
          body.key,
          body.projectId
        );
        if (!client.connected || !isCurrentMember || !keyBelongsToProject) {
          return {
            acquired: false,
            lock: undefined,
            token: undefined,
          };
        }

        return this.acquireLock(body.key, {
          userId,
          username: client.data.username as string,
          avatarUrl: client.data.avatarUrl as string | null,
          projectId: body.projectId,
          socketId: client.id,
        });
      }
    );

    if (result.acquired && result.lock !== undefined) {
      this.server
        .to(`project:${body.projectId}`)
        .emit("field:locked", { key: body.key, lock: result.lock });
    }

    return {
      locked: result.acquired,
      lock: result.lock,
      leaseToken: result.token,
    };
  }

  // client is done editing key
  @SubscribeMessage("field:unlock")
  async handleFieldUnlock(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId: string; key: string }
  ): Promise<void> {
    if (!(await this.waitUntilReady(client))) {
      return;
    }

    const released = await this.fieldLockManager.withProjectResource(
      body.projectId,
      body.key,
      async () => {
        const userId = client.data.userId as string;
        if (
          !client.connected ||
          !this.isMember(client, body.projectId) ||
          !(await this.isCurrentProjectMember(userId, body.projectId)) ||
          !(await this.keyBelongsToProject(body.key, body.projectId))
        ) {
          return undefined;
        }
        return this.releaseLock(body.key, client.id);
      }
    );
    if (released !== undefined) {
      this.emitFieldUnlock(released);
    }
  }

  @SubscribeMessage("field:renew")
  async handleFieldRenew(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId: string; key: string; leaseToken: string }
  ): Promise<{ renewed: boolean }> {
    if (!(await this.waitUntilReady(client))) {
      return { renewed: false };
    }

    const renewed = await this.fieldLockManager.withProjectResource(
      body.projectId,
      body.key,
      async () => {
        const userId = client.data.userId as string;
        if (
          !client.connected ||
          !this.isMember(client, body.projectId) ||
          !(await this.isCurrentProjectMember(userId, body.projectId)) ||
          !(await this.keyBelongsToProject(body.key, body.projectId))
        ) {
          return false;
        }
        return (
          this.fieldLockManager.renew(body.key, client.id, body.leaseToken) !==
          undefined
        );
      }
    );
    return { renewed };
  }

  // for a client opening something that was already locked before it connected
  @SubscribeMessage("field:query")
  async handleFieldQuery(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { projectId: string; key: string }
  ): Promise<{ lock: FieldLock | undefined }> {
    if (!(await this.waitUntilReady(client))) {
      return { lock: undefined };
    }
    return this.fieldLockManager.withProjectResource(
      body.projectId,
      body.key,
      async () => {
        const userId = client.data.userId as string;
        if (
          !client.connected ||
          !this.isMember(client, body.projectId) ||
          !(await this.isCurrentProjectMember(userId, body.projectId)) ||
          !(await this.keyBelongsToProject(body.key, body.projectId))
        ) {
          return { lock: undefined };
        }
        return { lock: this.getLock(body.key) };
      }
    );
  }

  // handleConnection's own body assigns client.data.ready synchronously as
  // its very first statement, so this is only ever undefined for a socket
  // NestJS hasn't called handleConnection on yet - not expected to happen
  // in practice, but awaiting nothing is a safe no-op if it ever did.
  private async waitUntilReady(client: Socket): Promise<boolean> {
    const ready = await (client.data.ready as Promise<boolean> | undefined);
    return ready === true && client.connected;
  }

  // handleConnection joins this socket to a room per project the user
  // belongs to (project:<id>) - checking room membership is an in-memory
  // Set lookup instead of a DB round-trip per field:lock/unlock/query
  // message, and is the same authorization boundary: being in the room is
  // exactly what lets a client receive that project's broadcasts at all.
  private isMember(client: Socket, projectId: string): boolean {
    return client.rooms.has(`project:${projectId}`);
  }

  private async isCurrentProjectMember(
    userId: string,
    projectId: string
  ): Promise<boolean> {
    return (
      (await this.prisma.projectMember.count({
        where: { userId, projectId },
      })) === 1
    );
  }

  // isMember only proves the caller belongs to body.projectId - it says
  // nothing about whether body.key (an opaque client-supplied string) is
  // actually a resource IN that project. Without this, a member of project
  // A could pass projectId: A but key: "checklist-item:<id from project B>"
  // and lock/unlock/query a resource in a project they have no access to.
  // The prefix -> validator lookup itself comes from
  // registerKeyPrefixValidator, not a hardcoded per-model branch here.
  //
  // Requires exactly "prefix:id" - key.split(":") on its own only reads the
  // first two segments and silently ignores anything past the second colon,
  // so "checklist-item:<realId>:<anything>" used to validate against the
  // same real resource while being a distinct Map key from the canonical
  // "checklist-item:<realId>" - every extra suffix created a brand new,
  // permanent entry in the locks Map for the same underlying field, with no
  // bound on how many a single connected socket could create.
  private async keyBelongsToProject(
    key: string,
    projectId: string
  ): Promise<boolean> {
    const segments = key.split(":");
    if (segments.length !== 2) {
      return false;
    }
    const [prefix, id] = segments;
    if (prefix === "" || id === "") {
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

  emitFieldUnlock(released: ReleasedFieldLock): void {
    this.server
      .to(`project:${released.lock.projectId}`)
      .emit("field:unlocked", { key: released.key });
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
