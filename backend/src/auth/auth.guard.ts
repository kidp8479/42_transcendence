import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { firstHeaderValue } from "../common/first-header-value";
import { VaultRuntimeService } from "../vault/vault-runtime.service";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "./authenticated-request";
import { IS_PUBLIC_KEY } from "./public.decorator";
import { PROJECT_API_TOKEN_PERMISSION_KEY } from "./project-api-token.decorator";

interface IntrospectionResponse {
  active: true;
  sub: string;
  sid: string;
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

  constructor(
    private readonly reflector: Reflector,
    configService: ConfigService,
    private readonly vaultRuntime: VaultRuntimeService
  ) {
    this.authServiceUrl = configService.getOrThrow<string>("AUTH_SERVICE_URL");
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const isProjectApiTokenRoute =
      this.reflector.getAllAndOverride<boolean>(
        PROJECT_API_TOKEN_PERMISSION_KEY,
        [context.getHandler(), context.getClass()]
      ) !== undefined;
    if (isProjectApiTokenRoute) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const accessToken = readBearerToken(
      firstHeaderValue(request.headers.authorization)
    );
    if (!accessToken) {
      throw new UnauthorizedException("Bearer access token required");
    }

    const response = await this.introspect(accessToken);
    const user: AuthenticatedUser = {
      id: response.sub,
      sessionId: response.sid,
      authenticationMethod: response.authenticationMethod,
      assuranceLevel: response.assuranceLevel,
      authenticatedAt: new Date(response.authenticatedAt),
      idleExpiresAt: new Date(response.idleExpiresAt),
      absoluteExpiresAt: new Date(response.absoluteExpiresAt),
    };
    request.user = user;
    return true;
  }

  private async introspect(
    accessToken: string
  ): Promise<IntrospectionResponse> {
    let response: Response;
    try {
      response = await fetch(
        `${this.authServiceUrl}/auth/internal/introspect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.vaultRuntime.getInternalToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accessToken }),
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
      throw new UnauthorizedException("Access token is invalid or inactive");
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        "Authentication service could not validate the access token"
      );
    }

    const result = (await response.json()) as Partial<IntrospectionResponse>;
    if (
      result.active !== true ||
      typeof result.sub !== "string" ||
      typeof result.sid !== "string" ||
      typeof result.authenticationMethod !== "string" ||
      typeof result.assuranceLevel !== "number" ||
      typeof result.authenticatedAt !== "string" ||
      typeof result.idleExpiresAt !== "string" ||
      typeof result.absoluteExpiresAt !== "string"
    ) {
      throw new ServiceUnavailableException(
        "Authentication service returned an invalid response"
      );
    }
    return result as IntrospectionResponse;
  }
}

function readBearerToken(value: string | undefined): string | undefined {
  if (!value?.startsWith("Bearer ")) {
    return undefined;
  }
  const token = value.slice("Bearer ".length);
  return token && !token.includes(" ") ? token : undefined;
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
