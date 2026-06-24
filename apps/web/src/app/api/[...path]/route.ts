import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const NESTJS_BASE_URL =
  process.env.NESTJS_BASE_URL || "http://localhost:3001/api";

// handleProxy — proxy các yêu cầu HTTP từ Next.js sang backend NestJS
// Mục đích: chuyển tiếp (forward) mọi request tới một URL backend (NESTJS_BASE_URL) giữ nguyên method,
// headers và body, rồi trả về response cho client.
async function handleProxy(
  request: NextRequest,
  { params }: { params: { path: string[] } },
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
