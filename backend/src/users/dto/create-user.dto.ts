// A DTO (Data Transfer Object) is just a description of the shape of the data you expect to receive.
// It's a simple object that says "when someone sends me data, it must look like this."
// DTOs only exist for routes that receive data in their body (POST, PATCH).
// GET and DELETE don't need one, they only use URL params, nothing in the body.

// THIS FILE IS PREPARED, NOT CONFIRMED - there is no POST /api/users route in UsersController yet.
// user creation may end up handled entirely by the auth service (writing to the DB directly),
// in which case this DTO (and a create() method) may never be used from this backend.
// whether/how to wire this up is the auth team's call - kept ready here in case they need it.

import { IsEmail, IsOptional, IsString } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  username: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
