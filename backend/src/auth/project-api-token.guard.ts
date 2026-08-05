import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { firstHeaderValue } from "../common/first-header-value";
import { PrismaService } from "../prisma/prisma.service";
import { VaultRuntimeService } from "../vault/vault-runtime.service";
import type {
  ProjectApiTokenPermission,
  ProjectApiTokenRequest,
} from "./authenticated-request";
import { PROJECT_API_TOKEN_PERMISSION_KEY } from "./project-api-token.decorator";

interface IntrospectionResponse {
  active: true;
  principalType: "PROJECT_API_TOKEN";
  tokenId: string;
  projectId: string;
  permission: ProjectApiTokenPermission;
}

@Injectable()
export class ProjectApiTokenGuard implements CanActivate {
  private readonly authServiceUrl: string;

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
    private readonly vaultRuntime: VaultRuntimeService,
    private readonly prisma: PrismaService
  ) {
    this.authServiceUrl = config.getOrThrow<string>("AUTH_SERVICE_URL");
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission =
      this.reflector.getAllAndOverride<ProjectApiTokenPermission>(
        PROJECT_API_TOKEN_PERMISSION_KEY,
        [context.getHandler(), context.getClass()]
      );
    if (!requiredPermission) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<
        ProjectApiTokenRequest & { params: { projectId?: string } }
      >();
    const rawAPIKey = request.headers["x-api-key"];
    if (Array.isArray(rawAPIKey)) {
      throw new UnauthorizedException("Project API token is invalid");
    }
    const apiKey = firstHeaderValue(rawAPIKey);
    if (!apiKey?.startsWith("trp_v1_")) {
      throw new UnauthorizedException("Project API token is invalid");
    }

    const principal = await this.introspect(apiKey);
    if (request.params.projectId !== principal.projectId) {
      throw new NotFoundException("Project not found");
    }
    if (
      requiredPermission === "READ_WRITE" &&
      principal.permission !== "READ_WRITE"
    ) {
      throw new ForbiddenException(
        "Project API token does not permit write operations"
      );
    }

    const project = await this.prisma.project.findFirst({
      where: { id: principal.projectId, isArchived: false },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }

    request.apiToken = principal;
    return true;
  }

  private async introspect(apiKey: string): Promise<IntrospectionResponse> {
    let response: Response;
    try {
      response = await fetch(
        `${this.authServiceUrl}/auth/internal/project-api-tokens/introspect`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.vaultRuntime.getInternalToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ apiKey }),
          signal: AbortSignal.timeout(2000),
        }
      );
    } catch {
      throw new ServiceUnavailableException(
        "Authentication service is unavailable"
      );
    }
    if (response.status === 401) {
      throw new UnauthorizedException("Project API token is invalid");
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        "Authentication service could not validate the project API token"
      );
    }
    const result = (await response.json()) as Partial<IntrospectionResponse>;
    if (
      result.active !== true ||
      result.principalType !== "PROJECT_API_TOKEN" ||
      typeof result.tokenId !== "string" ||
      typeof result.projectId !== "string" ||
      (result.permission !== "READ" && result.permission !== "READ_WRITE")
    ) {
      throw new ServiceUnavailableException(
        "Authentication service returned an invalid project API token response"
      );
    }
    return result as IntrospectionResponse;
  }
}
