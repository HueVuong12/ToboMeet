import { IsIn, IsNotEmpty } from "class-validator";
import { CalendarRSVPStatus } from "@tobomeet/shared/types";

export class UpdateRsvpDto {
  @IsNotEmpty({ message: "Trạng thái phản hồi không được để trống" })
  @IsIn(["ACCEPTED", "DECLINED", "TENTATIVE"], {
    message: "Trạng thái phản hồi phải là ACCEPTED, DECLINED hoặc TENTATIVE",
  })
  status: CalendarRSVPStatus;
}
