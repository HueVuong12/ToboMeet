import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const NESTJS_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function handleProxy(
  request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Ví dụ: Client gọi /api/users/me -> NestJS nhận /users/me
  const path = params.path.join("/");
  const targetUrl = `${NESTJS_BASE_URL}/${path}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host"); // Bắt buộc xóa host cũ để tránh lỗi cấu hình máy chủ

  // Rút Token từ Cookie và chuyển thành Bearer Header gửi cho NestJS
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  let body = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text(); // Lấy raw text để chuyển tiếp an toàn nhất
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    const data = await response.text();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (error) {
    console.error("Lỗi Proxy:", error);
    return NextResponse.json(
      { message: "Lỗi kết nối tới Backend" },
      { status: 500 },
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
