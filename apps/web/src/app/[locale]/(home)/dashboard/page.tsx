"use client";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { useGetMyRoomsQuery } from "@/lib/redux/api/roomsApi";
import { useGetMeQuery } from "@/lib/redux/api/usersApi";

export default function DashboardPage() {
  useGetMeQuery();
  const { data: initialRooms } = useGetMyRoomsQuery();
  return <DashboardContent initialRooms={initialRooms} />;
}
