// All fields are optional - the caller can update only one field at a time.
// projectId is not here: you never move an event from one project to another.
// assigneeIds are handled internally by CalendarAssigneeService when provided.

import { PartialType } from "@nestjs/mapped-types";
import { CreateCalendarEventDto } from "./create-calendar-event.dto";

// Reuses CreateCalendarEventDto's fields and validation decorators, makes them all optional for PATCH.
export class UpdateCalendarEventDto extends PartialType(
  CreateCalendarEventDto
) {}
