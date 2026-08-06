import { Transform } from "class-transformer";
import { IsDateString, IsEnum, IsString, Length } from "class-validator";
import { ProjectApiTokenPermission } from "@prisma/client";

export class CreateProjectApiTokenDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  label: string;

  @IsEnum(ProjectApiTokenPermission)
  permission: ProjectApiTokenPermission;

  @IsDateString()
  expiresAt: string;
}
