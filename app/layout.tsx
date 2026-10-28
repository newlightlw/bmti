import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "同行画像 · HGP | HereToo",
  description: "认识你的成长偏好，找到更适合自己的同行方式。",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
