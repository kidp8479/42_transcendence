import { IsEnum } from "class-validator";
import { RelationshipStatus } from "@prisma/client";

export class UpdateUserRelationshipDto {
  @IsEnum(RelationshipStatus)
  status: RelationshipStatus;
}
