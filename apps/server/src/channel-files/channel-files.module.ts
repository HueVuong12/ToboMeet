import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ChannelFilesController } from "./channel-files.controller";
import { ChannelFilesService } from "./channel-files.service";
import { ChannelFile, ChannelFileSchema } from "./schemas/channel-file.schema";
import { UserPinnedFile, UserPinnedFileSchema } from "./schemas/user-pinned-file.schema";
import { Room, RoomSchema } from "../rooms/schemas/room.schema";
import { User, UserSchema } from "../users/schemas/user.schema";
import { SupabaseModule } from "../supabase/supabase.module";
import { RoomsModule } from "../rooms/rooms.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChannelFile.name, schema: ChannelFileSchema },
      { name: UserPinnedFile.name, schema: UserPinnedFileSchema },
      { name: Room.name, schema: RoomSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SupabaseModule,
    RoomsModule,
  ],
  controllers: [ChannelFilesController],
  providers: [ChannelFilesService],
  exports: [ChannelFilesService],
})
export class ChannelFilesModule {}
