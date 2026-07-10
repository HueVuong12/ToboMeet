import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { RoomsService } from "./rooms/rooms.service";
import { getModelToken } from "@nestjs/mongoose";
import { User } from "./users/schemas/user.schema";
import { Model } from "mongoose";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const roomsService = app.get(RoomsService);
  const userModel = app.get<Model<any>>(getModelToken(User.name));

  console.log("Fetching all users from Mongoose DB...");
  const users = await userModel.find().exec();
  console.log(`Found ${users.length} users.`);

  for (const user of users) {
    console.log(`Testing room creation for user: ${user.email} (id: ${user.supabaseId})`);
    try {
      const result = await roomsService.createRoom(user.supabaseId, {
        name: "Test Room For " + (user.displayName || user.email),
        type: "meeting",
      });
      console.log(`Success for ${user.email}! Room ID: ${result._id}`);
    } catch (error: any) {
      console.error(`FAILED for ${user.email}:`, error);
    }
  }

  await app.close();
}
bootstrap();
