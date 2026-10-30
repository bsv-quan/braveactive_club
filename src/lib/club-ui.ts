export const weekdayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const weekdayLong = [
  "Thứ Hai",
  "Thứ Ba",
  "Thứ Tư",
  "Thứ Năm",
  "Thứ Sáu",
  "Thứ Bảy",
  "Chủ Nhật",
];

export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDate(
  date: Date,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat("vi-VN", options).format(date);
}

export function categoryColor(category: string) {
  if (category === "CẦU LÔNG") return "coral";
  if (category === "TỪ THIỆN") return "violet";
  return "green";
}
