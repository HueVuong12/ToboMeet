"use client";

import { useGetMeQuery } from "@/lib/redux/features/users/usersApi";

export default function TestPage() {
  const { data, error, isLoading } = useGetMeQuery();
  console.log("error:", error);
  console.log("data:", data);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4 font-sans">
      <h1>test call API</h1>
    </div>
  );
}
