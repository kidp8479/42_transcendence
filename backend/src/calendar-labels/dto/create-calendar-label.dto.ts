import { IsNumber, IsString } from "class-validator";

export class CreateCalendarLabelDto {
  @IsString()
  name: string;

  @IsNumber()
  color: number;
}
