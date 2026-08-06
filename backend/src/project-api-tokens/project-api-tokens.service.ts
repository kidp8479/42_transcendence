import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ProjectApiTokenPermission } from "@prisma/client";
import { ProjectsService } from "../projects/projects.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "../realtime/realtime.service";
import { VaultRuntimeService } from "../vault/vault-runtime.service";
import { CreateProjectApiTokenDto } from "./dto/create-project-api-token.dto";

export interface TokenMetadata {
  id: string;
  projectId: string;
  label: string;
  permission: ProjectApiTokenPermission;
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreateTokenResponse {
  token: TokenMetadata;
  apiKey: string;
}

@Injectable()
export class ProjectApiTokensService {
  private readonly authServiceUrl: string;

  constructor(
    config: ConfigService,
    private readonly vaultRuntime: VaultRuntimeService,
    private readonly projects: ProjectsService,
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService
  ) {
    this.authServiceUrl = config.getOrThrow<string>("AUTH_SERVICE_URL");
  }

  async list(projectId: string, userId: string): Promise<TokenMetadata[]> {
    await this.projects.assertMembership(projectId, userId);
    return this.request<TokenMetadata[]>(
      `/auth/internal/projects/${projectId}/api-tokens`,
      { method: "GET" }
    );
  }

  async create(
    projectId: string,
    userId: string,
    dto: CreateProjectApiTokenDto
  ): Promise<CreateTokenResponse> {
    return this.realtime.withProjectLock(projectId, async () => {
      await this.requireManager(projectId, userId);
      await this.assertProjectIsActive(projectId);
      const expiresAt = new Date(dto.expiresAt);
      if (
        Number.isNaN(expiresAt.getTime()) ||
        expiresAt <= new Date() ||
        expiresAt > new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      ) {
        throw new BadRequestException("expiresAt must be in the next 365 days");
      }
      return this.request<CreateTokenResponse>(
        "/auth/internal/project-api-tokens",
        {
          method: "POST",
          body: {
            projectId,
            label: dto.label,
            permission: dto.permission,
            expiresAt: expiresAt.toISOString(),
            createdByUserId: userId,
          },
        }
      );
    });
  }

  async revoke(projectId: string, tokenId: string, userId: string) {
    return this.realtime.withProjectLock(projectId, async () => {
      await this.requireManager(projectId, userId);
      return this.request<TokenMetadata>(
        `/auth/internal/project-api-tokens/${tokenId}/revoke`,
        {
          method: "POST",
          body: { projectId, actorUserId: userId },
        }
      );
    });
  }

  async remove(
    projectId: string,
    tokenId: string,
    userId: string
  ): Promise<void> {
    await this.realtime.withProjectLock(projectId, async () => {
      await this.requireManager(projectId, userId);
      await this.request<void>(
        `/auth/internal/projects/${projectId}/api-tokens/${tokenId}`,
        { method: "DELETE", body: { actorUserId: userId } }
      );
    });
  }

  private async requireManager(
    projectId: string,
    userId: string
  ): Promise<void> {
    const member = await this.projects.assertMembership(projectId, userId);
    if (member.role !== "OWNER" && member.role !== "ADMIN") {
      throw new ForbiddenException(
        "Only project owners or admins can manage project API tokens"
      );
    }
  }

  private async assertProjectIsActive(projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, isArchived: false },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException("Project not found");
    }
  }

  private async request<T>(
    path: string,
    options: { method: "GET" | "POST" | "DELETE"; body?: unknown }
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.authServiceUrl}${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${this.vaultRuntime.getInternalToken()}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      throw new ServiceUnavailableException(
        "Authentication service is unavailable"
      );
    }
    if (response.status === 404) {
      throw new NotFoundException("Project API token not found");
    }
    if (response.status === 409) {
      throw new ConflictException(
        "Project has reached the active API token limit"
      );
    }
    if (!response.ok) {
      throw new ServiceUnavailableException(
        "Authentication service could not manage the project API token"
      );
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
}
