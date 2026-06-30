// AppModule: the root module of the application, the entry point NestJS loads first
// every module that needs to run must be registered here in "imports"

import { Module } from "@nestjs/common";

// import each feature module so NestJS knows it exists
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./projects/projects.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    PrismaModule, // registers all modules, NestJS starts them in order at boot
    ProjectsModule,
    UsersModule,
  ],
  controllers: [], // top-level controllers (most are declared inside their own module)
  providers: [], // top-level services (same as above)
})
export class AppModule {}
