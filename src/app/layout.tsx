import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { getSiteUrl } from "@/lib/site-url";

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const title = "계좌 연동 없이 CSV로 쓰는 가계부 | Finsight";
const description =
  "계좌 연동이나 마이데이터 인증 없이, CSV 명세서 업로드만으로 지출을 자동 분류하고 월별 추이를 확인하는 개인 가계부 Finsight.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: title,
    template: "%s | Finsight",
  },
  description,
  openGraph: {
    title,
    description,
    siteName: "Finsight",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} ${jetBrainsMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
