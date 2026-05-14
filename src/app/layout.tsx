import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nemotron × SweetSpot — 브랜드 서베이",
  description:
    "HuggingFace Nemotron Personas + Claude(Anthropic)로 일본 디저트 브랜드 서베이 시뮬레이션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
