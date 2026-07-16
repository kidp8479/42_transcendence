import { getSession, type AuthSession } from "./auth";

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
  }

  setAnonymous(): void {
    this.revision += 1;
    this.state = { status: "anonymous" };
    this.checkedAt = Date.now();
  }

  invalidate(): void {
    this.revision += 1;
    this.state = null;
    this.checkedAt = 0;
    this.inFlight = null;
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
}

export interface AppRouterContext {
  auth: AuthSessionResource;
}

export const authSessionResource = new AuthSessionResource();
