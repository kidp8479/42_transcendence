import {
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateUserRelationshipDto } from "./dto/create-user-relationship.dto";
import { UpdateUserRelationshipDto } from "./dto/update-user-relationship.dto";

@Injectable()
export class UserRelationshipsService {
  constructor() {
    
  }
}