import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { PublicApiModule } from "./public-api/public-api.module";
import { VaultRuntimeService } from "./vault/vault-runtime.service";
import { setNoStoreForSensitiveApi } from "./common/no-store-sensitive-api";

// Entry point of the NestJS application.
// Flow: bootstrap() => NestFactory.create(AppModule) => setGlobalPrefix => Swagger => listen
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Adds security-related HTTP response headers (ex: blocks MIME-sniffing,
  // disables framing to prevent clickjacking) - cheap, no config needed for defaults
  app.use(helmet());
  app.use(setNoStoreForSensitiveApi);

  // Listens for shutdown signals (ex: SIGTERM sent by Docker on container stop/restart)
  // and calls onModuleDestroy() on every service that implements it - without this,
  // PrismaService.onModuleDestroy() (which closes the Postgres connection) never runs
  app.enableShutdownHooks();

  // Global validation pipe:
  // -validates incoming request bodies against dto decorators
  app.useGlobalPipes(
    new ValidationPipe({
      // only properties defined in the dto are allowed
      whitelist: true,
      // returns 400 Bad Request if client sends extra properties
      forbidNonWhitelisted: true,
      // converts request payloads into instances of dto classes and enables type transformation
      transform: true,
    })
  );

  // prefix all routes with /api (ex: /projects becomes /api/projects)
  app.setGlobalPrefix("api");

  // ConfigService reads from the same validated, typed config as envValidationSchema
  // (see app.module.ts) instead of raw process.env - PORT is guaranteed to exist here
  // because the schema gives it a default, so app startup already failed above if
  // any required configuration was missing.
  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>("NODE_ENV") === "production";

  // Production docs are an intentional public API contract: include only its
  // module and credential scheme. Non-production docs retain the complete
  // internal surface for development and integration troubleshooting.
  const swaggerConfig = new DocumentBuilder()
    .setTitle("42 Project Planner API")
    .setDescription("API documentation for the 42 Project Planner app.")
    .setVersion("1.0")
    .addApiKey(
      {
        type: "apiKey",
        in: "header",
        name: "X-API-Key",
        description:
          "Project API token. Created tokens are revealed exactly once; never send one in a URL.",
      },
      "project-api-key"
    );

  if (!isProduction) {
    swaggerConfig
      .addBearerAuth(
        {
          description: "Default JWT Authorization",
          type: "http",
          in: "header",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        "access-token"
      )
      .addSecurityRequirements("access-token");
  }

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    swaggerConfig.build(),
    isProduction ? { include: [PublicApiModule] } : undefined
  );

  if (!isProduction) {
    app.getHttpAdapter().get(
      "/api/docs/session-token.js",
      (
        _request: unknown,
        response: {
          type: (value: string) => { send: (body: string) => void };
        }
      ) => {
        response
          .type("application/javascript")
          .send(
            developmentSwaggerSessionButtonScript(
              configService.get<string>("AUTH_CSRF_COOKIE")!
            )
          );
      }
    );
  }

  SwaggerModule.setup(
    "api/docs",
    app,
    swaggerDocument,
    isProduction ? undefined : { customJs: "/api/docs/session-token.js" }
  );

  const vaultRuntime = app.get(VaultRuntimeService);
  void vaultRuntime.waitForFatal().catch(async (error: Error) => {
    console.error(error.message);
    await app.close();
    process.exit(1);
  });
  await app.listen(configService.get<number>("PORT")!);
}
bootstrap();

function developmentSwaggerSessionButtonScript(csrfCookieName: string): string {
  return `
let swaggerSessionButtonAttempts = 0;
const mountSwaggerSessionButton = () => {
  const information = document.querySelector(".swagger-ui .information-container");
  if (!information) {
    swaggerSessionButtonAttempts += 1;
    if (swaggerSessionButtonAttempts < 100) {
      window.setTimeout(mountSwaggerSessionButton, 50);
    }
    return;
  }
  if (document.getElementById("swagger-session-token")) {
    return;
  }

  const container = document.createElement("div");
  container.id = "swagger-session-token";
  container.style.margin = "16px 0";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Load current-session JWT";
  button.style.marginRight = "8px";

  const status = document.createElement("span");
  status.textContent = "Sign in through the app first.";

  button.addEventListener("click", async () => {
      const csrfCookie = document.cookie
        .split("; ")
        .find((cookie) => cookie.startsWith(${JSON.stringify(csrfCookieName)} + "="));
      const csrfToken = csrfCookie?.slice(${JSON.stringify(csrfCookieName)}.length + 1);

      if (!csrfToken) {
        status.textContent = "No signed-in session. Sign in through the app first.";
        return;
      }

      button.disabled = true;
      status.textContent = "Refreshing session...";

      try {
        const response = await fetch("/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "X-CSRF-Token": decodeURIComponent(csrfToken),
          },
        });
        const body = await response.json();

        if (!response.ok || typeof body.accessToken !== "string") {
          throw new Error(body.message || "Session refresh failed.");
        }

        window.ui.authActions.authorize({
          "access-token": {
            name: "access-token",
            schema: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
            value: body.accessToken,
          },
        });
        status.textContent = "Loaded a new 15-minute access token.";
      } catch (error) {
        status.textContent = error instanceof Error
          ? error.message
          : "Session refresh failed.";
      } finally {
        button.disabled = false;
      }
  });

  container.append(button, status);
  information.append(container);
};

if (document.readyState === "complete") {
  mountSwaggerSessionButton();
} else {
  window.addEventListener("load", mountSwaggerSessionButton, {once: true});
}
`;
}
