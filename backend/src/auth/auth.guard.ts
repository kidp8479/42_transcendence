import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "./public.decorator";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "./authenticated-request";

interface IntrospectionResponse {
  active: true;
  sessionId: string;
  userId: string;
  authenticationMethod: "LOCAL" | "FORTY_TWO" | "GOOGLE";
  assuranceLevel: number;
  authenticatedAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
}

interface IntrospectionError {
  code?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly authServiceUrl: string;
  private readonly internalToken: string;
  private readonly sessionCookieName: string;

  constructor(
    private readonly reflector: Reflector,
    configService: ConfigService
  ) {
    this.authServiceUrl = configService.getOrThrow<string>("AUTH_SERVICE_URL");
    this.internalToken = configService.getOrThrow<string>(
      "AUTH_INTERNAL_TOKEN"
    );
    this.sessionCookieName = configService.getOrThrow<string>(
      "AUTH_SESSION_COOKIE"
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionToken = readCookie(
      request.headers.cookie,
      this.sessionCookieName
    );
    if (!sessionToken) {
      throw new UnauthorizedException("Active session required");
    }

    const response = await this.introspect({
      sessionToken,
      requestMethod: request.method,
      origin: firstHeaderValue(request.headers.origin),
      csrfToken: firstHeaderValue(request.headers["x-csrf-token"]),
    });

    const user: AuthenticatedUser = {
      id: response.userId,
      sessionId: response.sessionId,
      authenticationMethod: response.authenticationMethod,
      assuranceLevel: response.assuranceLevel,
      authenticatedAt: new Date(response.authenticatedAt),
      idleExpiresAt: new Date(response.idleExpiresAt),
      absoluteExpiresAt: new Date(response.absoluteExpiresAt),
    };
    request.user = user;
    return true;
  }

  private async introspect(body: {
    sessionToken: string;
    requestMethod: string;
    origin?: string;
    csrfToken?: string;
  }): Promise<IntrospectionResponse> {
    let response: Response;
    try {
      response = await fetch(
        `${this.authServiceUrl}/auth/internal/introspect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.internalToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(2000),
        }
      );
    } catch {
      throw new ServiceUnavailableException(
        "Authentication service is unavailable"
      );
    }

    if (response.status === 401) {
      const error = await readIntrospectionError(response);
      if (error.code === "INVALID_INTERNAL_CREDENTIALS") {
        throw new ServiceUnavailableException(
          "Authentication service credentials are invalid"
        );
      }
      throw new UnauthorizedException("Active session required");
    }

    async function readIntrospectionError(
      response: Response
    ): Promise<IntrospectionError> {
      try {
        return (await response.json()) as IntrospectionError;
      } catch {
        return {};
      }
    }
    if (response.status === 403) {
      throw new ForbiddenException("CSRF validation failed");
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        "Authentication service could not validate the session"
      );
    }

    const result = (await response.json()) as Partial<IntrospectionResponse>;
    if (
      result.active !== true ||
      typeof result.userId !== "string" ||
      typeof result.sessionId !== "string"
    ) {
      throw new ServiceUnavailableException(
        "Authentication service returned an invalid response"
      );
    }
    return result as IntrospectionResponse;
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
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return undefined;
}

function firstHeaderValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
