import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BMTI · Better Me Type Indicator",
  description: "了解自己，探索边界，成为更好的自己。",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
