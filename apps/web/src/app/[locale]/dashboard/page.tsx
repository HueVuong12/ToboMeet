"use client";
import StoreProvider from "@/lib/redux/StoreProvider";
import DashboardContent from "@/components/dashboard/DashboardContent";
import { useGetMyRoomsQuery } from "@/lib/redux/api/roomsApi";

export default function DashboardPage() {
  const { data: initialRooms } = useGetMyRoomsQuery();
  return (
    <StoreProvider>
      <DashboardContent initialRooms={initialRooms} />
    </StoreProvider>
  );
}
