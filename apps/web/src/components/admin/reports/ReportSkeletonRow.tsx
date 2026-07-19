"use client";

export default function ReportSkeletonRow() {
  return (
    <tr className="border-b border-slate-100 animate-pulse">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-slate-100 rounded-md" style={{ width: `${60 + (i % 3) * 20}%` }} />
        </td>
      ))}
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <div className="h-7 w-16 bg-slate-100 rounded-lg" />
        </div>
      </td>
    </tr>
  );
}

export function ReportStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 space-y-3">
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-8 bg-slate-100 rounded w-1/2" />
          <div className="h-3 bg-slate-100 rounded w-full" />
        </div>
      ))}
    </div>
  );
}

export function ReportChartSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 animate-pulse">
      <div className="h-5 bg-slate-100 rounded w-40 mb-6" />
      <div className="h-48 bg-slate-50 rounded-xl" />
    </div>
  );
}
