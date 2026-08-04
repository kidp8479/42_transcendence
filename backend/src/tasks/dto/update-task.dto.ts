// All fields are optional - the caller can update only one field at a time.
// projectId is not here: you never move a task from one project to another.
// rank is here: updated when the user drags and drops a task to reorder it.
// assigneeIds are handled internally by TaskAssigneeService when provided.

import { PartialType } from "@nestjs/mapped-types";
import { CreateTaskDto } from "./create-task.dto";

// skipNullProperties: false is load-bearing. PartialType's default
// @IsOptional() only checks `value !== null && value !== undefined`, so an
// explicit JSON null skipped validation entirely and hit prisma.task.update()
// - title/priority/onCalendar are non-nullable columns, so Prisma threw a raw
// 500 instead of a clean 400. This swaps in ValidateIf(value !== undefined),
// which validates null like any other value and rejects it at the pipe.
//
// Consequence: null can no longer clear a nullable column (startAt, endAt,
// description, notes, categoryId) - it's a 400 now. Nothing sends it today.
// If clearing a date becomes a real need: type the field `string | null`,
// give it back an explicit @IsOptional(), and update the `??` in
// TasksService.update, which currently treats null as "not provided".
export class UpdateTaskDto extends PartialType(CreateTaskDto, {
  skipNullProperties: false,
}) {}
