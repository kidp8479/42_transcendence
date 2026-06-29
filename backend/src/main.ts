import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

/**
 * Entry point of the NestJS application.
 *
 * Flow of execution:
 * 1. bootstrap() is called manually to start the application
 * 2. NestFactory.create(AppModule) initializes the Nest application:
 *    - loads the root AppModule
 *    - sets up dependency injection container
 *    - registers all modules, controllers, and providers
 * 3. app.setGlobalPrefix('api'):
 *    - prefixes all routes with /api
 *    - example: GET /projects becomes GET /api/projects
 * 4. app.listen(PORT):
 *    - starts the HTTP server
 *    - begins listening for incoming requests
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
