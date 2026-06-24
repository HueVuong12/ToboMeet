import { HttpException } from "@nestjs/common";
import { ErrorDetail } from "@tobomeet/shared/types";

export class AppException extends HttpException {
  private readonly errorDetail: ErrorDetail;

  constructor(errorDetail: ErrorDetail) {
    super(errorDetail.message, errorDetail.statusCode);
    this.errorDetail = errorDetail;
  }

  getErrorDetail(): ErrorDetail {
    return this.errorDetail;
  }
}
