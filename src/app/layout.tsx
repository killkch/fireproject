import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "🏎️ Harbor Steel Racing - Firebase Leaderboard",
  description: "Harbor Steel 디자인 기반 실시간 Firebase 리더보드 자동차 레이싱 게임",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full dark">
      <body className="min-h-full flex flex-col bg-[#121622] text-[#e2e4e9] antialiased selection:bg-[#c59b4c] selection:text-[#121622]">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
