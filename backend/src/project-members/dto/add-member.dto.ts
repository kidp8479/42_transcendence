// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// ProjectMember is a join table: adding a member = creating a row that links a User to a Project.
// projectId is not here: it comes from the URL (/projects/:projectId/members), not the request body.
// The frontend submits a username; the service looks up the corresponding User
// and creates the ProjectMember row using that user's id.
import { IsString } from "class-validator";

export class AddMemberDto {
  @IsString()
  username: string;
}
