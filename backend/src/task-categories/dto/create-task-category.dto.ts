// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// projectId is not here: it comes from the URL (/projects/:projectId/task-categories), not the request body.

import { IsNumber, IsString } from "class-validator";

export class CreateTaskCategoryDto {
  @IsString()
  name: string;

  @IsNumber()
  color: number;
}
