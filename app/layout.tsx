import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sapharchem Solutions Library",
  description:
    "Thư viện giải pháp, nguyên liệu, chứng nhận và tài liệu kỹ thuật Sapharchem.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
