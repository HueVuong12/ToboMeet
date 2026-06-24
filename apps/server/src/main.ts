import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { TransformInterceptor } from "./core/interceptors/transform.interceptor";
import { GlobalExceptionFilter } from "./core/filters/global-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");
  app.enableCors({
    origin: process.env.CLIENT_URL || "http://localhost:3000", // Trỏ về domain của Next.js
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
  });
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Backend đang chạy tại: http://localhost:${port}/api`);
}
bootstrap();
