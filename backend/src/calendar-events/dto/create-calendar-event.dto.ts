import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";

export class CreateCalendarEventDto {
  @IsString()
  title: string;

  @IsString()
  labelId: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID("4", { each: true })
  @IsArray()
  @ArrayUnique()
  assigneeIds?: string[];
}
