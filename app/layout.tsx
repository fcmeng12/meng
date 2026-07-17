import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "见山 A 股雷达｜行情研究与候选池",
  description: "中文 A 股行情概览、多因子候选池与盘前盘中盘后分析。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
