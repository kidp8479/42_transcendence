import {
  getSession,
  setAuthSession,
  subscribeAuthSession,
  type AuthSession,
} from "./auth";
import {
  resetRealtimeSocket,
  disconnectRealtimeSocket,
} from "./realtimeSocket";

const sessionCacheTtlMs = 30_000;

export type AuthState =
  | { status: "authenticated"; session: AuthSession }
  | { status: "anonymous" }
  | { status: "unavailable"; error: Error };

export class AuthSessionResource {
  private state: AuthState | null = null;
  private checkedAt = 0;
  private inFlight: Promise<AuthState> | null = null;
  private revision = 0;
  private listeners = new Set<() => void>();
  private publishing = false;

  constructor() {
    subscribeAuthSession((session) => {
      if (!this.publishing) {
        this.applySession(session);
      }
    });
  }

  async resolve(): Promise<AuthState> {
    if (this.hasFreshState()) {
      return this.state!;
    }
    if (this.inFlight) {
      return this.inFlight;
    }

    const revision = this.revision;
    const request = getSession()
      .then<AuthState>((session) =>
        session ? { status: "authenticated", session } : { status: "anonymous" }
      )
      .catch<AuthState>((error: unknown) => ({
        status: "unavailable",
        error:
          error instanceof Error ? error : new Error("Session check failed"),
      }))
      .then((state) => {
        if (revision !== this.revision) {
          return this.state ?? this.resolve();
        }
        this.state = state;
        this.checkedAt = Date.now();
        this.notify();
        return state;
      })
      .finally(() => {
        if (this.inFlight === request) {
          this.inFlight = null;
        }
      });

    this.inFlight = request;
    return request;
  }

  setAuthenticated(session: AuthSession): void {
    this.revision += 1;
    this.state = { status: "authenticated", session };
    this.checkedAt = Date.now();
    this.publishSession(session);
    resetRealtimeSocket();
    this.notify();
  }

  setAnonymous(): void {
    this.revision += 1;
    this.state = { status: "anonymous" };
    this.checkedAt = Date.now();
    this.publishSession(null);
    // no session left to reconnect with - see disconnectRealtimeSocket's own comment
    disconnectRealtimeSocket();
    this.notify();
  }

  invalidate(): void {
    this.revision += 1;
    this.state = null;
    this.checkedAt = 0;
    this.inFlight = null;
    this.publishSession(null);
    resetRealtimeSocket();
    this.notify();
  }

  async endSession(): Promise<void> {
    this.setAnonymous();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getState(): AuthState | null {
    return this.state;
  }

  private hasFreshState(): boolean {
    if (!this.state || Date.now() - this.checkedAt >= sessionCacheTtlMs) {
      return false;
    }
    if (this.state.status !== "authenticated") {
      return true;
    }

    return Date.parse(this.state.session.idleExpiresAt) > Date.now();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private applySession(session: AuthSession | null): void {
    this.state = session
      ? { status: "authenticated", session }
      : { status: "anonymous" };
    this.checkedAt = Date.now();
    this.notify();
  }

  private publishSession(session: AuthSession | null): void {
    this.publishing = true;
    try {
      setAuthSession(session);
    } finally {
      this.publishing = false;
    }
  }
}

export interface AppRouterContext {
  auth: AuthSessionResource;
}

export const authSessionResource = new AuthSessionResource();
