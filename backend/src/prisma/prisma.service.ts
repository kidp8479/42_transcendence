// PrismaService: manages the connection to the database
// used by every other service that needs to read or write data

// Injectable: tells NestJS this service can be shared with other files
// OnModuleInit: interface that lets us run code when the app starts up
// OnModuleDestroy: interface that lets us run code when the app shuts down
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";

// PrismaClient: the main Prisma class, contains all the methods to talk to the database
// (ex: prisma.user.findMany(), prisma.task.create()...)
import { PrismaClient } from "@prisma/client";

// @Injectable(): marks this class as a NestJS service that can be injected elsewhere
@Injectable()
// extends PrismaClient: PrismaService inherits all database methods from PrismaClient
// implements OnModuleInit: NestJS will automatically call onModuleInit() on startup
// implements OnModuleDestroy: NestJS will automatically call onModuleDestroy() on shutdown
// (only fires if app.enableShutdownHooks() is called in main.ts)
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // NestJS calls this method automatically when the application starts
  // async/await: $connect() takes time (network call), so we wait for it to finish
  async onModuleInit() {
    await this.$connect(); // opens the connection to the PostgreSQL database
  }

  // NestJS calls this method automatically when the application shuts down
  // (ex: SIGTERM from Docker on container stop/restart) - releases the Postgres
  // connection cleanly instead of letting it hang until the OS kills it
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
