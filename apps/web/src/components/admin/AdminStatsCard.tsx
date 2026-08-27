"use client";

import React from "react";

interface AdminStatsCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
}

export default function AdminStatsCard({
  title,
  value,
  icon,
  gradient,
}: AdminStatsCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200`}
    >
      <div className="absolute right-4 top-4 opacity-15">
        <div className="p-3 bg-white rounded-xl">
          {icon}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
          {title}
        </span>
        <span className="text-3xl font-extrabold tracking-tight">
          {value}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-1.5 text-xs text-white/80">
        <div className="p-1 bg-white/10 rounded-lg">
          {icon}
        </div>
        <span>ToBoMeet System</span>
      </div>
    </div>
  );
}
