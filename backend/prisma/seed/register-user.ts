import { PrismaClient } from "@prisma/client";

// the Go auth service rate-limits /auth/register to 20 requests per IP per
// rolling 60s window (auth/internal/server/server.go's registerIPLimiter) -
// seeding more than that in a tight loop trips it, so this pauses just past
// the window once the limit is reached instead of registering all seed
// users in one burst. Kept at module scope so the window carries over
// across seed files instead of resetting each time.
const REGISTER_REQUESTS_PER_MINUTE = 20;
let registrationsInCurrentWindow = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// register a user through the real Go auth service (not prisma.user.create)
// so the account is actually loggable - auth.register() creates the User row
// itself, plus the AuthIdentity/PasswordCredential rows the seed has no
// business writing to directly (argon2id hashing lives in the auth service).
// AUTH_SERVICE_URL comes from docker-compose env (internal network address,
// ex: http://auth:3001) - Origin must match APP_ORIGIN or the auth service
// rejects the request (same check a real browser request goes through).
export function seedRequestOrigin(
  configuredOrigin = process.env.APP_ORIGIN ?? "https://localhost:8443"
): string {
  const origin = new URL(configuredOrigin);
  if (origin.hostname.startsWith("*.")) {
    origin.hostname = `seed.${origin.hostname.slice(2)}`;
    return origin.origin;
  }
  return configuredOrigin;
}

export async function registerSeedUser(
  prisma: PrismaClient,
  email: string,
  username: string,
  password: string
): Promise<string> {
  if (registrationsInCurrentWindow >= REGISTER_REQUESTS_PER_MINUTE) {
    await sleep(61_000);
    registrationsInCurrentWindow = 0;
  }
  registrationsInCurrentWindow = registrationsInCurrentWindow + 1;

  const res = await fetch(`${process.env.AUTH_SERVICE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: seedRequestOrigin(),
    },
    body: JSON.stringify({ email, username, password }),
  });

  if (res.status === 201) {
    const body = await res.json();
    return body.user.id as string;
  }

  // re-running the seed: this email is already registered - look up the
  // existing user instead of failing (register() never upserts, it always
  // tries to create)
  if (res.status === 409 || res.status === 400) {
    const existing = await prisma.user.findUniqueOrThrow({ where: { email } });
    return existing.id;
  }

  throw new Error(
    `auth register failed for ${email}: ${res.status} ${await res.text()}`
  );
}
