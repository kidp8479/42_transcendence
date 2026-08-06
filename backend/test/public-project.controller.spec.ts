import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { PublicProjectController } from "../src/public-api/public-project.controller";

const projectId = "d5ba85f5-9658-4b22-92de-14381d754d57";

function controllerWithTaskService(
  findAllForProject: (receivedProjectId: string, limit?: number) => unknown
) {
  return new PublicProjectController(
    { findAllForProject } as never,
    {} as never,
    {} as never
  );
}

test("returns no public tasks when limit is zero", () => {
  let receivedLimit: number | undefined;
  const controller = controllerWithTaskService((_projectId, limit) => {
    receivedLimit = limit;
    return [];
  });

  assert.deepEqual(controller.tasks(projectId, 0), []);
  assert.equal(receivedLimit, 0);
});

test("rejects a negative public task limit", () => {
  const controller = controllerWithTaskService(() => []);

  assert.throws(
    () => controller.tasks(projectId, -1),
    (error: unknown) =>
      error instanceof BadRequestException &&
      error.message === "limit must be zero or greater"
  );
});
