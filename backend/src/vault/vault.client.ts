import nodeVault = require("node-vault");

const httpStatusBadRequest = 400;
const httpStatusUnauthorized = 401;
const httpStatusForbidden = 403;

export interface VaultToken {
  leaseDurationMs: number;
}

export interface DatabaseCredentials {
  username: string;
  password: string;
  leaseId: string;
  leaseDurationMs: number;
}

export class VaultClient {
  private readonly client: ReturnType<typeof nodeVault>;

  constructor(address: string) {
    this.client = nodeVault({
      apiVersion: "v1",
      endpoint: address,
      requestOptions: { timeout: 10_000 },
    });
  }

  async login(roleId: string, secretId: string): Promise<VaultToken> {
    const response = (await this.client.approleLogin({
      role_id: roleId,
      secret_id: secretId,
    })) as AppRoleLoginResponse;
    const auth = response.auth;
    if (
      !auth?.client_token ||
      !auth.renewable ||
      !isPositiveNumber(auth.lease_duration)
    ) {
      throw new Error("Vault AppRole login returned an unusable token");
    }
    this.client.token = auth.client_token;
    return { leaseDurationMs: auth.lease_duration * 1000 };
  }

  async renewToken(): Promise<VaultToken> {
    const response =
      (await this.client.tokenRenewSelf()) as TokenRenewalResponse;
    if (
      !response.auth?.renewable ||
      !isPositiveNumber(response.auth.lease_duration)
    ) {
      throw new Error("Vault token renewal returned an unusable token");
    }
    return { leaseDurationMs: response.auth.lease_duration * 1000 };
  }

  async readInternalToken(): Promise<string> {
    const response = (await this.client.read(
      "kv/data/internal/backend-auth"
    )) as KVResponse;
    const token = response.data?.data?.internal_token;
    if (!token || token.length < 32) {
      throw new Error(
        "Vault internal credential must be at least 32 characters"
      );
    }
    return token;
  }

  async issueDatabaseCredentials(role: string): Promise<DatabaseCredentials> {
    const response = (await this.client.read(
      `database/creds/${encodeURIComponent(role)}`
    )) as DatabaseResponse;
    return parseDatabaseCredentials(response, true);
  }

  async renewDatabaseCredentials(
    credentials: DatabaseCredentials
  ): Promise<DatabaseCredentials> {
    const response = (await this.client.write("sys/leases/renew", {
      lease_id: credentials.leaseId,
    })) as DatabaseResponse;
    const renewed = parseDatabaseCredentials(response, false);
    if (renewed.leaseId !== credentials.leaseId) {
      throw new Error("Vault renewed an unexpected database lease");
    }
    return {
      ...renewed,
      username: credentials.username,
      password: credentials.password,
    };
  }
}

interface AppRoleLoginResponse {
  auth?: {
    client_token?: string;
    lease_duration?: number;
    renewable?: boolean;
  };
}

interface TokenRenewalResponse {
  auth?: { lease_duration?: number; renewable?: boolean };
}

interface KVResponse {
  data?: { data?: { internal_token?: string } };
}

interface DatabaseResponse {
  lease_id?: string;
  lease_duration?: number;
  renewable?: boolean;
  data?: { username?: string; password?: string };
}

function parseDatabaseCredentials(
  response: DatabaseResponse,
  requireCredentials: boolean
): DatabaseCredentials {
  if (
    !response.lease_id ||
    !response.renewable ||
    !isPositiveNumber(response.lease_duration) ||
    (requireCredentials &&
      (!response.data?.username || !response.data?.password))
  ) {
    throw new Error("Vault database credentials response is incomplete");
  }
  return {
    username: response.data?.username ?? "",
    password: response.data?.password ?? "",
    leaseId: response.lease_id,
    leaseDurationMs: response.lease_duration * 1000,
  };
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && value > 0;
}

export function isVaultAuthorizationError(error: unknown): boolean {
  const statusCode = vaultErrorStatusCode(error);
  return (
    statusCode === httpStatusUnauthorized || statusCode === httpStatusForbidden
  );
}

export function isVaultLeaseRenewalLimit(error: unknown): boolean {
  if (vaultErrorStatusCode(error) !== httpStatusBadRequest) {
    return false;
  }
  return vaultErrorMessages(error).some((message) =>
    /lease.*maximum.*ttl|maximum.*ttl.*lease/i.test(message)
  );
}

function vaultErrorStatusCode(error: unknown): number | undefined {
  if (
    !error ||
    typeof error !== "object" ||
    !("response" in error) ||
    !error.response ||
    typeof error.response !== "object" ||
    !("statusCode" in error.response)
  ) {
    return undefined;
  }
  const statusCode = error.response.statusCode;
  return typeof statusCode === "number" ? statusCode : undefined;
}

function vaultErrorMessages(error: unknown): string[] {
  if (
    !error ||
    typeof error !== "object" ||
    !("response" in error) ||
    !error.response ||
    typeof error.response !== "object" ||
    !("body" in error.response)
  ) {
    return [];
  }
  const body = error.response.body;
  if (!body || typeof body !== "object" || !("errors" in body)) {
    return [];
  }
  const errors = body.errors;
  return Array.isArray(errors)
    ? errors.filter((message): message is string => typeof message === "string")
    : [];
}
