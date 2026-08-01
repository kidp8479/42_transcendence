import { Body, Controller, Get, Patch, Delete, Req } from "@nestjs/common";
import { ApiSecurity } from "@nestjs/swagger";
import type { AuthenticatedRequest } from "../auth/authenticated-request";
import { UsersService } from "./users.service";
// import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  findMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.findById(request.user.id);
  }

  @ApiSecurity("csrf")
  @Patch("me")
  update(@Body() dto: UpdateUserDto, @Req() request: AuthenticatedRequest) {
    return this.usersService.update(request.user.id, dto);
  }

  @ApiSecurity("csrf")
  @Delete("me")
  remove(@Req() request: AuthenticatedRequest) {
    return this.usersService.remove(request.user.id);
  }
}
