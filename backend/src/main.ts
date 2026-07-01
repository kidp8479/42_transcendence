import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";

// Entry point of the NestJS application.
// Flow: bootstrap() => NestFactory.create(AppModule) => setGlobalPrefix => Swagger => listen
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // prefix all routes with /api (ex: /projects becomes /api/projects)
  app.setGlobalPrefix("api");

  // Swagger: reads the code and generates interactive API docs automatically
  // once active, go to /api/docs in the browser to see and test all endpoints
  const config = new DocumentBuilder()
    .setTitle("42 Projects Planner API")
    .setDescription("API documentation for the 42 Projects Planner app")
    .setVersion("1.0")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
