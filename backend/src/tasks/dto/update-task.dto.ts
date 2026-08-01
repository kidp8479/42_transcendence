// All fields are optional - the caller can update only one field at a time.
// projectId is not here: you never move a task from one project to another.
// rank is here: updated when the user drags and drops a task to reorder it.
// assigneeIds are handled internally by TaskAssigneeService when provided.

import { PartialType } from "@nestjs/mapped-types";
import { CreateTaskDto } from "./create-task.dto";

export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
