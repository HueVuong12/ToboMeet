import { IsDateString, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class GetEventsDto {
  @IsNotEmpty({ message: "Thời gian bắt đầu tìm kiếm không được để trống" })
  @IsDateString({}, { message: "Thời gian bắt đầu tìm kiếm không đúng định dạng" })
  start: string;

  @IsNotEmpty({ message: "Thời gian kết thúc tìm kiếm không được để trống" })
  @IsDateString({}, { message: "Thời gian kết thúc tìm kiếm không đúng định dạng" })
  end: string;

  @IsOptional()
  @IsString()
  roomId?: string;

  @IsOptional()
  @IsString()
  createdByMe?: string;
}
