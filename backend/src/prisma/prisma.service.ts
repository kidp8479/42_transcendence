// PrismaService: manages the connection to the database
// used by every other service that needs to read or write data

// Injectable: tells NestJS this service can be shared with other files
// OnModuleInit: interface that lets us run code when the app starts up
import { Injectable, OnModuleInit } from "@nestjs/common";

// PrismaClient: the main Prisma class, contains all the methods to talk to the database
// (ex: prisma.user.findMany(), prisma.task.create()...)
import { PrismaClient } from "@prisma/client";

// @Injectable(): marks this class as a NestJS service that can be injected elsewhere
@Injectable()
// extends PrismaClient: PrismaService inherits all database methods from PrismaClient
// implements OnModuleInit: NestJS will automatically call onModuleInit() on startup
export class PrismaService extends PrismaClient implements OnModuleInit {
  // NestJS calls this method automatically when the application starts
  // async/await: $connect() takes time (network call), so we wait for it to finish
  async onModuleInit() {
    await this.$connect(); // opens the connection to the PostgreSQL database
  }
}
