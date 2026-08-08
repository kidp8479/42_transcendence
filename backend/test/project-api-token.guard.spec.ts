import assert from "node:assert/strict";
import test from "node:test";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { ProjectApiTokenGuard } from "../src/auth/project-api-token.guard";
import { PROJECT_API_TOKEN_SELF_KEY } from "../src/auth/project-api-token.constants";

const projectId = "c39eb8c5-bc47-41d7-bd21-87d9b02582ec";

function contextFor(pathProjectId = projectId) {
  const request = {
    headers: { "x-api-key": "trp_v1_selector.secret" },
    params: { projectId: pathProjectId },
  };
  return {
    request,
    context: {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    },
  };
}

function guardFor(
  requiredPermission: "READ" | "READ_WRITE",
  project: { id: string } | null,
  isSelfReflection = false
) {
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === PROJECT_API_TOKEN_SELF_KEY
        ? isSelfReflection
        : requiredPermission,
  };
  const config = {
    getOrThrow: () => "http://auth",
  };
  const prisma = {
    project: {
      findFirst: async () => project,
    },
  };
  return new ProjectApiTokenGuard(
    reflector as never,
    config as never,
    {} as never,
    prisma as never
  );
}

function guardWithIntrospection(
  requiredPermission: "READ" | "READ_WRITE",
  project: { id: string } | null,
  permission: "READ" | "READ_WRITE",
  isSelfReflection = false
) {
  const guard = guardFor(requiredPermission, project, isSelfReflection);
  (
    guard as unknown as {
      introspect: () => Promise<{
        active: true;
        principalType: "PROJECT_API_TOKEN";
        tokenId: string;
        projectId: string;
        label: string;
        permission: "READ" | "READ_WRITE";
        expiresAt: string;
        lastUsedAt: string;
      }>;
    }
  ).introspect = async () => ({
    active: true,
    principalType: "PROJECT_API_TOKEN",
    tokenId: "ff7ffeb2-b04a-4cd5-9bda-c49b79b423c6",
    projectId,
    label: "automation",
    permission,
    expiresAt: "2026-12-31T00:00:00.000Z",
    lastUsedAt: "2026-08-07T00:00:00.000Z",
  });
  return guard;
}

test("returns 404 for an archived project before checking write permission", async () => {
  const { context } = contextFor();
  await assert.rejects(
    guardWithIntrospection("READ_WRITE", null, "READ").canActivate(
      context as never
    ),
    NotFoundException
  );
});

test("accepts canonical-equivalent UUID casing", async () => {
  const { context, request } = contextFor(projectId.toUpperCase());
  assert.equal(
    await guardWithIntrospection("READ", { id: projectId }, "READ").canActivate(
      context as never
    ),
    true
  );
  assert.equal(
    (request as { apiToken: { permission: string } }).apiToken.permission,
    "READ"
  );
});

test("returns 403 only for an active in-project read token writing", async () => {
  const { context } = contextFor();
  await assert.rejects(
    guardWithIntrospection("READ_WRITE", { id: projectId }, "READ").canActivate(
      context as never
    ),
    ForbiddenException
  );
});

test("rejects malformed project IDs before introspection", async () => {
  const { context } = contextFor("not-a-uuid");
  await assert.rejects(
    guardFor("READ", { id: projectId }).canActivate(context as never),
    BadRequestException
  );
});

test("self reflection authenticates without a project ID path parameter", async () => {
  const { context, request } = contextFor();
  request.params = {};

  assert.equal(
    await guardWithIntrospection("READ", null, "READ", true).canActivate(
      context as never
    ),
    true
  );
  assert.equal(
    (request as { apiToken: { label: string } }).apiToken.label,
    "automation"
  );
});

test("self reflection rejects a project ID path parameter", async () => {
  const { context } = contextFor();

  await assert.rejects(
    guardWithIntrospection("READ", { id: projectId }, "READ", true).canActivate(
      context as never
    ),
    BadRequestException
  );
});
