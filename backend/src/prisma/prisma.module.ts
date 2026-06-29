// PrismaModule: registers PrismaService with NestJS and makes it available across the app
// a NestJS module is a closed box by default, nothing inside is accessible from outside

// Module: the decorator that turns a class into a NestJS module
// Global: makes this module available everywhere without importing it in every other module
import { Module, Global } from "@nestjs/common";

// import the service this module is responsible for
import { PrismaService } from "./prisma.service";

// @Global(): every other module in the app can use PrismaService without importing PrismaModule
@Global()
// @Module(): configures the box, what it creates, and what it shares
// a decorator always applies to the class that immediately follows it
@Module({
  providers: [PrismaService], // "providers": NestJS creates and manages PrismaService here
  exports: [PrismaService], // "exports": opens a hole in the box so others can use it
})
export class PrismaModule {} // the box itself, body is empty because all config is in @Module above
