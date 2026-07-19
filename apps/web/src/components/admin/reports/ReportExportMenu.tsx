"use client";

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { AdminReportFilters, AdminReportExportRow } from "@/lib/redux/api/adminApi";
import { useLazyExportAdminReportsQuery } from "@/lib/redux/api/adminApi";
import { useTranslations } from "next-intl";

interface Props {
  filters: AdminReportFilters;
}

function toCSV(rows: AdminReportExportRow[]): string {
  if (!rows.length) return "";
  const headers = [
    "ID", "Tiêu đề", "Loại", "Mô tả", "Trạng thái", "Kết luận",
    "Email người báo cáo", "Tên người báo cáo",
    "Email bị báo cáo", "Tên bị báo cáo",
    "Phòng họp", "Bằng chứng",
    "Thời gian tạo", "Thời gian xử lý", "Thời gian đóng",
  ];
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((r) =>
      [
        r.id, r.title, r.reason, r.description, r.status, r.conclusion,
        r.reporterEmail, r.reporterName,
        r.reportedEmail, r.reportedName,
        r.roomName, r.hasEvidence,
        r.createdAt, r.resolvedAt, r.closedAt,
      ]
        .map(escape)
        .join(","),
    ),
  ];
  return "\uFEFF" + lines.join("\n"); // BOM for Excel UTF-8
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function cleanVietnameseTones(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x00-\x7F]/g, ""); // Remove non-ASCII
}

async function exportToPDF(rows: AdminReportExportRow[]) {
  // Dynamically import jspdf and autoTable
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape" });

  doc.setFontSize(14);
  doc.text("Bao cao vi pham - ToboMeet", 14, 16);
  doc.setFontSize(9);
  doc.text(`Xuat ngay: ${new Date().toLocaleString("vi-VN")}`, 14, 23);

  autoTable(doc, {
    startY: 28,
    head: [
      ["ID", "Loai Bao Cao", "Trang Thai", "Nguoi Bao Cao", "Nguoi Bi Bao Cao", "Phong Hop", "Thoi Gian"],
    ],
    body: rows.map((r) => [
      cleanVietnameseTones(r.id.slice(-8)),
      cleanVietnameseTones(r.reason),
      cleanVietnameseTones(r.status),
      `${cleanVietnameseTones(r.reporterName)}\n${cleanVietnameseTones(r.reporterEmail)}`,
      `${cleanVietnameseTones(r.reportedName)}\n${cleanVietnameseTones(r.reportedEmail)}`,
      cleanVietnameseTones(r.roomName || "—"),
      new Date(r.createdAt).toLocaleDateString("vi-VN"),
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [0, 85, 255], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const filename = `tobomeet_baocao_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}

export default function ReportExportMenu({ filters }: Props) {
  const t = useTranslations("admin.reports");
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "json" | "pdf" | null>(null);
  const [fetchExport] = useLazyExportAdminReportsQuery();

  const handleExport = async (format: "csv" | "json" | "pdf") => {
    setExporting(format);
    setOpen(false);
    try {
      const result = await fetchExport(filters).unwrap();
      const date = new Date().toISOString().split("T")[0];

      if (format === "csv") {
        downloadFile(toCSV(result), `tobomeet_baocao_${date}.csv`, "text/csv;charset=utf-8;");
      } else if (format === "json") {
        downloadFile(
          JSON.stringify(result, null, 2),
          `tobomeet_baocao_${date}.json`,
          "application/json",
        );
      } else if (format === "pdf") {
        await exportToPDF(result);
      }
    } catch (e) {
      console.error("Export failed", e);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={!!exporting}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        {exporting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        {exporting ? t("exporting") : t("export_data")}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50">
            <button
              onClick={() => handleExport("csv")}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              {t("export_csv")}
            </button>
            <button
              onClick={() => handleExport("json")}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-4 h-4 text-blue-500" />
              {t("export_json")}
            </button>
            <button
              onClick={() => handleExport("pdf")}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileText className="w-4 h-4 text-red-500" />
              {t("export_pdf")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
