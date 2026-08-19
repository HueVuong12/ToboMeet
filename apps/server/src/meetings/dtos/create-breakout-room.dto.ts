import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

// Validate cho từng phòng phụ
export class CreateBreakoutRoomDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  maxParticipants?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedUsers?: string[];
}

// Validate cho toàn bộ Payload gửi lên khi Start Breakout
export class StartBreakoutSessionDto {
  @IsArray()
  @ArrayMinSize(1) // Bắt buộc phải chia ít nhất 1 phòng
  @ValidateNested({ each: true })
  @Type(() => CreateBreakoutRoomDto)
  rooms: CreateBreakoutRoomDto[];
}
