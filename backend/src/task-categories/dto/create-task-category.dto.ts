import { 
  IsNumber, 
  IsString 
} from "class-validator";

export class CreateTaskCategoryDto {
  @IsString()
  name: string;
  
  @IsNumber()
  color: number;
}
