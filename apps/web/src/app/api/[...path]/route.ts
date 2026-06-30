import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const NESTJS_BASE_URL =
  process.env.NESTJS_BASE_URL || "http://localhost:3001/api";

// handleProxy — proxy các yêu cầu HTTP từ Next.js sang backend NestJS
// Mục đích: chuyển tiếp (forward) mọi request tới một URL backend (NESTJS_BASE_URL) giữ nguyên method,
// headers và body, rồi trả về response cho client.
async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const resolvedParams = await params;
  const path = resolvedParams.path.join("/");
  const targetUrl = `${NESTJS_BASE_URL}/${path}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  let body = undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    const contentType = response.headers.get("Content-Type") || "application/json";
    const data = await response.text();

    // Nếu backend trả về HTML (lỗi 502/504/...) nhưng client expect JSON,
    // trả về lỗi JSON rõ ràng thay vì để client parse thất bại
    const isJsonContentType = contentType.includes("application/json");
    const looksLikeHtml = data.trimStart().startsWith("<");

    if (!isJsonContentType || looksLikeHtml) {
      return NextResponse.json(
        {
          code: response.status,
          message: `Backend trả về phản hồi không hợp lệ (status ${response.status})`,
          result: null,
        },
        { status: response.status >= 200 && response.status < 600 ? response.status : 502 },
      );
    }

    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("Lỗi Proxy:", error);
    return NextResponse.json(
      {
        code: 503,
        message: "Không thể kết nối tới Backend",
        result: null,
      },
      { status: 503 },
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
