import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { logout } from "../auth/actions"; // Điều chỉnh lại đường dẫn import nếu cần

// Mocking dữ liệu người dùng để hiển thị trên trang Home
export default async function HomePage() {
  const supabase = await createClient();

  // Lấy thông tin user dựa vào httpOnly cookie được đính kèm tự động
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Đề phòng trường hợp lọt qua middleware, chặn lại một lần nữa
  if (error || !user) {
    redirect("/login");
  }

  const email = user.email;
  const fullName = user.user_metadata?.full_name || "Người dùng ToboMeet";
  const avatarUrl =
    user.user_metadata?.avatar_url ||
    `https://ui-avatars.com/api/?name=${fullName}&background=0052FF&color=fff`;

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
        {/* Phần Header trang trí */}
        <div className="h-32 bg-linear-to-r from-[#0052FF] to-[#00D4FF]"></div>

        <div className="px-8 pb-8">
          {/* Avatar nhô lên */}
          <div className="relative flex justify-center -mt-16 mb-4">
            <div className="h-32 w-32 rounded-full border-4 border-white overflow-hidden bg-white shadow-lg">
              {/* Lưu ý: Nếu dùng thẻ <Image /> của Next.js, bạn cần cấu hình domain trong next.config.ts */}
              {/* <Image
                width={128}
                height={128}
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              /> */}
            </div>
          </div>

          {/* Thông tin người dùng */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#0F172A]">{fullName}</h1>
            <p className="text-gray-500 font-medium">{email}</p>

            <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-100">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Đang trực tuyến
            </div>
          </div>

          <div className="space-y-3 mb-8">
            <div className="flex justify-between p-3 bg-gray-50 rounded-xl text-sm">
              <span className="text-gray-500">User ID</span>
              <span className="font-mono text-xs text-gray-700 truncate w-40 text-right">
                {user.id}
              </span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded-xl text-sm">
              <span className="text-gray-500">Đăng nhập lần cuối</span>
              <span className="text-gray-700 font-medium">
                {new Date(user.last_sign_in_at || "").toLocaleString("vi-VN")}
              </span>
            </div>
          </div>

          {/* Form gọi Server Action Logout */}
          <form action={logout}>
            <button
              type="submit"
              className="w-full bg-red-50 text-red-600 font-semibold py-3.5 rounded-full hover:bg-red-100 transition-colors border border-red-100 flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
