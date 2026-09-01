import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  IsNumber,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class AttachmentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsNumber()
  @IsOptional()
  size?: number;

  @IsString()
  @IsOptional()
  type?: string;

  @IsDateString()
  @IsOptional()
  uploadedAt?: string;
}

export class CreateAssignmentDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsOptional()
  channelId?: string;

  @IsArray()
  @IsOptional()
  channelIds?: string[];

  @IsDateString()
  @IsOptional()
  deadline?: string;

  @IsEnum(["allow_late", "lock_after_deadline"])
  @IsOptional()
  submissionPolicy?: string;

  @IsEnum([
    "all_current_and_future",
    "current_members",
    "current_and_future_members",
    "specific_members",
  ])
  @IsOptional()
  recipientType?: string;

  @IsArray()
  @IsOptional()
  recipientMemberIds?: string[];

  @IsEnum(["graded", "ungraded"])
  @IsOptional()
  gradingType?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxScore?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  attachments?: AttachmentDto[];

  @IsEnum(["draft", "published"])
  status: string;
}
