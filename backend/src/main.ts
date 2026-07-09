import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";

// Entry point of the NestJS application.
// Flow: bootstrap() => NestFactory.create(AppModule) => setGlobalPrefix => Swagger => listen
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Adds security-related HTTP response headers (ex: blocks MIME-sniffing,
  // disables framing to prevent clickjacking) - cheap, no config needed for defaults
  app.use(helmet());

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

  // Swagger: reads the code and generates interactive API docs automatically
  // once active, go to /api/docs in the browser to see and test all endpoints
  // gated out of production: it lists every route and expected request shape,
  // which is exactly what an attacker scanning a public API wants handed to them
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("42 Projects Planner API")
      .setDescription("API documentation for the 42 Projects Planner app")
      .setVersion("1.0")
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  // ConfigService reads from the same validated, typed config as envValidationSchema
  // (see app.module.ts) instead of raw process.env - PORT is guaranteed to exist here
  // because the schema gives it a default, so app startup already failed above if
  // any *required* variable (ex: DATABASE_URL) was missing.
  const configService = app.get(ConfigService);
  await app.listen(configService.get<number>("PORT")!);
}
bootstrap();
