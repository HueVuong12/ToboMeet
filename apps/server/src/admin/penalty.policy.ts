export interface Penalty {
  type: "WARNING" | "TEMPORARY" | "INDEFINITE";
  durationLabel: string;
  durationMs?: number; // millisecond duration for temporary locks
}

export const PENALTY_POLICY: Record<string, Penalty[]> = {
  spam: [
    { type: "WARNING", durationLabel: "Cảnh báo" },
    { type: "TEMPORARY", durationLabel: "12 giờ", durationMs: 12 * 60 * 60 * 1000 },
    { type: "TEMPORARY", durationLabel: "24 giờ", durationMs: 24 * 60 * 60 * 1000 },
  ],
  harassment: [
    { type: "TEMPORARY", durationLabel: "24 giờ", durationMs: 24 * 60 * 60 * 1000 },
    { type: "TEMPORARY", durationLabel: "7 ngày", durationMs: 7 * 24 * 60 * 60 * 1000 },
    { type: "INDEFINITE", durationLabel: "Vô thời hạn" },
  ],
  inappropriate_content: [
    { type: "TEMPORARY", durationLabel: "7 ngày", durationMs: 7 * 24 * 60 * 60 * 1000 },
    { type: "TEMPORARY", durationLabel: "30 ngày", durationMs: 30 * 24 * 60 * 60 * 1000 },
    { type: "INDEFINITE", durationLabel: "Vô thời hạn" },
  ],
  impersonation: [
    { type: "TEMPORARY", durationLabel: "30 ngày", durationMs: 30 * 24 * 60 * 60 * 1000 },
    { type: "INDEFINITE", durationLabel: "Vô thời hạn" },
  ],
  malware_fraud: [
    { type: "INDEFINITE", durationLabel: "Vô thời hạn" },
  ],
};

export function getPenalty(violationType: string, count: number): Penalty {
  const normalizedType = violationType.toLowerCase().replace(/\s+/g, "_");
  const penalties = PENALTY_POLICY[normalizedType] || [{ type: "WARNING", durationLabel: "Cảnh báo" }];
  
  // Lấy mức phạt tương ứng với số lần vi phạm (1-indexed). 
  // Nếu số lần vượt quá cấu hình, lấy mức phạt cuối cùng.
  const index = Math.max(0, count - 1);
  if (index >= penalties.length) {
    return penalties[penalties.length - 1];
  }
  return penalties[index];
}
