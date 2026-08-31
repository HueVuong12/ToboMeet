import { IsArray, IsNotEmpty } from "class-validator";

export class SubmitAssignmentDto {
  @IsArray()
  @IsNotEmpty()
  attachments: any[];
}
