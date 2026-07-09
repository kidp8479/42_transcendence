// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// ProjectMember is a join table: adding a member = creating a row that links a User to a Project.
// projectId is not here: it comes from the URL (/projects/:projectId/members), not the request body.
// there is no update DTO: you never edit a membership, you only add or remove it.

import { IsUUID } from "class-validator";

export class AddMemberDto {
  @IsUUID()
  userId: string;
}
