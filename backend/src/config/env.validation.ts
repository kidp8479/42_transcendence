// Validates process.env at boot time, before any module tries to use it.
// If a required variable is missing or malformed, the app refuses to start
// with a clear error message instead of failing later with a cryptic one
// (ex: Prisma throwing deep inside a query because DATABASE_URL was undefined).

import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  DATABASE_URL: Joi.string().uri().required(),
  PORT: Joi.number().port().default(3000),
});
