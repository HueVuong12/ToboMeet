import { IsArray, IsEnum, IsIn } from "class-validator";
import { WhiteboardAccessRole, WhiteboardPermissionLevel } from "@tobomeet/shared/types";

export class UpdateWhiteboardSettingsDto {
  @IsArray()
  @IsIn(["admin", "member", "guest"], { each: true })
  allowedRoles: WhiteboardAccessRole[];

  @IsEnum(["view", "edit"] as const)
  memberPermission: WhiteboardPermissionLevel;

  @IsEnum(["view", "edit"] as const)
  guestPermission: WhiteboardPermissionLevel;
}
