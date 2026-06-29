import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import { Model } from "mongoose";

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async getOrCreateUser(tokenPayload): Promise<User> {
    const userId = tokenPayload.id || tokenPayload.sub;
    const email = tokenPayload.email;
    const metadata = tokenPayload.user_metadata || {};

    let user = await this.userModel.findOne({ supabaseId: userId });

    if (!user) {
      user = await this.userModel.create({
        supabaseId: userId,
        email: email,
        displayName: metadata.full_name,
        avatarUrl: metadata.avatar_url,
      });
      console.log(`Đã tạo mới user: ${email}`);
    }
    // Cập nhật lại tên/avatar nếu họ đổi từ Google/Facebook
    else if (
      user.displayName !== metadata.full_name ||
      user.avatarUrl !== metadata.avatar_url
    ) {
      user.displayName = metadata.full_name || user.displayName;
      user.avatarUrl = metadata.avatar_url || user.avatarUrl;
      await user.save();
      console.log(`Đã cập nhật user: ${email}`);
    }

    return user;
  }
}
