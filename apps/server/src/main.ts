import { NestFactory } from "@nestjs/core";
import ws from "ws";

// Polyfill WebSocket toàn cục cho Node.js v20 (để Supabase sử dụng)
globalThis.WebSocket = ws as any;

import { AppModule } from "./app.module";
import { TransformInterceptor } from "./core/interceptors/transform.interceptor";
import { GlobalExceptionFilter } from "./core/filters/global-exception.filter";
import * as express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Tự cấu hình lại bodyParser để nhận diện cả JSON thường và Webhook của LiveKit
  app.use(
    express.json({
      type: ["application/json", "application/webhook+json"],
      verify: (req: any, res, buf) => {
        req.rawBody = buf; // Chủ động gắn rawBody dạng Buffer
      },
    }),
  );

  app.use(express.urlencoded({ extended: true }));
  app.setGlobalPrefix("api");

  // Trong môi trường dev: cho phép mọi origin (bao gồm thiết bị mobile trên LAN)
  // Trong môi trường prod: chỉ cho phép các domain cụ thể trong CLIENT_URL (phân cách bằng dấu phẩy)
  const isDev = process.env.NODE_ENV !== "production";
  const allowedOrigins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(",").map((o) => o.trim())
    : ["http://localhost:3000"];

  app.enableCors({
    origin: isDev ? true : allowedOrigins,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders: "Content-Type,Authorization",
    credentials: true,
  });
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Backend đang chạy tại: http://localhost:${port}/api`);
}
bootstrap();
