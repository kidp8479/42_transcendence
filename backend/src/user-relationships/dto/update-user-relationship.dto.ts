import { CreateUserRelationshipDto } from "./create-user-relationship.dto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdateUserRelationshipDto extends PartialType(CreateUserRelationshipDto) {}