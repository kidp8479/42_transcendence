// All fields are optional - the caller can update only one field at a time.
// projectId is not here: you never move a task from one project to another.
// rank is here: updated when the user drags and drops a task to reorder it.
// assigneeIds are handled internally by TaskAssigneeService when provided.

import { PartialType } from "@nestjs/mapped-types";
import { CreateTaskDto } from "./create-task.dto";

// skipNullProperties: false is load-bearing. PartialType wraps every inherited
// field in class-validator's @IsOptional(), whose condition is
// `value !== null && value !== undefined` - so a body carrying an explicit JSON
// null skipped @IsString()/@IsEnum()/@IsBoolean() entirely and the null reached
// prisma.task.update(). title, priority and onCalendar are non-nullable columns,
// so Prisma then threw PrismaClientValidationError - a different class from
// PrismaClientKnownRequestError, and the request came back as a raw 500 instead
// of a 400. This option swaps @IsOptional() for ValidateIf(value !== undefined),
// which validates null like any other value and rejects it at the pipe.
//
// Consequence: null can no longer CLEAR a nullable column (startAt, endAt,
// description, notes, categoryId) - it is a 400 now. Nothing sends it today
// (UpdateTaskBody in the frontend types them `string | undefined`). If clearing
// a date becomes a real need, type the field `string | null`, give it back an
// explicit @IsOptional(), and replace the `??` in TasksService.update - it
// treats null as "not provided" and would validate a value it never writes.
export class UpdateTaskDto extends PartialType(CreateTaskDto, {
  skipNullProperties: false,
}) {}
