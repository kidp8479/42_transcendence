import { Optional } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { IncomingMessage } from "node:http";
import { Socket, Server } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";
import {
  AcquireFieldLockResult,
  FieldLock,
  FieldLockManager,
  ReleasedFieldLock,
} from "./field-lock-manager";
import {
  WebSocketAdmission,
  WebSocketAdmissionService,
} from "./websocket-admission.service";

const webSocketTicketPattern = /^[A-Za-z0-9_-]{43}$/;
const sessionRevalidationIntervalMs = 30_000;
const maximumSocketLifetimeMs = 15 * 60_000;

function allowExactOrigin(
  request: IncomingMessage,
  callback: (error: string | null | undefined, success: boolean) => void
): void {
  callback(null, request.headers.origin === process.env.APP_ORIGIN);
}

// Resolves the real projectId a lockable resource belongs to, given the id
// half of its key (the "checklist-item:" / "discovery-block:" prefix is
// stripped before calling this). Returns undefined if the resource doesn't
// exist. Each owning module registers its own via
// RealtimeService.registerKeyPrefixValidator - this file has no business
// knowing about EvaluationChecklistItem, DiscoveryBlock, or any future
// lockable model (Kanban cards, per useFieldLock's own comment).
type KeyPrefixValidator = (id: string) => Promise<string | undefined>;

@WebSocketGateway({
  path: "/ws",
  transports: ["websocket"],
  allowRequest: allowExactOrigin,
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly fieldLockManager: FieldLockManager,
    @Optional()
    private readonly admissionService?: WebSocketAdmissionService
  ) {
    this.fieldLockManager.setExpirationHandler((released) => {
      this.emitFieldUnlock(released);
    });
  }

  @WebSocketServer() server: Server;

  // registered by each owning module's service (see keyBelongsToProject)
  private keyPrefixValidators = new Map<string, KeyPrefixValidator>();
  private socketGuards = new Map<
    string,
    { revalidation: NodeJS.Timeout; lifetime: NodeJS.Timeout }
  >();

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

  async handleConnection(client: Socket): Promise<void> {
    const ready = this.admit(client);
    client.data.ready = ready;
    if (!(await ready) && client.connected) {
      client.disconnect(true);
    }
  }

  // locks live in our own Map, not Socket.io's room state - release them
  // here or a dropped connection leaves them stuck forever.
  // Scoped to this socket's own locks (not every lock this userId holds) -
  // the same user can have two tabs open, one actively editing (holding a
  // lock) while the other's connection drops and reconnects; only the
  // disconnecting socket's own locks should be released.
  async handleDisconnect(@ConnectedSocket() client: Socket): Promise<void> {
    this.clearSocketGuards(client.id);
    const released = await this.fieldLockManager.releaseSocket(client.id);
    for (const lock of released) {
      this.emitFieldUnlock(lock);
    }
  }

  private async admit(client: Socket): Promise<boolean> {
    const ticket = client.handshake.query.ticket;
    if (
      !this.admissionService ||
      typeof ticket !== "string" ||
      !webSocketTicketPattern.test(ticket)
    ) {
      return false;
    }

    let admission: WebSocketAdmission;
    try {
      admission = await this.admissionService.consume(ticket);
    } catch {
      return false;
    }
    if (!client.connected) {
      return false;
    }

    client.data.userId = admission.sub;
    client.data.sessionId = admission.sid;
    client.data.username = admission.username;
    client.data.avatarUrl = admission.avatarUrl;

    await client.join(`user:${admission.sub}`);
    if (!client.connected) {
      return false;
    }

    const memberships = await this.prisma.projectMember.findMany({
      where: { userId: admission.sub },
      select: { projectId: true },
    });
    for (const membership of memberships) {
      if (!client.connected) {
        return false;
      }
      await this.fieldLockManager.withProject(
        membership.projectId,
        async () => {
          if (
            !client.connected ||
            !(await this.isCurrentProjectMember(
              admission.sub,
              membership.projectId
            ))
          ) {
            return;
          }
          if (client.connected) {
            await client.join(`project:${membership.projectId}`);
          }
        }
      );
    }
    if (!client.connected) {
      return false;
    }
    this.startSocketGuards(client, admission);
    return true;
  }

  private startSocketGuards(
    client: Socket,
    admission: WebSocketAdmission
  ): void {
    this.clearSocketGuards(client.id);
    let revalidationInFlight = false;
    const revalidation = setInterval(() => {
      if (revalidationInFlight || !client.connected) {
        return;
      }
      revalidationInFlight = true;
      void this.admissionService!.isSessionActive(admission.sub, admission.sid)
        .then((active) => {
          if (!active && client.connected) {
            client.disconnect(true);
          }
        })
        .catch(() => {
          if (client.connected) {
            client.disconnect(true);
          }
        })
        .finally(() => {
          revalidationInFlight = false;
        });
    }, sessionRevalidationIntervalMs);
    const lifetime = setTimeout(() => {
      if (client.connected) {
        client.disconnect(true);
      }
    }, maximumSocketLifetimeMs);
    this.socketGuards.set(client.id, { revalidation, lifetime });
  }

  private clearSocketGuards(socketId: string): void {
    const guards = this.socketGuards.get(socketId);
    if (!guards) {
      return;
    }
    clearInterval(guards.revalidation);
    clearTimeout(guards.lifetime);
    this.socketGuards.delete(socketId);
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
