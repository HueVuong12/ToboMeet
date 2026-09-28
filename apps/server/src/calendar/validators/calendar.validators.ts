import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from "class-validator";

/**
 * Validator kiểm tra thời gian phải ở tương lai (lớn hơn thời điểm hiện tại)
 */
export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isFutureDate",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (!value) return true;
          const d = new Date(value);
          return !isNaN(d.getTime()) && d.getTime() > Date.now();
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} phải sau thời gian hiện tại`;
        },
      },
    });
  };
}

/**
 * Validator kiểm tra ngày này phải diễn ra sau một trường ngày khác (ví dụ: endDate > startDate)
 */
export function IsAfterDate(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isAfterDate",
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as Record<string, any>)[relatedPropertyName];
          if (!value || !relatedValue) return true;
          const end = new Date(value);
          const start = new Date(relatedValue);
          return (
            !isNaN(end.getTime()) &&
            !isNaN(start.getTime()) &&
            end.getTime() > start.getTime()
          );
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} phải sau ${args.constraints[0]}`;
        },
      },
    });
  };
}
