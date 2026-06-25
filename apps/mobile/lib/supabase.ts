import axios from 'axios';

const SUPABASE_URL = 'https://mxmxqllqxtudlrojrrtb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iyjKfCUYMkLZU00VzysFJw_T7eQgnXd';

const supabaseClient = axios.create({
  baseURL: `${SUPABASE_URL}/auth/v1`,
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  },
});

export const supabaseAuth = {
  /**
   * 1. Gửi email chứa mã OTP khôi phục mật khẩu (6 số)
   */
  async sendPasswordResetOtp(email: string): Promise<void> {
    try {
      await supabaseClient.post('/recover', { email });
    } catch (error: any) {
      const msg = error.response?.data?.error_description || error.message || 'Lỗi gửi mã OTP';
      throw new Error(msg);
    }
  },

  /**
   * 2. Xác thực OTP khôi phục mật khẩu, trả về access_token (phiên làm việc)
   */
  async verifyPasswordResetOtp(email: string, token: string): Promise<string> {
    try {
      const response = await supabaseClient.post('/verify', {
        email,
        token,
        type: 'recovery',
      });
      
      const accessToken = response.data?.access_token;
      if (!accessToken) {
        throw new Error('Không nhận được mã xác thực truy cập từ Supabase.');
      }
      return accessToken;
    } catch (error: any) {
      const msg = error.response?.data?.error_description || error.message || 'Mã OTP không hợp lệ hoặc đã hết hạn';
      throw new Error(msg);
    }
  },

  /**
   * 3. Đặt mật khẩu mới sử dụng access_token vừa nhận được
   */
  async updatePassword(accessToken: string, password: string): Promise<void> {
    try {
      await supabaseClient.put(
        '/user',
        { password },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
    } catch (error: any) {
      const msg = error.response?.data?.error_description || error.message || 'Cập nhật mật khẩu thất bại';
      throw new Error(msg);
    }
  },
};
