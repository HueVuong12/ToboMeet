import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

export class QuizOptionDto {
  @IsString()
  @IsNotEmpty()
  _id: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsBoolean()
  @IsOptional()
  isCorrect?: boolean;
}

export class QuizQuestionDto {
  @IsString()
  @IsNotEmpty()
  _id: string;

  @IsEnum(["choice", "text"])
  questionType: "choice" | "text";

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  points?: number;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  shuffleOptions?: boolean;

  @IsBoolean()
  @IsOptional()
  allowMultiple?: boolean;

  /** Chỉ cần thiết khi questionType = "choice" */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  @IsOptional()
  @ArrayMinSize(2)
  options?: QuizOptionDto[];
}

export class QuizSettingsDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  timeLimitMinutes?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  passScore?: number;

  @IsBoolean()
  @IsOptional()
  shuffleQuestions?: boolean;

  @IsBoolean()
  @IsOptional()
  showResultsAfterSubmit?: boolean;

  @IsBoolean()
  @IsOptional()
  acceptingResponses?: boolean;

  @IsBoolean()
  @IsOptional()
  allowMultipleAttempts?: boolean;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  closeDate?: string;

  @IsEnum(["anyone", "organization", "specific_members"])
  @IsOptional()
  accessControl?: "anyone" | "organization" | "specific_members";
}

export class QuizAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  selectedOptionIds?: string[];

  @IsString()
  @IsOptional()
  textAnswer?: string;
}
