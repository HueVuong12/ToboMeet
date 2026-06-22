import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { User, UserDocument } from "./schemas/user.schema";
import { Model } from "mongoose";

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findOrCreate(supabaseUser: any): Promise<User> {
    const { id: supabaseId, email, user_metadata } = supabaseUser;

    // Kiểm tra user đã tồn tại chưa
    let user = await this.userModel.findOne({ supabaseId }).exec();

    // Nếu chưa, tạo mới
    if (!user) {
      user = new this.userModel({
        supabaseId,
        email,
        fullName: user_metadata?.full_name || user_metadata?.name || "",
      });
      await user.save();
    }

    return user;
  }
}
