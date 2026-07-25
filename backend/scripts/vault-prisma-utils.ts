import { readFile, stat } from "node:fs/promises";
import { URL } from "node:url";
import { DatabaseCredentials } from "../src/vault/vault.client";

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export async function readProtectedIDFile(
  path: string,
  label: string
): Promise<string> {
  const info = await stat(path);
  if ((info.mode & 0o077) !== 0) {
    throw new Error(`Vault ${label} file permissions are too broad`);
  }
  const value = (await readFile(path, "utf8")).trim();
  if (!value) {
    throw new Error(`Vault ${label} file is empty`);
  }
  return value;
}

export function buildDatabaseUrl(
  host: string,
  port: string,
  database: string,
  credentials: DatabaseCredentials
): string {
  const url = new URL(`postgresql://${host}:${port}`);
  url.pathname = database;
  url.username = credentials.username;
  url.password = credentials.password;
  url.searchParams.set("sslmode", "disable");
  return url.toString();
}
