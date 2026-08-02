import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { randomUUID, timingSafeEqual } from "node:crypto";

export interface FieldLock {
  userId: string;
  username: string;
  avatarUrl: string | null;
  projectId: string;
  socketId: string;
  expiresAt: number;
}

interface FieldLockLease extends FieldLock {
  token: string;
}

interface AcquireFieldLockInput {
  key: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  projectId: string;
  socketId: string;
}

export interface AcquireFieldLockResult {
  acquired: boolean;
  lock: FieldLock | undefined;
  token: string | undefined;
}

export class FieldLockLeaseError extends Error {
  constructor() {
    super("The field lock is no longer valid");
  }
}

export interface ReleasedFieldLock {
  key: string;
  lock: FieldLock;
}

const FIELD_LOCK_TTL_MS = 30_000;
const FIELD_LOCK_EXPIRY_CHECK_INTERVAL_MS = 5_000;

@Injectable()
export class FieldLockManager implements OnModuleDestroy {
  private readonly leases = new Map<string, FieldLockLease>();
  private readonly coordinator = new ProjectResourceCoordinator();
  private expirationHandler:
    ((released: ReleasedFieldLock) => void) | undefined;
  private readonly expiryTimer = setInterval(() => {
    void this.releaseExpiredLeases();
  }, FIELD_LOCK_EXPIRY_CHECK_INTERVAL_MS);

  constructor() {
    this.expiryTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.expiryTimer);
  }

  setExpirationHandler(handler: (released: ReleasedFieldLock) => void): void {
    this.expirationHandler = handler;
  }

  async withProject<T>(
    projectId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.coordinator.runProject(projectId, operation);
  }

  async withProjectResource<T>(
    projectId: string,
    resourceKey: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.coordinator.runProjectResource(
      projectId,
      resourceKey,
      operation
    );
  }

  acquire(input: AcquireFieldLockInput): AcquireFieldLockResult {
    this.releaseIfExpired(input.key);
    const existing = this.leases.get(input.key);
    if (existing !== undefined && existing.socketId !== input.socketId) {
      return {
        acquired: false,
        lock: toPublicLock(existing),
        token: undefined,
      };
    }

    if (existing !== undefined) {
      existing.expiresAt = Date.now() + FIELD_LOCK_TTL_MS;
      return {
        acquired: true,
        lock: toPublicLock(existing),
        token: existing.token,
      };
    }

    const lease: FieldLockLease = {
      ...input,
      token: randomUUID(),
      expiresAt: Date.now() + FIELD_LOCK_TTL_MS,
    };
    this.leases.set(input.key, lease);
    return { acquired: true, lock: toPublicLock(lease), token: lease.token };
  }

  renew(key: string, socketId: string, token: string): FieldLock | undefined {
    const lease = this.leases.get(key);
    if (
      lease === undefined ||
      lease.socketId !== socketId ||
      !tokensMatch(lease.token, token)
    ) {
      return undefined;
    }
    if (lease.expiresAt <= Date.now()) {
      const released = this.releaseResource(key);
      if (released !== undefined) {
        this.expirationHandler?.(released);
      }
      return undefined;
    }

    lease.expiresAt = Date.now() + FIELD_LOCK_TTL_MS;
    return toPublicLock(lease);
  }

  get(key: string): FieldLock | undefined {
    this.releaseIfExpired(key);
    const lease = this.leases.get(key);
    return lease === undefined ? undefined : toPublicLock(lease);
  }

  release(key: string, socketId: string): ReleasedFieldLock | undefined {
    const lease = this.leases.get(key);
    if (lease === undefined || lease.socketId !== socketId) {
      return undefined;
    }

    this.leases.delete(key);
    return { key, lock: toPublicLock(lease) };
  }

  releaseResource(key: string): ReleasedFieldLock | undefined {
    const lease = this.leases.get(key);
    if (lease === undefined) {
      return undefined;
    }

    this.leases.delete(key);
    return { key, lock: toPublicLock(lease) };
  }

  releaseUserInProject(userId: string, projectId: string): ReleasedFieldLock[] {
    const released: ReleasedFieldLock[] = [];
    for (const [key, lease] of this.leases) {
      if (lease.userId === userId && lease.projectId === projectId) {
        this.leases.delete(key);
        released.push({ key, lock: toPublicLock(lease) });
      }
    }
    return released;
  }

  async releaseSocket(socketId: string): Promise<ReleasedFieldLock[]> {
    const leases = [...this.leases.entries()].filter(
      ([, lease]) => lease.socketId === socketId
    );
    const released: ReleasedFieldLock[] = [];
    for (const [key, lease] of leases) {
      const result = await this.withProjectResource(
        lease.projectId,
        key,
        async () => this.release(key, socketId)
      );
      if (result !== undefined) {
        released.push(result);
      }
    }
    return released;
  }

  async withValidatedLease<T>(
    projectId: string,
    key: string,
    userId: string,
    token: string | undefined,
    authorize: () => Promise<void>,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.withProjectResource(projectId, key, async () => {
      const lease = this.leases.get(key);
      if (
        lease === undefined ||
        lease.userId !== userId ||
        lease.projectId !== projectId ||
        token === undefined ||
        !tokensMatch(lease.token, token) ||
        lease.expiresAt <= Date.now()
      ) {
        if (lease !== undefined && lease.expiresAt <= Date.now()) {
          const released = this.releaseResource(key);
          if (released !== undefined) {
            this.expirationHandler?.(released);
          }
        }
        throw new FieldLockLeaseError();
      }

      await authorize();

      const currentLease = this.leases.get(key);
      if (
        currentLease === undefined ||
        !tokensMatch(currentLease.token, token) ||
        currentLease.expiresAt <= Date.now()
      ) {
        throw new FieldLockLeaseError();
      }

      return operation();
    });
  }

  assertLeaseOwnerIfLocked(
    projectId: string,
    key: string,
    userId: string,
    token: string | undefined
  ): void {
    const lease = this.leases.get(key);
    if (lease === undefined) {
      return;
    }
    if (this.releaseIfExpired(key)) {
      return;
    }
    if (
      lease.userId !== userId ||
      lease.projectId !== projectId ||
      token === undefined ||
      !tokensMatch(lease.token, token)
    ) {
      throw new FieldLockLeaseError();
    }
  }

  private async releaseExpiredLeases(): Promise<void> {
    const now = Date.now();
    const expired = [...this.leases.entries()].filter(
      ([, lease]) => lease.expiresAt <= now
    );
    for (const [key, lease] of expired) {
      const released = await this.withProjectResource(
        lease.projectId,
        key,
        async () => {
          const currentLease = this.leases.get(key);
          if (
            currentLease === undefined ||
            currentLease.expiresAt > Date.now()
          ) {
            return undefined;
          }
          return this.releaseResource(key);
        }
      );
      if (released !== undefined) {
        this.expirationHandler?.(released);
      }
    }
  }

  private releaseIfExpired(key: string): boolean {
    const lease = this.leases.get(key);
    if (lease === undefined || lease.expiresAt > Date.now()) {
      return false;
    }
    const released = this.releaseResource(key);
    if (released !== undefined) {
      this.expirationHandler?.(released);
    }
    return true;
  }
}

