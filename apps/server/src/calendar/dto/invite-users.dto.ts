import { IsArray, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { InviteeDto } from "./create-event.dto";

export class InviteUsersDto {
  @IsOptional()
  @IsArray()
  userIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InviteeDto)
  invitees?: InviteeDto[];
}
