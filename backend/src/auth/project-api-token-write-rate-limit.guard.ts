import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { ProjectApiTokenRequest } from "./authenticated-request";

const windowMs = 60_000;
const limit = 30;
const maximumTrackedTokens = 10_000;

interface TokenWindow {
  count: number;
  resetAt: number;
}

// This intentionally runs after ProjectApiTokenGuard, so the limiter key is
// the authenticated internal token ID rather than an attacker-controlled
// header or a shared source IP.
// Deliberately process-local for the project's single-backend deployment.
// Revisit with a shared store before introducing multiple backend replicas.
@Injectable()
export class ProjectApiTokenWriteRateLimitGuard implements CanActivate {
  private readonly tokenWindows = new Map<string, TokenWindow>();
  private lastPrunedAt = 0;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ProjectApiTokenRequest>();
    const tokenId = request.apiToken.tokenId;
    const now = Date.now();
    this.pruneExpiredWindows(now);
    const current = this.tokenWindows.get(tokenId);
    if (!current || current.resetAt <= now) {
      this.evictOldestWindowIfNeeded();
      this.tokenWindows.set(tokenId, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (current.count >= limit) {
      throw new HttpException(
        "Project API token write rate exceeded",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    current.count += 1;
    return true;
  }

  private pruneExpiredWindows(now: number): void {
    if (now - this.lastPrunedAt < windowMs) {
      return;
    }
    for (const [tokenId, window] of this.tokenWindows) {
      if (window.resetAt <= now) {
        this.tokenWindows.delete(tokenId);
      }
    }
    this.lastPrunedAt = now;
  }

  private evictOldestWindowIfNeeded(): void {
    if (this.tokenWindows.size < maximumTrackedTokens) {
      return;
    }
    const oldestTokenId = this.tokenWindows.keys().next().value;
    if (oldestTokenId !== undefined) {
      this.tokenWindows.delete(oldestTokenId);
    }
  }
}
