// AppModule: the root module of the application, the entry point NestJS loads first
// every module that needs to run must be registered here in "imports"

import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ConfigModule } from "@nestjs/config";
import { envValidationSchema } from "./config/env.validation";
import { PrismaExceptionFilter } from "./common/filters/prisma-exception.filter";

// import each feature module so NestJS knows it exists
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ProjectMembersModule } from "./project-members/project-members.module";
import { ProjectsModule } from "./projects/projects.module";
import { DiscoveryBlocksModule } from "./discovery-blocks/discovery-blocks.module";
import { DiscoveryBlockItemsModule } from "./discovery-block-items/discovery-block-items.module";
import { EvaluationChecklistItemsModule } from "./evaluation-checklist-items/evaluation-checklist-items.module";
import { TasksModule } from "./tasks/tasks.module";
import { TaskCategoriesModule } from "./task-categories/task-categories.module";
import { CalendarEventsModule } from "./calendar-events/calendar-events.module";
import { CalendarCategoriesModule } from "./calendar-categories/calendar-categories.module";

@Module({
  imports: [
    // reads process.env once at boot, validates it against envValidationSchema, and
    // makes the result available app-wide (isGlobal) via ConfigService. If a required
    // variable is missing/malformed, the app refuses to start with a clear error
    // instead of failing later with a cryptic one deep inside Prisma or elsewhere.
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    // global rate limit: max 100 requests per 60s per IP, applied to every route
    // via the APP_GUARD below - protects against brute-force and basic spam/DoS
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule, // registers all modules, NestJS starts them in order at boot
    UsersModule,
    NotificationsModule,
    ProjectMembersModule,
    ProjectsModule,
    DiscoveryBlocksModule,
    DiscoveryBlockItemsModule,
    EvaluationChecklistItemsModule,
    TasksModule,
    TaskCategoriesModule,
    CalendarEventsModule,
    CalendarCategoriesModule,
  ],
  controllers: [], // top-level controllers (most are declared inside their own module)
  providers: [
    // applies ThrottlerModule's rate limit globally, to every route in the app
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // TODO (hard blocker before the first real route handler ships): add the auth
    // team's guard here too, ex: { provide: APP_GUARD, useClass: AuthGuard } - see
    // src/auth/auth.guard.ts. Multiple APP_GUARD entries all run, in order, so this
    // can be added alongside ThrottlerGuard without replacing it.

    // translates raw Prisma errors (ex: unique constraint violation, record not
    // found) into clean HTTP responses (409, 404, ...) globally, instead of every
    // service catching and mapping the same Prisma error codes by hand
    {
      provide: APP_FILTER,
      useClass: PrismaExceptionFilter,
    },
  ],
})
export class AppModule {}
