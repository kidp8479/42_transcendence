// Catches Prisma's raw database errors (ex: unique constraint violation, record not
// found via a bad FK) and translates them into clean HTTP responses, instead of every
// service having to catch and translate the same Prisma error codes by hand.
//
// TWO Prisma error classes, handled separately on purpose:
//   - PrismaClientKnownRequestError - the database answered and refused. It carries
//     a `code`, which is what the table below maps.
//   - PrismaClientValidationError - the query never reached the database: the
//     arguments didn't match the schema. No code, so nothing to map, and it means
//     the request body was wrong -> 400.
// Only the first was caught until TR-49, so a PATCH carrying an explicit null on a
// non-nullable column came back as a raw 500 (see UpdateTaskDto's comment). The DTOs
// are the real fix, one module at a time; this is the net underneath them.

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { Prisma } from "@prisma/client";

// maps Prisma error codes (https://pris.ly/d/prisma-schema-error-reference) to HTTP status
const PRISMA_ERROR_STATUS: Record<string, HttpStatus> = {
  P2002: HttpStatus.CONFLICT, // unique constraint violation (ex: duplicate email)
  P2025: HttpStatus.NOT_FOUND, // record to update/delete/connect doesn't exist
  P2003: HttpStatus.BAD_REQUEST, // foreign key constraint violation (ex: bad projectId)
  P2034: HttpStatus.CONFLICT, // serializable transaction conflict; client can retry
};

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(
    exception:
      Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientValidationError) {
      // Deliberately NOT forwarding exception.message: unlike a known request
      // error, it renders the whole Prisma call with its arguments reconstructed,
      // which leaks the schema and whatever the caller sent. Logged, not served.
      console.error("Prisma rejected the query arguments", exception);
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: "Invalid request data",
      });
      return;
    }

    const status =
      PRISMA_ERROR_STATUS[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR;

    response.status(status).json({
      statusCode: status,
      // exception.meta often holds useful context (ex: which field violated a unique
      // constraint) - safe to expose, it never contains raw query/connection details
      message: exception.message.split("\n").pop()?.trim() ?? exception.message,
      code: exception.code,
    });
  }
}
