import { HttpException } from "@nestjs/common";
import { ErrorDetail } from "@tobomeet/shared/types";

export class AppException extends HttpException {
  private readonly errorDetail: ErrorDetail;

  constructor(errorDetail: ErrorDetail) {
    const safeError = errorDetail || {
      code: 5000,
      message: "Đã có lỗi hệ thống xảy ra",
      statusCode: 500,
    };
    super(safeError.message, safeError.statusCode);
    this.errorDetail = safeError;
  }

  getErrorDetail(): ErrorDetail {
    return this.errorDetail;
  }
}
