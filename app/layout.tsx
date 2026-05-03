import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { QueryProvider } from "@/components/providers/QueryProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Career Compass | 대학생 진로 캘린더",
  description:
    "컨퍼런스, 자격증 시험, 채용박람회, 공모전 일정을 한눈에 확인하는 대학생 진로 캘린더",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <QueryProvider>
          <Header />
          <main className="flex-1 flex">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
