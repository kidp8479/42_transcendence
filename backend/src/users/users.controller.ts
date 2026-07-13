import { Controller, Get, Req } from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  findMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.findById(request.user.id);
  }
}
