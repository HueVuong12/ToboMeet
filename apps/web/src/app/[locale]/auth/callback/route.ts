import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  // Lấy URL hiện tại và bóc tách các tham số mà Facebook/Google trả về
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Nếu có tham số 'next' trên URL (ví dụ: muốn chuyển về /vi sau khi login), nếu không thì mặc định về /vi
  const next = searchParams.get("next") ?? "/";

  const localeMatch = next.match(/^\/(vi|en)/);
  const locale = localeMatch ? localeMatch[1] : "vi";

  // Nếu Facebook/Google có trả về mã 'code'
  if (code) {
    const supabase = await createClient();

    // Đổi mã code lấy Session.
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const errorMessage = encodeURIComponent(
    "Xác thực thất bại, vui lòng thử lại.",
  );

  return NextResponse.redirect(
    `${origin}/${locale}/login?error=${errorMessage}`,
  );
}
