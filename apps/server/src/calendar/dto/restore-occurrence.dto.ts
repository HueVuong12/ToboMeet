import { IsNotEmpty, IsString } from "class-validator";

export class RestoreOccurrenceDto {
  @IsNotEmpty({ message: "Ngày khôi phục không được để trống" })
  @IsString({ message: "Ngày khôi phục phải là chuỗi ký tự" })
  occurrenceDate: string;
}
