// AppModule: the root module of the application, the entry point NestJS loads first
// every module that needs to run must be registered here in "imports"

import { Module } from "@nestjs/common";

// import each feature module so NestJS knows it exists
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { ProjectMembersModule } from "./project-members/project-members.module";
import { ProjectsModule } from "./projects/projects.module";
import { DiscoveryBlocksModule } from "./discovery-blocks/discovery-blocks.module";
import { DiscoveryBlockItemsModule } from "./discovery-block-items/discovery-block-items.module";
import { EvaluationChecklistItemsModule } from "./evaluation-checklist-items/evaluation-checklist-items.module";

@Module({
  imports: [
    PrismaModule, // registers all modules, NestJS starts them in order at boot
    UsersModule,
    ProjectMembersModule,
    ProjectsModule,
    DiscoveryBlocksModule,
    DiscoveryBlockItemsModule,
    EvaluationChecklistItemsModule,
  ],
  controllers: [], // top-level controllers (most are declared inside their own module)
  providers: [], // top-level services (same as above)
})
export class AppModule {}
