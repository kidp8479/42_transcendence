// All fields are optional - the caller can update only one field at a time.
// projectId is not here: you never move a label from one project to another.

import { PartialType } from "@nestjs/mapped-types";
import { CreateCalendarLabelDto } from "./create-calendar-label.dto";

// Reuses CreateCalendarLabelDto's fields and validation decorators, makes them all optional for PATCH.
export class UpdateCalendarLabelDto extends PartialType(
  CreateCalendarLabelDto
) {}
