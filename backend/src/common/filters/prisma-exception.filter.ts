// Catches Prisma's raw database errors (ex: unique constraint violation, record not
// found via a bad FK) and translates them into clean HTTP responses, instead of every
// service having to catch and translate the same Prisma error codes by hand.

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
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

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
