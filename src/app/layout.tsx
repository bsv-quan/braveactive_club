import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brave Active — Cùng nhau năng động",
  description:
    "Thông báo hoạt động câu lạc bộ và đăng ký lịch cầu lông cùng Brave Active.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