// Ordinary field operations share project access so independent resources
// proceed together; membership removal takes exclusive project access and
// waits for every in-flight resource operation before changing authorization.
class ProjectResourceCoordinator {
  private readonly projects = new Map<string, ProjectCoordinator>();
  private readonly resources = new KeyedCoordinator();

  async runProject<T>(
    projectId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const project = this.getProject(projectId);
    const release = await project.acquireExclusive();
    try {
      return await operation();
    } finally {
      release();
      this.releaseProjectIfIdle(projectId, project);
    }
  }

  async runProjectResource<T>(
    projectId: string,
    resourceKey: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const project = this.getProject(projectId);
    const release = await project.acquireShared();
    try {
      return await this.resources.run(
        resourceCoordinatorKey(resourceKey),
        operation
      );
    } finally {
      release();
      this.releaseProjectIfIdle(projectId, project);
    }
  }

  private getProject(projectId: string): ProjectCoordinator {
    let project = this.projects.get(projectId);
    if (project === undefined) {
      project = new ProjectCoordinator();
      this.projects.set(projectId, project);
    }
    return project;
  }

  private releaseProjectIfIdle(
    projectId: string,
    project: ProjectCoordinator
  ): void {
    if (project.isIdle() && this.projects.get(projectId) === project) {
      this.projects.delete(projectId);
    }
  }
}

class ProjectCoordinator {
  private readerCount = 0;
  private writerActive = false;
  private readonly waiters: ProjectLockWaiter[] = [];

  acquireShared(): Promise<() => void> {
    if (
      !this.writerActive &&
      !this.waiters.some((waiter) => waiter.mode === "exclusive")
    ) {
      this.readerCount += 1;
      return Promise.resolve(() => this.releaseShared());
    }
    return this.enqueue("shared");
  }

  acquireExclusive(): Promise<() => void> {
    if (
      !this.writerActive &&
      this.readerCount === 0 &&
      this.waiters.length === 0
    ) {
      this.writerActive = true;
      return Promise.resolve(() => this.releaseExclusive());
    }
    return this.enqueue("exclusive");
  }

  isIdle(): boolean {
    return (
      !this.writerActive && this.readerCount === 0 && this.waiters.length === 0
    );
  }

  private enqueue(mode: ProjectLockMode): Promise<() => void> {
    return new Promise((resolve) => {
      this.waiters.push({ mode, resolve });
    });
  }

  private releaseShared(): void {
    this.readerCount -= 1;
    this.drain();
  }

  private releaseExclusive(): void {
    this.writerActive = false;
    this.drain();
  }

  private drain(): void {
    if (
      this.writerActive ||
      this.readerCount > 0 ||
      this.waiters.length === 0
    ) {
      return;
    }

    const first = this.waiters[0];
    if (first.mode === "exclusive") {
      this.waiters.shift();
      this.writerActive = true;
      first.resolve(() => this.releaseExclusive());
      return;
    }

    while (this.waiters[0]?.mode === "shared") {
      const waiter = this.waiters.shift();
      if (waiter === undefined) {
        break;
      }
      this.readerCount += 1;
      waiter.resolve(() => this.releaseShared());
    }
  }
}

type ProjectLockMode = "shared" | "exclusive";

interface ProjectLockWaiter {
  mode: ProjectLockMode;
  resolve: (release: () => void) => void;
}

class KeyedCoordinator {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const release = await this.acquire(key);
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async acquire(key: string): Promise<() => void> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let releaseCurrent: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const tail = previous.then(() => current);
    this.tails.set(key, tail);
    await previous;

    return () => {
      releaseCurrent!();
      if (this.tails.get(key) === tail) {
        this.tails.delete(key);
      }
    };
  }
}

function resourceCoordinatorKey(resourceKey: string): string {
  return `resource:${resourceKey}`;
}

function toPublicLock(lease: FieldLockLease): FieldLock {
  return {
    userId: lease.userId,
    username: lease.username,
    avatarUrl: lease.avatarUrl,
    projectId: lease.projectId,
    socketId: lease.socketId,
    expiresAt: lease.expiresAt,
  };
}

function tokensMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
