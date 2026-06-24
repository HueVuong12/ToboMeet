import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body('email') email: string) {
    if (!email) {
      throw new Error('Email is required');
    }
    await this.authService.sendForgotPasswordEmail(email);
    return { message: 'OTP sent to email successfully' };
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body('email') email: string, @Body('code') code: string) {
    if (!email || !code) {
      throw new Error('Email and code are required');
    }
    const isValid = await this.authService.verifyOtp(email, code);
    return { valid: isValid };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body('email') email: string,
    @Body('code') code: string,
    @Body('password') password: string
  ) {
    if (!email || !code || !password) {
      throw new Error('Email, code, and new password are required');
    }
    await this.authService.resetPassword(email, code, password);
    return { message: 'Password reset successfully' };
  }
}
