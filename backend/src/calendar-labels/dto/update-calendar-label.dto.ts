import { PartialType } from "@nestjs/mapped-types";
import { CreateCalendarLabelDto } from "./create-calendar-label.dto";

export class UpdateCalendarLabelDto extends PartialType(
  CreateCalendarLabelDto
) {}
