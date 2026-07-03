// All fields are optional - the caller can update only one field at a time.
// projectId is not here: you never move a category from one project to another.

import { PartialType } from "@nestjs/mapped-types";
import { CreateTaskCategoryDto } from "./create-task-category.dto";

// Reuses CreateTaskCategoryDto's fields and validation decorators, makes them all optional for PATCH.
export class UpdateTaskCategoryDto extends PartialType(CreateTaskCategoryDto) {}
