// Validates process.env at boot time, before any module tries to use it.
// If a required variable is missing or malformed, the app refuses to start
// with a clear error message instead of failing later with a cryptic one
// (ex: a Vault configuration error surfacing only during the first query).

import * as Joi from "joi";

export const envValidationSchema = Joi.object({
  PORT: Joi.number().port().default(3000),
  AUTH_SERVICE_URL: Joi.string().uri().required(),
  AUTH_SESSION_COOKIE: Joi.string().default("tr_session"),
  VAULT_ADDR: Joi.string().uri().required(),
  VAULT_ROLE_ID_FILE: Joi.string().required(),
  VAULT_SECRET_ID_FILE: Joi.string().required(),
  VAULT_DB_ROLE: Joi.string().required(),
  VAULT_DB_HOST: Joi.string().hostname().required(),
  VAULT_DB_PORT: Joi.number().port().required(),
  VAULT_DB_NAME: Joi.string().required(),
  RUSTFS_ENDPOINT: Joi.string().uri().required(),
  RUSTFS_ACCESS_KEY: Joi.string().required(),
  RUSTFS_SECRET_KEY: Joi.string().required(),
  RUSTFS_BUCKET: Joi.string().required(),
  RUSTFS_REGION: Joi.string().default("us-east-1"),
});
