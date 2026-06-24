import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Otp, OtpDocument } from './schemas/otp.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;
  private supabase: SupabaseClient;

  constructor(
    @InjectModel(Otp.name) private otpModel: Model<OtpDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('SMTP_PORT', 465),
      secure: true,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl && supabaseServiceKey) {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    } else {
      console.warn("SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations will fail.");
    }
  }

  async sendForgotPasswordEmail(email: string): Promise<void> {
    if (!this.supabase) {
      throw new InternalServerErrorException("Cấu hình Supabase Admin bị thiếu trên Server.");
    }

    // Dùng generateLink của Supabase Admin API để vừa kiểm tra email có tồn tại hay không,
    // vừa lấy được thông tin user.id của Supabase (mà không gửi email mặc định của Supabase).
    const { data, error: linkError } = await this.supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
    });

    if (linkError || !data?.user) {
      throw new NotFoundException("Không tìm thấy người dùng với email này");
    }

    const supabaseId = data.user.id;

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    await this.otpModel.findOneAndUpdate(
      { email },
      { code: otpCode, expiresAt, supabaseId },
      { upsert: true, new: true }
    );

    // FIRE-AND-FORGET: Gửi email ở background, không dùng await để tránh làm chậm phản hồi API
    this.transporter.sendMail({
      from: `"ToboMeet" <${this.configService.get('SMTP_USER')}>`,
      to: email,
      subject: 'Yêu cầu đặt lại mật khẩu',
      html: `
        <h2>Yêu cầu đặt lại mật khẩu</h2>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng nhập mã OTP gồm 6 chữ số dưới đây vào ứng dụng:</p>
        <h1 style="font-size: 36px; letter-spacing: 5px; color: #0052FF;">${otpCode}</h1>
        <p>Mã này sẽ hết hạn sau 5 phút.</p>
        <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
      `,
    }).catch(error => {
      // Chỉ log lỗi ở Server, không làm gián đoạn luồng của User
      console.error("Lỗi khi gửi email OTP (Background Task):", error);
    });
  }

  async verifyOtp(email: string, code: string): Promise<boolean> {
    const otpDoc = await this.otpModel.findOne({ email, code });
    if (!otpDoc) {
      throw new BadRequestException("Mã xác minh không chính xác hoặc đã hết hạn.");
    }
    
    if (otpDoc.expiresAt < new Date()) {
      await this.otpModel.deleteOne({ _id: otpDoc._id });
      throw new BadRequestException("Mã xác minh đã hết hạn.");
    }

    return true;
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    const otpDoc = await this.otpModel.findOne({ email, code });
    if (!otpDoc) {
      throw new BadRequestException("Mã xác minh không chính xác hoặc đã hết hạn.");
    }
    
    if (otpDoc.expiresAt < new Date()) {
      await this.otpModel.deleteOne({ _id: otpDoc._id });
      throw new BadRequestException("Mã xác minh đã hết hạn.");
    }

    if (!otpDoc.supabaseId) {
      throw new InternalServerErrorException("Không tìm thấy ID người dùng trong phiên bản OTP này.");
    }

    if (!this.supabase) {
      throw new InternalServerErrorException("Cấu hình Supabase Admin bị thiếu trên Server.");
    }

    const { error } = await this.supabase.auth.admin.updateUserById(
      otpDoc.supabaseId,
      { password: newPassword }
    );

    if (error) {
      throw new InternalServerErrorException(`Lỗi khi đổi mật khẩu: ${error.message}`);
    }

    await this.otpModel.deleteOne({ email, code });
  }
}
