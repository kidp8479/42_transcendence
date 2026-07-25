import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readFile, stat } from "node:fs/promises";
import { URL } from "node:url";
import {
  DatabaseCredentials,
  VaultClient,
  isVaultAuthorizationError,
  isVaultLeaseRenewalLimit,
} from "./vault.client";

const renewalSafetyMarginMs = 60_000;
const retryIntervalMs = 15_000;

@Injectable()
export class VaultRuntimeService implements OnModuleDestroy {
  private readonly client: VaultClient;
  private readonly roleIdFile: string;
  private readonly secretIdFile: string;
  private readonly databaseRole: string;
  private readonly databaseHost: string;
  private readonly databasePort: string;
  private readonly databaseName: string;
  private readonly databaseRefreshers = new Set<
    (credentials: DatabaseCredentials) => Promise<void>
  >();
  private readonly fatalPromise: Promise<never>;
  private fatalReject!: (error: Error) => void;
  private startPromise?: Promise<DatabaseCredentials>;
  private renewalTimer?: NodeJS.Timeout;
  private tokenExpiresAt = 0;
  private databaseExpiresAt = 0;
  private databaseCredentials?: DatabaseCredentials;
  private internalToken?: string;
  private roleId?: string;
  private secretId?: string;
  private ready = false;
  private stopped = false;

  constructor(config: ConfigService) {
    const address = config.getOrThrow<string>("VAULT_ADDR");
    validateVaultAddress(address);
    this.client = new VaultClient(address.replace(/\/$/, ""));
    this.roleIdFile = config.getOrThrow<string>("VAULT_ROLE_ID_FILE");
    this.secretIdFile = config.getOrThrow<string>("VAULT_SECRET_ID_FILE");
    this.databaseRole = config.getOrThrow<string>("VAULT_DB_ROLE");
    this.databaseHost = config.getOrThrow<string>("VAULT_DB_HOST");
    this.databasePort = config.getOrThrow<string>("VAULT_DB_PORT");
    this.databaseName = config.getOrThrow<string>("VAULT_DB_NAME");
    this.fatalPromise = new Promise<never>((_, reject) => {
      this.fatalReject = reject;
    });
  }

  start(): Promise<DatabaseCredentials> {
    this.startPromise ??= this.initialize();
    return this.startPromise;
  }

  isReady(): boolean {
    return this.ready;
  }

  getInternalToken(): string {
    if (!this.ready || !this.internalToken) {
      throw new Error("Vault runtime is not ready");
    }
    return this.internalToken;
  }

  databaseUrl(credentials: DatabaseCredentials): string {
    const url = new URL(
      `postgresql://${this.databaseHost}:${this.databasePort}`
    );
    url.pathname = this.databaseName;
    url.username = credentials.username;
    url.password = credentials.password;
    url.searchParams.set("sslmode", "disable");
    return url.toString();
  }

  registerDatabaseRefresher(
    refresher: (credentials: DatabaseCredentials) => Promise<void>
  ): () => void {
    this.databaseRefreshers.add(refresher);
    return () => this.databaseRefreshers.delete(refresher);
  }

  waitForFatal(): Promise<never> {
    return this.fatalPromise;
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.renewalTimer) {
      clearTimeout(this.renewalTimer);
    }
  }

  private async initialize(): Promise<DatabaseCredentials> {
    const [roleId, secretId] = await Promise.all([
      readProtectedIDFile(this.roleIdFile, "Role ID"),
      readProtectedIDFile(this.secretIdFile, "Secret ID"),
    ]);
    const token = await this.client.login(roleId, secretId);
    const [internalToken, credentials] = await Promise.all([
      this.client.readInternalToken(),
      this.client.issueDatabaseCredentials(this.databaseRole),
    ]);
    this.internalToken = internalToken;
    this.roleId = roleId;
    this.secretId = secretId;
    this.databaseCredentials = credentials;
    this.tokenExpiresAt = Date.now() + token.leaseDurationMs;
    this.databaseExpiresAt = Date.now() + credentials.leaseDurationMs;
    this.ready = true;
    this.scheduleRenewal();
    return credentials;
  }

  private scheduleRenewal(): void {
    if (this.stopped || !this.ready) {
      return;
    }
    const expiresAt = Math.min(this.tokenExpiresAt, this.databaseExpiresAt);
    const delay = Math.max(0, expiresAt - Date.now() - renewalSafetyMarginMs);
    this.renewalTimer = setTimeout(() => void this.renew(), delay);
  }

  private async renew(): Promise<void> {
    try {
      let token;
      try {
        token = await this.client.renewToken();
      } catch {
        await this.reauthenticate();
        return;
      }
      this.tokenExpiresAt = Date.now() + token.leaseDurationMs;
      if (!this.databaseCredentials) {
        throw new Error("Vault runtime has no database credentials");
      }
      let credentials: DatabaseCredentials;
      try {
        credentials = await this.client.renewDatabaseCredentials(
          this.databaseCredentials
        );
      } catch (error) {
        if (!isVaultLeaseRenewalLimit(error)) {
          throw error;
        }
        credentials = await this.client.issueDatabaseCredentials(
          this.databaseRole
        );
      }
      await Promise.all(
        [...this.databaseRefreshers].map((refresher) => refresher(credentials))
      );
      this.databaseCredentials = credentials;
      this.databaseExpiresAt = Date.now() + credentials.leaseDurationMs;
      this.scheduleRenewal();
    } catch (error) {
      if (
        isVaultAuthorizationError(error) ||
        Math.min(this.tokenExpiresAt, this.databaseExpiresAt) - Date.now() <=
          renewalSafetyMarginMs
      ) {
        this.fail(error);
        return;
      }
      this.renewalTimer = setTimeout(() => void this.renew(), retryIntervalMs);
    }
  }

  private async reauthenticate(): Promise<void> {
    if (!this.roleId || !this.secretId) {
      throw new Error("Vault runtime has no AppRole credentials");
    }
    const token = await this.client.login(this.roleId, this.secretId);
    const credentials = await this.client.issueDatabaseCredentials(
      this.databaseRole
    );
    await Promise.all(
      [...this.databaseRefreshers].map((refresher) => refresher(credentials))
    );
    this.tokenExpiresAt = Date.now() + token.leaseDurationMs;
    this.databaseCredentials = credentials;
    this.databaseExpiresAt = Date.now() + credentials.leaseDurationMs;
    this.scheduleRenewal();
  }

  private fail(error: unknown): void {
    if (this.stopped || !this.ready) {
      return;
    }
    this.ready = false;
    this.fatalReject(
      error instanceof Error
        ? new Error(`Vault runtime failed closed: ${error.message}`)
        : new Error("Vault runtime failed closed")
    );
  }
}

async function readProtectedIDFile(
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

function validateVaultAddress(address: string): void {
  const parsed = new URL(address);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("VAULT_ADDR must use http or https");
  }
}
