import { PartialType } from "@nestjs/mapped-types";
import { CreateCalendarEventDto } from "./create-calendar-event.dto";

// Reuses CreateCalendarEventDto's fields and validation decorators, makes them all optional for PATCH.
export class UpdateCalendarEventDto extends PartialType(
  CreateCalendarEventDto
) {}
