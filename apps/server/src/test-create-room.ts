import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { RoomsService } from "./rooms/rooms.service";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const roomsService = app.get(RoomsService);

  console.log("Testing createRoom...");
  try {
    const result = await roomsService.createRoom("test-owner-id-123", {
      name: "Test Room From Script",
      type: "meeting",
    });
    console.log("Success! Room created:", result);
  } catch (error) {
    console.error("Error creating room:", error);
  } finally {
    await app.close();
  }
}
bootstrap();
